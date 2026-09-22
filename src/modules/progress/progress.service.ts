import { AppError } from "../../core/errors.js";
import { coursesRepository, type EnrollmentRecord } from "../courses/courses.repository.js";
import { progressRepository } from "./progress.repository.js";

export class ProgressService {
  // 1. Marca aula como concluída e aciona o trigger de cálculo de progresso (RF14)
  public async completeLesson(userId: number, lessonId: number): Promise<EnrollmentRecord> {
    const lesson = coursesRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }

    const enrollment = progressRepository.getEnrollment(userId, lesson.course_id);
    if (!enrollment) {
      throw new AppError(403, "Você precisa estar matriculado no curso para concluir aulas");
    }

    // Grava o progresso; o trigger do SQLite recalcula automaticamente o percentual e a conclusão
    progressRepository.markLessonComplete(userId, lessonId);

    const updated = progressRepository.getEnrollment(userId, lesson.course_id);
    if (!updated) {
      throw new AppError(500, "Erro ao recuperar progresso atualizado");
    }

    return updated;
  }

  // 2. Reseta o progresso do aluno no curso e aciona o trigger de deleção (RF15)
  public async resetCourse(userId: number, courseId: number): Promise<EnrollmentRecord> {
    const course = coursesRepository.findCourseById(courseId);
    if (!course) {
      throw new AppError(404, "Curso não encontrado");
    }

    const enrollment = progressRepository.getEnrollment(userId, courseId);
    if (!enrollment) {
      throw new AppError(404, "Você não está matriculado neste curso");
    }

    // Remove as aulas concluídas; o trigger zera o progresso da matrícula e anula completed_at
    progressRepository.resetCourseProgress(userId, courseId);

    const updated = progressRepository.getEnrollment(userId, courseId);
    if (!updated) {
      throw new AppError(500, "Erro ao recuperar matrícula resetada");
    }

    return updated;
  }
}

export const progressService = new ProgressService();
