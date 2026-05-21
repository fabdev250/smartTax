import React, { useState, useEffect } from "react";
import { useSmartTaxStore } from "../store";
import { PlusCircle, ShoppingBag, Layers, Percent, FileWarning, Sparkles } from "lucide-react";

export default function SMEInventory() {
  const {
    t,
    currentBusiness,
    products,
    createProduct,
    fetchProducts,
    offlineMode
  } = useSmartTaxStore();

  const [showAddPrd, setShowAddPrd] = useState(false);
  const [prdName, setPrdName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [vatRate, setVatRate] = useState("18");
  const [stock, setStock] = useState("");
  const [taxExempt, setTaxExempt] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (currentBusiness) {
      fetchProducts(currentBusiness._id);
    }
  }, [currentBusiness]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!prdName || !price) {
      setError("Please fill out Name and Price.");
      return;
    }

    try {
      await createProduct(currentBusiness._id, {
        name: prdName,
        sku: sku || `SKU-${Date.now().toString().slice(-6)}`,
        price: Number(price),
        vatRate: taxExempt ? 0 : Number(vatRate),
        stock: Number(stock) || 0,
        taxExempt: taxExempt
      });

      setSuccessMsg(offlineMode ? "Product cached locally!" : "Product added successfully!");
      setPrdName("");
      setSku("");
      setPrice("");
      setStock("");
      setTaxExempt(false);
      
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      const errMsg = err.response?.data?.message 
        || (err.response?.status === 400 ? "Bad Request: Please verify the SKU, price, tax rate and stock parameters and try again." : null)
        || err.message 
        || "Failed to add product";
      setError(errMsg);
    }
  };

  if (!currentBusiness) {
    return (
      <div className="bg-[#0c0c0c] border border-[#1a1a1a] p-8 rounded-2xl text-center space-y-3">
        <ShoppingBag className="w-12 h-12 text-[#444] mx-auto" />
        <h3 className="text-sm font-semibold text-[#888]">No Enterprise Selected</h3>
        <p className="text-xs text-[#555]">
          Please select or register a business on the Dashboard tab to manage inventory assets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="inventory-title" className="text-xs font-bold uppercase tracking-widest text-[#666]">
            {t("inventory.product_catalog")}
          </h2>
          <p className="text-[10px] text-[#888] font-mono mt-0.5">{currentBusiness.name}</p>
        </div>
        <button
          id="inv-toggle-add-btn"
          onClick={() => setShowAddPrd(!showAddPrd)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#ebd06b] text-black text-xs font-bold transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" /> {t("inventory.add_new_product")}
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] rounded-xl text-xs font-bold text-center">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold text-center">
          {error}
        </div>
      )}

      {/* Add Product Inline collapsible Drawer form */}
      {showAddPrd && (
        <form onSubmit={handleAddProduct} className="bg-[#0c0c0c] border border-[#1a1a1a] p-4 rounded-2xl space-y-3.5 animate-slide-up">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">{t("inventory.add_new_product")}</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-[#888] font-bold ml-1">{t("inventory.product_name")} *</label>
              <input
                id="inv-prd-name"
                type="text"
                required
                value={prdName}
                onChange={(e) => setPrdName(e.target.value)}
                placeholder="e.g. Primus Beer (Small)"
                className="w-full bg-[#121212] border border-[#222] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-[#888] font-bold ml-1">{t("inventory.sku_code")}</label>
              <input
                id="inv-prd-sku"
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full bg-[#121212] border border-[#222] rounded-xl px-3 py-2 text-xs text-white placeholder:text-[#444]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-[#888] font-bold ml-1">{t("inventory.price_rwf")} *</label>
              <input
                id="inv-prd-price"
                type="number"
                required
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full bg-[#121212] border border-[#222] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-[#888] font-bold ml-1">{t("inventory.stock_count")}</label>
              <input
                id="inv-prd-stock"
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="e.g. 150"
                className="w-full bg-[#121212] border border-[#222] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#121212] p-3 rounded-xl border border-[#222]">
            <div className="flex items-center gap-2">
              <input
                id="inv-prd-exempt"
                type="checkbox"
                checked={taxExempt}
                onChange={(e) => setTaxExempt(e.target.checked)}
                className="w-4 h-4 rounded border-[#333] bg-[#121212] text-[#d4af37] focus:ring-[#d4af37]/40"
              />
              <span className="text-xs text-[#888] font-semibold">{t("inventory.tax_exempt")}</span>
            </div>
            {!taxExempt && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#666] font-bold uppercase">{t("inventory.standard_vat")} :</span>
                <select
                  id="inv-prd-vat"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="bg-[#0c0c0c] border border-[#222] text-xs font-bold text-[#d4af37] p-1 rounded-md"
                >
                  <option value="18">18% (Standard)</option>
                  <option value="15">15%</option>
                  <option value="5">5%</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              id="inv-prd-submit"
              type="submit"
              className="flex-1 bg-[#d4af37] text-black font-bold py-2.5 rounded-xl text-xs select-none hover:bg-[#ebd06b] transition-all"
            >
              {t("common.save")}
            </button>
            <button
              id="inv-prd-cancel"
              type="button"
              onClick={() => setShowAddPrd(false)}
              className="px-4 py-2.5 rounded-xl bg-[#121212] border border-[#222] hover:bg-[#1a1a1a] text-xs font-bold text-[#888]"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Product List Grid */}
      {products.length === 0 ? (
        <div className="bg-[#0c0c0c]/40 border border-[#1a1a1a] p-8 rounded-2xl text-center space-y-2">
          <Layers className="w-10 h-10 text-[#444] mx-auto" />
          <p className="text-xs text-[#666]">
            This business does not have any product models configured yet. Fill out the catalog first.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div
              id={`prd-card-${p._id}`}
              key={p._id}
              className="bg-[#0c0c0c] border border-[#1a1a1a] p-3.5 rounded-2xl flex items-center justify-between hover:border-[#222] transition-all"
            >
              <div className="flex flex-col text-left space-y-0.5">
                <span className="text-xs font-bold text-white">{p.name}</span>
                <span className="text-[10px] text-[#555] font-mono">SKU: {p.sku}</span>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-mono text-[#888] bg-[#121212] px-2 py-0.5 rounded border border-[#222]">
                    Stock: {p.stock} units
                  </span>
                  {p.taxExempt ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 border border-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">
                      VAT Exempt
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-[#d4af37]/5 border border-[#d4af37]/20 text-[#d4af37] px-1.5 py-0.5 rounded">
                      {p.vatRate}% VAT
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right space-y-1">
                <p className="text-sm font-mono font-bold text-white">{p.price.toLocaleString()} RWF</p>
                <p className="text-[10px] text-[#555] uppercase tracking-widest leading-none">Price per unit</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
