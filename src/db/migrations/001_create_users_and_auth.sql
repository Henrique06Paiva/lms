-- ==============================================================================
-- MIGRATION 001: Usuários, Sessões, Recuperação de Senha e Rate Limit
-- ==============================================================================

-- 1. Tabela de Usuários
-- 'STRICT' ativa a tipagem rigorosa de tipos no SQLite.
CREATE TABLE users (
  -- INTEGER PRIMARY KEY no SQLite é automaticamente um alias para o ROWID (64-bit autoincrement)
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  -- UNIQUE cria automaticamente um índice B-Tree para buscas rápidas e impede emails duplicados
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  -- CHECK simula um ENUM, aceitando apenas 'admin' ou 'student'
  role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  -- Armazenamos datas no padrão ISO-8601 (YYYY-MM-DD HH:MM:SS) em UTC
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
) STRICT;

-- 2. Tabela de Sessões (RF02, RF03, RNF05)
-- O 'id' é o token criptográfico que será gravado no cookie httpOnly do navegador
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  -- 'ON DELETE CASCADE' garante que se um usuário for deletado, suas sessões somem juntas
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
) STRICT;

-- Índice para acelerar a busca e a limpeza periódica de sessões expiradas
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- 3. Tabela de Recuperação de Senha (RF04)
CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Armazenamos o HASH do token enviado por email, e não o token cru, por segurança
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  -- 'used_at' fica NULL enquanto o token não for usado. Ao redefinir, gravamos o timestamp
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
) STRICT;

CREATE INDEX idx_password_resets_token_hash ON password_resets(token_hash);

-- 4. Tabela de Tentativas de Autenticação para Rate Limiting (RF05)
CREATE TABLE auth_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  email TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
) STRICT;

-- Índices compostos para que a verificação de rate limit por IP ou por Email seja O(log N)
CREATE INDEX idx_auth_attempts_ip_time ON auth_attempts(ip, attempted_at);
CREATE INDEX idx_auth_attempts_email_time ON auth_attempts(email, attempted_at);