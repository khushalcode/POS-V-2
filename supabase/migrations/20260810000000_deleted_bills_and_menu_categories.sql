-- ============================================================================
-- ServingSync POS — Migration: Deleted Bills archive + MenuCategory table
-- ============================================================================
-- Purpose:
--   1. Add a `DeletedBill` table that captures a full snapshot of a bill
--      at the moment it is voided (deleted). The dashboard / reports read
--      this table to expose a "Deleted Bill Amount" metric and to subtract
--      that amount from net cash flow.
--   2. Add a `MenuCategory` table for per-shop, user-manageable menu
--      categories (replaces the hardcoded list in MenuPage.tsx).
--
-- Attribution rule:
--   Deletions are attributed to the day the bill was ORIGINALLY PAID
--   (originalPaidAt), not the day it was deleted. So a bill paid on
--   Monday but voided on Tuesday still appears in Monday's report.
--
-- Compatibility:
--   • Safe to re-run (uses CREATE TABLE IF NOT EXISTS / CREATE INDEX
--     IF NOT EXISTS).
--   • Does NOT alter the existing Bill table — deleted bills are simply
--     removed from Bill and a snapshot is inserted into DeletedBill.
-- ============================================================================

-- ─── 1. DeletedBill ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DeletedBill" (
  "id"                TEXT PRIMARY KEY,
  "shopId"            TEXT NOT NULL,
  "originalBillId"    TEXT NOT NULL,
  "billNo"            INTEGER NOT NULL,
  "orderId"           TEXT NOT NULL,
  "tableNumber"       INTEGER NOT NULL,
  "subtotal"          REAL NOT NULL DEFAULT 0,
  "taxRate"           REAL NOT NULL DEFAULT 0,
  "taxAmount"         REAL NOT NULL DEFAULT 0,
  "discount"          REAL NOT NULL DEFAULT 0,
  "serviceCharge"     REAL NOT NULL DEFAULT 0,
  "total"             REAL NOT NULL,
  "paymentMode"       TEXT NOT NULL DEFAULT 'cash',
  "paymentStatus"     TEXT NOT NULL DEFAULT 'paid',
  "originalPaidAt"    TIMESTAMP(3) NOT NULL,
  "originalCreatedAt" TIMESTAMP(3) NOT NULL,
  "reason"            TEXT,
  "deletedBy"         TEXT,
  "deletedById"       TEXT,
  "deletedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeletedBill_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_deletedbill_shop_deletedAt"
  ON "DeletedBill"("shopId", "deletedAt");

CREATE INDEX IF NOT EXISTS "idx_deletedbill_shop_originalPaidAt"
  ON "DeletedBill"("shopId", "originalPaidAt");

CREATE INDEX IF NOT EXISTS "idx_deletedbill_deletedById"
  ON "DeletedBill"("deletedById");


-- ─── 2. MenuCategory ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MenuCategory" (
  "id"        TEXT PRIMARY KEY,
  "shopId"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "color"     TEXT NOT NULL DEFAULT 'slate',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MenuCategory_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_menucategory_shop_name"
  ON "MenuCategory"("shopId", "name");

CREATE INDEX IF NOT EXISTS "idx_menucategory_shop_sort"
  ON "MenuCategory"("shopId", "sortOrder");


-- ─── 3. Seed default categories for every existing shop ────────────────────
--     (New shops get them on first GET /api/menu-categories, but existing
--      shops created before this migration would otherwise see an empty
--      list. We insert defaults here so the dropdown is never blank.)
INSERT INTO "MenuCategory" ("id", "shopId", "name", "color", "sortOrder", "createdAt", "updatedAt")
SELECT
  -- generate_cuid() is provided by Supabase / Postgres extensions; if it
  -- is not available, replace with gen_random_uuid()::text or any other
  -- unique string generator.
  COALESCE(
    NULLIF(current_setting('app.cuid_fn', true), ''),
    'cat_' || "Shop"."id" || '_'
  ) || ROW_NUMBER() OVER () AS "id",
  "Shop"."id" AS "shopId",
  v."name",
  v."color",
  v."sortOrder",
  NOW(),
  NOW()
FROM "Shop"
CROSS JOIN (
  VALUES
    ('Starters',     'amber',  0),
    ('Main Course',  'rose',   1),
    ('Breads',       'orange', 2),
    ('Beverages',    'sky',    3),
    ('Desserts',     'violet', 4),
    ('General',      'slate',  5)
) AS v("name", "color", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1 FROM "MenuCategory" mc
  WHERE mc."shopId" = "Shop"."id" AND mc."name" = v."name"
);

-- NOTE: The seed block above uses a portable id-generation trick. If your
-- Supabase project has the `cuid` or `pgcrypto` extension enabled, you can
-- simplify the id expression to either `cuid()` or `gen_random_uuid()::text`.
-- The COALESCE/NULLIF dance is just a safe fallback that produces unique
-- ids without requiring any extension.


-- ─── 4. Enable Row Level Security on the new tables ────────────────────────
--     (Mirrors whatever RLS policy you have on Bill/MenuItem. Adjust to
--      match your project's auth model — these stubs allow authenticated
--      users full access, which is the typical POS setup.)
ALTER TABLE "DeletedBill"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuCategory"  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Drop-and-create so this migration is idempotent.
  DROP POLICY IF EXISTS "DeletedBill_select_authenticated" ON "DeletedBill";
  DROP POLICY IF EXISTS "DeletedBill_insert_authenticated" ON "DeletedBill";
  DROP POLICY IF EXISTS "DeletedBill_update_authenticated" ON "DeletedBill";
  DROP POLICY IF EXISTS "DeletedBill_delete_authenticated" ON "DeletedBill";

  DROP POLICY IF EXISTS "MenuCategory_select_authenticated" ON "MenuCategory";
  DROP POLICY IF EXISTS "MenuCategory_insert_authenticated" ON "MenuCategory";
  DROP POLICY IF EXISTS "MenuCategory_update_authenticated" ON "MenuCategory";
  DROP POLICY IF EXISTS "MenuCategory_delete_authenticated" ON "MenuCategory";

  CREATE POLICY "DeletedBill_select_authenticated" ON "DeletedBill"
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "DeletedBill_insert_authenticated" ON "DeletedBill"
    FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "DeletedBill_update_authenticated" ON "DeletedBill"
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "DeletedBill_delete_authenticated" ON "DeletedBill"
    FOR DELETE TO authenticated USING (true);

  CREATE POLICY "MenuCategory_select_authenticated" ON "MenuCategory"
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "MenuCategory_insert_authenticated" ON "MenuCategory"
    FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "MenuCategory_update_authenticated" ON "MenuCategory"
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "MenuCategory_delete_authenticated" ON "MenuCategory"
    FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS policies skipped: %', SQLERRM;
END $$;


-- ─── 5. Verification (informational — safe to ignore in CI) ────────────────
-- SELECT 'DeletedBill'  AS table_name, COUNT(*) AS rows FROM "DeletedBill"
-- UNION ALL
-- SELECT 'MenuCategory' AS table_name, COUNT(*) AS rows FROM "MenuCategory";
