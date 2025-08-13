
// @ts-nocheck
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  limit,
  orderBy,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import type { InventoryItem, Product, Sale, PickedItemLog, AllMappingsState, ApiKeyStatus, CompanyCost, ProductCategorySettings, AppUser, SupportData, SupportFile } from '@/lib/types';
import { startOfDay, endOfDay } from 'date-fns';

const USERS_COLLECTION = 'users';
const DEFAULT_USER_ID = 'default-user'; // Placeholder until proper auth is added


// Helper to convert data for Firestore
const toFirestore = (data) => {
  const firestoreData = { ...data };
  for (const key in firestoreData) {
    if (firestoreData[key] instanceof Date) {
      firestoreData[key] = Timestamp.fromDate(firestoreData[key]);
    }
  }
  return firestoreData;
};

// Helper to convert data from Firestore
const fromFirestore = (docData) => {
  const data = { ...docData };
  for (const key in data) {
    if (data[key] instanceof Timestamp) {
      data[key] = data[key].toDate().toISOString();
    }
  }
  return data;
};


// --- INVENTORY ---
export const loadInventoryItems = async (): Promise<InventoryItem[]> => {
  const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');
  const snapshot = await getDocs(query(inventoryCol, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as InventoryItem);
};

export const saveMultipleInventoryItems = async (items: Omit<InventoryItem, 'id'>[]): Promise<InventoryItem[]> => {
  const batch = writeBatch(db);
  const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');
  const newItemsWithIds: InventoryItem[] = [];

  items.forEach(item => {
    const docRef = doc(inventoryCol);
    const newItem = { ...item, id: docRef.id, createdAt: new Date() };
    batch.set(docRef, toFirestore(newItem));
    newItemsWithIds.push(fromFirestore(newItem) as InventoryItem);
  });

  await batch.commit();
  return newItemsWithIds;
};

export const deleteInventoryItem = async (itemId: string): Promise<void> => {
  const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory', itemId);
  await deleteDoc(docRef);
};

export const findInventoryItemBySN = async (serialNumber: string): Promise<InventoryItem | undefined> => {
  const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');
  const q = query(inventoryCol, where('serialNumber', '==', serialNumber), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return undefined;
  }
  const docData = snapshot.docs[0];
  return fromFirestore({ ...docData.data(), id: docData.id }) as InventoryItem;
};


// --- PRODUCTS ---
export const loadProducts = async (): Promise<Product[]> => {
  const productsCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'products');
  const snapshot = await getDocs(query(productsCol, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as Product);
};

export const findProductByAssociatedSku = async (sku: string): Promise<Product | null> => {
    const productsCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'products');
    
    // First, check if the SKU is in the associatedSkus array
    const qAssociated = query(productsCol, where('associatedSkus', 'array-contains', sku), limit(1));
    const snapshotAssociated = await getDocs(qAssociated);
    if (!snapshotAssociated.empty) {
        const docData = snapshotAssociated.docs[0];
        return fromFirestore({ ...docData.data(), id: docData.id }) as Product;
    }
    
    // Fallback: If not found, check if it's a main SKU
    const qMainSku = query(productsCol, where('sku', '==', sku), limit(1));
    const snapshotMain = await getDocs(qMainSku);
    if (!snapshotMain.empty) {
         const docData = snapshotMain.docs[0];
        return fromFirestore({ ...docData.data(), id: docData.id }) as Product;
    }
    
    return null;
};


export const saveProduct = async (product: Product): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'products', product.id);
    const dataToSave = { ...product };
    if (!dataToSave.createdAt) {
        dataToSave.createdAt = new Date();
    }
    await setDoc(docRef, toFirestore(dataToSave), { merge: true });
};

export const saveProducts = async (products: Product[]): Promise<void> => {
    const batch = writeBatch(db);
    const productsCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'products');
    products.forEach(product => {
        const docRef = doc(productsCol, product.id);
        batch.set(docRef, toFirestore(product));
    });
    await batch.commit();
};

export const deleteProduct = async (productId: string): Promise<void> => {
  const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'products', productId);
  await deleteDoc(docRef);
};


// --- PRODUCT SETTINGS ---
export const loadProductSettings = async (categoryId: string): Promise<ProductCategorySettings | null> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'product-settings', categoryId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        return fromFirestore({ ...snapshot.data(), id: snapshot.id }) as ProductCategorySettings;
    }
    return null;
};

export const saveProductSettings = async (categoryId: string, settings: ProductCategorySettings): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'product-settings', categoryId);
    await setDoc(docRef, toFirestore(settings));
};


