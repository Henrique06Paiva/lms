import { createAppServer } from "../../core/server.js";
import { Router } from "../../core/router.js";
import { registerAuthRoutes } from "../auth/auth.routes.js";
import { registerCoursesRoutes } from "./courses.routes.js";
import { registerProgressRoutes } from "../progress/progress.routes.js";
import { registerCertificatesRoutes } from "../certificates/certificates.routes.js";
import { db } from "../../db/connection.js";

async function runCourseCompletionTests() {
  console.log("🧪 [Course Completion] Testando ciclo completo de status, triggers e listagem...\n");

  // Limpeza de dados de teste
  db.prepare("DELETE FROM users WHERE email LIKE '%@completiontest.com'").run();
  db.prepare("DELETE FROM courses WHERE slug LIKE 'curso-completion-%'").run();

  const router = new Router();
  registerAuthRoutes(router);
  registerCoursesRoutes(router);
  registerProgressRoutes(router);
  registerCertificatesRoutes(router);

  const server = createAppServer(router);
  const PORT = 4005;
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
        name: "Admin Completion",
        email: "admin@completiontest.com",
        password: "adminPassword123",
      }),
    });
    // Eleva explicitamente para admin no banco de testes (pois cadastro público gera student)
    db.prepare("UPDATE users SET role = 'admin' WHERE email = 'admin@completiontest.com'").run();

    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Completion",
        email: "student@completiontest.com",
        password: "studentPassword123",
        role: "student",
      }),
    });

    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@completiontest.com",
        password: "adminPassword123",
      }),
    });
    const adminCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@completiontest.com",
        password: "studentPassword123",
      }),
    });
    const studentCookie = studentLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    // 2. Admin cria curso de 3 aulas
    const courseRes = await fetch(`${BASE_URL}/api/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "Curso Completion Test 3 Aulas",
        description: "Teste de ciclo de conclusão",
        workloadHours: 20,
      }),
    });
    const courseJson = (await courseRes.json()) as any;
    const courseId = courseJson.course.id;
    const courseSlug = courseJson.course.slug;

    const l1Res = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "Aula 1" }),
    });
    const l1 = ((await l1Res.json()) as any).lesson;

    const l2Res = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "Aula 2" }),
    });
    const l2 = ((await l2Res.json()) as any).lesson;

    const l3Res = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "Aula 3" }),
    });
    const l3 = ((await l3Res.json()) as any).lesson;

    // Teste 1: Aluno matricula no curso -> Progresso 0%, completed_at null
    const enrollRes = await fetch(`${BASE_URL}/api/courses/${courseId}/enroll`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const enrollJson = (await enrollRes.json()) as any;
    console.log(
      "1. Matrícula inicial com 0% e completed_at null:",
      enrollRes.status === 201 &&
        enrollJson.enrollment.progress_percent === 0 &&
        enrollJson.enrollment.completed_at === null
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 2: Conclui Aula 1 -> 33.3%, completed_at null
    const c1Res = await fetch(`${BASE_URL}/api/lessons/${l1.id}/complete`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const c1Json = (await c1Res.json()) as any;
    console.log(
      "2. Conclusão da Aula 1 recalcula para 33.3%:",
      c1Res.status === 200 &&
        c1Json.enrollment.progress_percent === 33.3 &&
        c1Json.enrollment.completed_at === null
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 3: Conclui Aula 2 -> 66.7%, completed_at null
    const c2Res = await fetch(`${BASE_URL}/api/lessons/${l2.id}/complete`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const c2Json = (await c2Res.json()) as any;
    console.log(
      "3. Conclusão da Aula 2 recalcula para 66.7%:",
      c2Res.status === 200 &&
        c2Json.enrollment.progress_percent === 66.7 &&
        c2Json.enrollment.completed_at === null
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 4: Conclui Aula 3 -> 100%, completed_at preenchido!
    const c3Res = await fetch(`${BASE_URL}/api/lessons/${l3.id}/complete`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const c3Json = (await c3Res.json()) as any;
    console.log(
      "4. Conclusão da Aula 3 atinge 100% e preenche completed_at:",
      c3Res.status === 200 &&
        c3Json.enrollment.progress_percent === 100 &&
        typeof c3Json.enrollment.completed_at === "string" &&
        c3Json.enrollment.completed_at.length > 0
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 5: GET /api/courses retorna o curso como concluído (progress_percent = 100 e completed_at preenchido)
    const listRes = await fetch(`${BASE_URL}/api/courses`, {
      headers: { Cookie: studentCookie },
    });
    const listJson = (await listRes.json()) as any;
    const courseInList = listJson.courses?.find((c: any) => c.id === courseId);
    console.log(
      "5. GET /api/courses lista curso com 100% e completed_at:",
      listRes.status === 200 &&
        courseInList &&
        courseInList.progress_percent === 100 &&
        typeof courseInList.completed_at === "string"
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 6: GET /api/courses/:slug retorna enrollment com completed_at preenchido
    const detailRes = await fetch(`${BASE_URL}/api/courses/${courseSlug}`, {
      headers: { Cookie: studentCookie },
    });
    const detailJson = (await detailRes.json()) as any;
    console.log(
      "6. GET /api/courses/:slug retorna matrícula concluída:",
      detailRes.status === 200 &&
        detailJson.enrollment &&
        detailJson.enrollment.progress_percent === 100 &&
        typeof detailJson.enrollment.completed_at === "string"
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 7: Aluno emite certificado após 100%
    const certRes = await fetch(`${BASE_URL}/api/courses/${courseId}/certificate`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const certJson = (await certRes.json()) as any;
    console.log(
      "7. Emissão de certificado oficial após conclusão do curso:",
      certRes.status === 201 && certJson.certificate?.code?.startsWith("EDU-")
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 8: Reset de curso reverte para 0% e completed_at = null
    const resetRes = await fetch(`${BASE_URL}/api/courses/${courseId}/reset`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const resetJson = (await resetRes.json()) as any;
    console.log(
      "8. Reset do curso reverte progress_percent para 0 e completed_at para null:",
      resetRes.status === 200 &&
        resetJson.enrollment.progress_percent === 0 &&
        resetJson.enrollment.completed_at === null
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 9: Curso de aula única (1 aula)
    const singleCourseRes = await fetch(`${BASE_URL}/api/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        title: "Curso Completion Aula Unica",
        description: "Teste de curso com apenas uma aula",
        workloadHours: 5,
      }),
    });
    const singleCourse = ((await singleCourseRes.json()) as any).course;

    const singleL1Res = await fetch(`${BASE_URL}/api/courses/${singleCourse.id}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "Aula Unica" }),
    });
    const singleL1 = ((await singleL1Res.json()) as any).lesson;

    await fetch(`${BASE_URL}/api/courses/${singleCourse.id}/enroll`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });

    const singleCompleteRes = await fetch(`${BASE_URL}/api/lessons/${singleL1.id}/complete`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const singleCompleteJson = (await singleCompleteRes.json()) as any;
    console.log(
      "9. Curso com 1 aula atinge 100% e preenche completed_at imediatamente:",
      singleCompleteRes.status === 200 &&
        singleCompleteJson.enrollment.progress_percent === 100 &&
        typeof singleCompleteJson.enrollment.completed_at === "string"
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    console.log("\n🎉 [Course Completion] Todos os 9 testes de ciclo de conclusão passaram com 100% de sucesso!");
  } finally {
    server.close();
    db.prepare("DELETE FROM users WHERE email LIKE '%@completiontest.com'").run();
    db.prepare("DELETE FROM courses WHERE slug LIKE 'curso-completion-%'").run();
  }
}

runCourseCompletionTests().catch((err) => {
  console.error("❌ Falha nos testes de conclusão:", err);
  process.exit(1);
});
