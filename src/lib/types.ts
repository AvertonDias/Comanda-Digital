export type RestaurantUser = {
  id: string; // Corresponds to Firebase Auth UID
  restaurantId: string;
  name: string;
  email: string;
  role: 'admin' | 'waiter';
  avatarUrl?: string;
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
  // ingredients: string[]; // This can be added later if needed for filters
};

export type OrderStatus = 'aberto' | 'preparando' | 'pronto' | 'finalizado' | 'cancelado';

export type OrderItem = {
  id: string;
  menuItemId: string;
  name: string; // Stored at time of order
  quantity: number;
  priceAtOrder: number; // Stored at time of order
  notes?: string;
};

export type Order = {
  id: string;
  restaurantId: string;
  tableId?: string;
  tableName?: string; // Denormalized for quick display
  customerId?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  origin: 'mesa' | 'whatsapp' | 'balcao' | 'telefone';
  destination: 'local' | 'retirada' | 'entrega';
  createdAt: any; // Firestore Timestamp
  closedAt?: any; // Firestore Timestamp
};

export type TableStatus = 'livre' | 'ocupada' | 'fechando';

export type Table = {
  id: string;
  name: string;
  status: TableStatus;
  restaurantId: string;
  qrCodeUrl: string;
};

export type Customer = {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  lastOrderId?: string;
  totalOrders: number;
  createdAt: any; // Firestore Timestamp
};

    