import { AppError } from "../../core/errors.js";
import type { AuthenticatedUser } from "../../core/types.js";
import {
  generateSalt,
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "./auth.crypto.js";
import { authRepository, type UserRecord } from "./auth.repository.js";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const SESSION_EXPIRATION_DAYS = 7;
const RESET_TOKEN_EXPIRATION_HOURS = 2;

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  role?: "admin" | "student";
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface ResetConfirmDTO {
  token: string;
  newPassword: string;
}

export class AuthService {
  public async register(dto: RegisterDTO): Promise<AuthenticatedUser> {
    if (!dto.name || dto.name.trim().length < 2) {
      throw new AppError(400, "Nome deve ter pelo menos 2 caracteres");
    }

    if (!dto.email || !dto.email.includes("@")) {
      throw new AppError(400, "E-mail inválido");
    }

    if (!dto.password || dto.password.length < 6) {
      throw new AppError(400, "Senha deve ter pelo menos 6 caracteres");
    }

    const existingUser = authRepository.findUserByEmail(dto.email);
    if (existingUser) {
      throw new AppError(409, "E-mail já cadastrado no sistema");
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(dto.password, salt);

    // Segurança: Cadastro público é forçosamente perfil "student" (Prevenção de Escalada de Privilégios)
    const user = authRepository.createUser({
      name: dto.name.trim(),
      email: dto.email,
      passwordHash,
      passwordSalt: salt,
      role: "student",
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  // 2. Cadastro administrativo de usuário / gestor (apenas via rota administrativa autenticada)
  public async createUserByAdmin(dto: RegisterDTO): Promise<AuthenticatedUser> {
    if (!dto.name || dto.name.trim().length < 2) {
      throw new AppError(400, "Nome deve ter pelo menos 2 caracteres");
    }

    if (!dto.email || !dto.email.includes("@")) {
      throw new AppError(400, "E-mail inválido");
    }

    if (!dto.password || dto.password.length < 6) {
      throw new AppError(400, "Senha deve ter pelo menos 6 caracteres");
    }

    const existingUser = authRepository.findUserByEmail(dto.email);
    if (existingUser) {
      throw new AppError(409, "E-mail já cadastrado no sistema");
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(dto.password, salt);

    const user = authRepository.createUser({
      name: dto.name.trim(),
      email: dto.email,
      passwordHash,
      passwordSalt: salt,
      role: dto.role === "admin" ? "admin" : "student",
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  public async login(
    dto: LoginDTO,
    ip: string
  ): Promise<{ user: AuthenticatedUser; sessionId: string; expiresAt: Date }> {
    if (!dto.email || !dto.password) {
      throw new AppError(400, "E-mail e senha são obrigatórios");
    }

    // 1. Verificação de Rate Limit (RF05)
    const attempts = authRepository.countRecentAttempts(
      ip,
      dto.email,
      RATE_LIMIT_WINDOW_MINUTES
    );

    if (attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
      throw new AppError(
        429,
        `Muitas tentativas de login. Tente novamente em ${RATE_LIMIT_WINDOW_MINUTES} minutos.`
      );
    }

    // 2. Busca de usuário
    const user = authRepository.findUserByEmail(dto.email);
    if (!user) {
      // Registra a tentativa falha
      authRepository.recordAuthAttempt(ip, dto.email);
      throw new AppError(401, "E-mail ou senha inválidos");
    }

    // 3. Validação de senha
    const isValid = verifyPassword(dto.password, user.password_salt, user.password_hash);
    if (!isValid) {
      authRepository.recordAuthAttempt(ip, dto.email);
      throw new AppError(401, "E-mail ou senha inválidos");
    }

    // 4. Criação de sessão (RF02)
    const sessionId = generateToken(32);
    const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

    authRepository.createSession(sessionId, user.id, expiresAt.toISOString());

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      sessionId,
      expiresAt,
    };
  }

  public async logout(sessionId: string): Promise<void> {
    authRepository.deleteSession(sessionId);
  }

  public async requestPasswordReset(
    email: string,
    ip: string
  ): Promise<{ message: string; token?: string }> {
    if (!email || !email.includes("@")) {
      throw new AppError(400, "E-mail inválido");
    }

    const attempts = authRepository.countRecentAttempts(
      ip,
      email,
      RATE_LIMIT_WINDOW_MINUTES
    );

    if (attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
      throw new AppError(
        429,
        `Muitas solicitações de reset. Tente novamente mais tarde.`
      );
    }

    authRepository.recordAuthAttempt(ip, email);

    const user = authRepository.findUserByEmail(email);
    if (!user) {
      return {
        message: "Se o e-mail estiver cadastrado, as instruções serão enviadas.",
      };
    }

    const rawToken = generateToken(32);
    const resetId = generateToken(16);
    const tokenHashed = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000
    );

    authRepository.createPasswordReset(
      resetId,
      user.id,
      tokenHashed,
      expiresAt.toISOString()
    );

    return {
      message: "Instruções de redefinição de senha geradas com sucesso.",
      token: rawToken,
    };
  }

  public async confirmPasswordReset(dto: ResetConfirmDTO): Promise<void> {
    if (!dto.token) {
      throw new AppError(400, "Token de redefinição é obrigatório");
    }

    if (!dto.newPassword || dto.newPassword.length < 6) {
      throw new AppError(400, "A nova senha deve ter pelo menos 6 caracteres");
    }

    const tokenHashed = hashToken(dto.token);
    const resetRecord = authRepository.findValidPasswordReset(tokenHashed);

    if (!resetRecord) {
      throw new AppError(400, "Token de recuperação inválido ou expirado");
    }

    const salt = generateSalt();
    const newHash = hashPassword(dto.newPassword, salt);

    authRepository.updateUserPassword(resetRecord.user_id, newHash, salt);
    authRepository.markPasswordResetAsUsed(resetRecord.id);
  }

  public async validateSession(sessionId: string): Promise<AuthenticatedUser | null> {
    if (!sessionId) return null;

    const data = authRepository.findSessionWithUser(sessionId);
    if (!data) return null;

    return {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
    };
  }
}

export const authService = new AuthService();
