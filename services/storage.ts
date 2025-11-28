
import { AppState, Product, Supplier, StockMovement, PurchaseOrder } from '../types';

const STORAGE_KEY = 'MERCADO_FACIL_DB_V4';

const INITIAL_STATE: AppState = {
  currentUser: null,
  adminPin: '1234', // Default PIN for demo purposes
  users: [
    { id: '1', name: 'Gerente Carlos', role: 'admin' },
    { id: '2', name: 'Func. Ana', role: 'employee' },
    { id: '3', name: 'Caixa João', role: 'cashier' },
  ],
  products: [
    {
      id: 'p1', name: 'Arroz Branco 5kg', category: 'Mercearia', sku: 'ARR001', barcode: '7891234567890',
      qty: 45, minQty: 10, costPrice: 18.50, sellPrice: 24.90, unit: 'PCT', supplierId: 's1'
    },
    {
      id: 'p2', name: 'Refrigerante Cola 2L', category: 'Bebidas', sku: 'REF001', barcode: '7890000000001',
      qty: 8, minQty: 12, costPrice: 5.00, sellPrice: 9.50, unit: 'UN', supplierId: 's2'
    },
    {
      id: 'p3', name: 'Detergente Líquido', category: 'Limpeza', sku: 'LIMP01', barcode: '7890000000002',
      qty: 100, minQty: 20, costPrice: 1.50, sellPrice: 2.99, unit: 'UN', supplierId: 's1'
    },
    {
      id: 'p4', name: 'Feijão Carioca 1kg', category: 'Mercearia', sku: 'FEI002', barcode: '7891234567891',
      qty: 30, minQty: 15, costPrice: 6.50, sellPrice: 9.90, unit: 'PCT', supplierId: 's1'
    }
  ],
  suppliers: [
    { id: 's1', name: 'Distribuidora Aliança', cnpj: '12.345.678/0001-90', contactName: 'Roberto (Financeiro)', representativeName: 'Carlos Silva', phone: '(11) 99999-9999', email: 'vendas@alianca.com', address: 'Rua das Indústrias, 100, São Paulo - SP' },
    { id: 's2', name: 'Bebidas Express', cnpj: '98.765.432/0001-10', contactName: 'Fernanda (SAC)', representativeName: 'Mariana Costa', phone: '(11) 98888-8888', email: 'pedidos@bebidas.com', address: 'Av. do Estado, 500, São Paulo - SP' },
    { id: 's3', name: 'Hortifruti Frescor', cnpj: '45.123.789/0001-55', contactName: 'José (Gerente)', representativeName: 'Paulo Souza', phone: '(11) 97777-7777', email: 'contato@frescor.com', address: 'Estrada do Campo, km 12, Mogi das Cruzes - SP' }
  ],
  movements: [
    { id: 'm1', productId: 'p1', type: 'in', qty: 50, date: new Date(Date.now() - 86400000 * 5).toISOString(), userId: '1', userName: 'Gerente Carlos', observation: 'Estoque inicial' },
    { id: 'm2', productId: 'p2', type: 'in', qty: 20, date: new Date(Date.now() - 86400000 * 4).toISOString(), userId: '1', userName: 'Gerente Carlos', observation: 'Estoque inicial' },
    { id: 'm3', productId: 'p2', type: 'sale', qty: 2, date: new Date(Date.now() - 86400000 * 2).toISOString(), userId: '3', userName: 'Caixa João' },
    { id: 'm4', productId: 'p2', type: 'sale', qty: 5, date: new Date(Date.now() - 86400000 * 1).toISOString(), userId: '3', userName: 'Caixa João' }
  ],
  orders: [
    {
      id: 'o1',
      supplierId: 's2',
      status: 'received',
      dateCreated: new Date(Date.now() - 86400000 * 10).toISOString(),
      items: [{ productId: 'p2', qty: 20, cost: 5.00 }]
    },
    {
      id: 'o2',
      supplierId: 's1',
      status: 'open',
      dateCreated: new Date().toISOString(),
      items: [{ productId: 'p1', qty: 50, cost: 18.50 }, { productId: 'p4', qty: 30, cost: 6.50 }]
    }
  ],
  sales: [],
  securityLogs: []
};

export const getAppState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
    return INITIAL_STATE;
  }
  return JSON.parse(stored);
};

export const saveAppState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};