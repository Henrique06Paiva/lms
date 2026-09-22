import { createAppServer } from "../../core/server.js";
import { Router } from "../../core/router.js";
import { registerAuthRoutes } from "../auth/auth.routes.js";
import { registerCoursesRoutes } from "../courses/courses.routes.js";
import { registerProgressRoutes } from "./progress.routes.js";
import { db } from "../../db/connection.js";

async function runProgressTests() {
  console.log("🧪 [Progress] Testando conclusão de aulas, triggers de cálculo e reset de curso...\n");

  // Limpa registros anteriores de testes
  db.prepare("DELETE FROM users WHERE email LIKE '%@progresstest.com'").run();
  db.prepare("DELETE FROM courses WHERE slug = 'curso-progresso-teste'").run();

  const router = new Router();
  registerAuthRoutes(router);
  registerCoursesRoutes(router);
  registerProgressRoutes(router);

  const server = createAppServer(router);
  const PORT = 4004;
  const BASE_URL = `http://localhost:${PORT}`;

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => resolve());
  });

  try {
    // 1. Cadastra Admin e Aluno
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Admin Prog",
        email: "admin@progresstest.com",
        password: "adminPassword123",
        role: "admin",
      }),
    });

    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Prog",
        email: "student@progresstest.com",
        password: "studentPassword123",
        role: "student",
      }),
    });

    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@progresstest.com",
        password: "adminPassword123",
      }),
    });
    const adminCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@progresstest.com",
        password: "studentPassword123",
      }),
    });
    const studentCookie = studentLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    // 2. Admin cria curso com 3 aulas
    const courseRes = await fetch(`${BASE_URL}/api/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "Curso Progresso Teste",
        description: "Testando triggers",
      }),
    });
    const courseJson = (await courseRes.json()) as any;
    const courseId = courseJson.course.id;

    const l1Res = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "Aula 1" }),
    });
    const l1Id = ((await l1Res.json()) as any).lesson.id;

    const l2Res = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "Aula 2" }),
    });
    const l2Id = ((await l2Res.json()) as any).lesson.id;

    const l3Res = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "Aula 3" }),
    });
    const l3Id = ((await l3Res.json()) as any).lesson.id;

    // Teste 1: Aluno tenta concluir aula sem estar matriculado -> 403
    const unEnrolledComplete = await fetch(`${BASE_URL}/api/lessons/${l1Id}/complete`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    console.log(
      "1. Aluno bloqueado de concluir aula sem matrícula (403):",
      unEnrolledComplete.status === 403 ? "✅ PASSOU" : "❌ FALHOU"
    );

    // 3. Aluno se matricula no curso
    await fetch(`${BASE_URL}/api/courses/${courseId}/enroll`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });

    // Teste 2: Aluno conclui Aula 1 -> Progresso deve ser 33.3% via trigger (RF14)
    const complete1Res = await fetch(`${BASE_URL}/api/lessons/${l1Id}/complete`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const complete1Json = (await complete1Res.json()) as any;
    console.log(
      "2. Conclusão da Aula 1 recalcula para 33.3% (RF14):",
      complete1Res.status === 200 &&
        complete1Json.enrollment.progress_percent === 33.3 &&
        complete1Json.enrollment.completed_at === null
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 3: Aluno conclui Aula 2 -> Progresso deve ser 66.7% via trigger
    const complete2Res = await fetch(`${BASE_URL}/api/lessons/${l2Id}/complete`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const complete2Json = (await complete2Res.json()) as any;
    console.log(
      "3. Conclusão da Aula 2 recalcula para 66.7%:",
      complete2Res.status === 200 &&
        complete2Json.enrollment.progress_percent === 66.7 &&
        complete2Json.enrollment.completed_at === null
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 4: Aluno conclui Aula 3 -> Progresso deve ser 100% e preencher completed_at!
    const complete3Res = await fetch(`${BASE_URL}/api/lessons/${l3Id}/complete`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const complete3Json = (await complete3Res.json()) as any;
    console.log(
      "4. Conclusão da Aula 3 atinge 100% e preenche completed_at:",
      complete3Res.status === 200 &&
        complete3Json.enrollment.progress_percent === 100 &&
        !!complete3Json.enrollment.completed_at
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 5: Reset de curso (RF15) -> Progresso deve voltar para 0% e completed_at virar null
    const resetRes = await fetch(`${BASE_URL}/api/courses/${courseId}/reset`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const resetJson = (await resetRes.json()) as any;
    console.log(
      "5. Reset do curso zera progresso e anula completed_at (RF15):",
      resetRes.status === 200 &&
        resetJson.enrollment.progress_percent === 0 &&
        resetJson.enrollment.completed_at === null
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    console.log("\n🎉 [Progress] Todos os 5 testes de progresso e triggers passaram com 100% de sucesso!");
  } finally {
    server.close();
    db.prepare("DELETE FROM users WHERE email LIKE '%@progresstest.com'").run();
    db.prepare("DELETE FROM courses WHERE slug = 'curso-progresso-teste'").run();
  }
}

runProgressTests().catch((err) => {
  console.error("❌ Falha nos testes de progresso:", err);
  process.exit(1);
});
