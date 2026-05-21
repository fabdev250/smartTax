import { GoogleGenAI } from "@google/genai";

// Initialize the GoogleGenAI client with the aistudio-build User-Agent
const apiKey = process.env.GEMINI_API_KEY;

// Lazy initialization logic
let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not configured. AI features will respond with offline intelligence fallback.");
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

export async function generateBusinessAnalysis(businessData: {
  name: string;
  category: string;
  totalSales: number;
  taxPaid: number;
  taxPending: number;
  topProducts: string[];
}) {
  const ai = getAIClient();
  if (!ai) {
    return getFallbackAnalysis(businessData);
  }

  const prompt = `You are a professional business advisor and tax expert specialized in Rwandan SMEs, EBM (Electronic Billing Machine), and RRA (Rwanda Revenue Authority) tax regulations.
Analyze the following business statistics and provide a structured, actionable evaluation.

Business Name: ${businessData.name}
Sector/Category: ${businessData.category}
Total Sales (RWF): ${businessData.totalSales} RWF
Total Tax Paid (RWF): ${businessData.taxPaid} RWF
Total Tax Pending/Unpaid (RWF): ${businessData.taxPending} RWF
Top Selling Product categories: ${businessData.topProducts.join(", ")}

Please provide:
1. Tax Compliance Assessment: Evaluate their current compliance. Are they paying VAT (18%) properly? Mention VAT vs Small Business Flat Tax rules in Rwanda.
2. Cash Flow & Revenue Recommendations: Actionable ideas to improve sales and manage tax obligations.
3. Mobile Money (MoMo) Payment Advice: How registering for MoMo pay benefits tax settlements.
4. An optimization quote for the upcoming month.

Ensure your advice is professional, concise, culturally grounded in the Rwandan SME market (mentioning RRA, EBM, local tax regimes), and in easy-to-read markdown.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    return response.text || "No response received from AI advisor.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return getFallbackAnalysis(businessData);
  }
}

export async function askAIAdvisor(context: {
  businessName?: string;
  category?: string;
  question: string;
  history?: Array<{ role: "user" | "model"; parts: string[] }>;
}) {
  const ai = getAIClient();
  if (!ai) {
    return "AI Assistant Offline: Gemini API is currently unavailable. fallback advice: Focus on local Rwandan SME accounting, ensure EBM version 2 receipts are recorded, and settle pending VAT (18%) within 15 days using MoMo to avoid RRA penalties.";
  }

  const systemInstruction = `You are SmartTax AI, a smart assistant for business owners in Rwanda. 
You speak English, Kinyarwanda, and French. If context questions are in Kinyarwanda or French, respond in that language.
You are extremely familiar with:
- Rwanda Revenue Authority (RRA) tax rules (Standard VAT: 18%, Flat tax for turnover under 50M RWF)
- EBM (Electronic Billing Machine) invoice requirements
- Mobile Money (MTN MoMo, Airtel Money) payment flows
- Rwandan administrative layout (Provinces, Districts, Sectors)

Keep responses helpful, structured, relatively short (mobile-first readers!), and very supportive.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: context.question,
      config: {
        systemInstruction,
      }
    });
    return response.text || "I apologize, but I couldn't formulate a response right now.";
  } catch (error) {
    console.error("Gemini Advisor Query Error:", error);
    return "Something went wrong while communicating with SmartTax AI. Settle taxes manually using RRA portals or check your internet connection.";
  }
}

function getFallbackAnalysis(data: {
  name: string;
  category: string;
  totalSales: number;
  taxPaid: number;
  taxPending: number;
  topProducts: string[];
}): string {
  return `### SmartTax Offline Performance Analytics for **${data.name}**

*Offline Smart Insights Engine generated this local report.*

#### 1. Tax Compliance Status (RRA)
* **Standard VAT Rate applied**: 18% 
* **Current status**: You have **${data.taxPending.toLocaleString()} RWF** in pending tax payments.
* **Warning**: Under RRA regulations, taxes classified as Cash Sales become "Pending Tax". You must settle these using MTN MoMo or Airtel Money to secure an RRA Clearance Certificate.

#### 2. Local Market Benchmarks
* In the **${data.category}** sector, standard operating margins in Rwanda average 15-22%. 
* Your top product categories include: *${data.topProducts.join(", ") || "No products initialized"}*. We advise adjusting pricing to automatically absorb the 18% VAT to preserve your margins.

#### 3. Action Steps
1. **Approve Payments**: Use the SmartTax dashboard to approve outstanding Cash Sales, turning them into official tax settlements.
2. **Settle pending tax**: Pay your outstanding balance of **${data.taxPending.toLocaleString()} RWF** via MTN MoMo immediately.
3. **Register for PWA Sync**: Ensure you connect to the internet occasionally to synchronize your offline sales data safely.`;
}
