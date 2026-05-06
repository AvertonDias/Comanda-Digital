
export type UserProfile = {
  name: string;
  email: string;
  avatarUrl?: string;
  activeRestaurantId?: string;
};

export type RestaurantUserRole = {
    userId: string;
    restaurantId: string;
    role: 'admin' | 'waiter';
    isActive: boolean;
};

export type MenuItemCategory = {
  id: string;
  name: string;
  order: number;
};

export type PrintSector = {
  id: string;
  name: string;
  restaurantId: string;
}

export type PrinterConnectionType = 'network' | 'usb' | 'bluetooth';

export type Printer = {
  id: string;
  restaurantId: string;
  name: string;
  connectionType: PrinterConnectionType;
  address: string;
  printSectors: string[];
  isActive: boolean;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  isAvailable: boolean;
  categoryId: string;
  printSectorId: string;
  imageUrl: string;
  imageHint: string;
};

export type OrderStatus = 'aberto' | 'preparando' | 'pronto' | 'finalizado' | 'cancelado';
export type OrderItemStatus = 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado';

export type OrderItem = {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  priceAtOrder: number;
  notes?: string;
  status: OrderItemStatus;
  printSectorId: string;
};

export type Order = {
  id: string;
  restaurantId: string;
  tableId?: string;
  tableName?: string;
  customerId?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  origin: 'mesa' | 'whatsapp' | 'balcao' | 'telefone';
  destination: 'local' | 'retirada' | 'entrega';
  createdAt: any;
  closedAt?: any;
};

export type TableStatus = 'livre' | 'ocupada' | 'fechando';

export type Table = {
  id: string;
  name: string;
  status: TableStatus;
  restaurantId: string;
  qrCodeUrl: string;
  currentOrderId?: string;
};

export type Customer = {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  lastOrderId?: string;
  totalOrders: number;
  createdAt: any;
};
