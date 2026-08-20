import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/menu-categories/[id] — rename and/or recolor a category.
// When renaming, also updates all menu items that referenced the old name
// so the change propagates to existing items.
// Body: { name?: string, color?: string, sortOrder?: number }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const existing = await db.menuCategory.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  const newName = body?.name != null ? body.name.toString().trim() : null
  const newColor = body?.color != null ? body.color.toString() : null
  const newSort = typeof body?.sortOrder === 'number' ? body.sortOrder : null

  // If renaming, make sure the new name doesn't collide with another category.
  if (newName && newName !== existing.name) {
    const dup = await db.menuCategory.findFirst({
      where: { shopId: existing.shopId, name: newName, NOT: { id } },
    })
    if (dup) {
      return NextResponse.json({ error: 'Another category already has that name' }, { status: 409 })
    }
  }

  const updated = await db.menuCategory.update({
    where: { id },
    data: {
      ...(newName && { name: newName }),
      ...(newColor && { color: newColor }),
      ...(newSort != null && { sortOrder: newSort }),
    },
  })

  // Propagate rename to existing menu items so their category label stays in sync.
  if (newName && newName !== existing.name) {
    await db.menuItem.updateMany({
      where: { shopId: existing.shopId, category: existing.name },
      data: { category: newName },
    })
  }

  return NextResponse.json({ category: updated })
}

// DELETE /api/menu-categories/[id] — delete a category.
// All menu items in the deleted category are reassigned to "General"
// (which is created if it doesn't exist) so no item is left orphaned.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const existing = await db.menuCategory.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  // Find or create the "General" fallback category for this shop.
  let general = await db.menuCategory.findFirst({
    where: { shopId: existing.shopId, name: 'General' },
  })
  if (!general) {
    general = await db.menuCategory.create({
      data: { shopId: existing.shopId, name: 'General', color: 'slate', sortOrder: 999 },
    })
  }

  // Reassign all menu items in the about-to-be-deleted category to "General".
  // We update the string `category` field on MenuItem (not a foreign key),
  // so a plain updateMany is enough.
  await db.menuItem.updateMany({
    where: { shopId: existing.shopId, category: existing.name },
    data: { category: 'General' },
  })

  await db.menuCategory.delete({ where: { id } })

  return NextResponse.json({ ok: true, reassignedTo: 'General' })
}
