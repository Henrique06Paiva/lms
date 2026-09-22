import { db } from "./db/connection.js";

// Executa uma query simples de teste no SQLite nativo
const result = db.prepare("SELECT sqlite_version() as version").get() as {
  version: string;
};

console.log("🚀 EduCore DB conectado com sucesso!");
console.log(`📦 Versão do SQLite: ${result.version}`);
console.log(`🔒 WAL habilitado?`, db.pragma("journal_mode", { simple: true }));
console.log(
  `🔑 Foreign Keys ativadas?`,
  db.pragma("foreign_keys", { simple: true }),
);
