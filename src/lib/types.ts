// Shared TypeScript types mirroring the Prisma schema (for client use)

export type OrderStatus =
  | 'open'
  | 'sent'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'billed'
  | 'paid'

export type ItemStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled'

export type TableStatus = 'available' | 'occupied'

export type PaymentMode = 'cash' | 'card' | 'upi' | 'other'

export interface MenuItem {
  id: string
  name: string
  category: string
  price: number
  cost: number
  stock: number
  unit: string
  image?: string | null
  available: boolean
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  orderId: string
  menuItemId: string
  name: string
  price: number
  quantity: number
  status: ItemStatus
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  tableId: string
  status: OrderStatus
  type: 'dine_in' | 'takeaway' | 'direct'
  guests: number
  waiterName?: string | null
  customerName?: string | null
  notes?: string | null
  kotPrinted: boolean
  billPrinted: boolean
  createdAt: string
  updatedAt: string
  items?: OrderItem[]
  table?: RestaurantTable
  bill?: Bill | null
}

export interface RestaurantTable {
  id: string
  number: number
  name: string
  capacity: number
  status: TableStatus
  currentOrderId?: string | null
  currentOrder?: Order | null
  createdAt: string
  updatedAt: string
}

export interface Bill {
  id: string
  billNo: number
  orderId: string
  tableNumber: number
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  serviceCharge: number
  total: number
  paymentMode: PaymentMode
  paymentStatus: string
  paidAt: string
  createdAt: string
  order?: Order
}

// Socket payload types
export interface KOTPayload {
  orderId: string
  tableNumber: number
  tableName: string
  type: 'dine_in' | 'takeaway'
  guests: number
  waiterName?: string | null
  notes?: string | null
  items: OrderItem[]
  createdAt: string
  isUpdate?: boolean
}

export interface ItemStatusPayload {
  orderId: string
  itemId: string
  status: ItemStatus
  tableNumber: number
}

export interface OrderStatusPayload {
  orderId: string
  status: OrderStatus
  tableNumber: number
}

export interface TablePayload {
  tableId: string
  tableNumber: number
  orderId?: string
}

// ─── Management entities ───
export interface Customer {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Supplier {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Purchase {
  id: string
  invoiceNumber: string
  supplierId?: string | null
  supplierName?: string | null
  subtotal: number
  taxAmount: number
  total: number
  paymentMode: string
  notes?: string | null
  items: string // JSON string
  createdAt: string
}

export interface Expense {
  id: string
  category: string
  description: string
  amount: number
  paymentMode: string
  date: string
  createdAt: string
}

export interface MoneyIn {
  id: string
  amount: number
  source: string
  description?: string | null
  partyName?: string | null
  paymentMode: string
  date: string
  createdAt: string
}

export interface MoneyOut {
  id: string
  amount: number
  purpose: string
  description?: string | null
  partyName?: string | null
  paymentMode: string
  date: string
  createdAt: string
}

export interface AppUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'staff' | 'kitchen'
  active: boolean
  createdAt: string
}

export interface ShopSettings {
  id: string
  shopName: string
  address?: string | null
  phone?: string | null
  email?: string | null
  gstin?: string | null
  taxRate: number
  serviceRate: number
  currency: string
  invoicePrefix: string
  kotPrefix: string
  footerNote: string
}

export interface DashboardData {
  today: { revenue: number; count: number; expenses: number; purchases: number }
  month: { revenue: number; count: number }
  allTime: { revenue: number; count: number }
  catalog: { menuItems: number; customers: number; suppliers: number }
  tables: { occupied: number; total: number }
  chartData: Array<{ date: string; total: number }>
  topItems: Array<{ name: string; qty: number; revenue: number }>
  recentBills: Array<Bill & { order: { items: OrderItem[] } }>
  lowStock: MenuItem[]
  cashFlow: {
    salesIn: number
    otherIn: number
    expenses: number
    purchases: number
    otherOut: number
    net: number
  }
}

// ─── Zomato Order ───
export type ZomatoStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'dispatched' | 'delivered' | 'cancelled'

export interface ZomatoOrder {
  id: string
  zomatoOrderId: string
  customerName: string
  customerPhone?: string | null
  deliveryType: 'delivery' | 'pickup'
  address?: string | null
  items: string // JSON
  subtotal: number
  taxAmount: number
  packagingCharge: number
  deliveryFee: number
  discount: number
  total: number
  paymentMode: 'prepaid' | 'cod'
  status: ZomatoStatus
  notes?: string | null
  internalOrderId?: string | null
  createdAt: string
  updatedAt: string
}
