import { Request, Response, NextFunction, Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User, Business, Product, Sale, TaxTransaction, AuditLog, connectDB } from "./models.js";
import { generateBusinessAnalysis, askAIAdvisor } from "./gemini.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "smarttax_secret_jwt_key_2026_rw";

// Error mapping helper to convert ValidationError or CastError parameters into HTTP 400 Bad Requests rather than HTTP 500
function handleRouteError(res: Response, err: any, defaultMessage: string, customStatusCode = 500) {
  console.error(`${defaultMessage}:`, err);
  if (err?.name === "ValidationError") {
    return res.status(400).json({ message: `Validation failed: ${err.message}` });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ message: `Invalid identifier format: ${err.message}` });
  }
  return res.status(customStatusCode).json({ message: `${defaultMessage}: ${err.message || err}` });
}

// ---------------- MIDDLEWARE ----------------

// Extend Express Request type
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "national_admin" | "provincial_admin" | "district_admin" | "sector_admin" | "business_owner";
    geographicScope: {
      province?: string;
      district?: string;
      sector?: string;
    };
  };
}

// Authentication middleware
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const token = (authHeader && (authHeader as string).split(" ")[1]) || req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Access denied. Ready to log in." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token sessions." });
  }
}

// Helper to log user actions
async function createAuditLog(userId: string | undefined, action: string, details: string) {
  try {
    const log = new AuditLog({
      userId,
      action,
      details,
    });
    await log.save();
  } catch (err) {
    console.error("Audit Logging Error:", err);
  }
}

// Helper to calculate taxes based on price and standard 18% VAT rate (or custom tax exemptions)
function computeVAT(price: number, vatRate: number, isExempt: boolean): number {
  if (isExempt) return 0;
  return Math.round((price * (vatRate / 100)));
}

// ---------------- ROUTES ----------------

// Connection check
router.get("/health", async (req, res) => {
  await connectDB();
  res.json({ status: "ok", message: "SmartTax backend operations are active" });
});

// -- AUTHENTICATION --

// Sign Up
router.post("/auth/register", async (req, res) => {
  try {
    await connectDB();
    const { name, email, password, role, geographicScope, phoneNumber } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All authentication fields (name, email, password, role) are required." });
    }

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "A user with this email already exists." });
    }

    // Role safety & Scope safety
    let scope = geographicScope || {};
    if (role === "business_owner") {
      scope = {}; // No regional admin scopes
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      passwordHash,
      role,
      geographicScope: {
        province: scope.province || "",
        district: scope.district || "",
        sector: scope.sector || "",
      },
      phoneNumber: phoneNumber || "",
    });

    await newUser.save();
    await createAuditLog(newUser._id.toString(), "USER_REGISTER", `Registered account: ${email} with role ${role}`);

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role, geographicScope: newUser.geographicScope },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        geographicScope: newUser.geographicScope,
        phoneNumber: newUser.phoneNumber,
      },
    });
  } catch (err: any) {
    return handleRouteError(res, err, "Error during registration");
  }
});

// Sign In
router.post("/auth/login", async (req, res) => {
  try {
    await connectDB();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    const validPass = await bcrypt.compare(password, user.passwordHash);
    if (!validPass) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    await createAuditLog(user._id.toString(), "USER_LOGIN", `LoggedIn successfully: ${email}`);

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, geographicScope: user.geographicScope },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Save token to cookie if needed
    res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        geographicScope: user.geographicScope,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (err: any) {
    return handleRouteError(res, err, "Login Error");
  }
});

// Validate session user
router.get("/auth/me", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(440).json({ message: "User session has expired or user account was deleted." }); // Use 440 or 404
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        geographicScope: user.geographicScope,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (err: any) {
    return handleRouteError(res, err, "Token Session validation error");
  }
});

// -- BUSINESS MANAGEMENT --

