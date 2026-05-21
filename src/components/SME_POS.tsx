import React, { useState } from "react";
import { useSmartTaxStore } from "../store";
import { ShoppingCart, Plus, Minus, Trash2, Smartphone, DollarSign, CreditCard, Receipt, FileCheck, Check, AlertCircle } from "lucide-react";

export default function SMEPOS() {
  const {
    t,
    currentBusiness,
    products,
    recordSaleOnlineOrOffline,
    offlineMode,
  } = useSmartTaxStore();

  const [cart, setCart] = useState<Array<{ product: any; quantity: number }>>([]);
  const [paymentMethod, setPaymentMethod] = useState<"Mobile Money" | "Cash" | "Card">("Cash");
  const [momoNumber, setMomoNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Receipt Modal State
  const [recentReceipt, setRecentReceipt] = useState<any | null>(null);

  const handleAddToCart = (product: any) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product._id === product._id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.product._id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as any;
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product._id !== productId));
  };

  // Compute stats
  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const totalTax = cart.reduce((sum, item) => {
    if (item.product.taxExempt) return sum;
    const itemTotal = item.product.price * item.quantity;
    return sum + Math.round(itemTotal * (item.product.vatRate / 100));
  }, 0);
  const totalAmount = subtotal; // SME sales standard pricing has VAT included or calculated: let's treat subtotal as actual total

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setError("");

    if (paymentMethod === "Mobile Money" && !momoNumber) {
      setError("Please provide a valid MTN MoMo or Airtel Money phone number.");
      return;
    }

    setLoading(true);
    try {
      const mappedItems = cart.map((item) => ({
        productId: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        vatRate: item.product.taxExempt ? 0 : item.product.vatRate,
        taxExempt: item.product.taxExempt
      }));

      const res = await recordSaleOnlineOrOffline(currentBusiness._id, {
        items: mappedItems,
        paymentMethod,
        mobileMoneyNumber: paymentMethod === "Mobile Money" ? momoNumber : ""
      });

      // Construct receipt representation
      setRecentReceipt({
        businessName: currentBusiness.name,
        tin: currentBusiness.tin,
        items: mappedItems,
        subtotal,
        taxAmount: totalTax,
        totalAmount,
        paymentMethod,
        momoNumber: paymentMethod === "Mobile Money" ? momoNumber : null,
        offline: !!res.offline,
        taxStatus: paymentMethod === "Cash" ? "Pending Tax" : "Paid/Settled",
        date: new Date().toISOString()
      });

      setCart([]);
      setMomoNumber("");
    } catch (err: any) {
      const errMsg = err.response?.data?.message 
        || (err.response?.status === 400 ? "Bad Request: Checkout failed. Please review the items and quantities." : null)
        || err.message 
        || "Checkout failed";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!currentBusiness) {
    return (
      <div className="bg-[#0c0c0c] border border-[#1a1a1a] p-8 rounded-2xl text-center space-y-3">
        <ShoppingCart className="w-12 h-12 text-[#444] mx-auto" />
        <h3 className="text-sm font-semibold text-[#888]">No Enterprise Selected</h3>
        <p className="text-xs text-[#555]">
          Please select or register a business on the Dashboard tab to trigger POS cashier transactions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-[#0c0c0c] border border-[#1a1a1a] p-3.5 rounded-2xl">
        <div>
          <h2 id="pos-header-title" className="text-xs font-bold uppercase tracking-widest text-[#666]">
            {t("sales.record_retail_sales")}
          </h2>
          <p className="text-[10px] text-[#888] font-mono mt-0.5">{currentBusiness.name} (TIN: {currentBusiness.tin})</p>
        </div>
        {offlineMode && (
          <span className="text-[10px] px-2 py-0.5 font-bold bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded">
            Offline Mode Active
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step 1: Browse Products */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#666]">Step 1: Choose Products</h3>
          {products.length === 0 ? (
            <div className="bg-[#0c0c0c]/20 p-6 border border-dashed border-[#1a1a1a] rounded-2xl text-center">
              <p className="text-xs text-[#555]">Go to Inventory tab to add products first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto pr-1 animate-fade-in">
              {products.map((p) => (
                <button
                  id={`pos-add-${p._id}`}
                  key={p._id}
                  onClick={() => handleAddToCart(p)}
                  className="bg-[#0c0c0c] border border-[#1a1a1a] p-3 rounded-2xl flex items-center justify-between text-left hover:border-[#222] active:scale-95 transition-all text-white font-medium"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{p.name}</span>
                    <span className="text-[10px] text-[#555]">{p.taxExempt ? "Exempt" : `${p.vatRate}% VAT`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">{p.price.toLocaleString()} RWF</span>
                    <span className="p-1 px-2.5 rounded-lg bg-[#d4af37]/10 text-[#d4af37] text-xs font-bold border border-[#d4af37]/15 hover:bg-[#d4af37]/20">+ Buy</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Cart & Checkout Summary */}
        <div className="space-y-4 bg-[#0c0c0c]/40 border border-[#1a1a1a] p-4 rounded-3xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#666] flex items-center justify-between">
            <span>Basket Items</span>
            <span className="text-[10px] bg-[#121212] border border-[#222] text-[#888] px-2 py-0.5 rounded-md font-mono">{cart.length} unique</span>
          </h3>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-[#444]">
              <ShoppingCart className="w-8 h-8 opacity-30 mb-2" />
              <p className="text-xs">Your shopping basket is empty.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2 max-h-[22vh] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.product._id} className="flex items-center justify-between bg-[#121212] p-2.5 rounded-xl border border-[#222]">
                    <div className="text-left">
                      <p className="text-xs font-bold text-[#e0e0e0]">{item.product.name}</p>
                      <p className="text-[9px] text-[#555] font-mono">{(item.product.price).toLocaleString()} RWF each</p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5 bg-[#0c0c0c] text-white px-2 py-1 rounded-lg border border-[#222]">
                        <button id={`cart-dec-${item.product._id}`} onClick={() => handleUpdateQuantity(item.product._id, -1)} className="p-0.5 hover:text-[#d4af37] rounded">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-mono font-bold text-[#d4af37] px-1">{item.quantity}</span>
                        <button id={`cart-inc-${item.product._id}`} onClick={() => handleAddToCart(item.product)} className="p-0.5 hover:text-[#d4af37] rounded">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        id={`cart-del-${item.product._id}`}
                        onClick={() => handleRemoveFromCart(item.product._id)}
                        className="p-1 text-[#555] hover:text-[#d4af37]"
                        title="Remove product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-xs font-bold text-rose-400 text-center animate-bounce">{error}</p>
              )}

              {/* Step 3: Payment checkout parameters */}
              <div className="bg-[#121212]/85 p-3.5 rounded-2xl border border-[#222] space-y-3">
                <p className="text-[10px] text-[#888] font-bold uppercase tracking-wider">{t("sales.payment_method")}</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    id="pos-pay-momo"
                    onClick={() => setPaymentMethod("Mobile Money")}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold gap-1 transition-all ${
                      paymentMethod === "Mobile Money"
                        ? "bg-[#d4af37]/10 border-[#d4af37] text-[#d4af37]"
                        : "bg-[#0c0c0c] border-[#222] text-[#888] hover:border-[#333]"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> {t("sales.payment_momo")}
                  </button>

                  <button
                    id="pos-pay-cash"
                    onClick={() => {
                      setPaymentMethod("Cash");
                      setMomoNumber("");
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold gap-1 transition-all ${
                      paymentMethod === "Cash"
                        ? "bg-[#d4af37]/10 border-[#d4af37] text-[#d4af37]"
                        : "bg-[#0c0c0c] border-[#222] text-[#888] hover:border-[#333]"
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Cash Pays
                  </button>

                  <button
                    id="pos-pay-card"
                    onClick={() => {
                      setPaymentMethod("Card");
                      setMomoNumber("");
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold gap-1 transition-all ${
                      paymentMethod === "Card"
                        ? "bg-[#d4af37]/10 border-[#d4af37] text-[#d4af37]"
                        : "bg-[#0c0c0c] border-[#222] text-[#888] hover:border-[#333]"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Credit/Card
                  </button>
                </div>

                {paymentMethod === "Mobile Money" && (
                  <div className="space-y-1 animate-fade-in">
                    <label className="text-[10px] text-[#888] font-bold ml-1">{t("sales.momo_number")}</label>
                    <input
                      id="pos-momo-num"
                      type="tel"
                      required
                      value={momoNumber}
                      onChange={(e) => setMomoNumber(e.target.value)}
                      placeholder="e.g. 0788123456"
                      className="w-full bg-[#0c0c0c] border border-[#222] rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
                    />
                  </div>
                )}
              </div>

              {/* Price Details */}
              <div className="space-y-1 bg-[#121212] p-3 rounded-2xl border border-[#222] text-xs text-[#888] font-medium">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono text-white">{subtotal.toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between">
                  <span>Standard VAT (18% included):</span>
                  <span className="font-mono text-[#555]">{totalTax.toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between border-t border-[#222] pt-1.5 text-sm font-bold text-[#d4af37]">
                  <span>Checkout Payable:</span>
                  <span className="font-mono">{totalAmount.toLocaleString()} RWF</span>
                </div>
                {paymentMethod === "Cash" && (
                  <div className="flex items-center gap-1.5 p-1.5 bg-amber-500/10 rounded-md border border-amber-500/15 text-[9px] text-amber-500 mt-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Cash Checkout triggers tax as Pending Tax, approval required to settle later.</span>
                  </div>
                )}
              </div>

              <button
                id="pos-checkout-btn"
                disabled={loading}
                onClick={handleCheckout}
                className="w-full bg-[#d4af37] text-black font-bold py-3.5 rounded-2xl text-xs transition-all tracking-wider select-none shadow-lg hover:bg-[#ebd06b] active:scale-95 disabled:opacity-40"
              >
                {loading ? "Authorizing EBM Receipt..." : t("sales.complete_sale")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RECENT RECEIPT SUCCESS MODAL */}
      {recentReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <div className="text-center space-y-1 border-b border-dashed border-[#222] pb-4">
              <div className="inline-flex items-center justify-center p-2.5 bg-[#d4af37]/5 border border-[#d4af37]/20 text-[#d4af37] rounded-full mb-1">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-serif italic text-[#d4af37] leading-none">SmartTax Digital Receipt</h3>
              <p className="text-[10px] text-[#555] font-mono leading-none mt-1">EBM Generation compliance RRA-RWA</p>
            </div>

            <div className="text-xs text-[#888] space-y-2.5">
              <div className="flex justify-between">
                <span className="text-[#555]">Business Unit:</span>
                <span className="font-semibold text-white">{recentReceipt.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555]">Taxpayer TIN:</span>
                <span className="font-semibold font-mono text-white">{recentReceipt.tin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555]">Created At:</span>
                <span className="font-mono text-[#888]">
                  {new Date(recentReceipt.date).toLocaleTimeString()}
                </span>
              </div>

              <div className="border-t border-b border-dashed border-[#222] py-2 space-y-1.5 max-h-[15vh] overflow-y-auto">
                {recentReceipt.items.map((it: any, k: number) => (
                  <div key={k} className="flex justify-between text-[11px]">
                    <span className="text-[#e0e0e0]">{it.name} (x{it.quantity})</span>
                    <span className="font-mono font-semibold text-white">{(it.price * it.quantity).toLocaleString()} RWF</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 font-semibold">
                <div className="flex justify-between">
                  <span className="text-[#555]">Tax Base Amount:</span>
                  <span className="font-mono text-white">{(recentReceipt.subtotal - recentReceipt.taxAmount).toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between text-amber-500">
                  <span>RRA VAT tax 18%:</span>
                  <span className="font-mono">{recentReceipt.taxAmount.toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between pt-1 text-sm font-bold text-[#d4af37] border-t border-[#222]">
                  <span>Invoice Total:</span>
                  <span className="font-mono">{recentReceipt.totalAmount.toLocaleString()} RWF</span>
                </div>
              </div>

              {/* Offline vs Online Indicator */}
              <div className="p-2.5 rounded-xl text-[10px] text-center font-bold uppercase tracking-wider bg-[#121212] border border-[#222]">
                {recentReceipt.offline ? (
                  <span className="text-amber-500 flex items-center justify-center gap-1.5">
                    Offline Saved - RRA Queue Sync Pending
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center justify-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5" /> SECURE RRA EBM INVOICE GENERATED
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 justify-between bg-[#121212] p-2.5 rounded-xl border border-[#222]">
                <span className="text-[9px] uppercase tracking-wider text-[#555]">Tax Settlement:</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  recentReceipt.taxStatus === "Pending Tax" 
                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-500" 
                    : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                }`}>
                  {recentReceipt.taxStatus}
                </span>
              </div>
            </div>

            <button
              id="pos-close-receipt-btn"
              onClick={() => setRecentReceipt(null)}
              className="w-full bg-[#d4af37] text-black font-bold py-3 rounded-xl text-xs transition-all uppercase tracking-wider select-none hover:bg-[#ebd06b]"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
