import { db } from "./server/db";
import { paymentSessions, fineQueries } from "./drizzle/schema";

async function check() {
  try {
    const sessions = await db.select().from(paymentSessions);
    console.log("Payment Sessions Count:", sessions.length);
    if (sessions.length > 0) {
      console.log("Latest Session:", sessions[0]);
    }

    const queries = await db.select().from(fineQueries);
    console.log("Fine Queries Count:", queries.length);
    if (queries.length > 0) {
      console.log("Latest Query:", queries[0]);
    }
  } catch (err) {
    console.error("Error checking DB:", err);
  } finally {
    process.exit();
  }
}

check();
