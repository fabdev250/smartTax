import React, { useState, useEffect } from "react";
import axios from "axios";
import { useSmartTaxStore } from "./store";
import { registerServiceWorker } from "./sw-register";

// Views
import AuthPortal from "./components/Auth_Portal";
import SMEDashboard from "./components/SME_Dashboard";
import SMEInventory from "./components/SME_Inventory";
import SMEPOS from "./components/SME_POS";
import SMETaxes from "./components/SME_Taxes";
import SMEAIAssistant from "./components/SME_AIAssistant";
import AdminDashboard from "./components/Admin_Dashboard";

// Icons
import {
  LayoutGrid,
  ClipboardList,
  Cpu,
  Coins,
  Receipt,
  LogOut,
  UserCheck,
  Building,
  Activity,
  User,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";

import LanguageSelector from "./components/LanguageSelector";

type ActiveTab = "dashboard" | "inventory" | "sales" | "taxes" | "assistant" | "admin";

export default function App() {
  const {
    token,
    user,
    logout,
    t,
    offlineMode,
    setOfflineMode,
    checkOnlineStatusAndRefresh,
    triggerSync,
  } = useSmartTaxStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");

  useEffect(() => {
    // Initiate Service Worker caching registration early
    registerServiceWorker();

    // Check offline status at start
    checkOnlineStatusAndRefresh();

    // Validate active token session with backend to handle base database shifts smoothly
    if (token) {
      axios.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      }).then((res) => {
        // sync local cached info if needed, or do nothing
        if (res.data?.user) {
          localStorage.setItem("smarttax_user", JSON.stringify(res.data.user));
        }
      }).catch((err) => {
        console.error("Session validated as stale or user deleted. Evicting local token context:", err);
        logout();
      });
    }

    const handleOnline = () => {
      setOfflineMode(false);
      triggerSync();
    };

    const handleOffline = () => {
      setOfflineMode(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Sync state if user role differs
  useEffect(() => {
    if (user) {
      if (user.role !== "business_owner") {
        setActiveTab("admin");
      } else {
        setActiveTab("dashboard");
      }
    }
  }, [user]);

  if (!token || !user) {
    return <AuthPortal />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case "dashboard":
        return <SMEDashboard />;
      case "inventory":
        return <SMEInventory />;
      case "sales":
        return <SMEPOS />;
      case "taxes":
        return <SMETaxes />;
      case "assistant":
        return <SMEAIAssistant />;
      case "admin":
        return <AdminDashboard />;
      default:
        return <SMEDashboard />;
    }
  };

  const isSmeOwner = user.role === "business_owner";

  return (
    <div className="min-h-screen bg-[#080808] text-[#e0e0e0] flex flex-col font-sans select-none">
      
      {/* Top sticky app-bar banner */}
      <header className="sticky top-0 bg-[#0c0c0c]/95 backdrop-blur-md border-b border-[#1a1a1a] px-4 py-3 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#d4af37] flex items-center justify-center text-black font-semibold text-base shadow-sm font-serif">
            S
          </div>
          <div className="text-left leading-none">
            <h1 className="text-base font-serif italic text-[#d4af37] leading-none">SmartTax</h1>
            <span className="text-[9px] uppercase tracking-wider text-[#777] font-bold font-mono">
              Rwanda-EBM v2
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Select Translations */}
          <LanguageSelector />

          {/* User badge */}
          <div className="flex items-center gap-1.5 bg-[#121212] px-2.5 py-1.5 rounded-full border border-[#222]">
            <User className="w-3.5 h-3.5 text-[#888]" />
            <span className="text-[10px] font-bold text-[#e0e0e0] max-w-[50px] truncate">
              {user.name.split(" ")[0]}
            </span>
          </div>

          {/* Logout btn */}
          <button
            id="app-logout-btn"
            onClick={logout}
            className="p-1.5 text-[#555] hover:text-[#d4af37] hover:bg-[#d4af37]/5 rounded-full transition-all"
            title={t("nav.logout")}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container Core viewports */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-4 overflow-y-auto pb-24">
        {renderActiveView()}
      </main>

      {/* Bottom Navigation Rails Bar (resembles mobile banking) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0c0c0c]/98 backdrop-blur-lg border-t border-[#1a1a1a] px-4 py-2 flex items-center justify-around pb-safe z-40 max-w-md mx-auto shadow-2xl rounded-t-2xl">
        
        {isSmeOwner ? (
          <>
            {/* Dashboard tab */}
            <button
              id="nav-tab-dash"
              onClick={() => setActiveTab("dashboard")}
              className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none ${
                activeTab === "dashboard" ? "text-[#d4af37]" : "text-[#555] hover:text-[#bbb]"
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-1 tracking-tight">{t("nav.dashboard")}</span>
            </button>

            {/* Inventory tab */}
            <button
              id="nav-tab-inv"
              onClick={() => setActiveTab("inventory")}
              className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none ${
                activeTab === "inventory" ? "text-[#d4af37]" : "text-[#555] hover:text-[#bbb]"
              }`}
            >
              <ClipboardList className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-1 tracking-tight">{t("nav.inventory")}</span>
            </button>

            {/* Sales /POS tab */}
            <button
              id="nav-tab-pos"
              onClick={() => setActiveTab("sales")}
              className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none ${
                activeTab === "sales" ? "text-[#d4af37]" : "text-[#555] hover:text-[#bbb]"
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-1 tracking-tight">{t("nav.sales")}</span>
            </button>

            {/* Taxes Ledger tab */}
            <button
              id="nav-tab-taxes"
              onClick={() => setActiveTab("taxes")}
              className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none relative ${
                activeTab === "taxes" ? "text-[#d4af37]" : "text-[#555] hover:text-[#bbb]"
              }`}
            >
              <Coins className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-1 tracking-tight">{t("nav.taxes")}</span>
            </button>
          </>
        ) : (
          <>
            {/* Admin Supervision Scope tab */}
            <button
              id="nav-tab-admin"
              onClick={() => setActiveTab("admin")}
              className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none ${
                activeTab === "admin" ? "text-[#d4af37]" : "text-[#555] hover:text-[#bbb]"
              }`}
            >
              <Activity className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-1 tracking-tight">Supervision</span>
            </button>
          </>
        )}

        {/* AI advisor chat tab is accessible globally */}
        <button
          id="nav-tab-ai"
          onClick={() => setActiveTab("assistant")}
          className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none ${
            activeTab === "assistant" ? "text-[#d4af37]" : "text-[#555] hover:text-[#bbb]"
          }`}
        >
          <Cpu className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-1 tracking-tight">{t("nav.assistant")}</span>
        </button>
      </nav>
    </div>
  );
}
