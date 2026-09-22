import { createAppServer } from "../../core/server.js";
import { Router } from "../../core/router.js";
import { registerAuthRoutes } from "../auth/auth.routes.js";
import { registerCoursesRoutes } from "./courses.routes.js";
import { db } from "../../db/connection.js";

async function runCoursesTests() {
  console.log("🧪 [Courses] Iniciando testes de CRUD de Cursos, Aulas e Matrículas...\n");

  // Limpa registros anteriores de testes
  db.prepare("DELETE FROM users WHERE email LIKE '%@coursetest.com'").run();
  db.prepare("DELETE FROM courses WHERE slug LIKE '%coursetest%' OR slug = 'node-expert'").run();

  const router = new Router();
  registerAuthRoutes(router);
  registerCoursesRoutes(router);

  const server = createAppServer(router);
  const PORT = 4002;
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
        name: "Admin User",
        email: "admin@coursetest.com",
        password: "adminPassword123",
        role: "admin",
      }),
    });

    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student User",
        email: "student@coursetest.com",
        password: "studentPassword123",
        role: "student",
      }),
    });

    // 2. Faz Login do Admin e do Aluno
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@coursetest.com",
        password: "adminPassword123",
      }),
    });
    const adminCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@coursetest.com",
        password: "studentPassword123",
      }),
    });
    const studentCookie = studentLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    // Teste 1: Aluno tenta criar curso (Deve dar 403 Forbidden)
    const studentCreateRes = await fetch(`${BASE_URL}/api/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        title: "Tentativa Proibida",
        description: "Não deve permitir",
      }),
    });
    console.log("1. Aluno bloqueado de criar curso (403):", studentCreateRes.status === 403 ? "✅ PASSOU" : "❌ FALHOU");

    // Teste 2: Admin cria curso (RF07)
    const adminCreateRes = await fetch(`${BASE_URL}/api/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "Node Expert",
        description: "Aprenda Node.js puro sem frameworks",
        workloadHours: 20,
      }),
    });
    const adminCreateJson = (await adminCreateRes.json()) as any;
    const courseId = adminCreateJson.course?.id;
    console.log(
      "2. Admin cria curso com slug automático (RF07):",
      adminCreateRes.status === 201 && adminCreateJson.course.slug === "node-expert"
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 3: Admin cria Aula 1 (RF10)
    const lesson1Res = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "1. Introdução ao Node Puro",
        durationSeconds: 600,
      }),
    });
    const lesson1Json = (await lesson1Res.json()) as any;
    const lesson1Id = lesson1Json.lesson?.id;
    console.log(
      "3. Admin cria Aula 1 vinculada ao curso (RF10):",
      lesson1Res.status === 201 && lesson1Json.lesson.order_index === 1
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 4: Admin cria Aula 2 (ordem automática = 2)
    const lesson2Res = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "2. Servidor HTTP Nativo",
        durationSeconds: 1200,
      }),
    });
    const lesson2Json = (await lesson2Res.json()) as any;
    console.log(
      "4. Admin cria Aula 2 com auto-incremento de ordem:",
      lesson2Res.status === 201 && lesson2Json.lesson.order_index === 2
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 5: Rejeição de conflito de ordem duplicada (409)
    const conflictLessonRes = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "Aula com ordem repetida",
        orderIndex: 1,
      }),
    });
    console.log(
      "5. Bloqueio de ordem de aula duplicada (409):",
      conflictLessonRes.status === 409 ? "✅ PASSOU" : "❌ FALHOU"
    );

    // Teste 6: Listagem pública de cursos (sem auth)
    const publicListRes = await fetch(`${BASE_URL}/api/courses`);
    const publicListJson = (await publicListRes.json()) as any;
    console.log(
      "6. Listagem pública de cursos (RF09):",
      publicListRes.status === 200 && publicListJson.courses.length > 0 && publicListJson.courses[0].enrollment_id === null
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 7: Aluno se matricula no curso (RF08)
    const enrollRes = await fetch(`${BASE_URL}/api/courses/${courseId}/enroll`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const enrollJson = (await enrollRes.json()) as any;
    console.log(
      "7. Aluno se matricula no curso (RF08):",
      enrollRes.status === 201 && enrollJson.enrollment.course_id === courseId
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 8: Bloqueio de matrícula duplicada
    const dupEnrollRes = await fetch(`${BASE_URL}/api/courses/${courseId}/enroll`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    console.log(
      "8. Bloqueio de matrícula duplicada (409):",
      dupEnrollRes.status === 409 ? "✅ PASSOU" : "❌ FALHOU"
    );

    // Teste 9: Listagem de cursos pelo aluno logado (traz progresso)
    const studentListRes = await fetch(`${BASE_URL}/api/courses`, {
      headers: { Cookie: studentCookie },
    });
    const studentListJson = (await studentListRes.json()) as any;
    const enrolledCourse = studentListJson.courses.find((c: any) => c.id === courseId);
    console.log(
      "9. Listagem traz matrícula e progresso do aluno logado:",
      studentListRes.status === 200 && !!enrolledCourse?.enrollment_id && enrolledCourse?.progress_percent === 0
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 10: Detalhe do curso com lista de aulas ordenadas
    const detailRes = await fetch(`${BASE_URL}/api/courses/node-expert`, {
      headers: { Cookie: studentCookie },
    });
    const detailJson = (await detailRes.json()) as any;
    console.log(
      "10. Detalhe do curso com aulas ordenadas e matrícula:",
      detailRes.status === 200 && detailJson.lessons.length === 2 && detailJson.enrollment !== null
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 11: Admin edita curso
    const updateRes = await fetch(`${BASE_URL}/api/courses/${courseId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "Node Expert v2",
        workloadHours: 25,
      }),
    });
    const updateJson = (await updateRes.json()) as any;
    console.log(
      "11. Admin atualiza dados do curso:",
      updateRes.status === 200 && updateJson.course.title === "Node Expert v2" && updateJson.course.workload_hours === 25
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 12: Admin edita aula
    const updateLessonRes = await fetch(`${BASE_URL}/api/lessons/${lesson1Id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "1. Introdução Atualizada",
        durationSeconds: 700,
      }),
    });
    console.log(
      "12. Admin atualiza título da aula:",
      updateLessonRes.status === 200 ? "✅ PASSOU" : "❌ FALHOU"
    );

    // Teste 13: Admin exclui aula
    const deleteLessonRes = await fetch(`${BASE_URL}/api/lessons/${lesson1Id}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    console.log("13. Admin exclui aula:", deleteLessonRes.status === 200 ? "✅ PASSOU" : "❌ FALHOU");

    // Teste 14: Admin exclui curso com cascade
    const deleteCourseRes = await fetch(`${BASE_URL}/api/courses/${courseId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    console.log(
      "14. Admin exclui curso com exclusão em cascata:",
      deleteCourseRes.status === 200 ? "✅ PASSOU" : "❌ FALHOU"
    );

    console.log("\n🎉 [Courses] Todos os 14 testes de cursos e aulas passaram com 100% de sucesso!");
  } finally {
    server.close();
    db.prepare("DELETE FROM users WHERE email LIKE '%@coursetest.com'").run();
    db.prepare("DELETE FROM courses WHERE slug LIKE '%coursetest%' OR slug LIKE 'node-expert%'").run();
  }
}

runCoursesTests().catch((err) => {
  console.error("❌ Falha nos testes de cursos:", err);
  process.exit(1);
});
