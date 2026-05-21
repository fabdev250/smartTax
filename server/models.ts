import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

// Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://fabdev255_db_user:fabdb@cluster0.dqog3jc.mongodb.net/smart_tax?retryWrites=true&w=majority";

export async function connectDB() {
  try {
    if (mongoose.connection.readyState >= 1) return;
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB Connected Successfully");
    // Run the automatic demo seeder
    await seedDatabase();
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
}

// ---------------- USER SCHEMA ----------------
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: "national_admin" | "provincial_admin" | "district_admin" | "sector_admin" | "business_owner";
  geographicScope: {
    province?: string;
    district?: string;
    sector?: string;
  };
  phoneNumber?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ["national_admin", "provincial_admin", "district_admin", "sector_admin", "business_owner"],
    required: true,
  },
  geographicScope: {
    province: { type: String, default: "" },
    district: { type: String, default: "" },
    sector: { type: String, default: "" },
  },
  phoneNumber: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
}, { collection: "smarttax_users" });

// ---------------- BUSINESS SCHEMA ----------------
export interface IBusiness extends Document {
  ownerId: mongoose.Types.ObjectId | string;
  name: string;
  tin: string; // Taxpayer Identification Number
  category: string;
  address: {
    province: string;
    district: string;
    sector: string;
  };
  isActive: boolean;
  createdAt: Date;
}

const BusinessSchema = new Schema<IBusiness>({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  tin: { type: String, required: true, unique: true },
  category: { type: String, default: "Retail" },
  address: {
    province: { type: String, required: true },
    district: { type: String, required: true },
    sector: { type: String, required: true },
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { collection: "smarttax_businesses" });

// ---------------- PRODUCT SCHEMA ----------------
export interface IProduct extends Document {
  businessId: mongoose.Types.ObjectId | string;
  name: string;
  sku: string;
  price: number; // in RWF
  vatRate: number; // e.g. 18 for 18% VAT or 0 for exempt
  stock: number;
  taxExempt: boolean;
  createdAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  vatRate: { type: Number, default: 18 }, // Rwandan default standard rate is 18%
  stock: { type: Number, default: 0 },
  taxExempt: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { collection: "smarttax_products" });

// ---------------- SALE SCHEMA ----------------
export interface ISale extends Document {
  businessId: mongoose.Types.ObjectId | string;
  cashierId: mongoose.Types.ObjectId | string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
    vatRate: number;
    taxCalculated: number;
  }>;
  totalAmount: number;
  taxAmount: number;
  paymentMethod: "Mobile Money" | "Cash" | "Card";
  paymentStatus: "Paid" | "Pending";
  mobileMoneyNumber?: string;
  createdAt: Date;
  isOffline: boolean;
  syncedAt?: Date;
}

const SaleSchema = new Schema<ISale>({
  businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
  cashierId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  items: [
    {
      productId: { type: String, required: true },
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true, min: 0 },
      vatRate: { type: Number, default: 18 },
      taxCalculated: { type: Number, required: true, min: 0 },
    },
  ],
  totalAmount: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ["Mobile Money", "Cash", "Card"], required: true },
  paymentStatus: { type: String, enum: ["Paid", "Pending"], required: true },
  mobileMoneyNumber: { type: String },
  createdAt: { type: Date, default: Date.now },
  isOffline: { type: Boolean, default: false },
  syncedAt: { type: Date },
}, { collection: "smarttax_sales" });

// ---------------- TAX TRANSACTION / SETTLEMENT SCHEMA ----------------
export interface ITaxTransaction extends Document {
  saleId?: mongoose.Types.ObjectId | string;
  businessId: mongoose.Types.ObjectId | string;
  taxAmount: number;
  paymentMethod: "MTN MoMo" | "Airtel Money" | "Cash" | "System Balance";
  status: "Paid" | "Pending";
  referenceNumber?: string;
  approvedBy?: mongoose.Types.ObjectId | string;
  approvedAt?: Date;
  createdAt: Date;
}

const TaxTransactionSchema = new Schema<ITaxTransaction>({
  saleId: { type: Schema.Types.ObjectId, ref: "Sale" },
  businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
  taxAmount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ["MTN MoMo", "Airtel Money", "Cash", "System Balance"], required: true },
  status: { type: String, enum: ["Paid", "Pending"], required: true },
  referenceNumber: { type: String },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
}, { collection: "smarttax_taxtransactions" });

// ---------------- AUDIT LOG SCHEMA ----------------
export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId | string;
  action: string;
  details: string;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true },
  details: { type: String, required: true },
  ipAddress: { type: String },
  createdAt: { type: Date, default: Date.now },
}, { collection: "smarttax_auditlogs" });

