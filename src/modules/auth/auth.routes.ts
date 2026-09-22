import { Router } from "../../core/router.js";
import { authenticate, SESSION_COOKIE_NAME, extractSessionToken } from "./auth.middleware.js";
import { authService } from "./auth.service.js";

export function registerAuthRoutes(router: Router): void {
  // 1. Cadastro de usuário (RF01)
  router.post("/api/auth/register", async (req, res) => {
    const user = await authService.register(req.body);
    res.status(201).json({
      message: "Usuário cadastrado com sucesso",
      user,
    });
  });

  // 2. Login de usuário (RF02)
  router.post("/api/auth/login", async (req, res) => {
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const { user, sessionId, expiresAt } = await authService.login(req.body, clientIp);

    // Grava o cookie httpOnly e sameSite=Lax (RF02)
    res.setCookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      expires: expiresAt,
    });

    res.status(200).json({
      message: "Login efetuado com sucesso",
      user,
      token: sessionId,
    });
  });

  // 3. Logout (RF03)
  router.post("/api/auth/logout", authenticate, async (req, res) => {
    const token = extractSessionToken(req);
    if (token) {
      await authService.logout(token);
    }

    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.status(200).json({ message: "Logout efetuado com sucesso" });
  });

  // 4. Solicitação de recuperação de senha (RF04, RF05)
  router.post("/api/auth/password/reset-request", async (req, res) => {
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const result = await authService.requestPasswordReset(req.body.email, clientIp);
    res.status(200).json(result);
  });

  // 5. Confirmação de nova senha (RF04)
  router.post("/api/auth/password/reset-confirm", async (req, res) => {
    await authService.confirmPasswordReset(req.body);
    res.status(200).json({ message: "Senha redefinida com sucesso" });
  });

  // 6. Dados do usuário logado (Sessão atual)
  router.get("/api/auth/me", authenticate, (req, res) => {
    res.status(200).json({ user: req.user });
  });
}
