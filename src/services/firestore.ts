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
import type { InventoryItem, Product, Sale, PickedItemLog, AllMappingsState, ApiKeyStatus, CompanyCost, ProductCategorySettings, AppUser, SupportData, SupportFile, ReturnLog, AppSettings, PurchaseList, PurchaseListItem, Notice } from '@/lib/types';
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

// --- ENTRY LOG ---
const migrateInventoryToEntryLog = async (): Promise<void> => {
    console.log("Iniciando migração de dados do inventário para o log de entradas...");
    const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-log');
    
    const inventorySnapshot = await getDocs(inventoryCol);
    if (inventorySnapshot.empty) {
        console.log("Nenhum item no inventário para migrar.");
        return;
    }

    const batch = writeBatch(db);
    let count = 0;
    inventorySnapshot.forEach(doc => {
        const item = fromFirestore({ ...doc.data(), id: doc.id }) as InventoryItem;
        const logDocRef = doc(logCol, item.id);
        batch.set(logDocRef, toFirestore(item));
        count++;
    });

    await batch.commit();
    console.log(`${count} itens migrados com sucesso para o log de entradas.`);
};


export const loadEntryLogs = async (): Promise<InventoryItem[]> => {
  const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-log');
  
  // Verifica se o log de entradas está vazio para executar a migração uma única vez.
  const snapshotCount = await getCountFromServer(query(logCol, limit(1)));
  if (snapshotCount.data().count === 0) {
      const inventorySnapshot = await getDocs(collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory'));
      if (!inventorySnapshot.empty) {
          await migrateInventoryToEntryLog();
      }
  }

  const snapshot = await getDocs(query(logCol, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as InventoryItem);
};

const logInventoryEntry = async (batch: WriteBatch, item: InventoryItem): Promise<void> => {
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-log');
    const logDocRef = doc(logCol, item.id); // Use the same ID as the inventory item for traceability
    // Certifique-se que o item passado já tem o formato correto (sem Timestamps do Firestore)
    const dataToLog = toFirestore(item);
    batch.set(logDocRef, dataToLog);
}


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

  for (const item of items) {
    const docRef = doc(inventoryCol);
    // Garante que 'createdAt' seja um objeto Date antes de converter para Firestore
    const newItem = { ...item, id: docRef.id, createdAt: new Date().toISOString() };
    const firestoreItem = toFirestore({ ...newItem, createdAt: new Date(newItem.createdAt) });
    
    batch.set(docRef, firestoreItem);
    // Para o log, usamos o objeto com a data já em string ISO
    await logInventoryEntry(batch, newItem as InventoryItem);

    newItemsWithIds.push(newItem as InventoryItem);
  }

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
    
    // First, check if the SKU is a main SKU
    const qMainSku = query(productsCol, where('sku', '==', sku), limit(1));
    const snapshotMain = await getDocs(qMainSku);
    if (!snapshotMain.empty) {
        const docData = snapshotMain.docs[0];
        return fromFirestore({ ...docData.data(), id: docData.id }) as Product;
    }

    // Fallback: If not a main SKU, check if it's in the associatedSkus array
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


// --- RETURNS ---
export const saveReturnLog = async (data: Omit<ReturnLog, 'id' | 'returnedAt'>): Promise<void> => {
    const batch = writeBatch(db);
    const returnsLogCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'returns-log');
    const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');

    // 1. Create the return log
    const returnDocRef = doc(returnsLogCol);
    const newReturnLog: ReturnLog = {
        ...data,
        id: returnDocRef.id,
        returnedAt: new Date().toISOString(),
        originalSaleData: data.originalSaleData || null, // Ensure null instead of undefined
    };
    batch.set(returnDocRef, toFirestore(newReturnLog));

    // 2. Add the item back to the inventory
    const inventoryItemDocRef = doc(inventoryCol); // Always create a new inventory item for a return
    const product = await findProductByAssociatedSku(data.sku);

    const itemToReenter: InventoryItem = {
        id: inventoryItemDocRef.id,
        productId: product?.id || `unknown-${data.sku}`,
        name: data.productName,
        sku: data.sku,
        serialNumber: data.serialNumber,
        costPrice: data.originalSaleData?.costPrice || 0,
        origin: data.originalSaleData?.origin || 'Devolução',
        quantity: 1,
        condition: data.condition,
        createdAt: new Date().toISOString(), // The date it re-entered inventory
    };
    const firestoreItem = toFirestore(itemToReenter);
    batch.set(inventoryItemDocRef, firestoreItem);
    await logInventoryEntry(batch, fromFirestore(itemToReenter)); // Log the return as an entry

    await batch.commit();
};

export const loadTodaysReturnLogs = async (): Promise<ReturnLog[]> => {
    const todayStart = startOfDay(new Date());
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'returns-log');
    const q = query(logCol, where('returnedAt', '>=', todayStart.toISOString()), orderBy('returnedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as ReturnLog);
};

export const revertReturnAction = async (returnLog: ReturnLog): Promise<void> => {
    const batch = writeBatch(db);
    
    // 1. Delete the return log entry
    const logDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'returns-log', returnLog.id);
    batch.delete(logDocRef);

    // 2. Find and delete the corresponding item from inventory that was re-added
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
    const q = query(salesCol, where('order_id', '==', orderId), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        return fromFirestore({ ...docData.data(), id: docData.id }) as Sale;
    }
    return null;
}


export async function loadSalesIdsAndOrderCodes(): Promise<{ id: string; order_code: string }[]> {
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

// --- APPROVALS ---
export const createApprovalRequest = async (request: Omit<ApprovalRequest, 'id'>): Promise<void> => {
    const requestsCol = collection(db, 'approval-requests');
    const docRef = doc(requestsCol);
    await setDoc(docRef, toFirestore({ ...request, id: docRef.id }));
};

export const loadApprovalRequests = async (status: 'pending' | 'approved' | 'rejected'): Promise<ApprovalRequest[]> => {
    const requestsCol = collection(db, 'approval-requests');
    // Firestore queries require a composite index for filtering and ordering on different fields.
    // As we cannot create indexes programmatically, we remove the ordering for now to avoid errors.
    // The list will be unsorted but functional.
    const q = query(requestsCol, where('status', '==', status));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as ApprovalRequest);
}

export const processApprovalRequest = async (request: ApprovalRequest, decision: 'approved' | 'rejected'): Promise<void> => {
    const requestDocRef = doc(db, 'approval-requests', request.id);

    if (decision === 'approved') {
        const batch = writeBatch(db);

        // 1. Delete the scanned item from inventory
        const inventoryItemRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory', request.scannedItem.id);
        batch.delete(inventoryItemRef);

        // 2. Create a new picking log entry for the approved item
        const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log');
        const logDocRef = doc(logCol);
        const newLogEntry: PickedItemLog = {
            ...request.scannedItem,
            orderNumber: (request.orderData as any).order_code,
            pickedAt: new Date().toISOString(),
            logId: logDocRef.id,
        };
        batch.set(logDocRef, toFirestore(newLogEntry));
        
        // 3. Update the request status
        batch.update(requestDocRef, { status: 'approved' });

        await batch.commit();

    } else { // 'rejected'
        // Just update the status, no inventory action needed.
        await updateDoc(requestDocRef, { status: 'rejected' });
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
    await updateDoc(docRef, data);
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


// --- APP SETTINGS & USERS ---
const settingsDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'app-data', 'settings');

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

/**
 * Atualiza o campo de status de múltiplos documentos de venda no Firestore.
 * @param updates Array de objetos com o ID da venda e o novo status.
 */
export const updateSalesStatuses = async (updates: { saleId: string; newStatus: string }[]): Promise<void> => {
  if (!updates || updates.length === 0) {
    return;
  }

  const batch = writeBatch(db);
  const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');

  updates.forEach(update => {
    const docRef = doc(salesCol, update.saleId);
    batch.update(docRef, { status: update.newStatus, status_description: update.newStatus });
  });

  await batch.commit();
};

export async function fetchSalesByIds(saleIds: string[]): Promise<Sale[]> {
    if (saleIds.length === 0) {
      return [];
    }
    const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');
    const sales: Sale[] = [];
    // Firestore 'in' query is limited to 30 items. We need to batch the requests.
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
