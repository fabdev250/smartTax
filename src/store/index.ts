import { create } from "zustand";
import axios from "axios";
import en from "../locales/en.json";
import rw from "../locales/rw.json";
import fr from "../locales/fr.json";
import { getSyncQueue, addSaleToSyncQueue, popSaleFromSyncQueue, cacheBusinessesOffline, getBusinessesOffline, cacheProductsOffline, getProductsOffline, OfflineSale } from "../offline/db";

// Locales mapping dictionary
const translations: Record<string, Record<string, string>> = { en, rw, fr };

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: "national_admin" | "provincial_admin" | "district_admin" | "sector_admin" | "business_owner";
  geographicScope: {
    province?: string;
    district?: string;
    sector?: string;
  };
  phoneNumber?: string;
}

interface SmartTaxState {
  token: string | null;
  user: UserInfo | null;
  language: "en" | "rw" | "fr";
  offlineMode: boolean;
  syncing: boolean;
  syncQueueCount: number;
  businesses: any[];
  currentBusiness: any | null;
  products: any[];
  sales: any[];
  taxSummary: { paid: number; pending: number; transactions: any[] } | null;
  adminAnalytics: any | null;

  // Actions
  setLanguage: (lang: "en" | "rw" | "fr") => void;
  setOfflineMode: (offline: boolean) => void;
  t: (key: string) => string;
  login: (token: string, user: UserInfo) => void;
  logout: () => void;
  fetchBusinesses: () => Promise<void>;
  setCurrentBusiness: (biz: any) => void;
  fetchProducts: (businessId: string) => Promise<void>;
  createBusiness: (bizData: any) => Promise<void>;
  createProduct: (businessId: string, prdData: any) => Promise<void>;
  recordSaleOnlineOrOffline: (businessId: string, saleData: {
    items: any[];
    paymentMethod: "Mobile Money" | "Cash" | "Card";
    mobileMoneyNumber?: string;
  }) => Promise<any>;
  triggerSync: () => Promise<void>;
  fetchTaxSummary: (businessId: string) => Promise<void>;
  settleTaxes: (businessId: string, data: { amount: number; mobileMoneyNumber: string; provider: string }) => Promise<any>;
  fetchAdminAnalytics: () => Promise<void>;
  checkOnlineStatusAndRefresh: () => Promise<void>;
}

