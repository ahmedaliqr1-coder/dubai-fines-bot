import { ENV } from './server/_core/env';
import mysql from "mysql2/promise";

async function test() {
  const url = new URL(ENV.databaseUrl);
  console.log("Host:", url.hostname);
  console.log("Port:", url.port);
  console.log("User:", url.username);
  console.log("Database:", url.pathname);

  try {
    const conn = await mysql.createConnection({
      host: url.hostname,
      port: parseInt(url.port),
      user: url.username,
      password: decodeURIComponent(url.password),
      database: url.pathname.substring(1),
      ssl: { rejectUnauthorized: false }
    });
    console.log("Connection successful!");
    await conn.end();
  } catch (err: any) {
    console.error("Connection failed:", err.message);
  }
}

test();