// Mongoose Models
export const User = (mongoose.models.User || mongoose.model<IUser>("User", UserSchema)) as any;
export const Business = (mongoose.models.Business || mongoose.model<IBusiness>("Business", BusinessSchema)) as any;
export const Product = (mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema)) as any;
export const Sale = (mongoose.models.Sale || mongoose.model<ISale>("Sale", SaleSchema)) as any;
export const TaxTransaction = (mongoose.models.TaxTransaction || mongoose.model<ITaxTransaction>("TaxTransaction", TaxTransactionSchema)) as any;
export const AuditLog = (mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema)) as any;

// Seeder logic to hydrate database automatically if no users exist
async function seedDatabase() {
  try {
    console.log("Starting SmartTax database check & robust upsert/seed...");

    const salt = bcrypt.genSaltSync(10);
    const ownerHash = bcrypt.hashSync("password123", salt);
    const adminHash = bcrypt.hashSync("admin123", salt);

    // 1. Ensure Core Users exist and are updated
    let owner = await User.findOne({ email: "owner@smarttax.rw" });
    if (!owner) {
      owner = new User({
        name: "Jean Bosco Nteziryayo",
        email: "owner@smarttax.rw",
        passwordHash: ownerHash,
        role: "business_owner",
        geographicScope: {},
        phoneNumber: "250788123456",
      });
      await owner.save();
    } else {
      owner.passwordHash = ownerHash;
      owner.role = "business_owner";
      await owner.save();
    }

    let admin = await User.findOne({ email: "admin@rra.gov.rw" });
    if (!admin) {
      admin = new User({
        name: "RRA Commissioner General",
        email: "admin@rra.gov.rw",
        passwordHash: adminHash,
        role: "national_admin",
        geographicScope: {},
        phoneNumber: "250788000111",
      });
      await admin.save();
    } else {
      admin.passwordHash = adminHash;
      admin.role = "national_admin";
      await admin.save();
    }

    let kigaliAdmin = await User.findOne({ email: "kigali@rra.gov.rw" });
    if (!kigaliAdmin) {
      kigaliAdmin = new User({
        name: "Kigali Province Supervisor",
        email: "kigali@rra.gov.rw",
        passwordHash: adminHash,
        role: "provincial_admin",
        geographicScope: { province: "Kigali City" },
        phoneNumber: "250788654321",
      });
      await kigaliAdmin.save();
    } else {
      kigaliAdmin.passwordHash = adminHash;
      kigaliAdmin.role = "provincial_admin";
      await kigaliAdmin.save();
    }

    let northernAdmin = await User.findOne({ email: "northern@rra.gov.rw" });
    if (!northernAdmin) {
      northernAdmin = new User({
        name: "Northern Province Inspector",
        email: "northern@rra.gov.rw",
        passwordHash: adminHash,
        role: "provincial_admin",
        geographicScope: { province: "Northern Province" },
        phoneNumber: "250788777888",
      });
      await northernAdmin.save();
    } else {
      northernAdmin.passwordHash = adminHash;
      northernAdmin.role = "provincial_admin";
      await northernAdmin.save();
    }

    // 2. Ensure Default Businesses exist
    let business = await Business.findOne({ tin: "109247382" });
    if (!business) {
      business = new Business({
        ownerId: owner._id,
        name: "Kigali Smart Retail Ltd",
        tin: "109247382",
        category: "Retail",
        address: {
          province: "Kigali City",
          district: "Nyarugenge",
          sector: "Nyarugenge",
        },
        isActive: true,
      });
      await business.save();
    }

    let boutique = await Business.findOne({ tin: "108356291" });
    if (!boutique) {
      boutique = new Business({
        ownerId: owner._id,
        name: "Rubavu Corner Boutique",
        tin: "108356291",
        category: "Wholesale",
        address: {
          province: "Western Province",
          district: "Rubavu",
          sector: "Gisenyi",
        },
        isActive: true,
      });
      await boutique.save();
    }

    // 3. Ensure Default Catalog Products exist
    let p1 = await Product.findOne({ sku: "PRD-MILK-12X", businessId: business._id });
    if (!p1) {
      p1 = new Product({
        businessId: business._id,
        name: "Inyange Milk (Pack of 12)",
        sku: "PRD-MILK-12X",
        price: 6000,
        vatRate: 18,
        stock: 150,
        taxExempt: false,
      });
      await p1.save();
    }

    let p2 = await Product.findOne({ sku: "PRD-PRIMUS-SM", businessId: business._id });
    if (!p2) {
      p2 = new Product({
        businessId: business._id,
        name: "Primus Beer (Small Bottle)",
        sku: "PRD-PRIMUS-SM",
        price: 1000,
        vatRate: 18,
        stock: 240,
        taxExempt: false,
      });
      await p2.save();
    }

    let p3 = await Product.findOne({ sku: "PRD-AKAB-LG", businessId: business._id });
    if (!p3) {
      p3 = new Product({
        businessId: business._id,
        name: "Akabanga Chili oil (Large)",
        sku: "PRD-AKAB-LG",
        price: 1500,
        vatRate: 18,
        stock: 95,
        taxExempt: false,
      });
      await p3.save();
    }

    let p4 = await Product.findOne({ sku: "PRD-TEA-MTN", businessId: business._id });
    if (!p4) {
      p4 = new Product({
        businessId: business._id,
        name: "Rwanda Mountain Tea (Exempt)",
        sku: "PRD-TEA-MTN",
        price: 2500,
        vatRate: 0,
        stock: 110,
        taxExempt: true,
      });
      await p4.save();
    }

    let p5 = await Product.findOne({ sku: "PRD-POTATO-50", businessId: boutique._id });
    if (!p5) {
      p5 = new Product({
        businessId: boutique._id,
        name: "Irish Potatoes (50kg sack)",
        sku: "PRD-POTATO-50",
        price: 18000,
        vatRate: 18,
        stock: 30,
        taxExempt: false,
      });
      await p5.save();
    }

    // 4. Create Historical Sales and Tax Transactions if none exist
    const salesCount = await Sale.countDocuments({ businessId: business._id });
    if (salesCount === 0) {
      console.log("Seeding and simulating historical sales records...");
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 3600 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 3600 * 1000);

      // Sale 1: One Month ago, Paid via MoMo
      const s1 = new Sale({
        businessId: business._id,
        cashierId: owner._id,
        items: [
          {
            productId: p1._id.toString(),
            name: p1.name,
            quantity: 2,
            price: p1.price,
            vatRate: p1.vatRate,
            taxCalculated: Math.round(p1.price * 2 * 0.18),
          }
        ],
        totalAmount: p1.price * 2,
        taxAmount: Math.round(p1.price * 2 * 0.18),
        paymentMethod: "Mobile Money",
        paymentStatus: "Paid",
        mobileMoneyNumber: "250788111222",
        createdAt: oneMonthAgo,
        isOffline: false,
      });
      await s1.save();

      const t1 = new TaxTransaction({
        saleId: s1._id,
        businessId: business._id,
        taxAmount: s1.taxAmount,
        paymentMethod: "MTN MoMo",
        status: "Paid",
        referenceNumber: "MOMO-SETTLE-6738",
        approvedBy: owner._id,
        approvedAt: oneMonthAgo,
        createdAt: oneMonthAgo,
      });
      await t1.save();

      // Sale 2: Fifteen Days ago, Paid via Cash (VAT Outstanding!)
      const s2 = new Sale({
        businessId: business._id,
        cashierId: owner._id,
        items: [
          {
            productId: p2._id.toString(),
            name: p2.name,
            quantity: 5,
            price: p2.price,
            vatRate: p2.vatRate,
            taxCalculated: Math.round(p2.price * 5 * 0.18),
          },
          {
            productId: p3._id.toString(),
            name: p3.name,
            quantity: 3,
            price: p3.price,
            vatRate: p3.vatRate,
            taxCalculated: Math.round(p3.price * 3 * 0.18),
          }
        ],
        totalAmount: (p2.price * 5) + (p3.price * 3),
        taxAmount: Math.round(p2.price * 5 * 0.18) + Math.round(p3.price * 3 * 0.18),
        paymentMethod: "Cash",
        paymentStatus: "Pending",
        createdAt: fifteenDaysAgo,
        isOffline: false,
      });
      await s2.save();

      const t2 = new TaxTransaction({
        saleId: s2._id,
        businessId: business._id,
        taxAmount: s2.taxAmount,
        paymentMethod: "Cash",
        status: "Pending",
        createdAt: fifteenDaysAgo,
      });
      await t2.save();

      // Sale 3: Two Days ago, Paid via Card (VAT Paid)
      const s3 = new Sale({
        businessId: business._id,
        cashierId: owner._id,
        items: [
          {
            productId: p1._id.toString(),
            name: p1.name,
            quantity: 1,
            price: p1.price,
            vatRate: p1.vatRate,
            taxCalculated: Math.round(p1.price * 1 * 0.18),
          },
          {
            productId: p4._id.toString(),
            name: p4.name,
            quantity: 2,
            price: p4.price,
            vatRate: p4.vatRate,
            taxCalculated: 0,
          }
        ],
        totalAmount: (p1.price * 1) + (p4.price * 2),
        taxAmount: Math.round(p1.price * 1 * 0.18),
        paymentMethod: "Card",
        paymentStatus: "Paid",
        createdAt: twoDaysAgo,
        isOffline: false,
      });
      await s3.save();

      const t3 = new TaxTransaction({
        saleId: s3._id,
        businessId: business._id,
        taxAmount: s3.taxAmount,
        paymentMethod: "MTN MoMo",
        status: "Paid",
        referenceNumber: "CARD-SETTLE-1120",
        approvedBy: owner._id,
        approvedAt: twoDaysAgo,
        createdAt: twoDaysAgo,
      });
      await t3.save();
    }

    console.log("SmartTax automatic incremental database seeding/upsert process completed successfully.");
  } catch (err) {
    console.error("Critical: SmartTax automatic incremental seeder failure:", err);
  }
}
