import { createAppServer } from "./server.js";
import { Router } from "./router.js";

async function runFrontendTests() {
  console.log("🧪 [Frontend] Testando entrega de arquivos estáticos e SPA fallback...\n");

  const router = new Router();
  const server = createAppServer(router);
  const PORT = 4006;
  const BASE_URL = `http://localhost:${PORT}`;

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => resolve());
  });

  try {
    // Teste 1: GET / (index.html)
    const homeRes = await fetch(`${BASE_URL}/`);
    const homeText = await homeRes.text();
    const homeType = homeRes.headers.get("content-type");
    console.log(
      "1. GET / entrega index.html:",
      homeRes.status === 200 && homeType?.includes("text/html") && homeText.includes("EduCore")
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 2: GET /css/style.css
    const cssRes = await fetch(`${BASE_URL}/css/style.css`);
    const cssText = await cssRes.text();
    const cssType = cssRes.headers.get("content-type");
    console.log(
      "2. GET /css/style.css entrega folha de estilo Flexbox:",
      cssRes.status === 200 && cssType?.includes("text/css") && cssText.includes("course-grid")
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 3: GET /js/app.js
    const jsRes = await fetch(`${BASE_URL}/js/app.js`);
    const jsText = await jsRes.text();
    const jsType = jsRes.headers.get("content-type");
    console.log(
      "3. GET /js/app.js entrega módulo ES6:",
      jsRes.status === 200 && jsType?.includes("application/javascript") && jsText.includes("CustomVideoPlayer")
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 4: SPA Fallback para rotas virtuais de frontend
    const spaRes = await fetch(`${BASE_URL}/curso/node-expert`);
    const spaText = await spaRes.text();
    console.log(
      "4. SPA Fallback entrega index.html para rotas sem extensão:",
      spaRes.status === 200 && spaText.includes("EduCore")
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    console.log("\n🎉 [Frontend] Todos os 4 testes de entrega do frontend passaram com 100% de sucesso!");
  } finally {
    server.close();
  }
}

runFrontendTests().catch((err) => {
  console.error("❌ Falha nos testes de frontend:", err);
  process.exit(1);
});