// --- PICKING LOGS ---
export const loadTodaysPickingLog = async (): Promise<PickedItemLog[]> => {
  const todayStart = startOfDay(new Date());
  const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log');
  const q = query(logCol, where('pickedAt', '>=', todayStart), orderBy('pickedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as PickedItemLog);
};

export const loadAllPickingLogs = async (): Promise<PickedItemLog[]> => {
  const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log');
  const snapshot = await getDocs(query(logCol, orderBy('pickedAt', 'desc')));
  return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as PickedItemLog);
};

export const updatePickingLogs = async (updates: { logId: string; costPrice: number }[]): Promise<void> => {
    const batch = writeBatch(db);
    updates.forEach(update => {
        if (update.logId && typeof update.costPrice === 'number') {
            const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log', update.logId);
            batch.update(docRef, { costPrice: update.costPrice });
        }
    });
    await batch.commit();
};


export const savePickLog = async (logs: PickedItemLog[]): Promise<void> => {
    const batch = writeBatch(db);
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log');
    logs.forEach(log => {
        const docRef = doc(logCol, log.logId);
        const logToSave = {...log, pickedAt: new Date(log.pickedAt), createdAt: new Date(log.createdAt) };
        batch.set(docRef, toFirestore(logToSave));
    });
    await batch.commit();
};

export const saveManualPickingLog = async (logData: Omit<PickedItemLog, 'logId' | 'productId' | 'origin' | 'quantity' | 'id'>): Promise<void> => {
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log');
    const docRef = doc(logCol);
    const newLog: PickedItemLog = {
        ...logData,
        id: `manual-${logData.serialNumber}-${Date.now()}`,
        logId: docRef.id,
        productId: `manual-${logData.sku}`,
        origin: 'Manual',
        quantity: 1,
        createdAt: new Date(logData.createdAt),
        pickedAt: new Date(logData.pickedAt),
    };
    await setDoc(docRef, toFirestore(newLog));
};


export const revertPickingAction = async (pickLog: PickedItemLog) => {
    const batch = writeBatch(db);
    
    // 1. Delete the log entry
    const logDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log', pickLog.logId);
    batch.delete(logDocRef);

    // 2. If it's not a manual item, add it back to inventory
    if (!pickLog.id.startsWith('manual-')) {
        const inventoryDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory', pickLog.id);
        const { logId, orderNumber, pickedAt, ...itemToAddBack } = pickLog;
        batch.set(inventoryDocRef, toFirestore(itemToAddBack));
    }
    
    await batch.commit();
}

export const clearTodaysPickingLog = async (): Promise<void> => {
    const todayStart = startOfDay(new Date());
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log');
    const q = query(logCol, where('pickedAt', '>=', todayStart));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
};


// --- SALES ---
export async function saveSales(sales: Sale[]): Promise<void> {
    const batch = writeBatch(db);
    const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');
    
    sales.forEach(newSale => {
        const docRef = doc(salesCol, newSale.id);
        batch.set(docRef, toFirestore(newSale), { merge: true });
    });

    await batch.commit();
}

export async function loadSales(): Promise<Sale[]> {
    const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');
    const snapshot = await getDocs(salesCol);
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as Sale);
}

export const findSaleByOrderNumber = async (orderNumber: string): Promise<Sale | null> => {
    const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');
    const q = query(salesCol, where('order_code', '==', orderNumber), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const docData = snapshot.docs[0];
    return fromFirestore({ ...docData.data(), id: docData.id }) as Sale;
};


// --- COSTS ---
export const loadCompanyCosts = async (): Promise<{ fixed: CompanyCost[]; variable: CompanyCost[] } | null> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'app-data', 'companyCosts');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        return snapshot.data() as { fixed: CompanyCost[]; variable: CompanyCost[] };
    }
    return null;
};

export const saveCompanyCosts = async (costs: { fixed: CompanyCost[]; variable: CompanyCost[] }): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'app-data', 'companyCosts');
    await setDoc(docRef, costs);
};

// --- MONTHLY SUPPORT DATA ---
export const loadMonthlySupportData = async (monthYearKey: string): Promise<SupportData | null> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'support-data', monthYearKey);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        return fromFirestore(snapshot.data()) as SupportData;
    }
    return null;
};

export const saveMonthlySupportData = async (monthYearKey: string, data: SupportData): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'support-data', monthYearKey);
    await setDoc(docRef, toFirestore(data), { merge: true });
};


// --- APP SETTINGS & USERS ---
const settingsDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'app-data', 'settings');

interface AppSettings {
    iderisPrivateKey?: string;
    googleSheetsApiKey?: string;
    allMappings?: AllMappingsState;
    friendlyFieldNames?: Record<string, string>;
    fileNames?: { [key: string]: string };
    fileData?: { [key: string]: string };
    iderisApiStatus?: ApiKeyStatus;
    googleSheetsApiStatus?: ApiKeyStatus;
    permissions?: Record<string, string[]>;
    customCalculations?: any[];
    ignoredIderisColumns?: string[];
    conciliacaoColumnOrder?: string[];
    conciliacaoVisibleColumns?: Record<string, boolean>;
}


export const loadAppSettings = async (): Promise<AppSettings | null> => {
    const snapshot = await getDoc(settingsDocRef);
    if (snapshot.exists()) {
        return snapshot.data() as AppSettings;
    }
    return null;
}

export const saveAppSettings = async (settings: Partial<AppSettings>): Promise<void> => {
    await setDoc(settingsDocRef, settings, { merge: true });
}

export const loadUsersWithRoles = async (): Promise<AppUser[]> => {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocs(usersCol);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
}

export const updateUserRole = async (uid: string, role: string): Promise<void> => {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, { role });
}