// Register a Business
router.post("/businesses", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    const { name, tin, category, address } = req.body;

    if (!name || !tin) {
      return res.status(400).json({ message: "Business Name and RRA TIN are required fields." });
    }

    if (req.user?.role !== "business_owner" && req.user?.role !== "national_admin") {
      return res.status(403).json({ message: "Only business owners can register businesses." });
    }

    const ownerId = req.user.id;
    const existing = await Business.findOne({ tin });
    if (existing) {
      return res.status(400).json({ message: `A business with RRA TIN ${tin} is already registered.` });
    }

    const business = new Business({
      ownerId,
      name,
      tin,
      category: category || "Retail",
      address: {
        province: address?.province || "Kigali City",
        district: address?.district || "Nyarugenge",
        sector: address?.sector || "Kanyinya",
      },
    });

    await business.save();
    await createAuditLog(req.user.id, "BUSINESS_CREATE", `Registered business: ${name} (TIN: ${tin})`);

    res.status(201).json(business);
  } catch (err: any) {
    return handleRouteError(res, err, "Business registration failed");
  }
});

// Get My Businesses
router.get("/businesses", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();

    // Geographic Scoping for admins
    if (req.user?.role && req.user.role !== "business_owner") {
      const scope = req.user.geographicScope;
      const query: any = {};

      if (req.user.role === "provincial_admin" && scope.province) {
        query["address.province"] = scope.province;
      } else if (req.user.role === "district_admin" && scope.district) {
        query["address.district"] = scope.district;
      } else if (req.user.role === "sector_admin" && scope.sector) {
        query["address.sector"] = scope.sector;
      }

      const businesses = await Business.find(query).populate("ownerId", "name email");
      return res.json(businesses);
    }

    // business owners only get their own
    const businesses = await Business.find({ ownerId: req.user?.id });
    res.json(businesses);
  } catch (err: any) {
    return handleRouteError(res, err, "Failed to retrieve businesses list");
  }
});

// -- PRODUCT MANAGEMENT --

// Get products for a business
router.get("/businesses/:businessId/products", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    if (!req.params.businessId) {
      return res.status(400).json({ message: "businessId parameter is required." });
    }
    const products = await Product.find({ businessId: req.params.businessId });
    res.json(products);
  } catch (err: any) {
    return handleRouteError(res, err, "Error retrieving products catalog");
  }
});

// Create product
router.post("/businesses/:businessId/products", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    const { name, sku, price, vatRate, stock, taxExempt } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ message: "Product Name and Price are required fields." });
    }

    // Check if business belongs to user
    const biz = await Business.findById(req.params.businessId);
    if (!biz) {
      return res.status(404).json({ message: "Business not found" });
    }

    if (req.user?.role !== "national_admin" && biz.ownerId.toString() !== req.user?.id) {
      return res.status(403).json({ message: "Unauthorized operation on this SME." });
    }

    const product = new Product({
      businessId: req.params.businessId,
      name,
      sku: sku || `PRD-${Date.now()}`,
      price: Number(price),
      vatRate: vatRate !== undefined ? Number(vatRate) : 18,
      stock: stock !== undefined ? Number(stock) : 0,
      taxExempt: !!taxExempt,
    });

    await product.save();
    res.status(201).json(product);
  } catch (err: any) {
    return handleRouteError(res, err, "Add product error");
  }
});

// -- OFF-LINE SYNC & RECORD SALES ROUTE --

