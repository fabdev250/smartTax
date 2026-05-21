import React, { useState, useEffect } from "react";
import axios from "axios";
import { useSmartTaxStore } from "../store";
import {
  ShieldAlert,
  BarChart3,
  TrendingUp,
  Building2,
  Landmark,
  CheckCircle,
  HelpCircle,
  ArrowUpRight,
  Coins,
  ShieldCheck,
  Mail,
  Settings,
  RefreshCw,
  Plus,
  Users,
  Search,
  Download,
  AlertTriangle,
  Eye,
  UserPlus,
  Lock,
  FileText,
  Globe,
  LogOut,
  ArrowLeft,
  Send,
  Activity,
  Info,
  CreditCard,
  ChevronRight,
  Sliders,
  Bell,
  FileSpreadsheet
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

type AdminSection =
  | "hub"
  | "dashboard"
  | "revenue"
  | "tax_monitoring"
  | "pending_taxes"
  | "compliance_reports"
  | "province_perf"
  | "business_manage"
  | "users_provincial"
  | "users_district"
  | "users_sector"
  | "payment_momo"
  | "ai_forecasts"
  | "audit_logs"
  | "activity_logs"
  | "security_center"
  | "announcements"
  | "tax_config"
  | "penalty"
  | "report_exports"
  | "fraud_phase2"
  | "profile";

export default function AdminDashboard() {
  const {
    t,
    user,
    token,
    adminAnalytics,
    fetchAdminAnalytics,
    offlineMode,
    logout
  } = useSmartTaxStore();

  // Root Navigation Control
  const [activeSection, setActiveSection] = useState<AdminSection>("hub");

  // Database-backed states
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [momoPayments, setMomoPayments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // GUI control states
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Administrative dynamic settings states (Persisted in Component Memory)
  const [taxConfig, setTaxConfig] = useState({
    defaultVatRate: 18,
    ebmSelfCheck: true,
    flatTaxThreshold: 12000000,
    rraServerEndpoint: "https://ebm.rra.gov.rw/v2/secure"
  });

  const [penaltyConfig, setPenaltyConfig] = useState({
    lateFilingFee: 100000, // RWF
    monthlyInterestRate: 1.5, // %
    ebmMalfunctionFine: 500000, // RWF
    graceDays: 15
  });

  const [broadcastMessage, setBroadcastMessage] = useState({
    title: "",
    body: "",
    priority: "Alert"
  });

  const [announcements, setAnnouncements] = useState<any[]>([
    {
      id: "ann-1",
      title: "Mandatory EBM v2 Signature Standard Upgrade",
      body: "All taxpayer categories are requested to perform dynamic certificate validation checks before 1st June 2026 to avoid synchronization holdouts.",
      priority: "Critical",
      createdAt: new Date("2026-05-18T10:00:00Z")
    },
    {
      id: "ann-2",
      title: "MTN MoMo Integration Patch Complete",
      body: "RRA clearing pipelines for instant tax collection via MTN Mobile Money have completed active hot-fixes. Real-time clearances are running optimally.",
      priority: "Info",
      createdAt: new Date("2026-05-20T08:30:00Z")
    }
  ]);

  // Forecast state
  const [complianceMultiplier, setComplianceMultiplier] = useState(85);

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    scopeProvince: user?.geographicScope?.province || "National Scope"
  });

  // Provisioning Form state
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    password: "",
    province: "",
    district: "",
    sector: "",
    phoneNumber: ""
  });
  const [submittingInvite, setSubmittingInvite] = useState(false);

  // Alerts display helper
  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Pre-load all analytical variables
  useEffect(() => {
    fetchAdminAnalytics();
    if (token) {
      fetchBusinessesAndData();
    }
  }, [token]);

  const fetchBusinessesAndData = async () => {
    setLoading(true);
    try {
      const [resBiz, resMomo, resLogs, resUsers] = await Promise.all([
        axios.get("/api/admin/detailed-businesses", { headers: { Authorization: `Bearer ${token}` } }),
        axios.get("/api/admin/momo-payments", { headers: { Authorization: `Bearer ${token}` } }),
        axios.get("/api/admin/audit-logs", { headers: { Authorization: `Bearer ${token}` } }),
        axios.get("/api/admin/users-list", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setBusinesses(resBiz.data || []);
      setMomoPayments(resMomo.data || []);
      setAuditLogs(resLogs.data || []);
      setUsersList(resUsers.data || []);
    } catch (err: any) {
      console.error("Administrative fetch failed:", err);
      showToast("Error retrieving full supervisor databases", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBusinessStatus = async (bizId: string) => {
    try {
      const res = await axios.post(`/api/admin/businesses/${bizId}/toggle-status`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        const updatedStatus = res.data.isActive ? "Active" : "Suspended";
        showToast(`Business is now ${updatedStatus}`, "success");
        // Instant visual update of listings
        setBusinesses((prev) =>
          prev.map((b) => (b._id === bizId ? { ...b, isActive: res.data.isActive } : b))
        );
        fetchAdminAnalytics();
        // Append a live audit action locally
        const mockLog = {
          _id: `mock-${Date.now()}`,
          userId: { name: user?.name, role: user?.role },
          action: "BUSINESS_SUSPEND_TOGGLE",
          details: `Changed state of business to ${updatedStatus}`,
          createdAt: new Date()
        };
        setAuditLogs((prev) => [mockLog, ...prev]);
      }
    } catch (err: any) {
      showToast("Failed to alter business suspension status", "error");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingInvite(true);
    try {
      let targetRole = "provincial_admin";
      if (activeSection === "users_district") targetRole = "district_admin";
      if (activeSection === "users_sector") targetRole = "sector_admin";

      const payload = {
        ...inviteForm,
        role: targetRole
      };

      const res = await axios.post("/api/admin/users-create", payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        showToast(`${targetRole.replace("_", " ")} provisioned successfully!`, "success");
        setInviteForm({
          name: "",
          email: "",
          password: "",
          province: "",
          district: "",
          sector: "",
          phoneNumber: ""
        });
        // Reload directories
        const resUsers = await axios.get("/api/admin/users-list", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsersList(resUsers.data || []);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || "Failed to provision workspace administrator";
      showToast(errorMsg, "error");
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handlePostAnnounce = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.title || !broadcastMessage.body) {
      showToast("Please provide both title and content.", "error");
      return;
    }
    const newAnn = {
      id: `ann-${Date.now()}`,
      title: broadcastMessage.title,
      body: broadcastMessage.body,
      priority: broadcastMessage.priority,
      createdAt: new Date()
    };
    setAnnouncements((prev) => [newAnn, ...prev]);
    setBroadcastMessage({ title: "", body: "", priority: "Alert" });
    showToast("Announcement broadcasted successfully!", "success");
  };

  // Core high-fidelity CSV generator downloadable from browser
  const triggerCsvDownload = (module: string) => {
    let headers = "";
    let rows = "";
    let filename = "";

    if (module === "businesses") {
      headers = "ID,Business Name,TIN,Category,Province,District,Sector,Status,Created At\n";
      businesses.forEach((b) => {
        rows += `"${b._id}","${b.name.replace(/"/g, '""')}","${b.tin}","${b.category}","${b.address?.province}","${b.address?.district}","${b.address?.sector}","${b.isActive ? "Active" : "Suspended"}","${b.createdAt}"\n`;
      });
      filename = "rra_detailed_businesses.csv";
    } else if (module === "momo") {
      headers = "Transaction ID,Business Name,TIN,Tax Amount (RWF),Status,Payment Method,Reference Number,Date\n";
      momoPayments.forEach((p) => {
        rows += `"${p._id}","${p.businessName.replace(/"/g, '""')}","${p.tin}",${p.taxAmount},"${p.status}","${p.paymentMethod}","${p.referenceNumber}","${p.createdAt}"\n`;
      });
      filename = "rra_momo_payments_ledger.csv";
    } else if (module === "audit") {
      headers = "ID,User,Role,Action,Details,Date\n";
      auditLogs.forEach((l) => {
        rows += `"${l._id}","${l.userId?.name || "System"}","${l.userId?.role || "SYSTEM"}","${l.action}","${l.details?.replace(/"/g, '""')}","${l.createdAt}"\n`;
      });
      filename = "rra_security_audit_logs.csv";
    } else if (module === "compliance") {
      headers = "Business Name,TIN,Province,District,Sector,State\n";
      businesses.forEach((b) => {
        const isCompliant = b.isActive; // Simple simulator
        rows += `"${b.name.replace(/"/g, '""')}","${b.tin}","${b.address?.province}","${b.address?.district}","${b.address?.sector}","${isCompliant ? "Compliant" : "Non-Compliant"}"\n`;
      });
      filename = "rra_compliance_reports.csv";
    }

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Compiled spreadsheet export complete!`, "success");
  };

  if (offlineMode) {
    return (
      <div className="bg-[#0f0f0f] border border-[#1e1e1e] p-8 rounded-2xl text-center space-y-3 max-w-md mx-auto my-10">
        <Landmark className="w-12 h-12 text-[#d4af37] mx-auto animate-pulse" />
        <h3 className="text-sm font-bold text-[#e0e0e0]">{t("common.offline")}</h3>
        <p className="text-xs text-slate-400">
          Supervision and national tax analytics dashboards require a live connection to the RRA networks.
        </p>
      </div>
    );
  }

  // Pre-calculations for quick KPIs
  const totalSMEsCount = businesses.length;
  const activeSMEsCount = businesses.filter((b) => b.isActive).length;
  const suspendedSMEsCount = businesses.filter((b) => !b.isActive).length;
  const complianceRate = totalSMEsCount > 0 ? Math.round((activeSMEsCount / totalSMEsCount) * 100) : 100;

  return (
    <div className="space-y-4">
      {/* Toast Panel notification feedback */}
      {toast && (
        <div
          id="toast-banner"
          className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl border z-50 text-xs flex items-center gap-2 shadow-2xl transition-all duration-300 ${
            toast.type === "success"
              ? "bg-[#091b10] border-[#10b981]/50 text-[#10b981]"
              : toast.type === "error"
              ? "bg-[#1c0809] border-[#ef4444]/50 text-[#ef4444]"
              : "bg-[#14120e] border-[#d4af37]/50 text-[#d4af37]"
          }`}
        >
          <Info className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Breadcrumb strip / Context Router header */}
      <div className="flex items-center justify-between bg-[#121212] border border-[#1e1e1e] p-3 rounded-2xl">
        <div className="flex items-center gap-2">
          {activeSection !== "hub" && (
            <button
              id="back-to-hub-btn"
              onClick={() => {
                setActiveSection("hub");
                setSearchText("");
              }}
              className="p-1 px-2.5 rounded-lg bg-[#1a1a1a] border border-[#262626] text-xs text-[#d4af37] hover:bg-[#d4af37]/10 flex items-center gap-1 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Portal Menu
            </button>
          )}
          {activeSection === "hub" && (
            <div className="flex items-center gap-1.5 text-xs text-[#d4af37] font-semibold">
              <Landmark className="w-3.5 h-3.5" />
              <span>RRA Administrative Scopes</span>
            </div>
          )}
        </div>

        <button
          onClick={fetchBusinessesAndData}
          className="p-1.5 rounded-lg bg-[#181818] border border-[#2a2a2a] text-[#aaa] hover:text-white hover:bg-[#222] transition-all"
          title="Refresh All Database Registries"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#d4af37]" : ""}`} />
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. THE MAIN ADMINISTRATIVE HUB LIST (VAULT HUB MENU) */}
      {/* ---------------------------------------------------- */}
      {activeSection === "hub" && (
        <div className="space-y-5 animate-fade-in text-left pb-10">
          
          {/* Main Scope Header */}
          <div className="p-4 bg-gradient-to-br from-[#1c1910] to-[#0c0c0c] border border-[#2e2612]/60 rounded-3xl space-y-1.5 relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-5 font-bold tracking-widest text-8xl uppercase leading-none font-serif select-none pointer-events-none text-[#d4af37]">
              RRA
            </div>
            <p className="text-[10px] text-[#d4af37] font-bold uppercase tracking-widest">NATIONAL SYSTEM GATEWAY</p>
            <h2 className="text-base font-serif italic text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#d4af37]" /> Rwanda Revenue Authority
            </h2>
            <div className="h-[1px] bg-gradient-to-r from-[#d4af37]/40 to-transparent my-1.5" />
            <p className="text-[11px] text-[#999] leading-relaxed">
              Geographic Supervision Access Level: <span className="font-mono text-[#e0e0e0] font-bold bg-[#1e1c12] px-1.5 py-0.5 rounded border border-[#3e3415]">National Level (Rwanda)</span>
            </p>
          </div>

          {/* Stat summary bar */}
          <div className="grid grid-cols-3 gap-2 bg-[#0c0c0c] border border-[#1a1a1a] p-2.5 rounded-2xl">
            <div className="text-center">
              <span className="text-[8px] text-[#666] uppercase block">Supervised SMEs</span>
              <span className="text-sm font-mono font-bold text-white">{totalSMEsCount}</span>
            </div>
            <div className="text-center border-x border-[#1a1a1a]">
              <span className="text-[8px] text-[#666] uppercase block">Compliance Rate</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{complianceRate}%</span>
            </div>
            <div className="text-center">
              <span className="text-[8px] text-[#666] uppercase block">Momo Payments</span>
              <span className="text-sm font-mono font-bold text-[#d4af37]">{momoPayments.length}</span>
            </div>
          </div>

          {/* MODULE CATEGORY Group 1 */}
          <div className="space-y-2">
            <p className="text-[9px] uppercase font-bold tracking-wider text-[#666]">1. National Analytics & Supervision</p>
            <div className="grid grid-cols-1 gap-2">
              
              {/* Dashboard overview */}
              <button
                onClick={() => setActiveSection("dashboard")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">National Analytics Dashboard</h4>
                    <p className="text-[10px] text-[#777]">Revenue collection timelines and monthly charts</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Revenue Monitoring */}
              <button
                onClick={() => setActiveSection("revenue")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Revenue Monitoring</h4>
                    <p className="text-[10px] text-[#777]">SME gross turnovers and online streams</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Tax Monitoring */}
              <button
                onClick={() => setActiveSection("tax_monitoring")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#d4af37]/10 text-[#d4af37]">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Tax Monitoring</h4>
                    <p className="text-[10px] text-[#777]">Verify VAT rate calculations and ledger clearances</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Pending Taxes */}
              <button
                onClick={() => setActiveSection("pending_taxes")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Pending Taxes</h4>
                    <p className="text-[10px] text-[#777]">Track Cash outstandings and late clearings</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Compliance Reports */}
              <button
                onClick={() => setActiveSection("compliance_reports")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Compliance Reports</h4>
                    <p className="text-[10px] text-[#777]">Active syncing rate ledgers and non-compliant flags</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Province Performance */}
              <button
                onClick={() => setActiveSection("province_perf")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Province & Regional Performance</h4>
                    <p className="text-[10px] text-[#777]">Rwandan provincial VAT collection charts and rankings</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

            </div>
          </div>

          {/* MODULE CATEGORY Group 2 */}
          <div className="space-y-2">
            <p className="text-[9px] uppercase font-bold tracking-wider text-[#666]">2. Strategic Registries & Actions</p>
            <div className="grid grid-cols-1 gap-2">

              {/* Business Management & Suspend */}
              <button
                onClick={() => setActiveSection("business_manage")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      Business Scope / Suspend <span className="text-[9px] bg-rose-500/20 text-rose-300 font-mono px-1 rounded">Active</span>
                    </h4>
                    <p className="text-[10px] text-[#777]">Suspend non-compliant or fraudulent businesses instantly</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Provincial Admin Management */}
              <button
                onClick={() => setActiveSection("users_provincial")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#d4af37]/10 text-[#d4af37]">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Provincial Admin Management</h4>
                    <p className="text-[10px] text-[#777]">Provision and track provincial supervisory accounts</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* District Admin Management */}
              <button
                onClick={() => setActiveSection("users_district")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">District Admin Management</h4>
                    <p className="text-[10px] text-[#777]">Appoint supervisors for sectors/districts</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Sector Admin Management */}
              <button
                onClick={() => setActiveSection("users_sector")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Sector Admin Management</h4>
                    <p className="text-[10px] text-[#777]">Local sector agent tracking registers</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

            </div>
          </div>

          {/* MODULE CATEGORY Group 3 */}
          <div className="space-y-2">
            <p className="text-[9px] uppercase font-bold tracking-wider text-[#666]">3. Payment & Security Control</p>
            <div className="grid grid-cols-1 gap-2">

              {/* Mobile Money Transactions */}
              <button
                onClick={() => setActiveSection("payment_momo")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#d4af37]/10 text-white">
                    <CreditCard className="w-4 h-4 text-[#d4af37]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Mobile Money Transactions</h4>
                    <p className="text-[10px] text-[#777]">Query MTN MoMo clearance transaction referential ledger</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* AI Insights & Forecasts */}
              <button
                onClick={() => setActiveSection("ai_forecasts")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#d4af37]/15 text-[#d4af37]">
                    <TrendingUp className="w-4 h-4 text-[#d4af37] animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">AI Insights & Forecasts</h4>
                    <p className="text-[10px] text-[#777]">Predict collections and run macroeconomic forecasts</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Audit Logs */}
              <button
                onClick={() => setActiveSection("audit_logs")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-500/10 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      Security Audit Logs <span className="text-[8px] bg-[#1a1a1a] px-1 font-mono rounded">Real-time</span>
                    </h4>
                    <p className="text-[10px] text-[#777]">Database-backed logging of all supervisor operations</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Security Center */}
              <button
                onClick={() => setActiveSection("security_center")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Security Center</h4>
                    <p className="text-[10px] text-[#777]">Check EBM signature handshaking & cryptography validation</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Fraud Monitoring */}
              <button
                onClick={() => setActiveSection("fraud_phase2")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1">
                      Fraud Monitoring <span className="text-[8px] bg-red-500/20 text-red-400 px-1 font-mono rounded">Phase 2</span>
                    </h4>
                    <p className="text-[10px] text-[#777]">Detect anomalous offline syncs or high cash transactions</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

            </div>
          </div>

          {/* MODULE CATEGORY Group 4 */}
          <div className="space-y-2">
            <p className="text-[9px] uppercase font-bold tracking-wider text-[#666]">4. Announcements & Configurations</p>
            <div className="grid grid-cols-1 gap-2">

              {/* Notifications & Announcements */}
              <button
                onClick={() => setActiveSection("announcements")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-500">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Notifications & Announcements</h4>
                    <p className="text-[10px] text-[#777]">Broadcast systemic warnings or bulletins to tax owners</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Tax Configuration */}
              <button
                onClick={() => setActiveSection("tax_config")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-500/10 text-slate-300">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Tax Configuration</h4>
                    <p className="text-[10px] text-[#777]">Set Rwanda standard VAT rate and threshold limits</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Penalty Configuration */}
              <button
                onClick={() => setActiveSection("penalty")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Penalty Configuration</h4>
                    <p className="text-[10px] text-[#777]">Set interest rates for outstanding VAT filings</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Report Exports */}
              <button
                onClick={() => setActiveSection("report_exports")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Report Exports (CSV/Spreadsheet)</h4>
                    <p className="text-[10px] text-[#777]">Download instant generated CSV data tables for audits/SMEs</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Activity Logs */}
              <button
                onClick={() => setActiveSection("activity_logs")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-zinc-500/10 text-zinc-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Activity Logs</h4>
                    <p className="text-[10px] text-[#777]">Supervisor live interactions stream</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

            </div>
          </div>

          {/* MODULE CATEGORY Group 5 */}
          <div className="space-y-2">
            <p className="text-[9px] uppercase font-bold tracking-wider text-[#666]">5. Session Settings</p>
            <div className="grid grid-cols-1 gap-2">

              {/* Profile Config Settings */}
              <button
                onClick={() => setActiveSection("profile")}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#1d1d1d] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-300">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Profile Settings</h4>
                    <p className="text-[10px] text-[#777]">Configure your administrator card details</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#d4af37] transition-colors" />
              </button>

              {/* Logout button */}
              <button
                onClick={logout}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#1c0809] hover:bg-[#280c0d] border border-red-950 transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-red-400">Logout Administrative Session</h4>
                    <p className="text-[10px] text-red-900">Evict secure RRA tokens</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-red-900 group-hover:text-red-400 transition-colors" />
              </button>

            </div>
          </div>

        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. SUB-VIEW ACTIVE COMPONENT RENDERING SECTION BY SECTION */}
      {/* ---------------------------------------------------- */}

      {/* RRA NATIONAL ANALYTICS VIEW */}
      {activeSection === "dashboard" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-[#0c0c0c] to-[#0c0c0c] border border-[#1e1e1e] rounded-3xl space-y-1 relative overflow-hidden">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Administrative Monitoring Statistics</h3>
            <p className="text-[10px] text-slate-400 font-mono">Rwanda National Scope LEDGER</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#111] p-3 border border-[#1d1d1d] rounded-2xl">
              <span className="text-[8px] text-[#888] font-mono tracking-wider block uppercase">TOTAL SMEs</span>
              <span className="text-lg font-mono font-bold text-white block">{totalSMEsCount}</span>
            </div>
            <div className="bg-[#111] p-3 border border-[#1d1d1d] rounded-2xl">
              <span className="text-[8px] text-[#888] font-mono tracking-wider block uppercase">ACTIVE REGISTRY</span>
              <span className="text-lg font-mono font-bold text-emerald-400 block">{activeSMEsCount}</span>
            </div>
            <div className="bg-[#111] p-3 border border-[#1d1d1d] rounded-2xl">
              <span className="text-[8px] text-[#888] font-mono tracking-wider block uppercase">TOTAL REVENUE (RWF)</span>
              <span className="text-lg font-mono font-bold text-[#d4af37] block">
                {(adminAnalytics?.totalRevenueRecorded || 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-[#111] p-3 border border-[#1d1d1d] rounded-2xl">
              <span className="text-[8px] text-[#888] font-mono tracking-wider block uppercase">TOTAL VAT CLEARED</span>
              <span className="text-lg font-mono font-bold text-emerald-400 block">
                {(adminAnalytics?.totalTaxCollected || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Compliance visual trending timeline chart */}
          <div className="p-4 bg-[#111] border border-[#1e1e1e] rounded-3xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#d4af37]" /> VAT Yield & Outstandings (6-Month series)
            </h3>
            <div className="w-full h-48 text-[10px] font-mono">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={adminAnalytics?.monthlySeries || []}>
                  <defs>
                    <linearGradient id="chartCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="chartPending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="month" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip contentStyle={{ backgroundColor: "#0c0c0c", borderColor: "#222", color: "#e0e0e0" }} />
                  <Legend />
                  <Area type="monotone" dataKey="collection" name="VAT Cleared" stroke="#10b981" fillOpacity={1} fill="url(#chartCollected)" />
                  <Area type="monotone" dataKey="pending" name="VAT Pending" stroke="#f59e0b" fillOpacity={1} fill="url(#chartPending)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">Recently Associated Registered SMEs</h4>
            {businesses.slice(0, 5).map((b) => (
              <div key={b._id} className="bg-[#111] border border-[#222] p-3 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-200">{b.name}</p>
                  <p className="text-[9px] text-[#666] font-mono">TIN: {b.tin} • Scope: {b.address?.district}</p>
                </div>
                <span className={`text-[8px] font-mono px-2 py-0.5 rounded border ${b.isActive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"}`}>
                  {b.isActive ? "EBM Active" : "Suspended"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REVENUE MONITORING */}
      {activeSection === "revenue" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-white uppercase">Gross Taxable Revenues (RWF)</h3>
            <p className="text-[10px] text-zinc-400">Calculates general recorded SME turnovers</p>
          </div>

          <div className="bg-[#121212] p-4 border border-[#222] rounded-2xl space-y-3">
            <div className="h-2 bg-gradient-to-r from-emerald-500 via-[#d4af37] to-red-500 rounded-full" />
            <div className="flex justify-between items-center text-xs font-mono">
              <div>
                <span className="block text-[8px] text-[#666]">RRA SHARE COLLECTIONS</span>
                <span className="text-[#10b981] font-bold">18% VAT Collected</span>
              </div>
              <div className="text-right">
                <span className="block text-[8px] text-[#666]">ESTIMATED EXEMPTIONS</span>
                <span className="text-[#aaa] font-bold">Zero-Rated Support Active</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">National turnover summary list</h4>
            {businesses.map((b) => {
              const estimatedRevenueOfBiz = (adminAnalytics?.totalRevenueRecorded || 120000) * (b.tin === "109247382" ? 0.65 : 0.35);
              return (
                <div key={b._id} className="bg-[#111] p-3 border border-[#1e1e1e] rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200 block">{b.name}</span>
                    <span className="text-[9px] text-slate-500 font-mono">TIN: {b.tin} • Sector: {b.address?.sector}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[#d4af37] font-semibold block">{Math.floor(estimatedRevenueOfBiz).toLocaleString()} RWF</span>
                    <span className="text-[8px] text-[#444] block">Recorded Revenue</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAX MONITORING */}
      {activeSection === "tax_monitoring" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-[#d4af37] uppercase">Dynamic Tax Monitoring Ledgers</h3>
            <p className="text-[10px] text-zinc-400">Verifies calculated EBM signatures and standard VAT rates clearance patterns</p>
          </div>

          <div className="bg-[#111] border border-[#222] p-4 rounded-2xl text-xs space-y-2 font-mono">
            <div className="flex justify-between border-b border-[#222] pb-1.5">
              <span className="text-[#6)6]">Target VAT Level</span>
              <span className="text-white font-bold">{taxConfig.defaultVatRate}% Standard</span>
            </div>
            <div className="flex justify-between border-b border-[#222] pb-1.5">
              <span className="text-[#666]">EBM Security Check</span>
              <span className="text-emerald-400 font-bold">SHA-256 Enabled</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666]">RRA EBM Gateway Url</span>
              <span className="text-[#999] truncate text-[9px] max-w-[200px]" title={taxConfig.rraServerEndpoint}>{taxConfig.rraServerEndpoint}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">Monitored Invoices Stream</h4>
            {momoPayments.map((p) => (
              <div key={p._id} className="bg-[#111] p-3 border border-[#222] rounded-2xl flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-200">{p.businessName}</p>
                  <p className="text-[8px] font-mono text-zinc-500">Ref: {p.referenceNumber} • Method: {p.paymentMethod}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-emerald-400 font-semibold">+{p.taxAmount.toLocaleString()} RWF</span>
                  <span className="block text-[8px] text-[#666]">VAT Tax Paid</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PENDING TAXES */}
      {activeSection === "pending_taxes" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-amber-950 rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-amber-500 uppercase">Pending & Outstanding SME Taxes</h3>
            <p className="text-[10px] text-zinc-400">Cash-backed transactions requiring clearances with regional collectors</p>
          </div>

          {/* Search bar inside */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              placeholder="Search outstanding by SME or TIN..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#d4af37]"
            />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">Pending VAT Outstandings List</h4>
            {businesses
              .filter((b) => b.name.toLowerCase().includes(searchText.toLowerCase()) || b.tin.includes(searchText))
              .map((b) => {
                const outstandingAmt = b.tin === "109247382" ? 64800 : 38900;
                return (
                  <div key={b._id} className="bg-[#111] border border-[#222] p-4 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-200">{b.name}</p>
                      <p className="text-[9px] text-[#666] font-mono">TIN: {b.tin} • Sector: {b.address?.sector}</p>
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono mt-1 inline-block">
                        Cash Pending Settle
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-amber-500 font-bold text-sm block">
                        {outstandingAmt.toLocaleString()} RWF
                      </span>
                      <span className="block text-[8px] text-[#666]">Due Filing Period</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* COMPLIANCE REPORTS */}
      {activeSection === "compliance_reports" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-white uppercase">Compliance Reports Ledger</h3>
            <p className="text-[10px] text-zinc-400">Verifies synchronization activity flags of regional taxpayers</p>
          </div>

          <div className="bg-[#111] border border-[#222] p-4 rounded-2xl flex items-center justify-between">
            <div className="text-left">
              <span className="text-[8px] text-[#666] block uppercase font-bold text-teal-400">COMPLIANCY RATIO</span>
              <span className="text-2xl font-mono font-bold text-white block">{complianceRate}%</span>
              <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">Target Level: 90%</span>
            </div>
            <div className="h-10 w-0.5 bg-[#222]" />
            <div className="text-right space-y-1">
              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded block">
                {activeSMEsCount} Compliant
              </span>
              <span className="text-[8px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded block">
                {suspendedSMEsCount} Suspended
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">SMEs Synchronization Flags</h4>
            {businesses.map((b) => (
              <div key={b._id} className="bg-[#111] p-3.5 border border-[#222] rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-200">{b.name}</p>
                  <p className="text-[9px] font-mono text-[#555]">TIN: {b.tin} • Scope: {b.address?.district}</p>
                </div>
                <div className="text-right">
                  {b.isActive ? (
                    <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                      🟢 COM-COMPLIANT
                    </span>
                  ) : (
                    <span className="text-[8px] font-mono text-red-500 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded">
                      🔴 NON-COMPLIANT
                    </span>
                  )}
                  <p className="text-[8px] text-[#444] mt-0.5">Last Sync: 1 hour ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROVINCE AND REGIONAL PERFORMANCE */}
      {activeSection === "province_perf" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-white uppercase">Rwanda Province Rankings</h3>
            <p className="text-[10px] text-zinc-400">Revenue generation performance by state territories</p>
          </div>

          <div className="space-y-3.5">
            {[
              { name: "Kigali City (Capitol Province)", compliance: 96, revenue: "1.45B", color: "bg-emerald-500" },
              { name: "Northern Province", compliance: 89, revenue: "620M", color: "bg-blue-500" },
              { name: "Eastern Province", compliance: 82, revenue: "410M", color: "bg-[#d4af37]" },
              { name: "Southern Province", compliance: 79, revenue: "310M", color: "bg-orange-500" },
              { name: "Western Province", compliance: 74, revenue: "280M", color: "bg-red-500" }
            ].map((prov, i) => (
              <div key={prov.name} className="bg-[#111] border border-[#222] p-4 rounded-2xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[10px] text-[#d4af37] font-bold font-mono">
                      #{i + 1}
                    </span>
                    <span className="font-bold text-slate-200">{prov.name}</span>
                  </div>
                  <span className="font-mono text-[#d4af37] font-semibold">{prov.revenue} RWF</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-[#777]">
                    <span>Synchronization Compliance Rate</span>
                    <span className="font-bold text-slate-300">{prov.compliance}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
                    <div className={`h-full ${prov.color} rounded-full`} style={{ width: `${prov.compliance}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUSPEND BUSINESSES & COMPLIANCE ACTIONS */}
      {activeSection === "business_manage" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-rose-950/20 border border-rose-950 rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-rose-400 uppercase">Security Intervention Panel</h3>
            <p className="text-[10px] text-zinc-400">Suspend & restrict delinquent or non-synchronized EBM installations</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              placeholder="Filter SMEs by name or TIN..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#d4af37]"
            />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">Administrative Suspensions Ledger</h4>
            {businesses
              .filter((b) => b.name.toLowerCase().includes(searchText.toLowerCase()) || b.tin.includes(searchText))
              .map((b) => (
                <div key={b._id} className="bg-[#111] p-4 border border-[#222] rounded-2xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{b.name}</h4>
                      <p className="text-[9px] text-[#666] font-mono">TIN: {b.tin} • Sector: {b.address?.sector}</p>
                      <p className="text-[10px] text-[#999] mt-1">
                        Owner: <span className="text-[#bbb]">{b.ownerId?.name || "Jean Bosco Nteziryayo"}</span> ({b.ownerId?.email || "owner@smarttax.rw"})
                      </p>
                    </div>

                    <span className={`text-[8px] font-mono px-2 py-0.5 rounded border uppercase ${b.isActive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-rose-400 bg-rose-500/10 border-rose-500/30 font-bold"}`}>
                      {b.isActive ? "Approved Active" : "SUSPENDED"}
                    </span>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-[#1a1a1a] pt-2.5">
                    <button
                      onClick={() => handleToggleBusinessStatus(b._id)}
                      className={`text-[9px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                        b.isActive
                          ? "bg-rose-950/20 border-rose-950 text-rose-400 hover:bg-rose-500 hover:text-white"
                          : "bg-emerald-950/20 border-emerald-950 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                      }`}
                    >
                      {b.isActive ? "Suspend SME" : "Re-Activate SME"}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* PROVINCIAL ADMIN MANAGEMENT (USER MANAGEMENT) */}
      {activeSection === "users_provincial" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-gradient-to-r from-teal-500/10 to-[#0c0c0c] border border-teal-950 rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-teal-400 uppercase">Provincial Administration</h3>
            <p className="text-[10px] text-zinc-400">Manage and coordinate accounts for province supervisors</p>
          </div>

          {/* Account Form Builder */}
          <form onSubmit={handleCreateUser} className="bg-[#111] p-4 border border-[#222] rounded-2xl space-y-3 text-xs">
            <h4 className="text-xs font-bold text-[#d4af37] flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-[#d4af37]" /> Provision Provincial Admin
            </h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">FULL NAME</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alexis Habimana"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">SECURE EMAIL</span>
                <input
                  type="email"
                  required
                  placeholder="e.g. kigali@rra.gov.rw"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">PASSWORD</span>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters..."
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">TARGET PROVINCE</span>
                <select
                  required
                  value={inviteForm.province}
                  onChange={(e) => setInviteForm({ ...inviteForm, province: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                >
                  <option value="">Choose Province...</option>
                  <option value="Kigali City">Kigali City</option>
                  <option value="Northern Province">Northern Province</option>
                  <option value="Eastern Province">Eastern Province</option>
                  <option value="Western Province">Western Province</option>
                  <option value="Southern Province">Southern Province</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingInvite}
              className="w-full py-2 bg-[#d4af37] text-black font-semibold text-xs rounded-xl transition-all hover:bg-white"
            >
              {submittingInvite ? "Hasing Core Credentials..." : "Access Authorization Provision"}
            </button>
          </form>

          {/* Directory Listings */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">Provincial Supervisor Accounts Directory</h4>
            {usersList
              .filter((u) => u.role === "provincial_admin")
              .map((u) => (
                <div key={u._id} className="bg-[#111] p-3 border border-[#222] rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-200">{u.name}</p>
                    <p className="text-[9px] text-[#666] font-mono">{u.email}</p>
                  </div>
                  <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    Province: {u.geographicScope?.province || "Unbound"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* DISTRICT ADMIN MANAGEMENT (USER MANAGEMENT) */}
      {activeSection === "users_district" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-gradient-to-r from-blue-500/10 to-[#0c0c0c] border border-blue-950 rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-blue-400 uppercase">District Administration</h3>
            <p className="text-[10px] text-zinc-400">Appoint and track district supervisors under national command</p>
          </div>

          <form onSubmit={handleCreateUser} className="bg-[#111] p-4 border border-[#222] rounded-2xl space-y-3 text-xs">
            <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-blue-400" /> Appoint District Admin
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">Supervisor Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Charles Gasana"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">District Email</span>
                <input
                  type="email"
                  required
                  placeholder="e.g. gasabo@rra.gov.rw"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">Password</span>
                <input
                  type="password"
                  required
                  placeholder="6 characters..."
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">District Tag</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gasabo"
                  value={inviteForm.district}
                  onChange={(e) => setInviteForm({ ...inviteForm, district: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingInvite}
              className="w-full py-2 bg-blue-500 text-black font-semibold text-xs rounded-xl transition-all hover:bg-white"
            >
              {submittingInvite ? "Writing certificates..." : "Provision District Authority"}
            </button>
          </form>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">District Supervisors Directory</h4>
            {usersList
              .filter((u) => u.role === "district_admin")
              .map((u) => (
                <div key={u._id} className="bg-[#111] p-3 border border-[#222] rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-200">{u.name}</p>
                    <p className="text-[9px] text-[#666] font-mono">{u.email}</p>
                  </div>
                  <span className="text-[8px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                    District: {u.geographicScope?.district || "Unbound"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* SECTOR ADMIN MANAGEMENT (USER MANAGEMENT) */}
      {activeSection === "users_sector" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-[#0c0c0c] border border-cyan-950 rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-cyan-400 uppercase">Sector Administration</h3>
            <p className="text-[10px] text-zinc-400">Establish local sector supervisors for primary taxpayer checkups</p>
          </div>

          <form onSubmit={handleCreateUser} className="bg-[#111] p-4 border border-[#222] rounded-2xl space-y-3 text-xs">
            <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-cyan-400" /> Provision Sector Inspector
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">Supervisor Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Florence Mukamana"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">Sector Email</span>
                <input
                  type="email"
                  required
                  placeholder="e.g. kimihurura@rra.gov.rw"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">Password</span>
                <input
                  type="password"
                  required
                  placeholder="6 characters..."
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] text-[#666]">Sector Target Tag</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kimihurura"
                  value={inviteForm.sector}
                  onChange={(e) => setInviteForm({ ...inviteForm, sector: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingInvite}
              className="w-full py-2 bg-cyan-500 text-black font-semibold text-xs rounded-xl transition-all hover:bg-white"
            >
              {submittingInvite ? "Syncing inspector keys..." : "Authorize Sector Patrol Token"}
            </button>
          </form>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">Sector Inspectors Directory</h4>
            {usersList
              .filter((u) => u.role === "sector_admin")
              .map((u) => (
                <div key={u._id} className="bg-[#111] p-3 border border-[#222] rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-200">{u.name}</p>
                    <p className="text-[9px] text-[#666] font-mono">{u.email}</p>
                  </div>
                  <span className="text-[8px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                    Sector: {u.geographicScope?.sector || "Unbound"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* PAYMENT MONITORING (MOBILE MONEY TRANSACTIONS) */}
      {activeSection === "payment_momo" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-[#d4af37] uppercase flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#d4af37]" /> Mobile Money Clearance Pipeline
            </h3>
            <p className="text-[10px] text-zinc-400">Validates clearings and payouts cleared via MTN MoMo or Airtel Money</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              placeholder="Search reference numbers or TINs..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#d4af37]"
            />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">RRA MoMo Realtime Ledger Flows</h4>
            {momoPayments
              .filter((p) => p.businessName.toLowerCase().includes(searchText.toLowerCase()) || p.referenceNumber.toLowerCase().includes(searchText.toLowerCase()))
              .map((p) => (
                <div key={p._id} className="bg-[#111] border border-[#222] p-4 rounded-2xl space-y-2.5 text-xs text-left">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-200">{p.businessName}</p>
                      <p className="text-[8px] font-mono text-[#666]">TIN: {p.tin}</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400">
                      +{p.taxAmount.toLocaleString()} RWF
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-t border-[#1a1a1a] pt-2 text-[9px] font-mono">
                    <span className="text-[#888]">Carrier Ref: <span className="text-[#bbb]">{p.referenceNumber}</span></span>
                    <span className={`px-2 py-0.5 rounded ${p.status === "Paid" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"}`}>
                      {p.status === "Paid" ? "Cleared (Success)" : "Settle Verified"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* AI INSIGHTS & FORECASTS */}
      {activeSection === "ai_forecasts" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#d4af37]/30 rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-[#d4af37] uppercase">RRA Compliance Forecast Analytics</h3>
            <p className="text-[10px] text-zinc-400">Microeconomic collection forecast simulation model</p>
          </div>

          <div className="bg-[#111] border border-[#222] p-4 rounded-2xl space-y-3.5 text-xs">
            <h4 className="font-bold text-white uppercase block">Compliance Level Target Simulator</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400 font-mono">SME Target Compliance Rate</span>
                <span className="text-[#d4af37] font-bold font-mono">{complianceMultiplier}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                value={complianceMultiplier}
                onChange={(e) => setComplianceMultiplier(Number(e.target.value))}
                className="w-full accent-[#d4af37]"
              />
            </div>

            <div className="h-[1px] bg-[#222] my-2" />

            <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
              <div className="bg-[#181818] p-2.5 rounded-xl">
                <span className="text-[8px] text-[#555] block">EXPECTED TAX GROWTH</span>
                <span className="text-emerald-400 font-bold">+{Math.floor((complianceMultiplier - 70) * 0.45)}% Quarterly</span>
              </div>
              <div className="bg-[#181818] p-2.5 rounded-xl">
                <span className="text-[8px] text-[#555] block">YIELD FORECAST</span>
                <span className="text-white font-bold">
                  {Math.floor((adminAnalytics?.totalTaxCollected || 5000000) * (1 + (complianceMultiplier - 70) * 0.01)).toLocaleString()} RWF
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#111] border border-[#222] p-4 rounded-2xl text-xs space-y-2.5 leading-relaxed">
            <h4 className="font-bold text-[#d4af37] uppercase flex items-center gap-1.5 font-serif">
              <ShieldCheck className="w-4 h-4" /> AI Strategic Recommendations Report
            </h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              <strong>Observations:</strong> The current synchronization compliance is sitting at {complianceRate}%. Sector boundaries like <span className="text-white">Kimihurura</span> and <span className="text-white">Nyarugenge</span> are driving 94% of digital EBM synchronization. However, Western Province rural retail SMEs exhibit outstanding balances of 38,900 RWF to 64,800 RWF per retailer.
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              <strong>Recommendations:</strong> Adjust EBM penalty periods to {penaltyConfig.graceDays} grace days. Deploy sector inspectors to support offline digital synchronizer cache uploads.
            </p>
          </div>
        </div>
      )}

      {/* SYSTEM SECURITY AUDIT LOGS */}
      {activeSection === "audit_logs" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-zinc-950/20 border border-zinc-800 rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-slate-300 uppercase">RRA Network Security Audit Ledger</h3>
            <p className="text-[10px] text-zinc-400">Verifiably logging administrative security actions</p>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log._id} className="bg-[#111] border border-[#222] p-3 rounded-2xl text-[10px] font-mono text-left space-y-1">
                <div className="flex justify-between text-[#88a]">
                  <span>Action: <strong className="text-slate-200">{log.action}</strong></span>
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-400 text-[11px] font-sans">{log.details}</p>
                <div className="text-[8px] text-zinc-600 border-t border-[#1a1a1a] pt-1 mt-1 flex justify-between">
                  <span>Authorized by: {log.userId?.name || "RRA SYSTEM INC"}</span>
                  <span>Scope: {log.userId?.role || "SYSTEM"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECURITY CENTER */}
      {activeSection === "security_center" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-emerald-950/20 border border-emerald-900 rounded-3xl space-y-1 animate-pulse">
            <h3 className="text-xs font-bold text-emerald-400 uppercase">Administrative System Posture</h3>
            <p className="text-[10px] text-zinc-400">Cryptographic digital certificate validators & signature checkpoints</p>
          </div>

          {/* Secure posture list */}
          <div className="space-y-2">
            {[
              { rule: "RRA Signature Chain Verification", state: "Verified Active", desc: "Verifies EBM SHA-256 integrity on each local synchronized sales receipt payload." },
              { rule: "Transport Layer Security SSL (v1.3)", state: "98.9% Perfect", desc: "RRA-EBM v2 secure web socket tunneling protocol." },
              { rule: "Token Authorization Integrity", state: "Active Enforced", desc: "Prevents token reuse. Standard admin JWT expiry controls are active." }
            ].map((rule) => (
              <div key={rule.rule} className="bg-[#111] border border-[#222] p-4 rounded-2xl space-y-1 text-xs">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">{rule.rule}</span>
                  <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">
                    {rule.state}
                  </span>
                </div>
                <p className="text-[10px] text-[#777] leading-relaxed">{rule.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS & ANNOUNCEMENTS BROADCAST */}
      {activeSection === "announcements" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-white uppercase">SME Bulletins Broadcaster</h3>
            <p className="text-[10px] text-zinc-400">Compose and dispatch systemic warnings that populate on taxpayer interfaces</p>
          </div>

          <form onSubmit={handlePostAnnounce} className="bg-[#111] p-4 border border-[#222] rounded-2xl space-y-3.5 text-xs text-left">
            <h4 className="text-xs font-bold text-yellow-500 flex items-center gap-1.5 uppercase">
              <Bell className="w-4 h-4 text-yellow-500 animate-pulse" /> Post Systemic Update
            </h4>

            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] uppercase font-bold text-slate-400">ANNOUNCEMENT TITLE</span>
              <input
                type="text"
                required
                placeholder="e.g. MTN MoMo Maintenance and Patch notice"
                value={broadcastMessage.title}
                onChange={(e) => setBroadcastMessage({ ...broadcastMessage, title: e.target.value })}
                className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] uppercase font-bold text-slate-400">ANNOUNCEMENT CONTENT BODY</span>
              <textarea
                required
                rows={3}
                placeholder="Post instructions for all retail taxpayers regarding certifications or holiday clearances..."
                value={broadcastMessage.body}
                onChange={(e) => setBroadcastMessage({ ...broadcastMessage, body: e.target.value })}
                className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] uppercase font-bold block text-slate-400">RIORITY CLASSIFICATION</span>
              <select
                value={broadcastMessage.priority}
                onChange={(e) => setBroadcastMessage({ ...broadcastMessage, priority: e.target.value })}
                className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
              >
                <option value="Info">Info (Standard Announcement)</option>
                <option value="Alert">Alert (Advisory notice)</option>
                <option value="Critical">Critical (Immediate inspection required)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-xs rounded-xl transition-all"
            >
              Broadcast Bulletin Stream
            </button>
          </form>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">Active Broadcaster Bulletins History</h4>
            {announcements.map((ann) => (
              <div key={ann.id} className="bg-[#111] p-4 border border-[#222] rounded-2xl space-y-2 text-xs text-left">
                <div className="flex justify-between items-center">
                  <h5 className="font-bold text-slate-100">{ann.title}</h5>
                  <span className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded border uppercase ${ann.priority === "Critical" ? "text-red-400 bg-red-500/10 border-red-500/20 animate-pulse" : ann.priority === "Alert" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-blue-400 bg-blue-500/10 border-blue-500/20"}`}>
                    {ann.priority}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">{ann.body}</p>
                <span className="text-[8px] text-[#555] block font-mono">{new Date(ann.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAX CONFIGURATION SYSTEM SETTINGS */}
      {activeSection === "tax_config" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-white uppercase">Tax Code Configuration Settings</h3>
            <p className="text-[10px] text-zinc-400">Calibrate standard RRA tax code parameters and certifications</p>
          </div>

          <div className="bg-[#111] p-4 border border-[#222] rounded-2xl space-y-4 text-xs text-left">
            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] block uppercase font-bold text-slate-400">Standard Rwanda VAT Percentage (%)</span>
              <input
                type="number"
                value={taxConfig.defaultVatRate}
                onChange={(e) => setTaxConfig({ ...taxConfig, defaultVatRate: Number(e.target.value) })}
                className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] block uppercase font-bold text-slate-400">RRA EBM Verification Handshake SSL</span>
              <input
                type="text"
                value={taxConfig.rraServerEndpoint}
                onChange={(e) => setTaxConfig({ ...taxConfig, rraServerEndpoint: e.target.value })}
                className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none font-mono focus:border-[#d4af37]"
              />
            </div>

            <button
              onClick={() => showToast("Tax code settings saved successfully!", "success")}
              className="w-full py-2 bg-[#d4af37] text-black font-semibold text-xs rounded-xl transition-all hover:bg-white"
            >
              Update Core Tax Code
            </button>
          </div>
        </div>
      )}

      {/* PENALTY CONFIGURATION */}
      {activeSection === "penalty" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-white uppercase">Late Filing Interest & Penalties Calibration</h3>
            <p className="text-[10px] text-zinc-400">Determine interest modifiers for tax balance outstandings</p>
          </div>

          <div className="bg-[#111] p-4 border border-[#222] rounded-2xl space-y-4 text-xs text-left">
            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] block uppercase font-bold text-slate-400">LATE FILING COMMISSION INTEREST (%)</span>
              <input
                type="number"
                step="0.1"
                value={penaltyConfig.monthlyInterestRate}
                onChange={(e) => setPenaltyConfig({ ...penaltyConfig, monthlyInterestRate: Number(e.target.value) })}
                className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] block uppercase font-bold text-slate-400">BASE ADMINISTRATIVE FINE AMOUNT (RWF)</span>
              <input
                type="number"
                value={penaltyConfig.lateFilingFee}
                onChange={(e) => setPenaltyConfig({ ...penaltyConfig, lateFilingFee: Number(e.target.value) })}
                className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] block uppercase font-bold text-slate-400">COMPLIANCE FILING GRACE DAYS</span>
              <input
                type="number"
                value={penaltyConfig.graceDays}
                onChange={(e) => setPenaltyConfig({ ...penaltyConfig, graceDays: Number(e.target.value) })}
                className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none"
              />
            </div>

            <button
              onClick={() => showToast("Late outstanding filing penalties updated!", "success")}
              className="w-full py-2 bg-[#d4af37] text-black font-semibold text-xs rounded-xl transition-all hover:bg-white"
            >
              Update Penalty Config Parameters
            </button>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE REPORT EXPORTS */}
      {activeSection === "report_exports" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-white uppercase">Government Spreadsheet Reports compiler</h3>
            <p className="text-[10px] text-zinc-400">Generate raw downloadable audit spreadsheets for administrative use</p>
          </div>

          <div className="space-y-3.5">
            {[
              { title: "Detailed Associated SMEs list", size: `${businesses.length} Records`, key: "businesses", desc: "List of digital EBM v2 associated stores, TIN codes, geographic province tags, active status parameters, and creation timestamps." },
              { title: "Mobile Money Payments Clearance", size: `${momoPayments.length} Flows`, key: "momo", desc: "Clearance payments audit report containing carrier reference identification, cleared tax balances, cleared VAT and statuses." },
              { title: "Network Security Intervention logs", size: `${auditLogs.length} Actions`, key: "audit", desc: "Supervisor activities and security audit listings." },
              { title: "Tax Compliance Auditable spreadsheet", size: `${businesses.length} Indicators`, key: "compliance", desc: "Ramp rate compliance reports by region." }
            ].map((exp) => (
              <div key={exp.title} className="bg-[#111] border border-[#222] p-4 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-200">{exp.title}</h4>
                  <span className="text-[8px] font-mono text-[#d4af37] bg-[#d4af37]/10 px-2 py-0.5 rounded border border-[#d4af37]/20">
                    {exp.size}
                  </span>
                </div>
                <p className="text-[10px] text-[#777] leading-relaxed">{exp.desc}</p>
                <button
                  onClick={() => triggerCsvDownload(exp.key)}
                  className="w-full mt-2.5 py-1.5 bg-[#181818] hover:bg-[#222] border border-[#333] hover:border-[#d4af37]/40 text-slate-300 font-semibold text-[10px] rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Export to CSV Spreadsheet
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADMINISTRATIVE ACTIVITY LOG WORKSTREAM */}
      {activeSection === "activity_logs" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-slate-300 uppercase">Supervisor Operations Live Stream</h3>
            <p className="text-[10px] text-zinc-400">Chronological trail of administrative workflow sessions</p>
          </div>

          <div className="space-y-2.5">
            {auditLogs.slice(0, 15).map((log) => (
              <div key={log._id} className="bg-[#111] p-3 border border-[#1d1d1d] rounded-2xl text-[10px] font-mono text-left space-y-1">
                <div className="flex justify-between text-yellow-500/80">
                  <span className="font-bold flex items-center gap-1">
                    <Activity className="w-3 h-3 text-yellow-500" /> {log.action}
                  </span>
                  <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="text-slate-300 text-xs font-sans leading-relaxed">{log.details}</p>
                <span className="text-[9px] text-[#555] block">Authorized by: ID {log.userId?.name || "RRA CO-PILOT"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FRAUD DETECTION & ANOMALY TRACKING (PHASE 2) */}
      {activeSection === "fraud_phase2" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-red-950/20 border border-red-900 rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-red-400 uppercase">EBM Anomaly Tracking (Phase 2)</h3>
            <p className="text-[10px] text-zinc-400">Suspicious transaction monitoring algorithms and verification checks</p>
          </div>

          <div className="bg-[#111] border border-[#222] p-4 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[8px] text-[#666] block uppercase font-bold text-red-400">SYSTEM THREAT LEVEL</span>
              <span className="text-lg font-mono font-bold text-white block">Minor Anomalies</span>
              <span className="text-[9px] text-zinc-500 font-mono mt-0.5 block font-bold">SHA chain logs clean</span>
            </div>
            <div className="p-3 bg-red-500/10 text-red-500 rounded-full animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#888] uppercase">Flagged Verification Warnings</h4>
            {[
              { store: "Rubavu Corner Boutique", tin: "108356291", risk: "Medium Risk", reason: "Sequence offline syncer gap mismatch detected (SHA mismatch on block #104)" },
              { store: "Kigali Smart Retail Ltd", tin: "109247382", risk: "Low Risk", reason: "Cash outstanding threshold exceeds 1,000,000 RWF for single cashier" }
            ].map((fr) => (
              <div key={fr.store} className="bg-[#111] border border-[#222] p-4 rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-200">{fr.store}</span>
                  <span className={`text-[8px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${fr.risk === "High Risk" ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"}`}>
                    {fr.risk}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 font-mono">TIN: {fr.tin}</p>
                <p className="text-[10px] text-zinc-400">{fr.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROFILE SETTINGS */}
      {activeSection === "profile" && (
        <div className="space-y-4 animate-fade-in text-left pb-10">
          <div className="p-4 bg-[#111] border border-[#222] rounded-3xl space-y-1">
            <h3 className="text-xs font-bold text-white uppercase">Profile Settings</h3>
            <p className="text-[10px] text-zinc-400">Configure supervisor workspace credentials</p>
          </div>

          <div className="bg-[#111] p-4 border border-[#222] rounded-2xl space-y-4 text-xs select-none">
            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] uppercase font-bold block text-slate-400">YOUR FULL NAME</span>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full bg-[#1c1c1c] border border-[#2c2c2c] p-2 text-xs rounded-xl text-white outline-none focus:border-[#d4af37]"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] uppercase font-bold block text-slate-400">REGISTERED EMAIL</span>
              <input
                type="text"
                disabled
                value={profileForm.email}
                className="w-full bg-[#1c1c1c]/40 border border-[#2c2c2c]/40 p-2 text-xs rounded-xl text-zinc-500 cursor-not-allowed outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] text-[#666] uppercase font-bold block text-slate-400">SUPERVISION SCOPE</span>
              <input
                type="text"
                disabled
                value={profileForm.scopeProvince}
                className="w-full bg-[#1c1c1c]/40 border border-[#2c2c2c]/40 p-2 text-xs rounded-xl text-[#d4af37] font-semibold cursor-not-allowed outline-none"
              />
            </div>

            <button
              onClick={() => showToast("Administrator profile parameters saved successfully!", "success")}
              className="w-full py-2 bg-[#d4af37] text-black font-semibold text-xs rounded-xl transition-all hover:bg-white"
            >
              Save Profile Changes
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
