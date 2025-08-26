
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
  getCountFromServer,
  WriteBatch
} from 'firebase/firestore';
import type { InventoryItem, Product, Sale, PickedItemLog, AllMappingsState, ApiKeyStatus, CompanyCost, ProductCategorySettings, AppUser, SupportData, SupportFile, ReturnLog, AppSettings, PurchaseList, PurchaseListItem, Notice, ConferenceResult, ConferenceHistoryEntry, FeedEntry, ApprovalRequest } from '@/lib/types';
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

// --- ENTRY LOG ---
const migrateInventoryToEntryLog = async (): Promise<void> => {
    const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-log');
    const inventorySnapshot = await getDocs(inventoryCol);
    if (inventorySnapshot.empty) return;

    const batch = writeBatch(db);

    inventorySnapshot.forEach(docSnapshot => {
        const raw = docSnapshot.data();
        const createdAt =
        raw.createdAt instanceof Timestamp ? raw.createdAt.toDate()
        : typeof raw.createdAt === 'string' ? new Date(raw.createdAt)
        : new Date();
        const item: any = { ...raw, id: docSnapshot.id, createdAt };

        // opcional: id próprio do log (evita overwrite)
        const logRef = doc(logCol, docSnapshot.id + '-migrate');
        batch.set(logRef, toFirestore(item));
    });

    await batch.commit();
};


export const loadEntryLogs = async (dateRange?: DateRange): Promise<InventoryItem[]> => {
  const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, "entry-log");

  // Migração: mantém
  const snapshotCount = await getCountFromServer(query(logCol, limit(1)));
  if (snapshotCount.data().count === 0) {
    const inventorySnapshot = await getDocs(collection(db, USERS_COLLECTION, DEFAULT_USER_ID, "inventory"));
    if (!inventorySnapshot.empty) {
      await migrateInventoryToEntryLog();
    }
  }

  // Fallback: últimos 30 dias se não vier range
  const fromDate = dateRange?.from ?? startOfDay(new Date());
  const toDate   = dateRange?.to   ?? endOfDay(new Date());

  const fromTs = Timestamp.fromDate(new Date(startOfDay(fromDate)));
  // limite superior EXCLUSIVO: +1ms
  const toTsExclusive = Timestamp.fromMillis(endOfDay(new Date(toDate)).getTime() + 1);

  const q = query(
    logCol,
    where("createdAt", ">=", fromTs),
    where("createdAt", "<", toTsExclusive),
    orderBy("createdAt", "desc"),
    // opcional: limit(2000)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data: any = docSnap.data();
    return {
      id: docSnap.id,
      // devolve ISO pro front (tua UI espera string)
      createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt ?? null,
      name: data.name ?? data.productName ?? "",
      sku: data.sku ?? "",
      serialNumber: data.serialNumber ?? data.sn ?? "",
      condition: data.condition ?? data.condicao ?? "",
      origin: data.origin ?? data.origem ?? "",
      costPrice: Number(data.costPrice ?? data.custo ?? 0),
    } as InventoryItem;
  });
};

const logInventoryEntry = async (batch: WriteBatch, item: InventoryItem): Promise<void> => {
    const logCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-log');
    const logDocRef = doc(logCol, item.id); // Use the same ID as the inventory item for traceability
    // The item passed in should have a string date. Convert it to Firestore Timestamp for saving.
    const itemWithDateObject = { ...item, createdAt: new Date(item.createdAt) };
    batch.set(logDocRef, toFirestore(itemWithDateObject));
}

export const revertEntryAction = async (entryLog: InventoryItem): Promise<void> => {
    const batch = writeBatch(db);

    // 1. Delete the entry log record
    const entryLogDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-log', entryLog.id);
    batch.delete(entryLogDocRef);

    // 2. Find and delete the corresponding item from inventory by its serial number
    const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');
    const q = query(inventoryCol, where('serialNumber', '==', entryLog.serialNumber), limit(1));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
        const inventoryItemDocRef = snapshot.docs[0].ref;
        batch.delete(inventoryItemDocRef);
    } else {
        // This case is unlikely if the data is consistent, but it's good to handle.
        console.warn(`Could not find inventory item with SN ${entryLog.serialNumber} to revert.`);
    }

    await batch.commit();
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
  const now = new Date(); // Use a single date object for consistency

  for (const item of items) {
    const docRef = doc(inventoryCol);
    const newItem = { 
        ...item, 
        id: docRef.id, 
        createdAt: now.toISOString() // Use ISO string for the object
    };
    
    // Use the same consistent date object for both inventory and log
    const firestoreItem = { ...newItem, createdAt: now }; // Use Date object for Firestore
    batch.set(docRef, toFirestore(firestoreItem));

    // Log the entry using the consistent date
    await logInventoryEntry(batch, fromFirestore(firestoreItem));

    newItemsWithIds.push(newItem as InventoryItem);
  }

  await batch.commit();
  return newItemsWithIds;
};

