import { createAppServer } from "./server.js";
import { Router } from "./router.js";
import { AppError } from "./errors.js";

async function runCoreTests() {
  console.log("🧪 [Core HTTP] Testando servidor, roteador, body parser e cookies...\n");

  const router = new Router();

  // Middleware global de log / auditoria
  router.use(async (req, res, next) => {
    (req as any).timestamp = Date.now();
    await next();
  });

  // 1. Rota GET simples com Query Params
  router.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", query: req.query });
  });

  // 2. Rota GET com Parâmetro dinâmico (:slug)
  router.get("/api/courses/:slug", (req, res) => {
    res.status(200).json({ slug: req.params["slug"] });
  });

  // 3. Rota POST com Body JSON e Cookies
  router.post("/api/echo", (req, res) => {
    res.setCookie("session_token", "abc-123-xyz", { httpOnly: true, sameSite: "Lax" });
    res.status(201).json({
      receivedBody: req.body,
      receivedCookies: req.cookies,
    });
  });

  // 4. Rota com AppError customizado
  router.get("/api/fail", () => {
    throw new AppError(400, "Erro proposital de teste de validação");
  });

  const server = createAppServer(router);

  await new Promise<void>((resolve) => {
    server.listen(4000, () => resolve());
  });

  try {
    // Teste 1: GET /api/health?tag=dev
    const res1 = await fetch("http://localhost:4000/api/health?tag=dev");
    const json1 = (await res1.json()) as any;
    console.log("1. GET /api/health com query:", json1.status === "ok" && json1.query.tag === "dev" ? "✅ PASSOU" : "❌ FALHOU");

    // Teste 2: GET /api/courses/nodejs-avancado (parâmetro de rota)
    const res2 = await fetch("http://localhost:4000/api/courses/nodejs-avancado");
    const json2 = (await res2.json()) as any;
    console.log("2. GET /api/courses/:slug:", json2.slug === "nodejs-avancado" ? "✅ PASSOU" : "❌ FALHOU");

    // Teste 3: POST com JSON body e Cookie enviado/recebido
    const res3 = await fetch("http://localhost:4000/api/echo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "theme=dark",
      },
      body: JSON.stringify({ message: "hello educore" }),
    });
    const json3 = (await res3.json()) as any;
    const cookieHeader = res3.headers.get("set-cookie") || "";
    const cookieOk = cookieHeader.includes("session_token=abc-123-xyz") && cookieHeader.includes("HttpOnly");
    console.log(
      "3. POST com Body e Cookie:",
      json3.receivedBody.message === "hello educore" && json3.receivedCookies.theme === "dark" && cookieOk
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 4: AppError retornando status 400 estruturado
    const res4 = await fetch("http://localhost:4000/api/fail");
    const json4 = (await res4.json()) as any;
    console.log("4. Tratamento de AppError (400):", res4.status === 400 && json4.error.includes("Erro proposital") ? "✅ PASSOU" : "❌ FALHOU");

    // Teste 5: Rota não existente (404)
    const res5 = await fetch("http://localhost:4000/api/nao-existe");
    console.log("5. 404 para rotas inexistentes:", res5.status === 404 ? "✅ PASSOU" : "❌ FALHOU");

    console.log("\n🎉 [Core HTTP] Todos os testes passaram com êxito!");
  } finally {
    server.close();
  }
}

runCoreTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
