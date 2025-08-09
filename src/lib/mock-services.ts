
import type { InventoryItem, Product, Sale, PickedItemLog } from './types';

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

let mockSales: Sale[] = [
  {
    id: "SALE001",
    date: "2024-05-01",
    marketplace: "Mercado Livre",
    productDescription: "Camiseta estampada de algodão",
    grossValue: 79.9,
    costs: [
      { id: "C01", description: "Taxa de venda", amount: 12.78, category: "Taxas do Marketplace" },
      { id: "C02", description: "Custo de envio", amount: 15.0, category: "Frete" },
    ],
    netValue: 52.12,
    orderNumber: "ORD-001",
    item_sku: "SKU-TSHIRT",
    item_title: "Camiseta estampada de algodão",
    item_quantity: 1,
    auth_name: 'Conta Principal'
  },
  {
    id: "SALE002",
    date: "2024-05-02",
    marketplace: "Amazon",
    productDescription: "Fone de ouvido Bluetooth 5.0",
    grossValue: 199.9,
    costs: [{ id: "C03", description: "Taxa Amazon", amount: 29.99, category: "Taxas do Marketplace" }],
    netValue: 169.91,
    orderNumber: "ORD-002",
    item_sku: "S23U",
    item_title: "Samsung Galaxy S23 Ultra",
    item_quantity: 2,
    auth_name: 'Conta Secundaria'
  },
];

let mockPickingLog: PickedItemLog[] = [];


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

export const loadTodaysPickingLog = async (): Promise<PickedItemLog[]> => {
    console.log("Loading today's picking log...");
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...mockPickingLog];
};

export const loadAppSettings = async (): Promise<{ iderisPrivateKey?: string } | null> => {
    console.log("Loading app settings...");
    await new Promise(resolve => setTimeout(resolve, 100));
    return { iderisPrivateKey: "mock-private-key" };
}

export const loadSales = async (): Promise<Sale[]> => {
    console.log("Loading sales...");
    await new Promise(resolve => setTimeout(resolve, 400));
    return [...mockSales];
};

export const saveSales = async (sales: Sale[]): Promise<void> => {
    console.log("Saving new sales:", sales);
    await new Promise(resolve => setTimeout(resolve, 400));
    mockSales.push(...sales);
};

export const findSaleByOrderNumber = async (orderNumber: string): Promise<Sale | null> => {
    console.log("Finding sale by order number:", orderNumber);
    await new Promise(resolve => setTimeout(resolve, 300));
    const sale = mockSales.find(s => s.orderNumber?.toLowerCase() === orderNumber.toLowerCase());
    return sale || null;
};

export const fetchOrdersFromIderis = async (
    privateKey: string,
    options: { from: Date; to: Date },
    existingSaleIds: string[]
): Promise<Sale[]> => {
    console.log("Fetching new orders from Ideris mock...");
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    // Return an empty array to simulate no new orders
    return [];
};


export const savePickLog = (logs: PickedItemLog[]) => {
    mockPickingLog.unshift(...logs);
};

export const removePickLogEntry = (logId: string) => {
    mockPickingLog = mockPickingLog.filter(log => log.logId !== logId);
}

export const clearTodaysPickingLog = async (): Promise<void> => {
    console.log("Clearing today's picking log...");
    await new Promise(resolve => setTimeout(resolve, 300));
    mockPickingLog = [];
};

export const revertPickingAction = async (pickLog: PickedItemLog) => {
    console.log(`Reverting pick for logId: ${pickLog.logId}`);
    
    // Remove from log
    removePickLogEntry(pickLog.logId);

    // If it's not a manual item, add it back to inventory
    if (!pickLog.id.startsWith('manual-')) {
        const itemToAddBack: InventoryItem = {
            id: pickLog.id,
            productId: pickLog.productId,
            name: pickLog.name,
            sku: pickLog.sku,
            costPrice: pickLog.costPrice,
            quantity: 1,
            serialNumber: pickLog.serialNumber,
            gtin: pickLog.gtin,
            origin: pickLog.origin,
            createdAt: pickLog.createdAt,
        };
        mockInventory.unshift(itemToAddBack);
    }
}
