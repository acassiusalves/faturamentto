

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
  getCountFromServer
} from 'firebase/firestore';
import type { InventoryItem, Product, Sale, PickedItemLog, AllMappingsState, ApiKeyStatus, CompanyCost, ProductCategorySettings, AppUser, SupportData, SupportFile, ReturnLog, AppSettings, PurchaseList, PurchaseListItem, Notice, ConferenceResult, ConferenceHistoryEntry, FeedEntry, SavedMlAnalysis, ApprovalRequest, EntryLog, PickingNotice, MLCategory, Trend } from '@/lib/types';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';

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

// --- PRINTED LABELS ---
export const savePrintedLabel = async (
  orderId: string,
  orderCode?: string | null,
  zplContent?: string
): Promise<void> => {
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  const data = { printedAt: now, zplContent: zplContent || '' };

  // salva por ID Ideris (numérico)
  if (orderId) {
    const byIdRef = doc(db, 'printed_labels', String(orderId));
    batch.set(byIdRef, data, { merge: true });
  }

  // salva também por código do pedido (LU-...)
  if (orderCode) {
    const byCodeRef = doc(db, 'printed_labels', String(orderCode));
    batch.set(byCodeRef, data, { merge: true });
  }

  await batch.commit();
};

export const loadPrintedLabels = async (): Promise<{id: string, zplContent?: string}[]> => {
    const labelsCol = collection(db, 'printed_labels');
    const snapshot = await getDocs(labelsCol);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as {id: string, zplContent?: string}));
};


// --- ENTRY LOG ---
export const loadEntryLogs = async (dateRange?: DateRange): Promise<InventoryItem[]> => {
    const entryLogCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-log');

    let q = query(entryLogCol, orderBy('createdAt', 'desc'));

    if (dateRange && dateRange.from) {
        q = query(q, where('createdAt', '>=', Timestamp.fromDate(startOfDay(dateRange.from))));
    }
    if (dateRange && dateRange.to) {
        q = query(q, where('createdAt', '<=', Timestamp.fromDate(endOfDay(dateRange.to))));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as InventoryItem);
};


const logInventoryEntry = async (batch, item: InventoryItem): Promise<void> => {
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-logs');
    const logDocRef = doc(logCol); // Generate a new unique ID for the log entry
    const payload: EntryLog = {
      ...item,
      id: logDocRef.id,
      originalInventoryId: item.id, // ID do item original no inventário
      // **Padroniza como Date/Timestamp**, independente se veio string
      entryDate: item.createdAt ? new Date(item.createdAt) : new Date(),
      logType: 'INVENTORY_ENTRY',
    };
    batch.set(logDocRef, toFirestore(payload));
}

export async function revertEntryAction(entry: InventoryItem): Promise<void> {
  const batch = writeBatch(db);
  
  if (entry.originalInventoryId) {
    const inventoryRef = doc(db, 'users', DEFAULT_USER_ID, 'inventory', entry.originalInventoryId);
    batch.delete(inventoryRef);
  }

  const entryLogRef = doc(db, 'users', DEFAULT_USER_ID, 'entry-logs', entry.id);
  batch.delete(entryLogRef);
  
  await batch.commit();
}


