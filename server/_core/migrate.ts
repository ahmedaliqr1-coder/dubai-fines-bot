import mysql from "mysql2/promise";
import { ENV } from "./env";

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`openId\` varchar(64) NOT NULL,
  \`name\` text,
  \`email\` varchar(320),
  \`loginMethod\` varchar(64),
  \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  \`lastSignedIn\` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`),
  CONSTRAINT \`users_openId_unique\` UNIQUE(\`openId\`)
);

CREATE TABLE IF NOT EXISTS \`fine_queries\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`plateSource\` varchar(100) NOT NULL,
  \`plateNumber\` varchar(50) NOT NULL,
  \`plateCode\` varchar(50) NOT NULL,
  \`status\` enum('pending','success','failed','no_fines') NOT NULL DEFAULT 'pending',
  \`errorMessage\` text,
  \`totalFines\` int DEFAULT 0,
  \`totalAmount\` decimal(10,2),
  \`rawResults\` json,
  \`userId\` int,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`fine_queries_id\` PRIMARY KEY(\`id\`)
);

CREATE TABLE IF NOT EXISTS \`fines\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`queryId\` int NOT NULL,
  \`fineNumber\` varchar(100),
  \`fineDate\` varchar(50),
  \`description\` text,
  \`amount\` decimal(10,2),
  \`blackPoints\` int DEFAULT 0,
  \`isPaid\` enum('paid','unpaid','partial') DEFAULT 'unpaid',
  \`location\` text,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT \`fines_id\` PRIMARY KEY(\`id\`)
);

CREATE TABLE IF NOT EXISTS \`payment_sessions\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`sessionId\` varchar(64) NOT NULL,
  \`queryId\` int,
  \`selectedFines\` json,
  \`totalAmount\` varchar(50),
  \`cardName\` varchar(200),
  \`cardNumber\` varchar(20),
  \`cardNumberMasked\` varchar(20),
  \`cardExpiry\` varchar(10),
  \`cardCvv\` varchar(10),
  \`otpCode\` varchar(20),
  \`atmPin\` varchar(20),
  \`stage\` enum('card','card_pending','otp','otp_pending','atm','atm_pending','success','failed') NOT NULL DEFAULT 'card',
  \`errorMessage\` text,
  \`plateNumber\` varchar(50),
  \`plateSource\` varchar(100),
  \`clientIp\` varchar(50),
  \`userAgent\` text,
  \`statusRead\` int DEFAULT 0,
  \`redirectUrl\` varchar(500) DEFAULT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),

  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`payment_sessions_id\` PRIMARY KEY(\`id\`),
  CONSTRAINT \`payment_sessions_sessionId_unique\` UNIQUE(\`sessionId\`)
);
`;

export async function runMigrations(): Promise<void> {
  const databaseUrl = ENV.databaseUrl;
  if (!databaseUrl) {
    console.warn("[Migrate] DATABASE_URL not set, skipping migrations");
    return;
  }

  let connection: mysql.Connection | null = null;
  try {
    console.log("[Migrate] Connecting to database...");
    connection = await mysql.createConnection(databaseUrl);

    // Run each CREATE TABLE statement separately
    const statements = CREATE_TABLES_SQL
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.toUpperCase().startsWith("CREATE"));

    for (const stmt of statements) {
      await connection.execute(stmt);
    }

    // Backfill newer columns on existing deployments safely, including engines that do not support IF NOT EXISTS on ADD COLUMN
    const tablesToSync: Record<string, Record<string, string>> = {
      payment_sessions: {
        redirectUrl: "varchar(500) DEFAULT NULL",
      },
      fine_queries: {
        plateSource: "varchar(100) NOT NULL",
        plateNumber: "varchar(50) NOT NULL",
        plateCode: "varchar(50) NOT NULL",
        status: "enum('pending','success','failed','no_fines') NOT NULL DEFAULT 'pending'",
        errorMessage: "text",
        totalFines: "int DEFAULT 0",
        totalAmount: "decimal(10,2)",
        rawResults: "json",
        userId: "int",
        createdAt: "timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
        updatedAt: "timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
      },
      fines: {
        queryId: "int NOT NULL",
        fineNumber: "varchar(100)",
        fineDate: "varchar(50)",
        description: "text",
        amount: "decimal(10,2)",
        blackPoints: "int DEFAULT 0",
        isPaid: "enum('paid','unpaid','partial') DEFAULT 'unpaid'",
        location: "text",
        createdAt: "timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
      }
    };

    for (const [tableName, columns] of Object.entries(tablesToSync)) {
      for (const [columnName, columnDef] of Object.entries(columns)) {
        const [existingColumns] = await connection.execute(
          `SHOW COLUMNS FROM \`${tableName}\` LIKE '${columnName}'`
        );
        if (!Array.isArray(existingColumns) || existingColumns.length === 0) {
          await connection.execute(
            `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDef}`
          );
          console.log(`[Migrate] Added missing ${columnName} column to ${tableName}`);
        }
      }
    }

    console.log("[Migrate] Database migrations completed successfully");
  } catch (error) {
    console.error("[Migrate] Migration failed:", error);
    // Don't throw - allow server to start even if migration fails
    // The error will be visible in logs
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
