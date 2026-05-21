import React, { useState, useRef, useEffect } from "react";
import { useSmartTaxStore } from "../store";
import { Sparkles, Send, Mic, MicOff, Brain, User, RefreshCw, FileText, AlertCircle, Volume2 } from "lucide-react";
import axios from "axios";

export default function SMEAIAssistant() {
  const {
    t,
    currentBusiness,
    token,
    offlineMode,
  } = useSmartTaxStore();

  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { sender: "ai", text: "Hello! I am SmartTax AI, your Rwandan SME compliance expert. Ask me about RRA taxes, VAT exemptions, or tap the diagnostic checker to generate a complete business tax analysis." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  
  // Tax compliance report states
  const [reportDoc, setReportDoc] = useState("");
  const [loadingDoc, setLoadingDoc] = useState(false);

  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim()) return;

    // Append user message
    setMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    if (!customText) setInput("");
    setLoading(true);

    try {
      const res = await axios.post("/api/ai/chat", {
        question: textToSend,
        businessId: currentBusiness?._id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessages((prev) => [...prev, { sender: "ai", text: res.data.answer }]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [...prev, {
        sender: "ai",
        text: offlineMode 
          ? "I am operating in offline fallback modes. For standard SME under 50 Million RWF turnover, a 3% flat tax rate is applied instead of the 18% standard VAT rate. Turn on internet to get live answers."
          : "Sorry, I am having trouble connecting to Gemini. Ensure you've registered with valid secrets."
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Diagnostic tool check
  const handleGenerateAudit = async () => {
    if (!currentBusiness) return;
    setLoadingDoc(true);
    setReportDoc("");
    try {
      const res = await axios.post("/api/ai/analyse", {
        businessId: currentBusiness._id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportDoc(res.data.analysis);
    } catch (err: any) {
      console.error(err);
      setReportDoc(`### Standard Tax Evaluation fallback format - ${currentBusiness.name}

1. **VAT Assessment**: Standard VAT (18%) is calculated on item checkouts.
2. **Offline Actions**: Sync queue has local Sales pending. Sync when internet returns to file with RRA.
3. **MoMo Settle**: Pay outstanding balances through MoMo portals directly.`);
    } finally {
      setLoadingDoc(false);
    }
  };

  // Mock Voice command / Speech recognition architecture
  const toggleSpeech = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((prev) => [...prev, { 
        sender: "ai", 
        text: "Speech recognition is not supported in this browser viewport window. Please type your target command." 
      }]);
      return;
    }

    if (listening) {
      setListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      setListening(true);
    };

    rec.onresult = (e: any) => {
      const resultText = e.results[0][0].transcript;
      setInput(resultText);
      setListening(false);
    };

    rec.onerror = (e: any) => {
      console.error("Speech Error:", e);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
    };

    rec.start();
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-emerald-400" />
          <h2 id="ai-title" className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {t("assistant.smarttax_ai")}
          </h2>
        </div>
        {currentBusiness && (
          <button
            id="ai-audit-btn"
            onClick={handleGenerateAudit}
            disabled={loadingDoc}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/15 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            {loadingDoc ? "Analysing SME..." : t("assistant.generate_audit_analysis")}
          </button>
        )}
      </div>

      {/* RRA Diagnostic Reports rendering */}
      {reportDoc && (
        <div className="bg-[#0f1724] border border-emerald-500/20 p-5 rounded-3xl space-y-3 relative overflow-hidden animate-slide-up">
          <div className="absolute top-0 right-0 p-1.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase rounded-bl-xl tracking-widest">
            Diagnostic Finished
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Tax Assessment Diagnosis
          </h3>
          <div className="text-xs text-slate-300 font-medium space-y-2 leading-relaxed whitespace-pre-line prose prose-invert">
            {reportDoc}
          </div>
          <button
            id="ai-clear-doc"
            onClick={() => setReportDoc("")}
            className="w-full text-center text-[10px] font-bold uppercase text-slate-500 mt-2 hover:text-slate-300"
          >
            Dismiss Report Document
          </button>
        </div>
      )}

      {/* Main chat widget */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl flex flex-col h-[48vh] overflow-hidden relative">
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 custom-scrollbar">
          {messages.map((m, idx) => {
            const isUser = m.sender === "user";
            return (
              <div
                key={idx}
                className={`flex gap-2.5 max-w-[85%] ${
                  isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                <div className={`p-2 rounded-xl flex items-center justify-center h-8 w-8 min-w-8 ${
                  isUser ? "bg-emerald-500 text-slate-950" : "bg-slate-850 text-emerald-400 border border-slate-700"
                }`}>
                  {isUser ? <User className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
                </div>

                <div className={`p-3 rounded-2xl text-xs font-medium space-y-1 ${
                  isUser 
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-slate-100 rounded-tr-none" 
                    : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none leading-relaxed"
                }`}>
                  <p className="whitespace-pre-line">{m.text}</p>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex gap-2.5 max-w-[85%]">
              <div className="p-2 rounded-xl bg-slate-850 text-emerald-400 border border-slate-700 flex items-center justify-center h-8 w-8 animate-pulse">
                <Brain className="w-4 h-4" />
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-400 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={listEndRef} />
        </div>

        {/* Action input widgets */}
        <div className="p-3 bg-slate-950 border-t border-slate-850 flex items-center gap-2">
          <button
            id="ai-mic-btn"
            onClick={toggleSpeech}
            className={`p-2.5 rounded-xl border transition-all ${
              listening 
                ? "bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
            title="Start speech input dictation"
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            id="ai-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder={t("assistant.ask_placeholder")}
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none"
          />

          <button
            id="ai-send-btn"
            onClick={() => handleSend()}
            className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