// --- INVENTORY ---
export const loadInventoryItems = async (): Promise<InventoryItem[]> => {
  const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');
  const snapshot = await getDocs(query(inventoryCol, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as InventoryItem);
};

export const saveInventoryItem = async (newItem: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
  const batch = writeBatch(db);
  const inventoryCol = collection(db, 'users', DEFAULT_USER_ID, 'inventory');
  const docRef = doc(inventoryCol);

  const itemWithId: InventoryItem = { ...newItem, id: docRef.id };
  batch.set(docRef, toFirestore(itemWithId));
  await logInventoryEntry(batch, itemWithId);

  await batch.commit();
  return itemWithId;
}

export async function saveMultipleInventoryItems(newItems: Omit<InventoryItem, 'id'>[]): Promise<InventoryItem[]> {
  const batch = writeBatch(db);
  const inventoryCol = collection(db, 'users', DEFAULT_USER_ID, 'inventory');
  
  const savedItems: InventoryItem[] = [];

  for (const item of newItems) {
    const docRef = doc(inventoryCol);
    const itemWithId: InventoryItem = { ...item, id: docRef.id, createdAt: new Date().toISOString() };
    batch.set(docRef, toFirestore(itemWithId));
    await logInventoryEntry(batch, itemWithId);
    savedItems.push(itemWithId);
  }

  await batch.commit();
  return savedItems;
}

export const deleteInventoryItem = async (itemId: string): Promise<void> => {
  const inventoryDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory', itemId);
  await deleteDoc(inventoryDocRef);
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
    
    const qMainSku = query(productsCol, where('sku', '==', sku), limit(1));
    const snapshotMain = await getDocs(qMainSku);
    if (!snapshotMain.empty) {
        const docData = snapshotMain.docs[0];
        return fromFirestore({ ...docData.data(), id: docData.id }) as Product;
    }

    const qAssociated = query(productsCol, where('associatedSkus', 'array-contains', sku), limit(1));
    const snapshotAssociated = await getDocs(qAssociated);
    if (!snapshotAssociated.empty) {
        const docData = snapshotAssociated.docs[0];
        return fromFirestore({ ...docData.data(), id: docData.id }) as Product;
    }
    
    return null;
};


export const saveProduct = async (product: Product): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'products', product.id);
    const dataToSave = { ...product };
    if (!dataToSave.createdAt) {
        dataToSave.createdAt = new Date().toISOString();
    }
     // Ensure createdAt is a Date object for Firestore
    const firestoreProduct = { ...dataToSave, createdAt: new Date(dataToSave.createdAt) };
    await setDoc(docRef, toFirestore(firestoreProduct), { merge: true });
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

export const updateProductAveragePrices = async (updates: { sku: string; averagePrice: number }[]): Promise<void> => {
    const productsCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'products');
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const update of updates) {
        const q = query(productsCol, where('sku', '==', update.sku), limit(1));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            batch.update(docRef, {
                averagePrice: update.averagePrice,
                averagePriceUpdatedAt: now
            });
            updatedCount++;
        }
    }
    
    if (updatedCount > 0) {
        await batch.commit();
    }
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
  return snapshot.docs.map(docSnap => fromFirestore({ ...docSnap.data(), id: docSnap.id }) as PickedItemLog);
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

export const findPickLogBySN = async (serialNumber: string): Promise<PickedItemLog | null> => {
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log');
    const q = query(logCol, where('serialNumber', '==', serialNumber), limit(1));
    const snapshot = await getDocs(q);
    if(snapshot.empty) {
        return null;
    }
    const docData = snapshot.docs[0];
    return fromFirestore({ ...docData.data(), id: docData.id }) as PickedItemLog;
}


export const revertPickingAction = async (pickLog: PickedItemLog) => {
  const batch = writeBatch(db);

  // 1. Delete the picking log entry
  const logDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log', pickLog.logId);
  batch.delete(logDocRef);

  // 2. Re-create the item in the inventory
  // Use the original item ID if it's not a manual entry
  if (!pickLog.id.startsWith('manual-')) {
    const inventoryDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory', pickLog.id);
    // Remove properties specific to the pick log before re-adding
    const { logId, orderNumber, pickedAt, ...itemToAddBack } = pickLog;
    // Update the createdAt timestamp to reflect re-entry
    const itemWithDate = { ...itemToAddBack, createdAt: new Date() };
    batch.set(inventoryDocRef, toFirestore(itemWithDate));
  }

  await batch.commit();
};

export const clearTodaysPickingLog = async (): Promise<void> => {
    const todayStart = startOfDay(new Date());
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log');
    const q = query(logCol, where('pickedAt', '>=', todayStart));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
};


