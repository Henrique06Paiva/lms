import fs from "node:fs";
import path from "node:path";
import { db } from "./connection.js";

// Tipagem para a linha retornada da tabela de controle
interface MigrationRow {
  name: string;
}

/**
 * Função responsável por executar as migrações pendentes no banco SQLite.
 */
function runMigrations(): void {
  console.log("📦 [Migrations] Iniciando processo de migração...");

  // 1. Garante que a tabela de controle de histórico exista
  // 'IF NOT EXISTS' previne erro caso a tabela já tenha sido criada em execuções anteriores
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);

  // 2. Busca no banco todos os nomes de migrations que já foram executadas
  // .prepare() compila a query SQL e .all() retorna todas as linhas encontradas
  const appliedMigrations = db
    .prepare("SELECT name FROM _migrations ORDER BY id ASC")
    .all() as MigrationRow[];

  // Criamos um Set (conjunto) para buscas O(1) ultra-rápidas: appliedSet.has("001_xxx.sql")
  const appliedSet = new Set(appliedMigrations.map((m) => m.name));

  // 3. Lê todos os arquivos dentro do diretório src/db/migrations
  const migrationsDir = path.resolve(process.cwd(), "src", "db", "migrations");

  // Garante que o diretório existe
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // fs.readdirSync lê os nomes dos arquivos na pasta
  // .filter() seleciona apenas arquivos que terminam com '.sql'
  // .sort() garante a execução na ordem: '001_...', '002_...', etc.
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  // 4. Filtra apenas os arquivos que ainda NÃO estão no banco
  const pendingMigrations = migrationFiles.filter(
    (file) => !appliedSet.has(file),
  );

  if (pendingMigrations.length === 0) {
    console.log(
      "✨ [Migrations] Banco de dados já está atualizado. Nenhuma migration pendente.",
    );
    return;
  }

  console.log(
    `🚀 [Migrations] Encontradas ${pendingMigrations.length} migration(s) pendente(s).`,
  );

  // 5. Prepara a query de inserção para registrar a migration aplicada
  // Usamos '?' como placeholder para evitar qualquer risco de SQL injection
  const insertMigrationStmt = db.prepare(
    "INSERT INTO _migrations (name) VALUES (?)",
  );

  // 6. Define a transação atômica do better-sqlite3
  // O better-sqlite3 encapsula a função: se ela lançar erro, ele faz ROLLBACK automaticamente
  const applyMigration = db.transaction(
    (fileName: string, sqlContent: string) => {
      // Executa todo o script SQL daquele arquivo
      db.exec(sqlContent);
      // Registra o nome do arquivo na tabela de controle
      insertMigrationStmt.run(fileName);
    },
  );

  // 7. Itera e aplica cada migration pendente
  for (const file of pendingMigrations) {
    const filePath = path.join(migrationsDir, file);
    // fs.readFileSync lê o conteúdo textual do arquivo SQL em UTF-8
    const sql = fs.readFileSync(filePath, "utf-8");

    try {
      console.log(`⏳ Aplicando: ${file}...`);
      applyMigration(file, sql);
      console.log(`✅ Aplicado com sucesso: ${file}`);
    } catch (error) {
      console.error(`❌ Erro ao aplicar migration '${file}':`, error);
      // Lança o erro para parar o script imediatamente e não aplicar as próximas
      throw error;
    }
  }

  console.log(
    "🎉 [Migrations] Todas as migrações foram aplicadas com sucesso!",
  );
}

// Executa o runner
try {
  runMigrations();
} catch (err) {
  process.exit(1);
}
