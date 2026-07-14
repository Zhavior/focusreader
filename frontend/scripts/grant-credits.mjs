#!/usr/bin/env node
/**
 * Local admin tool: inspect balances and grant credits in the dev ledger.
 *
 *   node scripts/grant-credits.mjs list
 *   node scripts/grant-credits.mjs grant <userId|all> <amount>
 *
 * Writes go through the same append-only credit_ledger the app uses, with a
 * unique (reason, ref) so an accidental double-run can't double-grant.
 */
import Database from "better-sqlite3";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const db = new Database(path.join(DATA_DIR, "focusreader.db"));

const [, , cmd, target, amountArg] = process.argv;

function balances() {
  return db
    .prepare(
      `SELECT user_id, SUM(delta) AS balance, COUNT(*) AS entries
       FROM credit_ledger GROUP BY user_id ORDER BY user_id`
    )
    .all();
}

if (cmd === "list" || !cmd) {
  const rows = balances();
  if (rows.length === 0) console.log("No users in the ledger yet.");
  for (const r of rows) {
    console.log(`${r.user_id}  balance=${r.balance}  (${r.entries} ledger entries)`);
  }
  process.exit(0);
}

if (cmd === "grant") {
  const amount = Number(amountArg);
  if (!target || !Number.isInteger(amount) || amount <= 0) {
    console.error("Usage: node scripts/grant-credits.mjs grant <userId|all> <amount>");
    process.exit(1);
  }

  const users =
    target === "all" ? balances().map((r) => r.user_id) : [target];

  const ref = `dev-grant:${new Date().toISOString()}`;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO credit_ledger (user_id, delta, reason, ref)
     VALUES (?, ?, 'migration', ?)`
  );

  for (const userId of users) {
    insert.run(userId, amount, `${ref}:${userId}`);
    const { balance } = db
      .prepare(`SELECT SUM(delta) AS balance FROM credit_ledger WHERE user_id = ?`)
      .get(userId);
    console.log(`Granted ${amount} to ${userId} — new balance: ${balance}`);
  }
  process.exit(0);
}

console.error(`Unknown command "${cmd}". Use: list | grant <userId|all> <amount>`);
process.exit(1);