export const useSmartTaxStore = create<SmartTaxState>((set, get) => ({
  token: localStorage.getItem("smarttax_token"),
  user: localStorage.getItem("smarttax_user") ? JSON.parse(localStorage.getItem("smarttax_user")!) : null,
  language: (localStorage.getItem("smarttax_lang") as any) || "en",
  offlineMode: !navigator.onLine,
  syncing: false,
  syncQueueCount: 0,
  businesses: [],
  currentBusiness: null,
  products: [],
  sales: [],
  taxSummary: null,
  adminAnalytics: null,

  setLanguage: (lang) => {
    localStorage.setItem("smarttax_lang", lang);
    set({ language: lang });
  },

  setOfflineMode: (offline) => {
    set({ offlineMode: offline });
    if (!offline) {
      get().triggerSync();
    }
  },

  t: (key) => {
    const lang = get().language;
    return translations[lang]?.[key] || translations["en"]?.[key] || key;
  },

  login: (token, user) => {
    localStorage.setItem("smarttax_token", token);
    localStorage.setItem("smarttax_user", JSON.stringify(user));
    set({ token, user, offlineMode: !navigator.onLine });
    get().fetchBusinesses();
    get().triggerSync();
  },

  logout: () => {
    localStorage.removeItem("smarttax_token");
    localStorage.removeItem("smarttax_user");
    set({ token: null, user: null, businesses: [], currentBusiness: null, products: [], sales: [], taxSummary: null, adminAnalytics: null });
  },

  // Generic axios headers setup
  checkOnlineStatusAndRefresh: async () => {
    const isOnline = navigator.onLine;
    set({ offlineMode: !isOnline });
    // Update offline queue count
    try {
      const q = await getSyncQueue();
      set({ syncQueueCount: q.length });
    } catch (_) {}
  },

  fetchBusinesses: async () => {
    const { token, offlineMode } = get();
    if (offlineMode) {
      const b = await getBusinessesOffline();
      set({ businesses: b });
      if (b.length > 0 && !get().currentBusiness) {
        set({ currentBusiness: b[0] });
      }
      return;
    }

    try {
      const res = await axios.get("/api/businesses", {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ businesses: res.data });
      await cacheBusinessesOffline(res.data);
      if (res.data.length > 0 && !get().currentBusiness) {
        set({ currentBusiness: res.data[0] });
      }
    } catch (err) {
      console.error("Fetch businesses failed:", err);
      // Fallback
      const b = await getBusinessesOffline();
      set({ businesses: b });
    }
  },

  setCurrentBusiness: (biz) => {
    set({ currentBusiness: biz });
    if (biz) {
      get().fetchProducts(biz._id);
      get().fetchTaxSummary(biz._id);
    }
  },

  fetchProducts: async (businessId) => {
    const { token, offlineMode } = get();
    if (offlineMode) {
      const allPrds = await getProductsOffline();
      // filter locally if they contain businessId
      const filtered = allPrds.filter((p) => p.businessId === businessId);
      set({ products: filtered });
      return;
    }

    try {
      const res = await axios.get(`/api/businesses/${businessId}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ products: res.data });
      await cacheProductsOffline(res.data);
    } catch (err) {
      const allPrds = await getProductsOffline();
      const filtered = allPrds.filter((p) => p.businessId === businessId);
      set({ products: filtered });
    }
  },

  createBusiness: async (bizData) => {
    const { token, offlineMode } = get();
    if (offlineMode) {
      throw new Error("Registering new businesses with RRA requires a live cellular or internet connection.");
    }
    const res = await axios.post("/api/businesses", bizData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set((state) => ({ businesses: [...state.businesses, res.data] }));
    await cacheBusinessesOffline([res.data]);
  },

  createProduct: async (businessId, prdData) => {
    const { token, offlineMode } = get();
    if (offlineMode) {
      // offline creation
      const tempPrd = {
        _id: `OFFLINE-PRD-${Math.random().toString(36).substr(2, 9)}`,
        businessId,
        ...prdData,
        createdAt: new Date().toISOString()
      };
      await cacheProductsOffline([tempPrd]);
      set((state) => ({ products: [...state.products, tempPrd] }));
      return;
    }

    const res = await axios.post(`/api/businesses/${businessId}/products`, prdData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    set((state) => ({ products: [...state.products, res.data] }));
    await cacheProductsOffline([res.data]);
  },

  recordSaleOnlineOrOffline: async (businessId, saleData) => {
    const { token, offlineMode } = get();

    // calculate tax locally matching 18% standard VAT
    let localTax = 0;
    let localTotal = 0;
    const computedItems = saleData.items.map((it: any) => {
      const lineTotal = it.price * it.quantity;
      const vat = it.taxExempt ? 0 : Math.round(lineTotal * ((it.vatRate || 18) / 100));
      localTax += vat;
      localTotal += lineTotal;
      return {
        ...it,
        taxCalculated: vat
      };
    });

    if (offlineMode) {
      const tempSale: OfflineSale = {
        _tempId: `SALE-OFFLINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        businessId,
        items: computedItems,
        totalAmount: localTotal,
        taxAmount: localTax,
        paymentMethod: saleData.paymentMethod,
        paymentStatus: saleData.paymentMethod === "Cash" ? "Pending" : "Paid",
        mobileMoneyNumber: saleData.mobileMoneyNumber,
        createdAt: new Date().toISOString()
      };

      // save in sync queue state
      await addSaleToSyncQueue(tempSale);
      const q = await getSyncQueue();
      set({ syncQueueCount: q.length });
      return { success: true, offline: true, sale: tempSale };
    }

    // Online Recording
    const res = await axios.post(`/api/businesses/${businessId}/sales`, {
      items: computedItems,
      paymentMethod: saleData.paymentMethod,
      mobileMoneyNumber: saleData.mobileMoneyNumber
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Refresh status
    await get().fetchTaxSummary(businessId);
    return { success: true, offline: false, data: res.data };
  },

  triggerSync: async () => {
    const { token, syncing } = get();
    if (syncing || !navigator.onLine) return;

    try {
      const queue = await getSyncQueue();
      if (queue.length === 0) {
        set({ syncQueueCount: 0 });
        return;
      }

      set({ syncing: true });

      // send to api
      await axios.post("/api/sales/sync", { sales: queue }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Clear synced sales
      for (const item of queue) {
        await popSaleFromSyncQueue(item._tempId);
      }

      const updatedQueue = await getSyncQueue();
      set({ syncing: false, syncQueueCount: updatedQueue.length });

      // Refresh data
      if (get().currentBusiness) {
        await get().fetchTaxSummary(get().currentBusiness._id);
      }
    } catch (err) {
      console.error("Auto Sync Failure:", err);
      set({ syncing: false });
    }
  },

  fetchTaxSummary: async (businessId) => {
    const { token, offlineMode } = get();
    if (offlineMode) return; // Summary is read online

    try {
      const res = await axios.get(`/api/businesses/${businessId}/tax-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ taxSummary: res.data });
    } catch (err) {
      console.error("Error fetching tax summaries:", err);
    }
  },

  settleTaxes: async (businessId, data) => {
    const { token, offlineMode } = get();
    if (offlineMode) {
      throw new Error("Tax settlement via MoMo APIs requires a live cellular networks connection.");
    }

    const res = await axios.post(`/api/businesses/${businessId}/settle-taxes`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });

    await get().fetchTaxSummary(businessId);
    return res.data;
  },

  fetchAdminAnalytics: async () => {
    const { token, offlineMode } = get();
    if (offlineMode) return;

    try {
      const res = await axios.get("/api/admin/analytics", {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ adminAnalytics: res.data });
    } catch (err) {
      console.error("Admin analytics loading failure", err);
    }
  }
}));
