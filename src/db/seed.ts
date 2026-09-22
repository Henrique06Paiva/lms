import fs from "node:fs";
import path from "node:path";
import { db } from "./connection.js";
import { runMigrations } from "./migrate.js";
import { generateSalt, hashPassword } from "../modules/auth/auth.crypto.js";

export async function seed() {
  console.log("🌱 [Seed] Iniciando povoamento corporativo do banco de dados...");

  // Garante que migrations estão em dia
  await runMigrations();

  // Garante pastas em uploads
  const uploadDirs = ["videos", "materials", "certificates"];
  for (const d of uploadDirs) {
    const p = path.resolve(process.cwd(), "uploads", d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }

  // 1. Cria ou atualiza Usuários
  const users = [
    {
      name: "Henrique Paiva",
      email: "admin@educore.com",
      password: "adminPassword123",
      role: "admin",
    },
    {
      name: "Carolina Mendes",
      email: "aluno@empresa.com",
      password: "alunoPassword123",
      role: "student",
    },
  ];

  for (const u of users) {
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(u.email);
    if (!existing) {
      const salt = generateSalt();
      const hash = hashPassword(u.password, salt);
      db.prepare(
        "INSERT INTO users (name, email, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?)"
      ).run(u.name, u.email, hash, salt, u.role);
      console.log(`👤 Usuário criado: ${u.name} (${u.email}) [${u.role}]`);
    } else {
      console.log(`ℹ️ Usuário já existente: ${u.email}`);
    }
  }

  const studentUser = db.prepare("SELECT id FROM users WHERE email = 'aluno@empresa.com'").get() as any;

  // 2. Cria Programas de Capacitação (Cursos)
  const courses = [
    {
      title: "Arquitetura e Segurança de Sistemas Corporativos",
      slug: "arquitetura-e-seguranca-corporativa",
      description: "Metodologias avançadas de resiliência, padrões de segurança Zero Trust, criptografia de ponta a ponta e conformidade com LGPD.",
      workload_hours: 40,
      lessons: [
        {
          title: "Princípios de Arquitetura Zero Trust e Defesa em Camadas",
          order_index: 1,
          duration_seconds: 720,
        },
        {
          title: "Criptografia de Dados em Repouso, em Trânsito e Enclaves Seguros",
          order_index: 2,
          duration_seconds: 960,
        },
        {
          title: "Auditoria Contínua, Observabilidade e Conformidade com a LGPD",
          order_index: 3,
          duration_seconds: 600,
        },
      ],
    },
    {
      title: "Governança de Dados e Compliance em Nuvem",
      slug: "governanca-de-dados-e-compliance",
      description: "Estratégia corporativa para classificação de ativos digitais, ciclo de vida de dados, gestão de acessos privilegiados e soberania informacional.",
      workload_hours: 24,
      lessons: [
        {
          title: "Classificação da Informação e Políticas de Retenção",
          order_index: 1,
          duration_seconds: 540,
        },
        {
          title: "Gestão de Acessos Privilegiados (PAM) e IAM Corporativo",
          order_index: 2,
          duration_seconds: 840,
        },
      ],
    },
    {
      title: "Liderança Técnica e Métricas de Engenharia",
      slug: "lideranca-tecnica-e-metricas",
      description: "Gestão orientada a dados com métricas DORA, condução de postmortems sem culpa, mentoria e cultura de excelência operacional.",
      workload_hours: 16,
      lessons: [
        {
          title: "Métricas DORA e Otimização do Fluxo de Valor de Engenharia",
          order_index: 1,
          duration_seconds: 600,
        },
        {
          title: "Cultura de Postmortem Sem Culpa e Resiliência Organizacional",
          order_index: 2,
          duration_seconds: 750,
        },
      ],
    },
  ];

  for (const c of courses) {
    let courseRecord = db.prepare("SELECT id FROM courses WHERE slug = ?").get(c.slug) as any;
    if (!courseRecord) {
      const info = db.prepare(
        "INSERT INTO courses (title, slug, description, workload_hours) VALUES (?, ?, ?, ?) RETURNING id"
      ).get(c.title, c.slug, c.description, c.workload_hours) as any;
      courseRecord = info;
      console.log(`📚 Curso cadastrado: ${c.title}`);
    }

    // Aulas
    for (const l of c.lessons) {
      const existingLesson = db.prepare(
        "SELECT id FROM lessons WHERE course_id = ? AND order_index = ?"
      ).get(courseRecord.id, l.order_index) as any;

      let lessonId = existingLesson?.id;
      if (!existingLesson) {
        const lessonInfo = db.prepare(
          "INSERT INTO lessons (course_id, title, order_index, duration_seconds) VALUES (?, ?, ?, ?) RETURNING id"
        ).get(courseRecord.id, l.title, l.order_index, l.duration_seconds) as any;
        lessonId = lessonInfo.id;
        console.log(`  📖 Aula criada: ${l.order_index}. ${l.title}`);
      }

      // Material complementar de exemplo
      const existingMaterial = db.prepare("SELECT id FROM lesson_materials WHERE lesson_id = ?").get(lessonId);
      if (!existingMaterial) {
        const materialFilename = `guia_apoio_aula_${lessonId}.pdf`;
        const materialPath = path.resolve(process.cwd(), "uploads", "materials", materialFilename);
        if (!fs.existsSync(materialPath)) {
          fs.writeFileSync(materialPath, "%PDF-1.4\n% EduCore Enterprise Material Oficial\n%%EOF");
        }
        db.prepare(
          "INSERT INTO lesson_materials (lesson_id, title, file_path, file_type) VALUES (?, ?, ?, ?)"
        ).run(lessonId, `Guia Didático Complementar - Aula ${l.order_index}`, materialFilename, "application/pdf");
      }
    }
  }

  // 3. Matrícula do Aluno de teste no primeiro curso
  if (studentUser) {
    const firstCourse = db.prepare("SELECT id FROM courses WHERE slug = 'arquitetura-e-seguranca-corporativa'").get() as any;
    if (firstCourse) {
      const existingEnrollment = db.prepare(
        "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?"
      ).get(studentUser.id, firstCourse.id);

      if (!existingEnrollment) {
        db.prepare(
          "INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)"
        ).run(studentUser.id, firstCourse.id);

        // Marca primeira aula como concluída
        const firstLesson = db.prepare(
          "SELECT id FROM lessons WHERE course_id = ? AND order_index = 1"
        ).get(firstCourse.id) as any;

        if (firstLesson) {
          db.prepare(
            "INSERT INTO lesson_progress (user_id, lesson_id) VALUES (?, ?) ON CONFLICT DO NOTHING"
          ).run(studentUser.id, firstLesson.id);
        }

        console.log(`🎓 Aluno matriculado no curso 1 com progresso inicial registrado via triggers!`);
      }
    }
  }

  console.log("\n✨ [Seed] Povoamento concluído com sucesso!");
  console.log("--------------------------------------------------");
  console.log("Credenciais de Teste Disponíveis:");
  console.log("👑 Administrador: admin@educore.com | adminPassword123");
  console.log("🎓 Colaborador:  aluno@empresa.com | alunoPassword123");
  console.log("--------------------------------------------------");
}

const isDirectExecution = process.argv[1]?.replace(/\\/g, "/").endsWith("seed.ts") || process.argv[1]?.replace(/\\/g, "/").endsWith("seed.js");
if (isDirectExecution) {
  seed().catch((err) => {
    console.error("❌ Falha no seed:", err);
    process.exit(1);
  });
}
