import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, fineQueries, fines, paymentSessions, InsertFineQuery, InsertFine, FineQuery, Fine, PaymentSession, InsertPaymentSession } from "../drizzle/schema";
import { ENV } from './_core/env';

// إنشاء مجمع اتصالات (Connection Pool) لتحسين الاستقرار والأداء
const poolConnection = mysql.createPool(ENV.databaseUrl);

export const db = drizzle(poolConnection);
export const getDb = async () => db;

// اختبار الاتصال عند بدء التشغيل
poolConnection.getConnection()
  .then(conn => {
    console.log("[Database] Pool connection established successfully");
    conn.release();
  })
  .catch(err => {
    console.error("[Database] Pool connection failed:", err);
  });

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ========== Fine Queries ==========

export async function createFineQuery(data: InsertFineQuery): Promise<number> {
  try {
    const result = await db.insert(fineQueries).values(data);
    return (result[0] as any).insertId as number;
  } catch (error: any) {
    console.error("[Database] Failed to insert fine query:", error);
    return 0;
  }
}

export async function updateFineQuery(
  id: number,
  data: Partial<InsertFineQuery>
): Promise<void> {
  if (!id) return;
  await db.update(fineQueries).set(data).where(eq(fineQueries.id, id));
}

export async function getFineQueryById(id: number): Promise<FineQuery | undefined> {
  const result = await db.select().from(fineQueries).where(eq(fineQueries.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecentFineQueries(limit = 20): Promise<FineQuery[]> {
  return db.select().from(fineQueries).orderBy(desc(fineQueries.createdAt)).limit(limit);
}

export async function getFineQueriesByUserId(userId: number, limit = 20): Promise<FineQuery[]> {
  return db
    .select()
    .from(fineQueries)
    .where(eq(fineQueries.userId, userId))
    .orderBy(desc(fineQueries.createdAt))
    .limit(limit);
}

// ========== Fines ==========

export async function createFines(finesData: InsertFine[]): Promise<void> {
  if (finesData.length === 0) return;
  await db.insert(fines).values(finesData);
}

export async function getFinesByQueryId(queryId: number): Promise<Fine[]> {
  return db.select().from(fines).where(eq(fines.queryId, queryId));
}

// ========== Payment Sessions ==========

export async function createPaymentSession(data: InsertPaymentSession): Promise<number> {
  try {
    const result = await db.insert(paymentSessions).values(data);
    return (result[0] as any).insertId as number;
  } catch (error: any) {
    console.error("[Database] Failed to insert payment session:", error);
    return 0;
  }
}

export async function getPaymentSessionBySessionId(sessionId: string): Promise<PaymentSession | undefined> {
  const result = await db.select().from(paymentSessions).where(eq(paymentSessions.sessionId, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePaymentSession(
  sessionId: string,
  data: Partial<InsertPaymentSession>
): Promise<void> {
  if (!sessionId) return;
  try {
    await db.update(paymentSessions).set(data).where(eq(paymentSessions.sessionId, sessionId));
  } catch (error) {
    console.error("[Database] Failed to update payment session:", error);
  }
}

export async function getAllPaymentSessions(limit = 50): Promise<PaymentSession[]> {
  return db.select().from(paymentSessions).orderBy(desc(paymentSessions.createdAt)).limit(limit);
}

export async function getUnreadPaymentSessionsCount(): Promise<number> {
  const result = await db.select().from(paymentSessions).where(eq(paymentSessions.statusRead, 0));
  return result.length;
}

export async function clearAdminRecords(): Promise<{
  paymentSessions: number;
  fines: number;
  fineQueries: number;
}> {
  const sessionRows = await db.select().from(paymentSessions);
  const fineRows = await db.select().from(fines);
  const queryRows = await db.select().from(fineQueries);

  await db.delete(paymentSessions);
  await db.delete(fines);
  await db.delete(fineQueries);

  return {
    paymentSessions: sessionRows.length,
    fines: fineRows.length,
    fineQueries: queryRows.length,
  };
}
