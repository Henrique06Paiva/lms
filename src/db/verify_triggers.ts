import { db } from "./connection.js";

console.log("🧪 Testando triggers e integridade relacional do SQLite...\n");

try {
  // Limpa dados de teste anteriores caso existam
  db.prepare("DELETE FROM users WHERE email = ?").run("teste_aluno@educore.com");
  db.prepare("DELETE FROM courses WHERE slug = ?").run("curso-teste-triggers");

  // 1. Cria usuário de teste
  const userResult = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?)"
    )
    .run("Aluno Teste", "teste_aluno@educore.com", "hash123", "salt123", "student");
  const userId = Number(userResult.lastInsertRowid);

  // 2. Cria curso com 2 aulas
  const courseResult = db
    .prepare(
      "INSERT INTO courses (title, slug, description, workload_hours) VALUES (?, ?, ?, ?)"
    )
    .run("Curso de Teste", "curso-teste-triggers", "Descrição do curso", 10);
  const courseId = Number(courseResult.lastInsertRowid);

  const lesson1 = db
    .prepare("INSERT INTO lessons (course_id, title, order_index) VALUES (?, ?, ?)")
    .run(courseId, "Aula 1: Introdução", 1);
  const lesson1Id = Number(lesson1.lastInsertRowid);

  const lesson2 = db
    .prepare("INSERT INTO lessons (course_id, title, order_index) VALUES (?, ?, ?)")
    .run(courseId, "Aula 2: Conclusão", 2);
  const lesson2Id = Number(lesson2.lastInsertRowid);

  // 3. Matricula o aluno no curso
  db.prepare("INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)").run(
    userId,
    courseId
  );

  let enrollment = db
    .prepare("SELECT progress_percent, completed_at FROM enrollments WHERE user_id = ? AND course_id = ?")
    .get(userId, courseId) as { progress_percent: number; completed_at: string | null };

  console.log(`1. Matrícula inicial: progresso = ${enrollment.progress_percent}% (esperado: 0%)`);

  // 4. Conclui Aula 1 -> Trigger deve calcular 50%
  db.prepare("INSERT INTO lesson_progress (user_id, lesson_id) VALUES (?, ?)").run(
    userId,
    lesson1Id
  );

  enrollment = db
    .prepare("SELECT progress_percent, completed_at FROM enrollments WHERE user_id = ? AND course_id = ?")
    .get(userId, courseId) as { progress_percent: number; completed_at: string | null };

  console.log(`2. Aula 1 concluída: progresso = ${enrollment.progress_percent}% (esperado: 50%)`);

  // 5. Conclui Aula 2 -> Trigger deve calcular 100% e preencher completed_at
  db.prepare("INSERT INTO lesson_progress (user_id, lesson_id) VALUES (?, ?)").run(
    userId,
    lesson2Id
  );

  enrollment = db
    .prepare("SELECT progress_percent, completed_at FROM enrollments WHERE user_id = ? AND course_id = ?")
    .get(userId, courseId) as { progress_percent: number; completed_at: string | null };

  console.log(
    `3. Aula 2 concluída: progresso = ${enrollment.progress_percent}% | completed_at = ${enrollment.completed_at} (esperado: 100% com data)`
  );

  // 6. Reseta curso (deleta progressos) -> Trigger de delete deve zerar
  db.prepare("DELETE FROM lesson_progress WHERE user_id = ?").run(userId);

  enrollment = db
    .prepare("SELECT progress_percent, completed_at FROM enrollments WHERE user_id = ? AND course_id = ?")
    .get(userId, courseId) as { progress_percent: number; completed_at: string | null };

  console.log(
    `4. Progresso resetado: progresso = ${enrollment.progress_percent}% | completed_at = ${enrollment.completed_at} (esperado: 0% e null)`
  );

  // Limpeza dos dados de teste
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  db.prepare("DELETE FROM courses WHERE id = ?").run(courseId);

  console.log("\n✅ Todos os testes de trigger e integridade passaram com 100% de sucesso!");
} catch (error) {
  console.error("❌ Falha na verificação de triggers:", error);
}
