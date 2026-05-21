import React, { useState } from "react";
import { useSmartTaxStore } from "../store";
import { Smartphone, Receipt, CheckCircle, HelpCircle, ArrowUpRight, Check, AlertTriangle, ShieldCheck } from "lucide-react";

export default function SMETaxes() {
  const {
    t,
    currentBusiness,
    taxSummary,
    settleTaxes,
    offlineMode,
  } = useSmartTaxStore();

  const [provider, setProvider] = useState<"MTN MoMo" | "Airtel Money">("MTN MoMo");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (offlineMode) {
      setError("Mobile Money payment triggers require an active network status.");
      return;
    }

    const settleValue = Number(customAmount) || taxSummary?.pending || 0;
    if (isNaN(settleValue) || settleValue <= 0) {
      setError("No outstanding balance configured to settle.");
      return;
    }

    if (!phoneNumber) {
      setError("Please provide your wallet phone number.");
      return;
    }

    setLoading(true);
    try {
      const res = await settleTaxes(currentBusiness._id, {
        amount: settleValue,
        mobileMoneyNumber: phoneNumber,
        provider,
      });

      setSuccess(`Direct MoMo Payment trigger pushed to (+250) ${phoneNumber}. Status: Paid. Reference: ${res.referenceNumber}`);
      setCustomAmount("");
      setPhoneNumber("");
    } catch (err: any) {
      const errMsg = err.response?.data?.message 
        || (err.response?.status === 400 ? "Bad Request: Unable to process tax settlement. Please verify the amount and phone number and try again." : null)
        || err.message 
        || "Failed to settle taxes.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!currentBusiness) {
    return (
      <div className="bg-[#0c0c0c] border border-[#1a1a1a] p-8 rounded-2xl text-center space-y-3">
        <ShieldCheck className="w-12 h-12 text-[#444] mx-auto" />
        <h3 className="text-sm font-semibold text-[#888]">No Enterprise Selected</h3>
        <p className="text-xs text-[#555]">
          Please select or register a business on the Dashboard tab to view and settle outstanding VAT ledgers.
        </p>
      </div>
    );
  }

  // filter ledger lists
  const pendingTxs = taxSummary?.transactions?.filter((t: any) => t.status === "Pending") || [];
  const paidTxs = taxSummary?.transactions?.filter((t: any) => t.status === "Paid") || [];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-[#0c0c0c] border border-[#1a1a1a] p-3.5 rounded-2xl">
        <div>
          <h2 id="taxes-title" className="text-xs font-bold uppercase tracking-widest text-[#666]">
            {t("taxes.rra_compliance")}
          </h2>
          <p className="text-[10px] text-[#888] font-mono mt-0.5">{currentBusiness.name} Ledger</p>
        </div>
        {offlineMode && (
          <span className="text-[10px] px-2 py-0.5 font-bold bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded">
            Settles Disabled Offline
          </span>
        )}
      </div>

      {success && (
        <div className="bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] p-3.5 rounded-2xl text-xs font-bold text-center">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-2xl text-xs font-bold text-center">
          {error}
        </div>
      )}

      {/* MoMo Push form */}
      {taxSummary && taxSummary.pending > 0 && (
        <form onSubmit={handleSettle} className="bg-[#0c0c0c] border border-[#1a1a1a] p-4 rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#d4af37]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#e0e0e0]">
              {t("taxes.pay_with_wallet")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-1 space-y-1">
              <label className="text-[10px] text-[#888] font-bold ml-1">{t("taxes.select_momo_provider")}</label>
              <select
                id="tax-momo-prov"
                value={provider}
                onChange={(e: any) => setProvider(e.target.value)}
                className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37]/50 rounded-xl px-3 py-2 text-xs text-white uppercase"
              >
                <option value="MTN MoMo">MTN MoMo Pay</option>
                <option value="Airtel Money">Airtel Money Pay</option>
              </select>
            </div>

            <div className="col-span-1 space-y-1">
              <label className="text-[10px] text-[#888] font-bold ml-1">{t("taxes.momo_number")} *</label>
              <input
                id="tax-momo-num"
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="250XXXXXXXXX"
                className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37]/50 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-[10px] text-[#888] font-bold ml-1">Settlement Amount (RWF) (leave blank for complete checkout of pending tax)</label>
              <input
                id="tax-momo-amt"
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder={`Current full amount: ${taxSummary.pending.toLocaleString()} RWF`}
                className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37]/50 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <button
            id="tax-pay-momo-btn"
            disabled={loading || offlineMode}
            type="submit"
            className="w-full bg-[#d4af37] hover:bg-[#ebd06b] text-black font-bold py-3 rounded-xl text-xs transition-all uppercase tracking-wider select-none"
          >
            {loading ? "Triggering MoMo Wallet Approval..." : t("taxes.settle_now")}
          </button>
        </form>
      )}

      {/* Ledgers Lists columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending ledger */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center justify-between">
            <span>{t("taxes.unpaid_invoice")}</span>
            <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono">
              {pendingTxs.length} items
            </span>
          </h3>

          {pendingTxs.length === 0 ? (
            <div className="bg-[#0c0c0c]/40 p-6 border border-[#1a1a1a] rounded-2xl text-center text-[#444]">
              <CheckCircle className="w-7 h-7 text-emerald-500/30 mx-auto mb-1" />
              <p className="text-xs">No pending outstanding cash sales. Your business is up-to-date.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[35vh] overflow-y-auto">
              {pendingTxs.map((tx: any) => (
                <div key={tx._id} className="bg-[#0c0c0c] border border-[#1a1a1a] p-3 rounded-2xl flex items-center justify-between">
                  <div className="text-left space-y-1">
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase font-mono">
                      Pending VAT Settlement
                    </span>
                    <p className="text-[10px] text-[#888] font-mono mt-1">Invoice Ref: {tx._id.slice(-8).toUpperCase()}</p>
                    <p className="text-[10px] text-[#555]">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-white">{tx.taxAmount.toLocaleString()} RWF</p>
                    <span className="text-[9px] text-[#555] uppercase tracking-wider">Tax Due</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settled history ledger */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37] flex items-center justify-between">
            <span>Settled Payment Records</span>
            <span className="text-[10px] bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37] px-2 py-0.5 rounded font-mono">
              {paidTxs.length} settled
            </span>
          </h3>

          {paidTxs.length === 0 ? (
            <div className="bg-[#0c0c0c]/40 p-6 border border-[#1a1a1a] rounded-2xl text-center text-[#444]">
              <p className="text-xs">No settlements history recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[35vh] overflow-y-auto">
              {paidTxs.map((tx: any) => (
                <div key={tx._id} className="bg-[#0c0c0c] border border-[#1a1a1a] p-3 rounded-2xl flex items-center justify-between col-span-1">
                  <div className="text-left space-y-1">
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase font-mono">
                      {tx.paymentMethod}
                    </span>
                    <p className="text-[10px] text-[#888] font-mono mt-1">Ref: {tx.referenceNumber || `MOMO-SETTLE-${tx._id.slice(-6).toUpperCase()}`}</p>
                    <p className="text-[10px] text-[#555]">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-emerald-400">+{tx.taxAmount.toLocaleString()} RWF</p>
                    <span className="text-[9px] text-emerald-500 uppercase tracking-wider">Settled</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