export const deleteInventoryItem = async (itemId: string): Promise<void> => {
  const batch = writeBatch(db);

  // Reference to the item in the inventory
  const inventoryDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory', itemId);
  batch.delete(inventoryDocRef);

  // Reference to the item in the entry log (assuming the ID is the same)
  const entryLogDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-log', itemId);
  batch.delete(entryLogDocRef);
  
  await batch.commit();
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
  const now = new Date();

  // 1) Apaga o log de saída
  const logDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'picking-log', pickLog.logId);
  batch.delete(logDocRef);

  // 2) Se não for manual, recoloca no inventory
  if (!pickLog.id.startsWith('manual-')) {
    const inventoryDocRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory', pickLog.id);
    const { logId, orderNumber, pickedAt, ...itemToAddBack } = pickLog;

    // createdAt novo para a reentrada (evento de volta ao estoque)
    const itemWithDate = { ...itemToAddBack, createdAt: now };
    batch.set(inventoryDocRef, toFirestore(itemWithDate));

    // 3) **LOG DE ENTRADA** da reversão
    const entryLogCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'entry-log');
    const entryLogRef = doc(entryLogCol, pickLog.id + '-revert-' + now.getTime()); // id único p/ não sobrescrever
    const entryLogPayload: InventoryItem = {
      ...(fromFirestore(itemWithDate) as any),
      id: entryLogRef.id,           // id do log ≠ id do inventory (evita overwrite)
      origin: pickLog.origin ?? 'Reversão de Picking',
      createdAt: now.toISOString(), // salva como ISO; toFirestore converte p/ Timestamp
    };
    batch.set(entryLogRef, toFirestore({ ...entryLogPayload, createdAt: now }));
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
export const saveReturnLog = async (data: Omit<ReturnLog, 'id' | 'returnedAt'>): Promise<void> => {
    const batch = writeBatch(db);
    const returnsLogCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'returns-log');
    const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');

    // 1. Create the return log
    const returnDocRef = doc(returnsLogCol);
    const now = new Date();
    const newReturnLog: ReturnLog = {
        ...data,
        id: returnDocRef.id,
        returnedAt: now.toISOString(),
        originalSaleData: data.originalSaleData || null, // Ensure null instead of undefined
    };
    batch.set(returnDocRef, toFirestore({ ...newReturnLog, returnedAt: now }));

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
        createdAt: now.toISOString(), // The date it re-entered inventory
    };
    const firestoreItem = { ...itemToReenter, createdAt: now }; // Use Date object for Firestore
    batch.set(inventoryItemDocRef, toFirestore(firestoreItem));
    await logInventoryEntry(batch, itemToReenter); // Log the return as an entry

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

export const findSaleByOrderNumber = async (orderIdentifier: string): Promise<Sale | null> => {
    const salesCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'sales');
    const identifier = orderIdentifier.trim();

    // Stage 1: Attempt exact match on order_code or order_id
    const isNumeric = !isNaN(Number(identifier));
    
    // Query for exact order_code match
    const qCode = query(salesCol, where('order_code', '==', identifier), limit(1));
    const codeSnapshot = await getDocs(qCode);
    if (!codeSnapshot.empty) {
        return fromFirestore({ ...codeSnapshot.docs[0].data(), id: codeSnapshot.docs[0].id }) as Sale;
    }

    // If it's a number, also query for exact order_id match
    if (isNumeric) {
        const numericId = Number(identifier);
        const qId = query(salesCol, where('order_id', '==', numericId), limit(1));
        const idSnapshot = await getDocs(qId);
        if (!idSnapshot.empty) {
            return fromFirestore({ ...idSnapshot.docs[0].data(), id: idSnapshot.docs[0].id }) as Sale;
        }
    }
    
    // Stage 2: Fallback to "contains" search if no exact match was found
    // This part is less efficient and should be a last resort.
    const allSales = await loadSales(); // This loads all sales, which can be slow
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
    // Firestore queries require a composite index for filtering and ordering on different fields.
    // As we cannot create indexes programmatically, we remove the ordering for now to avoid errors.
    // The list will be unsorted but functional.
    const q = query(requestsCol, where('status', '==', status));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore({ ...doc.data(), id: doc.id }) as ApprovalRequest);
}

export const processApprovalRequest = async (request: ApprovalRequest, decision: 'approved' | 'rejected', userEmail: string): Promise<void> => {
    const requestDocRef = doc(db, 'approval-requests', request.id);
    const updateData: Partial<ApprovalRequest> = {
        status: decision,
        processedBy: userEmail,
        processedAt: new Date().toISOString(),
    };

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
        batch.update(requestDocRef, toFirestore(updateData));

        await batch.commit();

    } else { // 'rejected'
        // Just update the status, no inventory action needed.
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
    today.setHours(today.getHours() - 3); // Adjust for timezone if needed (e.g., UTC-3)
    const dateKey = today.toISOString().split("T")[0];

    const docRef = doc(db, "daily-summaries", dateKey);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docSnap.data().initialStock || 0;
    }
    
    // Fallback if the scheduled function hasn't run yet for today
    const inventoryCol = collection(db, USERS_COLLECTION, DEFAULT_USER_ID, 'inventory');
    const snapshot = await getCountFromServer(inventoryCol);
    return snapshot.data().count;
};
