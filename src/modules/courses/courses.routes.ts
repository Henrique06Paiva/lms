import { Router } from "../../core/router.js";
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
} from "../auth/auth.middleware.js";
import { coursesService } from "./courses.service.js";

export function registerCoursesRoutes(router: Router): void {
  // 1. Listagem de cursos (+ progresso se logado) (RF09)
  router.get("/api/courses", optionalAuthenticate, async (req, res) => {
    const courses = await coursesService.listCourses(req.user?.id);
    res.status(200).json({ courses });
  });

  // 2. Detalhe do curso + aulas ordenadas (+ status de conclusão)
  router.get("/api/courses/:slug", optionalAuthenticate, async (req, res) => {
    const slug = req.params["slug"] ?? "";
    const data = await coursesService.getCourseBySlug(slug, req.user?.id);
    res.status(200).json(data);
  });

  // 3. Criação de curso (Admin) (RF07)
  router.post(
    "/api/courses",
    authenticate,
    requireRole("admin"),
    async (req, res) => {
      const course = await coursesService.createCourse(req.body);
      res.status(201).json({
        message: "Curso criado com sucesso",
        course,
      });
    }
  );

  // 4. Edição de curso (Admin) (RF07)
  router.put(
    "/api/courses/:id",
    authenticate,
    requireRole("admin"),
    async (req, res) => {
      const courseId = Number(req.params["id"]);
      const course = await coursesService.updateCourse(courseId, req.body);
      res.status(200).json({
        message: "Curso atualizado com sucesso",
        course,
      });
    }
  );

  // 5. Exclusão de curso (Admin) (RF07)
  router.delete(
    "/api/courses/:id",
    authenticate,
    requireRole("admin"),
    async (req, res) => {
      const courseId = Number(req.params["id"]);
      await coursesService.deleteCourse(courseId);
      res.status(200).json({ message: "Curso excluído com sucesso" });
    }
  );

  // 6. Matrícula do aluno no curso (RF08)
  router.post(
    "/api/courses/:id/enroll",
    authenticate,
    async (req, res) => {
      const courseId = Number(req.params["id"]);
      const enrollment = await coursesService.enroll(req.user!.id, courseId);
      res.status(201).json({
        message: "Matrícula realizada com sucesso",
        enrollment,
      });
    }
  );

  // 7. Criação de aula vinculada ao curso (Admin) (RF10)
  router.post(
    "/api/courses/:id/lessons",
    authenticate,
    requireRole("admin"),
    async (req, res) => {
      const courseId = Number(req.params["id"]);
      const lesson = await coursesService.createLesson(courseId, req.body);
      res.status(201).json({
        message: "Aula criada com sucesso",
        lesson,
      });
    }
  );

  // 8. Edição de aula (Admin)
  router.put(
    "/api/lessons/:id",
    authenticate,
    requireRole("admin"),
    async (req, res) => {
      const lessonId = Number(req.params["id"]);
      const lesson = await coursesService.updateLesson(lessonId, req.body);
      res.status(200).json({
        message: "Aula atualizada com sucesso",
        lesson,
      });
    }
  );

  // 9. Exclusão de aula (Admin)
  router.delete(
    "/api/lessons/:id",
    authenticate,
    requireRole("admin"),
    async (req, res) => {
      const lessonId = Number(req.params["id"]);
      await coursesService.deleteLesson(lessonId);
      res.status(200).json({ message: "Aula excluída com sucesso" });
    }
  );
}
