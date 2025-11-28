import { User } from './types';

export const CATEGORIES = [
  'Mercearia',
  'Bebidas',
  'Limpeza',
  'Higiene',
  'Hortifruti',
  'Padaria',
  'Açougue',
  'Frios e Laticínios',
  'Outros'
];

export const UNITS = [
  'UN', // Unidade
  'KG', // Quilograma
  'L',  // Litro
  'CX', // Caixa
  'PCT', // Pacote
  'M',  // Metro
];

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Gerente Carlos', role: 'admin' },
  { id: '2', name: 'Func. Ana', role: 'employee' },
  { id: '3', name: 'Caixa João', role: 'cashier' },
];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
