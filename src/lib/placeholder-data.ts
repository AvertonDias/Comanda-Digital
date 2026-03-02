import type { MenuItem, Order, Table, RestaurantUser, MenuItemCategory, PrintSector } from '@/lib/types';
import { PlaceHolderImages } from './placeholder-images';

const getImage = (id: string) => {
    const img = PlaceHolderImages.find(p => p.id === id);
    return {
        imageUrl: img?.imageUrl || 'https://picsum.photos/seed/placeholder/400/300',
        imageHint: img?.imageHint || 'food plate'
    }
}

export const DUMMY_USER: Omit<RestaurantUser, 'id' | 'restaurantId' | 'isActive'> = {
    name: 'Admin',
    email: 'admin@comandadigital.com',
    avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
    role: 'admin',
};

export const DUMMY_PRINT_SECTORS: PrintSector[] = [
  { id: 'sector-1', name: 'Cozinha', restaurantId: 'rest-1'},
  { id: 'sector-2', name: 'Bar', restaurantId: 'rest-1'},
  { id: 'sector-3', name: 'Sobremesa', restaurantId: 'rest-1'},
]

export const DUMMY_CATEGORIES: MenuItemCategory[] = [
  { id: 'cat-1', name: 'Lanches', order: 1 },
  { id: 'cat-2', name: 'Pizzas', order: 2 },
  { id: 'cat-3', name: 'Saladas', order: 3 },
  { id: 'cat-4', name: 'Sobremesas', order: 4 },
  { id: 'cat-5', name: 'Bebidas', order: 5 },
]

export const DUMMY_MENU_ITEMS: (MenuItem & { categoryName: string })[] = [
  {
    id: 'item-1',
    name: 'Hambúrguer Clássico',
    description: 'Um suculento hambúrguer de 180g, queijo cheddar, alface, tomate e nosso molho especial no pão brioche.',
    price: 32.50,
    categoryId: 'cat-1',
    categoryName: 'Lanches',
    printSectorId: 'sector-1', // Cozinha
    isAvailable: true,
    ...getImage('cheeseburger'),
  },
  {
    id: 'item-2',
    name: 'Pizza Margherita',
    description: 'A clássica pizza italiana com molho de tomate fresco, muçarela de búfala e manjericão.',
    price: 45.00,
    categoryId: 'cat-2',
    categoryName: 'Pizzas',
    printSectorId: 'sector-1', // Cozinha
    isAvailable: true,
    ...getImage('margherita-pizza'),
  },
  {
    id: 'item-3',
    name: 'Salada Caesar',
    description: 'Alface romana fresca, croutons crocantes, lascas de parmesão e o tradicional molho Caesar.',
    price: 28.00,
    categoryId: 'cat-3',
    categoryName: 'Saladas',
    printSectorId: 'sector-1', // Cozinha
    isAvailable: true,
    ...getImage('caesar-salad'),
  },
  {
    id: 'item-4',
    name: 'Petit Gâteau',
    description: 'Bolo de chocolate com interior cremoso, servido quente com uma bola de sorvete de creme.',
    price: 22.00,
    categoryId: 'cat-4',
    categoryName: 'Sobremesas',
    printSectorId: 'sector-3', // Sobremesa
    isAvailable: true,
    ...getImage('chocolate-cake'),
  },
  {
    id: 'item-5',
    name: 'Mojito',
    description: 'Um coquetel refrescante feito com rum, hortelã, limão, açúcar e água com gás.',
    price: 25.00,
    categoryId: 'cat-5',
    categoryName: 'Bebidas',
    printSectorId: 'sector-2', // Bar
    isAvailable: true,
    ...getImage('mojito-cocktail'),
  },
  {
    id: 'item-6',
    name: 'Cappuccino Italiano',
    description: 'Café espresso, leite vaporizado e uma generosa camada de espuma de leite.',
    price: 12.00,
    categoryId: 'cat-5',
    categoryName: 'Bebidas',
    printSectorId: 'sector-2', // Bar
    isAvailable: true,
    ...getImage('cappuccino'),
  },
];

export const DUMMY_ORDERS: Order[] = [
  {
    id: 'order-1',
    restaurantId: 'rest-1',
    tableId: 'table-3',
    tableName: 'Mesa 03',
    items: [
      { id: 'oi-1', menuItemId: 'item-1', name: 'Hambúrguer Clássico', quantity: 2, priceAtOrder: 32.50 },
      { id: 'oi-2', menuItemId: 'item-5', name: 'Mojito', quantity: 2, priceAtOrder: 25.00 },
    ],
    total: 115.00,
    status: 'preparando',
    origin: 'mesa',
    destination: 'local',
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  },
  {
    id: 'order-2',
    restaurantId: 'rest-1',
    tableId: 'table-1',
    tableName: 'Mesa 01',
    items: [
      { id: 'oi-3', menuItemId: 'item-2', name: 'Pizza Margherita', quantity: 1, priceAtOrder: 45.00 },
    ],
    total: 45.00,
    status: 'aberto',
    origin: 'mesa',
    destination: 'local',
    createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
  },
  {
    id: 'order-3',
    restaurantId: 'rest-1',
    tableId: 'table-5',
    tableName: 'Mesa 05',
    items: [
      { id: 'oi-4', menuItemId: 'item-3', name: 'Salada Caesar', quantity: 1, priceAtOrder: 28.00 },
      { id: 'oi-5', menuItemId: 'item-6', name: 'Cappuccino Italiano', quantity: 1, priceAtOrder: 12.00 },
    ],
    total: 40.00,
    status: 'pronto',
    origin: 'mesa',
    destination: 'local',
    createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
  },
  {
    id: 'order-4',
    restaurantId: 'rest-1',
    tableId: 'table-2',
    tableName: 'Mesa 02',
    items: [
      { id: 'oi-6', menuItemId: 'item-4', name: 'Petit Gâteau', quantity: 2, priceAtOrder: 22.00 },
    ],
    total: 44.00,
    status: 'preparando',
    origin: 'mesa',
    destination: 'local',
    createdAt: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
  },
];

export const DUMMY_TABLES: Table[] = [
    { id: 'table-1', name: 'Mesa 01', status: 'ocupada', restaurantId: 'rest-1', qrCodeUrl: '' },
    { id: 'table-2', name: 'Mesa 02', status: 'ocupada', restaurantId: 'rest-1', qrCodeUrl: '' },
    { id: 'table-3', name: 'Mesa 03', status: 'ocupada', restaurantId: 'rest-1', qrCodeUrl: '' },
    { id: 'table-4', name: 'Mesa 04', status: 'livre', restaurantId: 'rest-1', qrCodeUrl: '' },
    { id: 'table-5', name: 'Mesa 05', status: 'fechando', restaurantId: 'rest-1', qrCodeUrl: '' },
    { id: 'table-6', name: 'Mesa 06', status: 'livre', restaurantId: 'rest-1', qrCodeUrl: '' },
    { id: 'table-7', name: 'Balcão 01', status: 'livre', restaurantId: 'rest-1', qrCodeUrl: '' },
    { id: 'table-8', name: 'Balcão 02', status: 'livre', restaurantId: 'rest-1', qrCodeUrl: '' },
];

    