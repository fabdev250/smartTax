import React, { useState, useEffect } from "react";
import { useSmartTaxStore } from "../store";
import { Building2, Plus, Sparkles, RefreshCcw, Wifi, WifiOff, FileText, CheckCircle2, AlertTriangle, Coins } from "lucide-react";

export default function SMEDashboard() {
  const {
    t,
    businesses,
    currentBusiness,
    setCurrentBusiness,
    createBusiness,
    taxSummary,
    offlineMode,
    syncing,
    syncQueueCount,
    triggerSync,
    fetchBusinesses,
    checkOnlineStatusAndRefresh
  } = useSmartTaxStore();

  const [showRegModal, setShowRegModal] = useState(false);
  const [bizName, setBizName] = useState("");
  const [tin, setTin] = useState("");
  const [category, setCategory] = useState("Retail");
  const [province, setProvince] = useState("Kigali City");
  const [district, setDistrict] = useState("Nyarugenge");
  const [sector, setSector] = useState("Kanyinya");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkOnlineStatusAndRefresh();
    fetchBusinesses();
  }, []);

  const handleRegisterBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!bizName || !tin) {
      setError("Please fill out Business Name and TIN.");
      return;
    }

    if (tin.length < 9) {
      setError("RRA TIN number must be at least 9 digits long.");
      return;
    }

    setLoading(true);
    try {
      await createBusiness({
        name: bizName,
        tin,
        category,
        address: { province, district, sector }
      });
      setShowRegModal(false);
      setBizName("");
      setTin("");
      setError("");
    } catch (err: any) {
      const errMsg = err.response?.data?.message 
        || (err.response?.status === 400 ? "Bad Request: Please check that the EBM TIN/details are valid and try again." : null)
        || err.message 
        || "Failed to register SME.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Compute calculated values
  const totalSalesVal = taxSummary?.transactions?.reduce((sum: number, item: any) => {
    // estimate matching sale if online
    return sum + (item.taxAmount * 5.5); // standard dynamic sizing mapping
  }, 0) || 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Network Status & Queue Bar */}
      <div className="flex items-center justify-between bg-[#0c0c0c] border border-[#1a1a1a] p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          {offlineMode ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold">
              <WifiOff className="w-3.5 h-3.5" /> {t("common.offline")}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4af37]/5 border border-[#d4af37]/20 text-[#d4af37] text-xs font-bold">
              <Wifi className="w-3.5 h-3.5" /> {t("common.online")}
            </div>
          )}
        </div>

        {syncQueueCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#888]">
              {syncQueueCount} pending offline sales
            </span>
            <button
              id="dash-sync-btn"
              onClick={triggerSync}
              disabled={syncing || offlineMode}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#d4af37] hover:bg-[#ebd06b] text-black text-xs font-bold transition-all disabled:opacity-40"
            >
              <RefreshCcw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? t("common.syncing") : "Sync Database"}
            </button>
          </div>
        )}
      </div>

      {/* SME Selector / Quick Select */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="sme-section-title" className="text-xs font-bold uppercase tracking-widest text-[#666]">
            {t("dashboard.registered_businesses")}
          </h2>
          <button
            id="dash-open-reg-btn"
            onClick={() => setShowRegModal(!showRegModal)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#d4af37] hover:text-[#ebd06b] font-bold border border-[#d4af37]/20 rounded-lg hover:bg-[#d4af37]/5 transition-all"
          >
            <Plus className="w-3 h-3" /> {t("dashboard.register_your_sme")}
          </button>
        </div>

        {businesses.length === 0 ? (
          <div className="bg-[#0c0c0c]/40 border border-dashed border-[#1a1a1a] p-6 rounded-2xl text-center space-y-3">
            <Building2 className="w-10 h-10 text-[#444] mx-auto" />
            <p className="text-xs text-[#888]">
              You haven't registered any SMEs yet. Click register to create your first business profile with RRA.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {businesses.map((biz) => {
              const active = currentBusiness?._id === biz._id;
              return (
                <button
                  id={`sme-selector-${biz._id}`}
                  key={biz._id}
                  onClick={() => setCurrentBusiness(biz)}
                  className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all relative overflow-hidden ${
                    active
                      ? "bg-[#0c0c0c] border-[#d4af37]/60 shadow-lg shadow-[#d4af37]/5 text-white"
                      : "bg-[#0c0c0c]/60 border-[#1a1a1a] text-[#888] hover:border-[#222]"
                  }`}
                >
                  <span className="text-[10px] text-[#d4af37] font-bold uppercase tracking-wider">TIN: {biz.tin}</span>
                  <span className="text-xs font-bold leading-tight mt-1 truncate">{biz.name}</span>
                  <span className="text-[10px] mt-2 block opacity-80 truncate">{biz.address?.sector}, {biz.address?.district}</span>
                  {active && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active business Stats Overview */}
      {currentBusiness && (
        <div className="space-y-4">
          <div className="p-4 bg-[#d4af37]/5 border border-[#d4af37]/10 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#d4af37] font-bold uppercase tracking-widest leading-none">Selected SME Active Hub</p>
              <h3 className="text-[13px] font-bold text-white mt-1">{currentBusiness.name}</h3>
            </div>
            <span className="text-xs font-mono bg-[#0c0c0c] border border-[#222] px-2.5 py-1 rounded-md text-[#d4af37] font-bold">
              {currentBusiness.category}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Sales revenue */}
            <div className="bg-[#0c0c0c] border border-[#1a1a1a] p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[#888]">
                <span className="text-[10px] font-bold uppercase tracking-wider leading-none">Total Sales EST</span>
                <Coins className="w-4 h-4 text-[#d4af37]" />
              </div>
              <p className="text-[15px] font-mono font-bold leading-none text-white">
                {totalSalesVal.toLocaleString()} <span className="text-[10px] text-[#555]">RWF</span>
              </p>
            </div>

            {/* Paid taxes */}
            <div className="bg-[#0c0c0c] border border-[#1a1a1a] p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[#888]">
                <span className="text-[10px] font-bold uppercase tracking-wider leading-none">{t("dashboard.taxes_paid")}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-[15px] font-mono font-bold leading-none text-emerald-400">
                {(taxSummary?.paid || 0).toLocaleString()} <span className="text-[10px] text-emerald-500/80">RWF</span>
              </p>
            </div>

            {/* Unpaid pending taxes */}
            <div className="grid col-span-2 bg-gradient-to-br from-[#0c0c0c] via-[#0c0c0c] to-amber-500/5 border border-[#1a1a1a] p-4 rounded-2xl items-center flex justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#888] block">{t("dashboard.taxes_pending")}</span>
                <p className="text-xl font-mono font-bold text-amber-400">
                  {(taxSummary?.pending || 0).toLocaleString()} <span className="text-xs text-amber-500">RWF</span>
                </p>
              </div>
              <div>
                {taxSummary && taxSummary.pending > 0 ? (
                  <span className="inline-flex gap-1 items-center px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> Settle Pending VAT
                  </span>
                ) : (
                  <span className="inline-flex gap-1 items-center px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Compliant
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register SME Modal */}
      {showRegModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-end z-50 animate-fade-in">
          <div className="w-full max-w-md bg-[#0c0c0c] border-t border-[#1a1a1a] rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-[#1a1a1a]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#e0e0e0]">
                {t("dashboard.register_your_sme")}
              </h3>
              <button
                id="dash-close-reg-btn"
                onClick={() => setShowRegModal(false)}
                className="text-xs text-[#888] hover:text-[#e0e0e0] font-bold px-2 py-1 bg-[#121212] rounded-lg"
              >
                Close
              </button>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs font-semibold text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleRegisterBusiness} className="space-y-3">
              {/* Business Name */}
              <div className="space-y-1">
                <label className="text-xs text-[#888] block">{t("dashboard.business_name")}</label>
                <input
                  id="reg-biz-name"
                  type="text"
                  required
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full bg-[#121212] border border-[#222] rounded-xl px-3 py-2.5 text-xs text-white"
                  placeholder="e.g. Kigali Smart Boutique Ltd"
                />
              </div>

              {/* RRA TIN */}
              <div className="space-y-1">
                <label className="text-xs text-[#888] block">{t("dashboard.rra_tin")}</label>
                <input
                  id="reg-biz-tin"
                  type="text"
                  required
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  className="w-full bg-[#121212] border border-[#222] rounded-xl px-3 py-2.5 text-xs text-white"
                  placeholder="e.g. 109247382"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-xs text-[#888] block">{t("dashboard.category")}</label>
                <select
                  id="reg-biz-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#121212] border border-[#222] rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value="Retail">Retail Store</option>
                  <option value="Wholesale">Wholesale Trading</option>
                  <option value="Agribusiness">Agribusiness / Farming</option>
                  <option value="Hospitality">Restaurant & Hotel</option>
                  <option value="Construction">Construction Services</option>
                </select>
              </div>

              {/* Address config */}
              <div className="space-y-1">
                <label className="text-[10px] text-[#d4af37] uppercase font-bold block">Business Geographic Location</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-[#666]">{t("dashboard.address_province")}</label>
                    <select
                      id="reg-biz-prov"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full bg-[#121212] border border-[#222] rounded-lg p-1.5 text-[10px] text-white"
                    >
                      <option value="Kigali City">Kigali City</option>
                      <option value="Northern Province">Northern Pro.</option>
                      <option value="Southern Province">Southern Pro.</option>
                      <option value="Eastern Province">Eastern Pro.</option>
                      <option value="Western Province">Western Pro.</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] text-[#666]">{t("dashboard.address_district")}</label>
                    <input
                      id="reg-biz-dist"
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full bg-[#121212] border border-[#222] rounded-lg p-1 text-[10px] text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-[#666]">{t("dashboard.address_sector")}</label>
                    <input
                      id="reg-biz-sect"
                      type="text"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      className="w-full bg-[#121212] border border-[#222] rounded-lg p-1 text-[10px] text-white"
                    />
                  </div>
                </div>
              </div>

              <button
                id="reg-biz-submit"
                disabled={loading}
                type="submit"
                className="w-full bg-[#d4af37] text-black font-bold py-3 rounded-xl text-xs mt-3 select-none hover:bg-[#ebd06b] transition-all"
              >
                {loading ? "Registering..." : t("dashboard.register_sme_btn")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