// --- RETURNS ---
export const saveReturnLogs = async (
  data: Omit<ReturnLog, 'id' | 'returnedAt'>[],
  productId: string,
  costPrice: number,
  origin: string
): Promise<void> => {
    const batch = writeBatch(db);
    const returnsLogCol = collection(db, 'users', DEFAULT_USER_ID, 'returns-log');
    const inventoryCol = collection(db, 'users', DEFAULT_USER_ID, 'inventory');
    const entryLogsCol = collection(db, 'users', DEFAULT_USER_ID, 'entry-logs');

    const now = new Date();

    for (const returnData of data) {
        // Create Return Log
        const returnDocRef = doc(returnsLogCol);
        const newReturnLog: ReturnLog = {
            ...returnData,
            id: returnDocRef.id,
            returnedAt: now.toISOString(),
        };
        batch.set(returnDocRef, toFirestore({ ...newReturnLog, returnedAt: now }));

        // Create Inventory Item
        const inventoryItemDocRef = doc(inventoryCol);
        const itemToReenter: InventoryItem = {
            id: inventoryItemDocRef.id,
            productId: productId,
            name: returnData.productName,
            sku: returnData.sku,
            serialNumber: returnData.serialNumber,
            costPrice: costPrice,
            origin: origin,
            quantity: 1,
            condition: returnData.condition as any,
            createdAt: now.toISOString(),
            orderNumber: returnData.orderNumber, // <-- Adicionando o campo aqui
        };
        batch.set(inventoryItemDocRef, toFirestore(itemToReenter));
        
        // Create Entry Log
        const entryLogDocRef = doc(entryLogsCol);
        const entryLog: EntryLog = {
            ...itemToReenter,
            id: entryLogDocRef.id,
            originalInventoryId: itemToReenter.id,
            entryDate: now, // salva como Timestamp
            logType: 'RETURN_ENTRY'
        };
        batch.set(entryLogDocRef, toFirestore(entryLog));
    }

    await batch.commit();
};

export const loadTodaysReturnLogs = async (): Promise<ReturnLog[]> => {
    const todayStart = startOfDay(new Date());
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'returns-log');
    const q = query(logCol, where('returnedAt', '>=', todayStart), orderBy('returnedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as ReturnLog);
};

export const revertReturnAction = async (returnLog: ReturnLog): Promise<void> => {
    const batch = writeBatch(db);
    
    // Remove a devolução do log
    const logDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'returns-log', returnLog.id);
    batch.delete(logDocRef);

    // Encontra e remove o item que foi re-adicionado ao estoque
    const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');
    const q = query(inventoryCol, where('serialNumber', '==', returnLog.serialNumber), limit(1));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
        const inventoryItemDocRef = snapshot.docs[0].ref;
        batch.delete(inventoryItemDocRef);
    }
    
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

export async function getSaleByOrderId(orderId: string): Promise<Sale | null> {
    const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');
    const q = query(salesCol, where('order_id', '==', Number(orderId)), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        return fromFirestore({ ...docData.data(), id: docData.id }) as Sale;
    }
    return null;
}


export async function loadSalesIdsAndOrderCodes(): Promise<{ id: string; order_code: string; }[]> {
  const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');
  const snapshot = await getDocs(query(salesCol));
  return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
          id: doc.id,
          order_code: data.order_code,
      };
  });
}

export const findSaleByOrderNumber = async (orderIdentifier: string): Promise<Sale | null> => {
    const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');
    const identifier = orderIdentifier.trim();

    const qCode = query(salesCol, where('order_code', '==', identifier), limit(1));
    const codeSnapshot = await getDocs(qCode);
    if (!codeSnapshot.empty) {
        return fromFirestore({ ...codeSnapshot.docs[0].data(), id: codeSnapshot.docs[0].id }) as Sale;
    }

    if (!isNaN(Number(identifier))) {
        const numericId = Number(identifier);
        const qId = query(salesCol, where('order_id', '==', numericId), limit(1));
        const idSnapshot = await getDocs(qId);
        if (!idSnapshot.empty) {
            return fromFirestore({ ...idSnapshot.docs[0].data(), id: idSnapshot.docs[0].id }) as Sale;
        }
    }
    
    const allSales = await loadSales(); 
    const foundSale = allSales.find(sale => 
        (sale as any).order_code?.includes(identifier) ||
        String((sale as any).order_id)?.includes(identifier)
    );
    
    return foundSale || null;
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

export const deleteMonthlySupportData = async (monthYearKey: string): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'support-data', monthYearKey);
    await deleteDoc(docRef);
}


