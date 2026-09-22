import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.resolve(process.cwd(), "data", "educore.sqlite");

export const db = new Database(DB_PATH, { verbose: console.log });

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

const handleShutdown = (signal: string) => {
  if (db.open) {
    db.close();
    console.log(`Database connection closed due to ${signal}`);
  }
  process.exit(0);
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

export type DB = typeof db;
