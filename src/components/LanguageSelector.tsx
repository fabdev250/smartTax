import React from "react";
import { useSmartTaxStore } from "../store";
import { Globe } from "lucide-react";

export default function LanguageSelector() {
  const { language, setLanguage } = useSmartTaxStore();

  return (
    <div className="flex items-center gap-1.5 bg-[#0c0c0c] backdrop-blur-md px-3 py-1.5 rounded-full border border-[#222]">
      <Globe className="w-3.5 h-3.5 text-[#d4af37]" />
      <select
        id="language-picker"
        aria-label="Select Language"
        value={language}
        onChange={(e) => setLanguage(e.target.value as any)}
        className="bg-transparent text-xs font-semibold text-[#e0e0e0] focus:outline-none cursor-pointer pr-1"
      >
        <option value="en" className="bg-[#0c0c0c] text-[#e0e0e0] font-medium">EN</option>
        <option value="rw" className="bg-[#0c0c0c] text-[#e0e0e0] font-medium">RW</option>
        <option value="fr" className="bg-[#0c0c0c] text-[#e0e0e0] font-medium">FR</option>
      </select>
    </div>
  );
}
