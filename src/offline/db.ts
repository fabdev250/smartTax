// IndexedDB custom helper for SmartTax offline-first workflow
export interface OfflineItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  vatRate: number;
  taxCalculated: number;
}

export interface OfflineSale {
  businessId: string;
  items: OfflineItem[];
  totalAmount: number;
  taxAmount: number;
  paymentMethod: "Mobile Money" | "Cash" | "Card";
  paymentStatus: "Paid" | "Pending";
  mobileMoneyNumber?: string;
  createdAt: string; // ISO string
  _tempId: string;
}

const DB_NAME = "smarttax_offline_db";
const DB_VERSION = 1;

export function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => {
      console.error("IndexedDB load error:", e);
      reject(e);
    };

    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Define offline caches
      if (!db.objectStoreNames.contains("businesses")) {
        db.createObjectStore("businesses", { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains("products")) {
        db.createObjectStore("products", { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains("sales_queue")) {
        db.createObjectStore("sales_queue", { keyPath: "_tempId" });
      }
      if (!db.objectStoreNames.contains("sales_history")) {
        db.createObjectStore("sales_history", { keyPath: "_id" });
      }
    };
  });
}

// Global generic accessors
export async function getOfflineStore<T>(storeName: string): Promise<T[]> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = (err) => reject(err);
  });
}

export async function saveToOfflineStore<T>(storeName: string, item: T): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = (err) => reject(err);
  });
}

export async function clearOfflineStore(storeName: string): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = (err) => reject(err);
  });
}

export async function removeFromOfflineStore(storeName: string, key: string): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = (err) => reject(err);
  });
}

// Specific wrappers
export async function getBusinessesOffline(): Promise<any[]> {
  return getOfflineStore("businesses");
}

export async function cacheBusinessesOffline(businesses: any[]): Promise<void> {
  for (const b of businesses) {
    await saveToOfflineStore("businesses", b);
  }
}

export async function getProductsOffline(): Promise<any[]> {
  return getOfflineStore("products");
}

export async function cacheProductsOffline(products: any[]): Promise<void> {
  for (const p of products) {
    if (!p._id) {
       p._id = `OFFLINE-PRD-${Math.random().toString(36).substr(2, 9)}`;
    }
    await saveToOfflineStore("products", p);
  }
}

export async function addSaleToSyncQueue(sale: OfflineSale): Promise<void> {
  await saveToOfflineStore("sales_queue", sale);
}

export async function getSyncQueue(): Promise<OfflineSale[]> {
  return getOfflineStore("sales_queue");
}

export async function popSaleFromSyncQueue(tempId: string): Promise<void> {
  await removeFromOfflineStore("sales_queue", tempId);
}