// --- APPROVALS ---
export const createApprovalRequest = async (request: Omit<ApprovalRequest, 'id'>): Promise<void> => {
    const requestsCol = collection(db, 'approval-requests');
    const docRef = doc(requestsCol);
    await setDoc(docRef, toFirestore({ ...request, id: docRef.id }));
};

export const loadApprovalRequests = async (status: 'pending' | 'approved' | 'rejected'): Promise<ApprovalRequest[]> => {
    const requestsCol = collection(db, 'approval-requests');
    const q = query(requestsCol, where('status', '==', status));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as ApprovalRequest);
}

export const processApprovalRequest = async (request: ApprovalRequest, decision: 'approved' | 'rejected', userEmail: string): Promise<void> => {
    const requestDocRef = doc(db, 'approval-requests', request.id);
    
    // Correção: Usar new Date().toISOString() para garantir o timestamp atual
    const updateData: Partial<ApprovalRequest> = {
        status: decision,
        processedBy: userEmail,
        processedAt: new Date().toISOString(),
    };

    if (decision === 'approved') {
        const batch = writeBatch(db);

        const inventoryItemRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory', request.scannedItem.id);
        batch.delete(inventoryItemRef);

        const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log');
        const logDocRef = doc(logCol);
        const newLogEntry: PickedItemLog = {
            ...request.scannedItem,
            orderNumber: (request.orderData as any).order_code,
            pickedAt: new Date(),
            createdAt: new Date(),
            logId: logDocRef.id,
        };
        batch.set(logDocRef, toFirestore(newLogEntry));
        
        batch.update(requestDocRef, toFirestore(updateData));

        await batch.commit();

    } else {
        await updateDoc(requestDocRef, toFirestore(updateData));
    }
}

// --- PURCHASE HISTORY ---
export const savePurchaseList = async (purchaseList: Omit<PurchaseList, 'id'>): Promise<void> => {
    const historyCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'purchase-history');
    const docRef = doc(historyCol);
    await setDoc(docRef, toFirestore({ ...purchaseList, id: docRef.id }));
};

export const loadPurchaseHistory = async (): Promise<PurchaseList[]> => {
    const historyCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'purchase-history');
    const q = query(historyCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as PurchaseList);
};

export const updatePurchaseList = async (id: string, data: Partial<Omit<PurchaseList, 'id'>>): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'purchase-history', id);
    const dataToUpdate = { ...data };
    // Recalcula o totalCost antes de salvar
    if (data.items) {
        dataToUpdate.totalCost = data.items.reduce((acc, item) => {
             const quantity = (item.quantity || 0) + (item.surplus || 0);
             return acc + (item.unitCost * quantity);
        }, 0);
    }
    await updateDoc(docRef, dataToUpdate);
};

export const deletePurchaseList = async (id: string): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'purchase-history', id);
    await deleteDoc(docRef);
};


// --- NOTICES ---
export const saveNotice = async (notice: Partial<Notice>): Promise<void> => {
  const noticeId = notice.id || doc(collection(db, 'notices')).id;
  const docRef = doc(db, 'notices', noticeId);
  await setDoc(docRef, toFirestore({ ...notice, id: noticeId }), { merge: true });
};

export const loadNotices = async (): Promise<Notice[]> => {
  const noticesCol = collection(db, 'notices');
  const q = query(noticesCol, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as Notice);
};

export const deleteNotice = async (noticeId: string): Promise<void> => {
  const docRef = doc(db, 'notices', noticeId);
  await deleteDoc(docRef);
};

// --- PICKING NOTICES ---
export const savePickingNotice = async (notice: Omit<PickingNotice, 'id'>): Promise<void> => {
    const docRef = doc(collection(db, 'picking-notices'));
    await setDoc(docRef, toFirestore({ ...notice, id: docRef.id }));
};

export const loadPickingNotices = async (): Promise<PickingNotice[]> => {
    const noticesCol = collection(db, 'picking-notices');
    const q = query(noticesCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => fromFirestore(d.data()) as PickingNotice);
};

export const deletePickingNotice = async (noticeId: string): Promise<void> => {
    const docRef = doc(db, 'picking-notices', noticeId);
    await deleteDoc(docRef);
};


