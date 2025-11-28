
export type UserRole = 'admin' | 'employee' | 'cashier';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  barcode: string;
  qty: number;
  minQty: number;
  costPrice: number;
  sellPrice: number;
  unit: string;
  supplierId: string;
  imageUrl?: string;
}

export interface Supplier {
  id: string;
  name: string;
  cnpj: string;
  contactName: string;
  representativeName?: string; // New field for Sales Representative
  phone: string;
  email: string;
  address: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'in' | 'out' | 'adjustment' | 'sale';
  qty: number;
  date: string; // ISO string
  userId: string;
  userName: string;
  observation?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  status: 'open' | 'sent' | 'received';
  dateCreated: string;
  items: { productId: string; qty: number; cost: number }[];
}

export interface SaleItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalValue: number;
  paymentMethod: 'cash' | 'credit' | 'debit' | 'pix';
  date: string;
  userId: string;
  userName: string;
}

export type SecurityAction = 'delete_product' | 'cancel_sale' | 'remove_item_pos' | 'manual_adjustment' | 'change_price' | 'user_management';

export interface SecurityLog {
  id: string;
  action: SecurityAction;
  description: string;
  userId: string;
  userName: string;
  authorizedBy?: string; // If manager override was used
  timestamp: string;
}

export interface AppState {
  users: User[];
  products: Product[];
  suppliers: Supplier[];
  movements: StockMovement[];
  orders: PurchaseOrder[];
  sales: Sale[];
  securityLogs: SecurityLog[];
  currentUser: User | null;
  adminPin: string; // For manager overrides
}