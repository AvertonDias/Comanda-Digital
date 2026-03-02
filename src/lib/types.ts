export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'Admin' | 'Garçom';
};

export type MenuItemCategory = 'Lanches' | 'Pizzas' | 'Saladas' | 'Sobremesas' | 'Bebidas';

export type MenuItem = {
  id: string;
  name:string;
  description: string;
  price: number;
  category: MenuItemCategory;
  imageUrl: string;
  imageHint: string;
  ingredients: string[];
  sector: 'Cozinha' | 'Bar' | 'Sobremesa';
};

export type OrderStatus = 'Aberto' | 'Preparando' | 'Pronto' | 'Finalizado' | 'Cancelado';

export type OrderItem = {
  menuItemId: string;
  quantity: number;
  name: string;
  price: number;
};

export type Order = {
  id: string;
  tableId: string;
  tableName: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: Date;
};

export type Table = {
  id: string;
  name: string;
  status: 'Livre' | 'Ocupada';
  qrCodeUrl: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  orderHistory: string[];
};
