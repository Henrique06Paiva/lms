import { db } from "../../db/connection.js";

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: "admin" | "student";
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface PasswordResetRecord {
  id: string;
  user_id: number;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export class AuthRepository {
  public createUser(params: {
    name: string;
    email: string;
    passwordHash: string;
    passwordSalt: string;
    role: "admin" | "student";
  }): UserRecord {
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, password_salt, role)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      params.name,
      params.email.toLowerCase().trim(),
      params.passwordHash,
      params.passwordSalt,
      params.role
    ) as UserRecord;
  }

  public findUserByEmail(email: string): UserRecord | null {
    const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
    return (stmt.get(email.toLowerCase().trim()) as UserRecord) || null;
  }

  public findUserById(id: number): UserRecord | null {
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    return (stmt.get(id) as UserRecord) || null;
  }

  public updateUserPassword(
    userId: number,
    passwordHash: string,
    passwordSalt: string
  ): void {
    const stmt = db.prepare(`
      UPDATE users
      SET password_hash = ?, password_salt = ?
      WHERE id = ?
    `);
    stmt.run(passwordHash, passwordSalt, userId);
  }

  public createSession(sessionId: string, userId: number, expiresAt: string): void {
    const stmt = db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(sessionId, userId, expiresAt);
  }

  public findSessionWithUser(
    sessionId: string
  ): { session: SessionRecord; user: UserRecord } | null {
    const stmt = db.prepare(`
      SELECT 
        s.id as s_id, s.user_id as s_user_id, s.expires_at as s_expires_at, s.created_at as s_created_at,
        u.id as u_id, u.name as u_name, u.email as u_email, u.role as u_role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND datetime(s.expires_at) > datetime('now')
    `);

    const row = stmt.get(sessionId) as any;
    if (!row) return null;

    return {
      session: {
        id: row.s_id,
        user_id: row.s_user_id,
        expires_at: row.s_expires_at,
        created_at: row.s_created_at,
      },
      user: {
        id: row.u_id,
        name: row.u_name,
        email: row.u_email,
        password_hash: "",
        password_salt: "",
        role: row.u_role,
        created_at: "",
        updated_at: "",
      },
    };
  }

  public deleteSession(sessionId: string): void {
    const stmt = db.prepare("DELETE FROM sessions WHERE id = ?");
    stmt.run(sessionId);
  }

  public deleteExpiredSessions(): void {
    const stmt = db.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')");
    stmt.run();
  }

  public createPasswordReset(
    id: string,
    userId: number,
    tokenHash: string,
    expiresAt: string
  ): void {
    const stmt = db.prepare(`
      INSERT INTO password_resets (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, userId, tokenHash, expiresAt);
  }

  public findValidPasswordReset(tokenHash: string): PasswordResetRecord | null {
    const stmt = db.prepare(`
      SELECT * FROM password_resets
      WHERE token_hash = ?
        AND used_at IS NULL
        AND datetime(expires_at) > datetime('now')
    `);
    return (stmt.get(tokenHash) as PasswordResetRecord) || null;
  }

  public markPasswordResetAsUsed(id: string): void {
    const stmt = db.prepare(`
      UPDATE password_resets
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(id);
  }

  public recordAuthAttempt(ip: string, email: string): void {
    const stmt = db.prepare(`
      INSERT INTO auth_attempts (ip, email)
      VALUES (?, ?)
    `);
    stmt.run(ip, email.toLowerCase().trim());
  }

  public countRecentAttempts(ip: string, email: string, windowMinutes: number): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM auth_attempts
      WHERE (ip = ? OR email = ?)
        AND datetime(attempted_at) >= datetime('now', '-' || ? || ' minutes')
    `);
    const row = stmt.get(ip, email.toLowerCase().trim(), windowMinutes) as { count: number };
    return row.count;
  }
}

export const authRepository = new AuthRepository();