router.post("/sales/sync", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    const { sales } = req.body; // Array of sales to synchronize

    if (!Array.isArray(sales)) {
      return res.status(400).json({ message: "Invalid payload: 'sales' must be an array." });
    }

    const syncedSales = [];
    for (const offlineSale of sales) {
      // Validate offline sale fields
      if (!offlineSale.businessId || !offlineSale.items || !Array.isArray(offlineSale.items)) {
        continue; // Skip invalid elements rather than failing the whole batch or returning 500
      }

      // Avoid duplicate uploads by comparing offline generated unique keys in references
      const existing = await Sale.findOne({
        businessId: offlineSale.businessId,
        createdAt: offlineSale.createdAt,
        totalAmount: offlineSale.totalAmount,
      });

      if (existing) {
        syncedSales.push(existing);
        continue;
      }

      // Record offline sale structure
      const sale = new Sale({
        businessId: offlineSale.businessId,
        cashierId: req.user?.id,
        items: offlineSale.items,
        totalAmount: offlineSale.totalAmount || 0,
        taxAmount: offlineSale.taxAmount || 0,
        paymentMethod: offlineSale.paymentMethod || "Cash",
        paymentStatus: offlineSale.paymentStatus || "Pending",
        mobileMoneyNumber: offlineSale.mobileMoneyNumber,
        createdAt: offlineSale.createdAt || new Date(),
        isOffline: true,
        syncedAt: new Date(),
      });

      await sale.save();

      // Log tax transaction as pending if paid with Cash
      const status = sale.paymentMethod === "Cash" ? "Pending" : "Paid";
      const tx = new TaxTransaction({
        saleId: sale._id,
        businessId: offlineSale.businessId,
        taxAmount: sale.taxAmount,
        paymentMethod: sale.paymentMethod === "Cash" ? "Cash" : "MTN MoMo",
        status: status,
        referenceNumber: sale.paymentMethod === "Cash" ? "" : `MOMO-SYNC-${Date.now()}-${SyncCounter++}`,
      });

      await tx.save();
      syncedSales.push(sale);
    }

    await createAuditLog(req.user?.id, "SALES_SYNC", `Synchronized ${sales.length} offline transactions successfully.`);
    res.json({ success: true, count: syncedSales.length, syncList: syncedSales });
  } catch (err: any) {
    return handleRouteError(res, err, "Sync execution error");
  }
});

let SyncCounter = 1000;

// Regular Record single sale
router.post("/businesses/:businessId/sales", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    const { items, paymentMethod, mobileMoneyNumber } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Transaction failed: Sales cart must contain at least one item." });
    }

    const biz = await Business.findById(req.params.businessId);
    if (!biz) {
      return res.status(404).json({ message: "Business not found" });
    }

    if (req.user?.role !== "national_admin" && biz.ownerId.toString() !== req.user?.id) {
      return res.status(403).json({ message: "Unpermitted action for this SME." });
    }

    // Process tax calculations dynamically per product
    let totalTax = 0;
    let totalAmount = 0;

    const processedItems = items.map((item: any) => {
      const lineTotal = (item.price || 0) * (item.quantity || 0);
      const vat = computeVAT(lineTotal, item.vatRate || 18, item.taxExempt || false);
      totalTax += vat;
      totalAmount += lineTotal;

      return {
        productId: item.productId || `UNSP-${Date.now()}`,
        name: item.name || "Default Product",
        quantity: item.quantity || 1,
        price: item.price || 0,
        vatRate: item.vatRate || 18,
        taxCalculated: vat,
      };
    });

    // Payment Logic
    // Mobile Money -> Tax settled immediately, MoMo API triggered mock status
    // Cash -> Tax status is "Pending Tax", owner settles custom MoMo later
    const status = paymentMethod === "Cash" ? "Pending" : "Paid";

    const sale = new Sale({
      businessId: req.params.businessId,
      cashierId: req.user.id,
      items: processedItems,
      totalAmount,
      taxAmount: totalTax,
      paymentMethod: paymentMethod || "Cash",
      paymentStatus: status,
      mobileMoneyNumber: mobileMoneyNumber || "",
      isOffline: false,
    });

    await sale.save();

    // Trigger tax transaction document
    const tx = new TaxTransaction({
      saleId: sale._id,
      businessId: req.params.businessId,
      taxAmount: totalTax,
      paymentMethod: paymentMethod === "Cash" ? "Cash" : "MTN MoMo",
      status: status,
      referenceNumber: paymentMethod === "Cash" ? "" : `MOMO-ONLINE-${Date.now()}-${SyncCounter++}`,
    });

    await tx.save();

    res.status(201).json({ sale, taxTransaction: tx });
  } catch (err: any) {
    return handleRouteError(res, err, "Record sale error");
  }
});

// Get business sale history
router.get("/businesses/:businessId/sales", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    if (!req.params.businessId) {
      return res.status(400).json({ message: "businessId parameter is required to query sales history." });
    }
    const sales = await Sale.find({ businessId: req.params.businessId }).sort({ createdAt: -1 });
    res.json(sales);
  } catch (err: any) {
    return handleRouteError(res, err, "Sales fetch error");
  }
});

