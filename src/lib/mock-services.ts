
import type { InventoryItem, Product } from './types';

// Mock data
let mockInventory: InventoryItem[] = [
    { id: 'IP15-123', productId: 'PROD001', name: 'iPhone 15 Pro Max', sku: 'IP15PM', costPrice: 7500, quantity: 1, serialNumber: 'SN123456789', gtin: '1234567890123', origin: 'Fornecedor A', createdAt: new Date().toISOString() },
    { id: 'IP15-124', productId: 'PROD001', name: 'iPhone 15 Pro Max', sku: 'IP15PM', costPrice: 7500, quantity: 1, serialNumber: 'SN123456790', gtin: '1234567890123', origin: 'Fornecedor A', createdAt: new Date().toISOString() },
    { id: 'S23-ABC', productId: 'PROD002', name: 'Samsung Galaxy S23 Ultra', sku: 'S23U', costPrice: 6800, quantity: 1, serialNumber: 'SNABCDEFGHIJK', gtin: '9876543210987', origin: 'Fornecedor B', createdAt: new Date().toISOString() },
];

let mockProducts: Product[] = [
    { id: 'PROD001', name: 'iPhone 15 Pro Max', sku: 'IP15PM' },
    { id: 'PROD002', name: 'Samsung Galaxy S23 Ultra', sku: 'S23U' },
    { id: 'PROD003', name: 'Google Pixel 8 Pro', sku: 'GP8P' },
];

// Mock service functions
export const loadInventoryItems = async (): Promise<InventoryItem[]> => {
    console.log("Loading mock inventory items...");
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return [...mockInventory];
};

export const saveMultipleInventoryItems = async (items: Omit<InventoryItem, 'id'>[]): Promise<InventoryItem[]> => {
    console.log("Saving multiple inventory items:", items);
    await new Promise(resolve => setTimeout(resolve, 500));
    const newItemsWithIds = items.map((item, index) => {
        const newItem = {
            ...item,
            id: `${item.sku}-${Date.now()}-${index}`,
        };
        mockInventory.unshift(newItem); // Add to the beginning of the array
        return newItem;
    });
    return newItemsWithIds;
};

export const deleteInventoryItem = async (itemId: string): Promise<void> => {
    console.log("Deleting inventory item:", itemId);
    await new Promise(resolve => setTimeout(resolve, 500));
    mockInventory = mockInventory.filter(item => item.id !== itemId);
};

export const loadProducts = async (): Promise<Product[]> => {
    console.log("Loading mock products...");
    await new Promise(resolve => setTimeout(resolve, 500));
    return [...mockProducts];
};

export const findInventoryItemBySN = async (serialNumber: string): Promise<InventoryItem | undefined> => {
    console.log("Finding inventory item by SN:", serialNumber);
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockInventory.find(item => item.serialNumber.toLowerCase() === serialNumber.toLowerCase());
}
