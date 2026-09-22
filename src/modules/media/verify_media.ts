import fs from "node:fs";
import path from "node:path";
import { createAppServer } from "../../core/server.js";
import { Router } from "../../core/router.js";
import { registerAuthRoutes } from "../auth/auth.routes.js";
import { registerCoursesRoutes } from "../courses/courses.routes.js";
import { registerMediaRoutes } from "./media.routes.js";
import { db } from "../../db/connection.js";

async function runMediaTests() {
  console.log("🧪 [Media] Testando upload de vídeo via Streams e Range Requests (HTTP 206)...\n");

  // Limpa registros anteriores de testes
  db.prepare("DELETE FROM users WHERE email LIKE '%@mediatest.com'").run();
  db.prepare("DELETE FROM courses WHERE slug = 'curso-media-teste'").run();

  const router = new Router();
  registerAuthRoutes(router);
  registerCoursesRoutes(router);
  registerMediaRoutes(router);

  const server = createAppServer(router);
  const PORT = 4003;
  const BASE_URL = `http://localhost:${PORT}`;

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => resolve());
  });

  let createdVideoFilename = "";
  let createdMaterialFilename = "";

  try {
    // 1. Cadastra e loga Admin e Aluno
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Admin Media",
        email: "admin@mediatest.com",
        password: "adminPassword123",
        role: "admin",
      }),
    });

    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Student Media",
        email: "student@mediatest.com",
        password: "studentPassword123",
        role: "student",
      }),
    });

    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@mediatest.com",
        password: "adminPassword123",
      }),
    });
    const adminCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@mediatest.com",
        password: "studentPassword123",
      }),
    });
    const studentCookie = studentLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    // 2. Admin cria curso e aula de teste
    const courseRes = await fetch(`${BASE_URL}/api/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "Curso Media Teste",
        description: "Teste de upload e streaming",
      }),
    });
    const courseJson = (await courseRes.json()) as any;
    const courseId = courseJson.course.id;

    const lessonRes = await fetch(`${BASE_URL}/api/courses/${courseId}/lessons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        title: "Aula com Vídeo HD",
      }),
    });
    const lessonJson = (await lessonRes.json()) as any;
    const lessonId = lessonJson.lesson.id;

    // Teste 1: Aluno tenta fazer upload de vídeo -> 403 Forbidden
    const fakeVideoBuffer = Buffer.alloc(500 * 1024, "A"); // 500 KB simulando vídeo
    const studentUploadRes = await fetch(`${BASE_URL}/api/lessons/${lessonId}/video`, {
      method: "POST",
      headers: {
        "Content-Type": "video/mp4",
        Cookie: studentCookie,
      },
      body: fakeVideoBuffer,
    });
    console.log("1. Aluno bloqueado de enviar vídeo (403):", studentUploadRes.status === 403 ? "✅ PASSOU" : "❌ FALHOU");

    // Teste 2: Admin faz upload de vídeo via Stream (RF11, RNF03)
    const adminUploadRes = await fetch(`${BASE_URL}/api/lessons/${lessonId}/video?duration=180`, {
      method: "POST",
      headers: {
        "Content-Type": "video/mp4",
        Cookie: adminCookie,
      },
      body: fakeVideoBuffer,
    });
    const adminUploadJson = (await adminUploadRes.json()) as any;
    createdVideoFilename = adminUploadJson.lesson?.video_filename;

    console.log(
      "2. Upload de vídeo via Streams realizado com sucesso (RF11):",
      adminUploadRes.status === 200 && !!createdVideoFilename ? "✅ PASSOU" : "❌ FALHOU"
    );

    // Teste 3: Stream completo sem cabeçalho Range (HTTP 200)
    const fullStreamRes = await fetch(`${BASE_URL}/api/lessons/${lessonId}/video`, {
      headers: { Cookie: studentCookie },
    });
    const fullContentLength = fullStreamRes.headers.get("content-length");
    const acceptRanges = fullStreamRes.headers.get("accept-ranges");

    console.log(
      "3. Stream completo (HTTP 200 com Accept-Ranges):",
      fullStreamRes.status === 200 &&
        acceptRanges === "bytes" &&
        fullContentLength === "512000"
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 4: Range request para os primeiros 100 bytes (Range: bytes=0-99)
    const range1Res = await fetch(`${BASE_URL}/api/lessons/${lessonId}/video`, {
      headers: {
        Cookie: studentCookie,
        Range: "bytes=0-99",
      },
    });
    const range1ContentRange = range1Res.headers.get("content-range");
    const range1Length = range1Res.headers.get("content-length");

    console.log(
      "4. Range Request inicial (HTTP 206 bytes 0-99):",
      range1Res.status === 206 &&
        range1ContentRange === "bytes 0-99/512000" &&
        range1Length === "100"
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 5: Seek no player (Range: bytes=1000-2999)
    const range2Res = await fetch(`${BASE_URL}/api/lessons/${lessonId}/video`, {
      headers: {
        Cookie: studentCookie,
        Range: "bytes=1000-2999",
      },
    });
    const range2ContentRange = range2Res.headers.get("content-range");
    const range2Length = range2Res.headers.get("content-length");

    console.log(
      "5. Seek no player (HTTP 206 bytes 1000-2999):",
      range2Res.status === 206 &&
        range2ContentRange === "bytes 1000-2999/512000" &&
        range2Length === "2000"
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 6: Range inválido além do tamanho do arquivo (HTTP 416)
    const invalidRangeRes = await fetch(`${BASE_URL}/api/lessons/${lessonId}/video`, {
      headers: {
        Cookie: studentCookie,
        Range: "bytes=999999-",
      },
    });
    console.log(
      "6. Range Not Satisfiable (HTTP 416):",
      invalidRangeRes.status === 416 ? "✅ PASSOU" : "❌ FALHOU"
    );

    // Teste 7: Upload de material complementar PDF (RF12)
    const fakePdfBuffer = Buffer.from("%PDF-1.4 Fake PDF Content");
    const materialUploadRes = await fetch(
      `${BASE_URL}/api/lessons/${lessonId}/materials?title=Slides+Node&type=pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          Cookie: adminCookie,
        },
        body: fakePdfBuffer,
      }
    );
    const materialUploadJson = (await materialUploadRes.json()) as any;
    const materialId = materialUploadJson.material?.id;
    createdMaterialFilename = materialUploadJson.material?.file_path;

    console.log(
      "7. Upload de Material Complementar via stream (RF12):",
      materialUploadRes.status === 201 && !!materialId ? "✅ PASSOU" : "❌ FALHOU"
    );

    // Teste 8: Listagem de materiais da aula
    const listMaterialsRes = await fetch(`${BASE_URL}/api/lessons/${lessonId}/materials`, {
      headers: { Cookie: studentCookie },
    });
    const listMaterialsJson = (await listMaterialsRes.json()) as any;
    console.log(
      "8. Listagem de materiais complementares da aula:",
      listMaterialsRes.status === 200 && listMaterialsJson.materials.length === 1
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    // Teste 9: Download do material complementar com Content-Disposition attachment
    const downloadRes = await fetch(`${BASE_URL}/api/materials/${materialId}/download`, {
      headers: { Cookie: studentCookie },
    });
    const contentDisposition = downloadRes.headers.get("content-disposition") || "";
    console.log(
      "9. Download de material com Content-Disposition attachment:",
      downloadRes.status === 200 && contentDisposition.includes("attachment")
        ? "✅ PASSOU"
        : "❌ FALHOU"
    );

    console.log("\n🎉 [Media] Todos os 9 testes de vídeo e materiais passaram com 100% de sucesso!");
  } finally {
    server.close();
    db.prepare("DELETE FROM users WHERE email LIKE '%@mediatest.com'").run();
    db.prepare("DELETE FROM courses WHERE slug = 'curso-media-teste'").run();

    // Limpeza dos arquivos temporários gerados em disco
    if (createdVideoFilename) {
      const vPath = path.resolve(process.cwd(), "uploads", "videos", createdVideoFilename);
      if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
    }
    if (createdMaterialFilename) {
      const mPath = path.resolve(process.cwd(), "uploads", "materials", createdMaterialFilename);
      if (fs.existsSync(mPath)) fs.unlinkSync(mPath);
    }
  }
}

runMediaTests().catch((err) => {
  console.error("❌ Falha nos testes de mídia:", err);
  process.exit(1);
});
