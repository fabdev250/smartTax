import React, { useState } from "react";
import { useSmartTaxStore } from "../store";
import { Lock, Mail, User, Phone, MapPin, Building2, Fingerprint } from "lucide-react";
import axios from "axios";
import LanguageSelector from "./LanguageSelector";

export default function AuthPortal() {
  const { login, t, language } = useSmartTaxStore();
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<"business_owner" | "provincial_admin" | "district_admin" | "sector_admin">("business_owner");
  
  // Geographic Scope States
  const [province, setProvince] = useState("Kigali City");
  const [district, setDistrict] = useState("Nyarugenge");
  const [sector, setSector] = useState("Nyarugenge");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin 
      ? { email, password }
      : {
          name,
          email,
          password,
          role,
          phoneNumber,
          geographicScope: role !== "business_owner" ? { province, district, sector } : {}
        };

    try {
      const res = await axios.post(url, payload);
      login(res.data.token, res.data.user);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message 
        || (err.response?.status === 400 ? "Incorrect login details or this account email is already registered." : null)
        || err.message 
        || "Connection has failed. Settle credentials and retry.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 flex flex-col justify-center items-center bg-[#080808] text-[#e0e0e0]">
      <div className="absolute top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-4 bg-[#d4af37]/5 rounded-2xl border border-[#d4af37]/20 text-[#d4af37]">
            <Fingerprint className="w-10 h-10" />
          </div>
          <h1 id="auth-title" className="text-3xl font-serif italic text-[#d4af37] tracking-tight">
            {t("app.title")}
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#666] font-medium">
            {t("app.tagline")}
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#888] ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444] w-4 h-4" />
                  <input
                    id="reg-name"
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37]/50 rounded-xl px-10 py-3 text-sm placeholder:text-[#444] focus:outline-none transition-all text-white"
                  />
                </div>
              </div>

              {/* Phone and Role */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#888] ml-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444] w-3.5 h-3.5" />
                    <input
                      id="reg-phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 078XXXXXXX"
                      className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37]/50 rounded-xl pl-9 pr-3 py-3 text-xs placeholder:text-[#444] focus:outline-none transition-all text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#888] ml-1">Account Role</label>
                  <select
                    id="reg-role"
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37]/50 rounded-xl px-3 py-3 text-xs focus:outline-none text-white font-medium"
                  >
                    <option value="business_owner">Business Owner</option>
                    <option value="provincial_admin">Province Admin</option>
                    <option value="district_admin">District Admin</option>
                    <option value="sector_admin">Sector Admin</option>
                  </select>
                </div>
              </div>

              {/* Admin scope configs */}
              {role !== "business_owner" && (
                <div className="bg-[#121212] border border-[#1a1a1a] p-3.5 rounded-2xl space-y-2.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#d4af37] flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Geographic Scoping
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] text-[#555] uppercase font-bold block ml-1">Province</label>
                      <select
                        id="reg-province"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        className="w-full bg-[#0c0c0c] border border-[#222] rounded-lg p-1.5 text-[10px] text-white"
                      >
                        <option value="Kigali City">Kigali City</option>
                        <option value="Northern Province">Northern</option>
                        <option value="Southern Province">Southern</option>
                        <option value="Eastern Province">Eastern</option>
                        <option value="Western Province">Western</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] text-[#555] uppercase font-bold block ml-1">District</label>
                      <input
                        id="reg-district"
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        className="w-full bg-[#0c0c0c] border border-[#222] rounded-lg p-1 text-[10px] text-white"
                        placeholder="District"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] text-[#555] uppercase font-bold block ml-1">Sector</label>
                      <input
                        id="reg-sector"
                        type="text"
                        value={sector}
                        onChange={(e) => setSector(e.target.value)}
                        className="w-full bg-[#0c0c0c] border border-[#222] rounded-lg p-1 text-[10px] text-white"
                        placeholder="Sector"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Email Address */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#888] ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444] w-4 h-4" />
              <input
                id="login-email"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37]/50 rounded-xl px-10 py-3 text-sm placeholder:text-[#444] focus:outline-none transition-all text-white"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#888] ml-1">Security PIN/Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444] w-4 h-4" />
              <input
                id="login-password"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-[#121212] border border-[#222] focus:border-[#d4af37]/50 rounded-xl px-10 py-3 text-sm placeholder:text-[#444] focus:outline-none transition-all text-white"
              />
            </div>
          </div>

          <button
            id="auth-submit-btn"
            disabled={loading}
            type="submit"
            className="w-full bg-[#d4af37] text-black font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg hover:bg-[#ebd06b] active:scale-95 disabled:opacity-50"
          >
            {loading ? "Please wait..." : isLogin ? t("nav.login") : t("nav.register")}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            id="auth-toggle-btn"
            onClick={() => {
              setError("");
              setIsLogin(!isLogin);
            }}
            className="text-[#d4af37] hover:text-[#ebd06b] text-xs font-semibold hover:underline"
          >
            {isLogin 
              ? "New here? Register a Rwanda SME / Regional Admin account" 
              : "Already have an account? Sign In"}
          </button>
        </div>

        {/* Quick Demo Logins Helper */}
        {isLogin && (
          <div className="bg-[#121212]/50 border border-[#1a1a1a] rounded-2xl p-4 space-y-2.5">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#d4af37] flex items-center gap-1.5">
              🔑 SmartTax Seeded Accounts
            </p>
            <div className="grid grid-cols-2 gap-2.5 text-[11px] text-[#aaa]">
              <div className="bg-[#0a0a0a] border border-[#181818] p-2.5 rounded-xl space-y-1">
                <span className="font-bold text-white block">SME Owner</span>
                <p className="font-mono text-[9px] text-[#888] truncate" title="owner@smarttax.rw">owner@smarttax.rw</p>
                <p className="font-mono text-[9px] text-amber-500/80">PIN: password123</p>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("owner@smarttax.rw");
                    setPassword("password123");
                  }}
                  className="w-full mt-1.5 px-2 py-1 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] text-[9px] font-bold rounded transition-all active:scale-95"
                >
                  Auto Fill
                </button>
              </div>
              <div className="bg-[#0a0a0a] border border-[#181818] p-2.5 rounded-xl space-y-1">
                <span className="font-bold text-white block">RRA Administrator</span>
                <p className="font-mono text-[9px] text-[#888] truncate" title="admin@rra.gov.rw">admin@rra.gov.rw</p>
                <p className="font-mono text-[9px] text-amber-500/80">PIN: admin123</p>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("admin@rra.gov.rw");
                    setPassword("admin123");
                  }}
                  className="w-full mt-1.5 px-2 py-1 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] text-[9px] font-bold rounded transition-all active:scale-95"
                >
                  Auto Fill
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