// --- APP SETTINGS & USERS ---
const settingsDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'app-data', 'settings');

export const loadAppSettings = async (): Promise<AppSettings | null> => {
    const snapshot = await getDoc(settingsDocRef);
    if (snapshot.exists()) {
        const settings = snapshot.data() as AppSettings;
        // Ensure favoriteCategories is always an array
        if (!Array.isArray(settings.favoriteCategories)) {
            settings.favoriteCategories = [];
        }
        return settings;
    }
    return { favoriteCategories: [] }; // Return default structure if not exists
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

export const updateSalesDeliveryType = async (updates: { saleId: string; deliveryType: string | undefined }[]): Promise<void> => {
  if (!updates || updates.length === 0) {
    return;
  }

  const batch = writeBatch(db);
  const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');

  updates.forEach(update => {
    if (update.saleId && update.deliveryType) {
        const docRef = doc(salesCol, update.saleId);
        batch.update(docRef, { 
            deliveryType: update.deliveryType,
            deliveryType_updated_at: new Date().toISOString(),
        });
    }
  });

  await batch.commit();
};

export async function fetchSalesByIds(saleIds: string[]): Promise<Sale[]> {
    if (saleIds.length === 0) {
      return [];
    }
    const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');
    const sales: Sale[] = [];
    for (let i = 0; i < saleIds.length; i += 30) {
      const batchIds = saleIds.slice(i, i + 30);
      const q = query(salesCol, where('__name__', 'in', batchIds));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        sales.push(fromFirestore({ ...doc.data(), id: doc.id }) as Sale);
      });
    }
    return sales;
  }


// --- CONFERENCE HISTORY ---
export const saveConferenceHistory = async (results: ConferenceResult): Promise<ConferenceHistoryEntry> => {
    const historyCol = collection(db, 'conference-history');
    const docRef = doc(historyCol);
    const newEntry: ConferenceHistoryEntry = {
        id: docRef.id,
        date: new Date().toISOString(),
        results: {
            found: results.found.map(item => ({ ...item })),
            notFound: [...results.notFound],
            notScanned: results.notScanned.map(item => ({ ...item })),
        }
    };
    await setDoc(docRef, toFirestore(newEntry));
    return newEntry;
}

export const loadConferenceHistory = async (): Promise<ConferenceHistoryEntry[]> => {
    const historyCol = collection(db, 'conference-history');
    const sevenDaysAgo = subDays(new Date(), 7);
    const q = query(historyCol, where('date', '>=', sevenDaysAgo.toISOString()), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as ConferenceHistoryEntry);
}


// --- FEED 25 ---
export const saveFeedEntry = async (entry: FeedEntry): Promise<void> => {
    const docRef = doc(db, "feed_entries", entry.id);
    await setDoc(docRef, toFirestore(entry), { merge: true });
};

export const loadAllFeedEntries = async (): Promise<FeedEntry[]> => {
    const feedCol = collection(db, "feed_entries");
    const q = query(feedCol, orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data() }) as FeedEntry);
};

export const deleteFeedEntry = async (id: string): Promise<void> => {
    const docRef = doc(db, "feed_entries", id);
    await deleteDoc(docRef);
};

// --- DAILY SUMMARY ---
export const loadInitialStockForToday = async (): Promise<number> => {
    const today = new Date();
    today.setHours(today.getHours() - 3); 
    const dateKey = today.toISOString().split("T")[0];

    const docRef = doc(db, "daily-summaries", dateKey);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docSnap.data().initialStock || 0;
    }
    
    // Fallback if not recorded: count current inventory
    const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');
    const snapshot = await getCountFromServer(inventoryCol);
    return snapshot.data().count;
};

