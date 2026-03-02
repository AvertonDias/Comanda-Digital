import type { MenuItem, Order, Table, User } from '@/lib/types';
import { PlaceHolderImages } from './placeholder-images';

const getImage = (id: string) => {
    const img = PlaceHolderImages.find(p => p.id === id);
    return {
        imageUrl: img?.imageUrl || 'https://picsum.photos/seed/placeholder/400/300',
        imageHint: img?.imageHint || 'food plate'
    }
}

export const DUMMY_USER: User = {
    id: 'user-1',
    name: 'Admin',
    email: 'admin@comandadigital.com',
    avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
    role: 'Admin',
};

export const DUMMY_MENU_ITEMS: MenuItem[] = [
  {
    id: 'item-1',
    name: 'Hambúrguer Clássico',
    description: 'Um suculento hambúrguer de 180g, queijo cheddar, alface, tomate e nosso molho especial no pão brioche.',
    price: 32.50,
    category: 'Lanches',
    ingredients: ['Pão brioche', 'Carne 180g', 'Queijo cheddar', 'Alface', 'Tomate', 'Molho especial'],
    sector: 'Cozinha',
    ...getImage('cheeseburger'),
  },
  {
    id: 'item-2',
    name: 'Pizza Margherita',
    description: 'A clássica pizza italiana com molho de tomate fresco, muçarela de búfala e manjericão.',
    price: 45.00,
    category: 'Pizzas',
    ingredients: ['Massa', 'Molho de tomate', 'Muçarela de búfala', 'Manjericão'],
    sector: 'Cozinha',
    ...getImage('margherita-pizza'),
  },
  {
    id: 'item-3',
    name: 'Salada Caesar',
    description: 'Alface romana fresca, croutons crocantes, lascas de parmesão e o tradicional molho Caesar.',
    price: 28.00,
    category: 'Saladas',
    ingredients: ['Alface romana', 'Croutons', 'Parmesão', 'Molho Caesar'],
    sector: 'Cozinha',
    ...getImage('caesar-salad'),
  },
  {
    id: 'item-4',
    name: 'Petit Gâteau',
    description: 'Bolo de chocolate com interior cremoso, servido quente com uma bola de sorvete de creme.',
    price: 22.00,
    category: 'Sobremesas',
    ingredients: ['Chocolate', 'Sorvete de creme'],
    sector: 'Sobremesa',
    ...getImage('chocolate-cake'),
  },
  {
    id: 'item-5',
    name: 'Mojito',
    description: 'Um coquetel refrescante feito com rum, hortelã, limão, açúcar e água com gás.',
    price: 25.00,
    category: 'Bebidas',
    ingredients: ['Rum', 'Hortelã', 'Limão', 'Açúcar', 'Água com gás'],
    sector: 'Bar',
    ...getImage('mojito-cocktail'),
  },
  {
    id: 'item-6',
    name: 'Cappuccino Italiano',
    description: 'Café espresso, leite vaporizado e uma generosa camada de espuma de leite.',
    price: 12.00,
    category: 'Bebidas',
    ingredients: ['Café', 'Leite'],
    sector: 'Bar',
    ...getImage('cappuccino'),
  },
];

export const DUMMY_ORDERS: Order[] = [
  {
    id: 'order-1',
    tableId: 'table-3',
    tableName: 'Mesa 03',
    items: [
      { menuItemId: 'item-1', name: 'Hambúrguer Clássico', quantity: 2, price: 32.50 },
      { menuItemId: 'item-5', name: 'Mojito', quantity: 2, price: 25.00 },
    ],
    total: 115.00,
    status: 'Preparando',
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  },
  {
    id: 'order-2',
    tableId: 'table-1',
    tableName: 'Mesa 01',
    items: [
      { menuItemId: 'item-2', name: 'Pizza Margherita', quantity: 1, price: 45.00 },
    ],
    total: 45.00,
    status: 'Aberto',
    createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
  },
  {
    id: 'order-3',
    tableId: 'table-5',
    tableName: 'Mesa 05',
    items: [
      { menuItemId: 'item-3', name: 'Salada Caesar', quantity: 1, price: 28.00 },
      { menuItemId: 'item-6', name: 'Cappuccino Italiano', quantity: 1, price: 12.00 },
    ],
    total: 40.00,
    status: 'Pronto',
    createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
  },
  {
    id: 'order-4',
    tableId: 'table-2',
    tableName: 'Mesa 02',
    items: [
      { menuItemId: 'item-4', name: 'Petit Gâteau', quantity: 2, price: 22.00 },
    ],
    total: 44.00,
    status: 'Preparando',
    createdAt: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
  },
];

export const DUMMY_TABLES: Table[] = [
    { id: 'table-1', name: 'Mesa 01', status: 'Ocupada', qrCodeUrl: '' },
    { id: 'table-2', name: 'Mesa 02', status: 'Ocupada', qrCodeUrl: '' },
    { id: 'table-3', name: 'Mesa 03', status: 'Ocupada', qrCodeUrl: '' },
    { id: 'table-4', name: 'Mesa 04', status: 'Livre', qrCodeUrl: '' },
    { id: 'table-5', name: 'Mesa 05', status: 'Ocupada', qrCodeUrl: '' },
    { id: 'table-6', name: 'Mesa 06', status: 'Livre', qrCodeUrl: '' },
    { id: 'table-7', name: 'Balcão 01', status: 'Livre', qrCodeUrl: '' },
    { id: 'table-8', name: 'Balcão 02', status: 'Livre', qrCodeUrl: '' },
];
