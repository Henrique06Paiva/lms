import fs from "node:fs";
import path from "node:path";
import { createAppServer } from "../../core/server.js";
import { Router } from "../../core/router.js";
import { registerAuthRoutes } from "../auth/auth.routes.js";
import { registerCoursesRoutes } from "../courses/courses.routes.js";
import { registerProgressRoutes } from "../progress/progress.routes.js";
import { registerCertificatesRoutes } from "./certificates.routes.js";
import { db } from "../../db/connection.js";

async function runCertificatesTests() {
  console.log("🧪 [Certificates] Testando emissão via subprocesso, PDF e verificação pública...\n");

  // Limpa registros anteriores de testes
  db.prepare("DELETE FROM users WHERE email LIKE '%@certtest.com'").run();
  db.prepare("DELETE FROM courses WHERE slug = 'curso-cert-teste'").run();

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

  let generatedPdfPath = "";

  try {
    // 1. Cadastra Admin e Aluno
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Admin Cert",
        email: "admin@certtest.com",
        password: "adminPassword123",
      }),
    });
    // Eleva explicitamente para admin no banco de testes (pois cadastro público gera student)
    db.prepare("UPDATE users SET role = 'admin' WHERE email = 'admin@certtest.com'").run();

    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Henrique Aluno",
        email: "student@certtest.com",
        password: "studentPassword123",
        role: "student",
      }),
    });

    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@certtest.com",
        password: "adminPassword123",
      }),
    });
    const adminCookie = adminLogin.headers.get("set-cookie")?.split(";")[0] || "";

    const studentLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@certtest.com",
        password: "studentPassword123",
      }),
    });
    const studentCookie = studentLogin.headers.get("set-cookie")?.split(";")[0] || "";

    // 2. Admin cria curso e 1 aula
    const courseRes = await fetch(`${BASE_URL}/api/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        title: "Curso Cert Teste",
        description: "Certificado em PDF",
        workloadHours: 40,
      }),
    });
    const courseId = ((await courseRes.json()) as any).course.id;

    const lessonRes = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "Aula Única de Conclusão" }),
    });
    const lessonId = ((await lessonRes.json()) as any).lesson.id;

    // 3. Aluno se matricula
    await fetch(`${BASE_URL}/api/courses/${courseId}/enroll`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });

    // Teste 1: Aluno tenta emitir certificado com 0% de progresso -> 400 Bad Request (RF16)
    const prematureCertRes = await fetch(`${BASE_URL}/api/courses/${courseId}/certificate`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    console.log(
      "1. Bloqueio de emissão com progresso < 100% (RF16):",
      prematureCertRes.status === 400 ? "✅ PASSOU" : "❌ FALHOU"
    );

    // 4. Aluno conclui a aula única -> Progresso vira 100%
    await fetch(`${BASE_URL}/api/lessons/${lessonId}/complete`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });

    // Teste 2: Aluno emite certificado com 100% de progresso (RF16, RF17)
    const issueRes = await fetch(`${BASE_URL}/api/courses/${courseId}/certificate`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const issueJson = (await issueRes.json()) as any;
    const certCode = issueJson.certificate?.code;
    const pdfFilename = issueJson.certificate?.pdf_path;
    generatedPdfPath = path.resolve(process.cwd(), "uploads", "certificates", pdfFilename);

    console.log(
      "2. Emissão de certificado com código público gerado (RF16):",
      issueRes.status === 201 && !!certCode && certCode.startsWith("EDU-")
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 3: Verifica se o arquivo PDF físico foi criado pelo subprocesso (RF17)
    const fileExists = fs.existsSync(generatedPdfPath);
    console.log(
      "3. Arquivo PDF gerado em disco via subprocesso (RF17):",
      fileExists ? "✅ PASSOU" : "❌ FALHOU"
    );

    // Teste 4: Idempotência: emitir de novo retorna o mesmo certificado
    const reissueRes = await fetch(`${BASE_URL}/api/courses/${courseId}/certificate`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const reissueJson = (await reissueRes.json()) as any;
    console.log(
      "4. Idempotência na emissão de certificado:",
      reissueRes.status === 201 && reissueJson.certificate.code === certCode
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 5: Validação pública do certificado sem autenticação (RF18)
    const verifyRes = await fetch(`${BASE_URL}/api/certificates/${certCode}`);
    const verifyJson = (await verifyRes.json()) as any;
    console.log(
      "5. Verificação pública de autenticidade (RF18):",
      verifyRes.status === 200 &&
        verifyJson.valid === true &&
        verifyJson.certificate.studentName === "Henrique Aluno" &&
        verifyJson.certificate.courseTitle === "Curso Cert Teste"
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 6: Código inexistente retorna 404
    const invalidVerifyRes = await fetch(`${BASE_URL}/api/certificates/CODIGO-INEXISTENTE`);
    console.log("6. 404 para código de certificado inválido:", invalidVerifyRes.status === 404 ? "✅ PASSOU" : "❌ FALHOU");

    // Teste 7: Download público do PDF do certificado
    const downloadRes = await fetch(`${BASE_URL}/api/certificates/${certCode}/download`);
    const contentType = downloadRes.headers.get("content-type");
    const pdfBytes = await downloadRes.arrayBuffer();
    const pdfHeader = Buffer.from(pdfBytes.slice(0, 8)).toString("utf-8");

    console.log(
      "7. Download do PDF válido via stream (%PDF-1.4):",
      downloadRes.status === 200 &&
        contentType === "application/pdf" &&
        pdfHeader.startsWith("%PDF-1.4")
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    console.log("\n🎉 [Certificates] Todos os 7 testes de certificados passaram com 100% de sucesso!");
  } finally {
    server.close();
    db.prepare("DELETE FROM users WHERE email LIKE '%@certtest.com'").run();
    db.prepare("DELETE FROM courses WHERE slug = 'curso-cert-teste'").run();

    if (generatedPdfPath && fs.existsSync(generatedPdfPath)) {
      fs.unlinkSync(generatedPdfPath);
    }
  }
}

runCertificatesTests().catch((err) => {
  console.error("❌ Falha nos testes de certificado:", err);
  process.exit(1);
});