// --- ML ANALYSIS ---
export const saveMlAnalysis = async (analysis: Omit<SavedMlAnalysis, 'id'>): Promise<void> => {
  const mainCategoryName = analysis.mainCategoryName.replace(/\//g, '-');
  const date = new Date().toISOString().split('T')[0];
  const docId = `${mainCategoryName}-${date}`;

  const analysisRef = doc(db, 'ml-analysis', docId);
  const dataToSave: SavedMlAnalysis = { ...analysis, id: docId };
  
  await setDoc(analysisRef, toFirestore(dataToSave), { merge: true });
};


export const loadMlAnalyses = async (): Promise<SavedMlAnalysis[]> => {
  const analysisCol = collection(db, 'ml-analysis');
  const q = query(analysisCol, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as SavedMlAnalysis);
};

export const deleteMlAnalysis = async (analysisId: string): Promise<void> => {
  const docRef = doc(db, 'ml-analysis', analysisId);
  await deleteDoc(docRef);
};

export async function loadAllTrendEmbeddings(): Promise<Trend[]> {
  try {
    const analyses = await loadMlAnalyses();
    if (!analyses) return [];

    const trendMap = new Map<string, Trend>();

    for (const analysis of analyses) {
      for (const result of analysis.results) {
        for (const trend of result.trends) {
          if (trend.keyword && trend.embedding && !trendMap.has(trend.keyword)) {
            trendMap.set(trend.keyword, trend);
          }
        }
      }
    }
    return Array.from(trendMap.values());
  } catch (error) {
    console.error('Erro ao carregar embeddings de tendências:', error);
    return [];
  }
}

// --- Permanent Entry Log ---
export const loadEntryLogsFromPermanentLog = async (dateRange?: DateRange): Promise<EntryLog[]> => {
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-logs');

    let q = query(logCol, orderBy('entryDate', 'desc'));
    
    if (dateRange?.from) {
         q = query(q, where('entryDate', '>=', Timestamp.fromDate(startOfDay(dateRange.from))));
    }
     if (dateRange?.to) {
        q = query(q, where('entryDate', '<=', Timestamp.fromDate(endOfDay(dateRange.to))));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as EntryLog);
};


export const loadEntryLogsByDateFromPermanentLog = async (date: Date): Promise<EntryLog[]> => {
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-logs');
    const start = startOfDay(date);
    const end   = endOfDay(date);

    // 1) TENTATIVA COM TIMESTAMP (padrão novo)
    let q1 = query(
      logCol,
      where('entryDate', '>=', Timestamp.fromDate(start)),
      where('entryDate', '<=', Timestamp.fromDate(end))
    );
    let snap = await getDocs(q1);

    // 2) FALLBACK: documentos antigos com entryDate como string ISO
    if (snap.empty) {
      const startIso = start.toISOString();
      const endIso   = end.toISOString();
      const q2 = query(
        logGeral,
        where('entryDate', '>=', startIso),
        where('entryDate', '<=', endIso)
      );
      snap = await getDocs(q2);
    }

    return snap.docs.map(d => fromFirestore({ ...d.data(), id: d.id }) as EntryLog);
};


// --- TRENDS FOR CATALOG ---
export async function loadAllTrendKeywords(): Promise<string[]> {
  try {
    const analyses = await loadMlAnalyses();
    
    if (!analyses || analyses.length === 0) {
      console.log("Nenhuma análise de ML encontrada para carregar palavras-chave.");
      return [];
    }
    
    const allKeywords = new Set<string>();
    
    analyses.forEach((analysis) => {
      analysis.results.forEach((result) => {
        result.trends.forEach(trend => {
          if (trend.keyword && trend.keyword.trim()) {
            allKeywords.add(trend.keyword.trim());
          }
        });
      });
    });
    
    const keywords = Array.from(allKeywords);
    console.log(`Carregadas ${keywords.length} palavras-chave de tendência únicas.`);
    return keywords;
  } catch (error) {
    console.error('Erro ao carregar palavras-chave de tendências:', error);
    return [];
  }
}


export const removeGlobalFromAllProducts = async (): Promise<{count: number}> => {
    const products = await loadProducts();
    const productsToUpdate: Product[] = [];
    let updatedCount = 0;

    products.forEach(product => {
        if (product.name.toLowerCase().includes('global')) {
            const newName = product.name.replace(/global/ig, '').replace(/\s\s+/g, ' ').trim();
            if (newName !== product.name) {
                productsToUpdate.push({ ...product, name: newName });
                updatedCount++;
            }
        }
    });

    if (productsToUpdate.length > 0) {
        await saveProducts(productsToUpdate);
    }
    return { count: updatedCount };
};


    

    

    
