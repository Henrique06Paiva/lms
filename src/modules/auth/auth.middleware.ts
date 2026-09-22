import { AppError } from "../../core/errors.js";
import type { HttpRequest, HttpResponse, NextFunction } from "../../core/types.js";
import { authService } from "./auth.service.js";

export const SESSION_COOKIE_NAME = "educore_session";

export function extractSessionToken(req: HttpRequest): string | null {
  if (req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }

  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return null;
}

export async function authenticate(
  req: HttpRequest,
  _res: HttpResponse,
  next: NextFunction
): Promise<void> {
  const token = extractSessionToken(req);

  if (!token) {
    throw new AppError(401, "Acesso não autorizado: sessão não encontrada");
  }

  const user = await authService.validateSession(token);
  if (!user) {
    throw new AppError(401, "Sessão inválida ou expirada");
  }

  req.user = user;
  await next();
}

export async function optionalAuthenticate(
  req: HttpRequest,
  _res: HttpResponse,
  next: NextFunction
): Promise<void> {
  const token = extractSessionToken(req);

  if (token) {
    const user = await authService.validateSession(token);
    if (user) {
      req.user = user;
    }
  }

  await next();
}

export function requireRole(requiredRole: "admin" | "student") {
  return async (req: HttpRequest, _res: HttpResponse, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, "Usuário não autenticado");
    }

    if (req.user.role !== requiredRole) {
      throw new AppError(403, `Acesso restrito: permissão de ${requiredRole} requerida`);
    }

    await next();
  };
}