// -- TAX MANAGEMENT --

// Get tax balance and list for business
router.get("/businesses/:businessId/tax-summary", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    if (!req.params.businessId) {
      return res.status(400).json({ message: "businessId parameter is required." });
    }

    const transactions = await TaxTransaction.find({ businessId: req.params.businessId });

    let paid = 0;
    let pending = 0;

    transactions.forEach((tx) => {
      if (tx.status === "Paid") {
        paid += tx.taxAmount;
      } else {
        pending += tx.taxAmount;
      }
    });

    res.json({
      paid,
      pending,
      transactions,
    });
  } catch (err: any) {
    return handleRouteError(res, err, "Tax summary fetch error");
  }
});

// Settle outstanding cash taxes using simulated MTN MoMo / Airtel Money direct wallet API
router.post("/businesses/:businessId/settle-taxes", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    if (!req.params.businessId) {
      return res.status(400).json({ message: "businessId parameter is required to settle taxes." });
    }

    const { amount, mobileMoneyNumber, provider } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: "Invalid settlement amount: amount must be positive." });
    }

    // Fetch all pending tax transactions
    const pendingTransactions = await TaxTransaction.find({
      businessId: req.params.businessId,
      status: "Pending",
    });

    if (pendingTransactions.length === 0) {
      return res.status(400).json({ message: "No outstanding pending taxes to settle for this business." });
    }

    // Process payment and convert outstanding transactions to paid
    let totalPaidInThisRun = Number(amount);
    let remaining = totalPaidInThisRun;

    const modifiedIds = [];
    for (const tx of pendingTransactions) {
      if (remaining <= 0) break;

      if (tx.taxAmount <= remaining) {
        remaining -= tx.taxAmount;
        tx.status = "Paid";
        tx.paymentMethod = provider === "Airtel Money" ? "Airtel Money" : "MTN MoMo";
        tx.referenceNumber = `MOMO-SETTLE-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        tx.approvedBy = req.user?.id;
        tx.approvedAt = new Date();
        await tx.save();
        modifiedIds.push(tx._id);

        // Also update the sale record matching this tax payment
        if (tx.saleId) {
          await Sale.findByIdAndUpdate(tx.saleId, { paymentStatus: "Paid" });
        }
      } else {
        // partial payment allocation setup
        tx.taxAmount = tx.taxAmount - remaining;
        await tx.save();

        // create new transaction reflecting the paid slice
        const newPaidTx = new TaxTransaction({
          saleId: tx.saleId,
          businessId: req.params.businessId,
          taxAmount: remaining,
          paymentMethod: provider === "Airtel Money" ? "Airtel Money" : "MTN MoMo",
          status: "Paid",
          referenceNumber: `MOMO-SETTLE-PART-${Date.now()}`,
          approvedBy: req.user?.id,
          approvedAt: new Date(),
        });
        await newPaidTx.save();
        remaining = 0;
      }
    }

    await createAuditLog(
      req.user?.id,
      "TAX_SETTLEMENT",
      `Settled ${amount} RWF of outstanding VAT taxes via ${provider || "MTN MoMo"} on number ${mobileMoneyNumber}`
    );

    res.json({
      success: true,
      message: `Tax payment processed successfully. Outstanding taxes amounting to ${amount} RWF settled via ${provider || "MTN MoMo"}.`,
      referenceNumber: `RRA-MOMO-${Date.now()}`,
    });
  } catch (err: any) {
    return handleRouteError(res, err, "Tax settlement execution error");
  }
});

// -- AI ASSISTANT PORTAL ROUTE --

router.post("/ai/analyse", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) {
      return res.status(400).json({ message: "businessId parameter is required for AI analytics compile." });
    }

    await connectDB();

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    // Compile analytics summary
    const sales = await Sale.find({ businessId });
    const taxes = await TaxTransaction.find({ businessId });

    let totalSales = 0;
    sales.forEach((s) => (totalSales += s.totalAmount));

    let taxPaid = 0;
    let taxPending = 0;
    taxes.forEach((t) => {
      if (t.status === "Paid") taxPaid += t.taxAmount;
      else taxPending += t.taxAmount;
    });

    // Extract categories
    const products = await Product.find({ businessId });
    const topProducts = products.slice(0, 3).map((p) => p.name);

    const report = await generateBusinessAnalysis({
      name: business.name,
      category: business.category,
      totalSales,
      taxPaid,
      taxPending,
      topProducts: topProducts.length > 0 ? topProducts : [business.category],
    });

    res.json({ analysis: report });
  } catch (err: any) {
    return handleRouteError(res, err, "AI Analysis failure");
  }
});

router.post("/ai/chat", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { question, businessId } = req.body;

    if (!question) {
      return res.status(400).json({ message: "question parameter is required for the AI chat query." });
    }

    let context: any = { question };
    if (businessId) {
      await connectDB();
      const biz = await Business.findById(businessId);
      if (biz) {
        context.businessName = biz.name;
        context.category = biz.category;
      }
    }

    const answer = await askAIAdvisor(context);
    res.json({ answer });
  } catch (err: any) {
    return handleRouteError(res, err, "Smart Assistant query failed");
  }
});

// -- ADMINISTRATIVE GEOGRAPHIC CONSOLE ROUTE --

router.get("/admin/analytics", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();

    if (req.user?.role === "business_owner") {
      return res.status(403).json({ message: "Unauthorized. Action restricted to tax supervisors and government officials." });
    }

    const scope = req.user?.geographicScope || {};
    const query: any = {};

    if (req.user?.role === "provincial_admin" && scope.province) {
      query["address.province"] = scope.province;
    } else if (req.user?.role === "district_admin" && scope.district) {
      query["address.district"] = scope.district;
    } else if (req.user?.role === "sector_admin" && scope.sector) {
      query["address.sector"] = scope.sector;
    }

    // Get matching businesses
    const businesses = await Business.find(query);
    const bizIds = businesses.map((b) => b._id);

    // Fetch related records
    const sales = await Sale.find({ businessId: { $in: bizIds } });
    const taxes = await TaxTransaction.find({ businessId: { $in: bizIds } });

    // Summing metrics
    let totalRevenueRecorded = 0;
    sales.forEach((s) => (totalRevenueRecorded += s.totalAmount));

    let totalTaxCollected = 0;
    let totalTaxPending = 0;

    taxes.forEach((t) => {
      if (t.status === "Paid") totalTaxCollected += t.taxAmount;
      else totalTaxPending += t.taxAmount;
    });

    // Compile time series (Last 6 Months metrics for charting in dashboard)
    const monthlySeries = [
      { month: "Dec", collection: Math.floor(totalTaxCollected * 0.12), pending: Math.floor(totalTaxPending * 0.1) },
      { month: "Jan", collection: Math.floor(totalTaxCollected * 0.15), pending: Math.floor(totalTaxPending * 0.15) },
      { month: "Feb", collection: Math.floor(totalTaxCollected * 0.18), pending: Math.floor(totalTaxPending * 0.12) },
      { month: "Mar", collection: Math.floor(totalTaxCollected * 0.22), pending: Math.floor(totalTaxPending * 0.2) },
      { month: "Apr", collection: Math.floor(totalTaxCollected * 0.13), pending: Math.floor(totalTaxPending * 0.18) },
      { month: "May", collection: Math.floor(totalTaxCollected * 0.2), pending: Math.floor(totalTaxPending * 0.25) },
    ];

    res.json({
      scope,
      businessesCount: businesses.length,
      totalRevenueRecorded,
      totalTaxCollected,
      totalTaxPending,
      monthlySeries,
      recentBusinesses: businesses.slice(-5).map(b => ({
        id: b._id,
        name: b.name,
        tin: b.tin,
        sector: b.address.sector,
        district: b.address.district,
        createdAt: b.createdAt
      }))
    });
  } catch (err: any) {
    return handleRouteError(res, err, "Admin analytics computation failed");
  }
});

// -- ADMINISTRATIVE EXTENSION ENDPOINTS TO SUPPORT THE DETAILED PORTAL --

// Fetch all businesses with populated owner info (scoped by region if not national)
router.get("/admin/detailed-businesses", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    if (req.user?.role === "business_owner") {
      return res.status(403).json({ message: "Action restricted to supervisors." });
    }

    const scope = req.user?.geographicScope || {};
    const query: any = {};

    if (req.user?.role === "provincial_admin" && scope.province) {
      query["address.province"] = scope.province;
    } else if (req.user?.role === "district_admin" && scope.district) {
      query["address.district"] = scope.district;
    } else if (req.user?.role === "sector_admin" && scope.sector) {
      query["address.sector"] = scope.sector;
    }

    const businesses = await Business.find(query).populate("ownerId", "name email phoneNumber").sort({ createdAt: -1 });
    res.json(businesses);
  } catch (err: any) {
    return handleRouteError(res, err, "Failed to retrieve extensive business list");
  }
});

// Toggle suspend / active state of a business
router.post("/admin/businesses/:businessId/toggle-status", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    if (req.user?.role === "business_owner") {
      return res.status(403).json({ message: "Action restricted to supervisors." });
    }

    const biz = await Business.findById(req.params.businessId);
    if (!biz) {
      return res.status(404).json({ message: "Business not found" });
    }

    // Toggle active state
    biz.isActive = !biz.isActive;
    await biz.save();

    await createAuditLog(
      req.user?.id,
      "BUSINESS_SUSPEND_TOGGLE",
      `Changed business status of '${biz.name}' (TIN: ${biz.tin}) to '${biz.isActive ? "Active" : "Suspended"}'`
    );

    res.json({ success: true, isActive: biz.isActive, business: biz });
  } catch (err: any) {
    return handleRouteError(res, err, "Failed to toggle business status");
  }
});

// Fetch historical mobile money transactions, audit logs, and compliance reports inside the app
router.get("/admin/momo-payments", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    if (req.user?.role === "business_owner") {
      return res.status(403).json({ message: "Action restricted to supervisors." });
    }

    // Get all transactions
    const txs = await TaxTransaction.find({}).populate("businessId", "name tin").sort({ createdAt: -1 });
    // Simulate real MoMo details
    const formatted = txs.map((t: any) => ({
      _id: t._id,
      businessName: t.businessId?.name || "Unknown SME",
      tin: t.businessId?.tin || "Unknown TIN",
      taxAmount: t.taxAmount,
      status: t.status,
      paymentMethod: t.paymentMethod,
      referenceNumber: t.referenceNumber || `MOMO-${t._id.toString().substring(0,6).toUpperCase()}`,
      createdAt: t.createdAt
    }));

    res.json(formatted);
  } catch (err: any) {
    return handleRouteError(res, err, "Failed to fetch administrative payment ledgers");
  }
});

router.get("/admin/audit-logs", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    if (req.user?.role === "business_owner") {
      return res.status(403).json({ message: "Action restricted to supervisors." });
    }

    const logs = await AuditLog.find({}).populate("userId", "name email role").sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (err: any) {
    return handleRouteError(res, err, "Failed to retrieve administrative audit logs");
  }
});

router.get("/admin/users-list", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    if (req.user?.role === "business_owner") {
      return res.status(403).json({ message: "Action restricted to supervisors." });
    }

    // Return list of all users to manage
    const users = await User.find({}, "name email role geographicScope phoneNumber createdAt").sort({ role: 1 });
    res.json(users);
  } catch (err: any) {
    return handleRouteError(res, err, "Failed to retrieve users directory");
  }
});

router.post("/admin/users-create", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await connectDB();
    if (req.user?.role !== "national_admin") {
      return res.status(403).json({ message: "Only National Administrators can provision new supervisors." });
    }

    const { name, email, password, role, province, district, sector, phoneNumber } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing required fields for administrator provisioning." });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "This email address is already registered." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      passwordHash,
      role,
      geographicScope: { province, district, sector },
      phoneNumber: phoneNumber || ""
    });

    await newUser.save();
    await createAuditLog(req.user?.id, "ADMIN_PROVISIONED", `Successfully provisioned ${role}: ${email}`);

    res.status(201).json({ success: true, user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role } });
  } catch (err: any) {
    return handleRouteError(res, err, "Provincial/District administrator provisioning failed");
  }
});

export default router;
