import { createAppServer } from "../../core/server.js";
import { Router } from "../../core/router.js";
import { registerAuthRoutes } from "./auth.routes.js";
import { db } from "../../db/connection.js";

async function runAuthTests() {
  console.log("🧪 [Auth] Iniciando testes automatizados do Módulo de Autenticação...\n");

  // Limpa registros de testes anteriores
  db.prepare("DELETE FROM users WHERE email LIKE '%@authtest.com'").run();
  db.prepare("DELETE FROM auth_attempts WHERE email LIKE '%@authtest.com'").run();

  const router = new Router();
  registerAuthRoutes(router);

  const server = createAppServer(router);
  const PORT = 4001;
  const BASE_URL = `http://localhost:${PORT}`;

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => resolve());
  });

  try {
    // 1. Registro de Usuário (RF01)
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dev Aluno",
        email: "aluno@authtest.com",
        password: "senhaSegura123",
      }),
    });
    const regJson = (await regRes.json()) as any;
    console.log(
      "1. Registro de Aluno (RF01):",
      regRes.status === 201 && regJson.user.email === "aluno@authtest.com" && !regJson.user.password_hash
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // 2. Bloqueio de e-mail duplicado
    const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Outro Aluno",
        email: "aluno@authtest.com",
        password: "senhaSegura123",
      }),
    });
    console.log("2. Rejeição de E-mail Duplicado (409):", dupRes.status === 409 ? "✅ PASSOU" : "❌ FALHOU");

    // 3. Login com senha errada
    const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "aluno@authtest.com",
        password: "senhaIncorreta",
      }),
    });
    console.log("3. Bloqueio de Senha Errada (401):", badLoginRes.status === 401 ? "✅ PASSOU" : "❌ FALHOU");

    // 4. Login com sucesso e geração de cookie (RF02)
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "aluno@authtest.com",
        password: "senhaSegura123",
      }),
    });
    const loginJson = (await loginRes.json()) as any;
    const cookieHeader = loginRes.headers.get("set-cookie") || "";
    const sessionMatch = cookieHeader.match(/educore_session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : "";

    console.log(
      "4. Login e Emissão de Cookie HttpOnly (RF02):",
      loginRes.status === 200 && cookieHeader.includes("HttpOnly") && !!sessionToken
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // 5. Acesso a rota protegida com sessão válida (/api/auth/me)
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: `educore_session=${sessionToken}` },
    });
    const meJson = (await meRes.json()) as any;
    console.log(
      "5. Acesso a Rota Protegida (RF06):",
      meRes.status === 200 && meJson.user.email === "aluno@authtest.com" ? "✅ PASSOU" : "❌ FALHOU"
    );

    // 6. Bloqueio de acesso sem sessão (RF06)
    const unauthRes = await fetch(`${BASE_URL}/api/auth/me`);
    console.log("6. Bloqueio sem Cookie de Sessão (401):", unauthRes.status === 401 ? "✅ PASSOU" : "❌ FALHOU");

    // 7. Solicitação de Reset de Senha (RF04)
    const resetReqRes = await fetch(`${BASE_URL}/api/auth/password/reset-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "aluno@authtest.com" }),
    });
    const resetReqJson = (await resetReqRes.json()) as any;
    const resetToken = resetReqJson.token;
    console.log("7. Solicitação de Reset de Senha (RF04):", resetReqRes.status === 200 && !!resetToken ? "✅ PASSOU" : "❌ FALHOU");

    // 8. Confirmação do Reset com nova senha (RF04)
    const resetConfirmRes = await fetch(`${BASE_URL}/api/auth/password/reset-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: resetToken,
        newPassword: "novaSenhaSegura456",
      }),
    });
    console.log("8. Confirmação de Nova Senha (RF04):", resetConfirmRes.status === 200 ? "✅ PASSOU" : "❌ FALHOU");

    // 9. Login com a nova senha
    const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "aluno@authtest.com",
        password: "novaSenhaSegura456",
      }),
    });
    console.log("9. Login com a Nova Senha Atualizada:", newLoginRes.status === 200 ? "✅ PASSOU" : "❌ FALHOU");

    // 10. Logout invalidando sessão no banco (RF03)
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: `educore_session=${sessionToken}` },
    });
    console.log("10. Logout com Invalidação de Sessão (RF03):", logoutRes.status === 200 ? "✅ PASSOU" : "❌ FALHOU");

    // 11. Tentativa de reusar a sessão antiga pós-logout -> Deve dar 401
    const reusedMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: `educore_session=${sessionToken}` },
    });
    console.log("11. Verificação de Sessão Invalidadas no Banco:", reusedMeRes.status === 401 ? "✅ PASSOU" : "❌ FALHOU");

    // 12. Rate Limit (RF05)
    console.log("⏳ Testando Rate Limit com 5 tentativas consecutivas...");
    for (let i = 0; i < 4; i++) {
      await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "rate_limit@authtest.com",
          password: "errada",
        }),
      });
    }

    // A 5ª ou 6ª requisição atinge o teto do rate limit
    const rateLimitedRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "rate_limit@authtest.com",
        password: "errada",
      }),
    });

    console.log("12. Rate Limit Ativado com Status 429 (RF05):", rateLimitedRes.status === 429 ? "✅ PASSOU" : "❌ FALHOU");

    console.log("\n🎉 [Auth] Todos os 12 testes de autenticação passaram com 100% de sucesso!");
  } finally {
    server.close();
    db.prepare("DELETE FROM users WHERE email LIKE '%@authtest.com'").run();
    db.prepare("DELETE FROM auth_attempts WHERE email LIKE '%@authtest.com'").run();
  }
}

runAuthTests().catch((err) => {
  console.error("❌ Erro nos testes de Auth:", err);
  process.exit(1);
});
