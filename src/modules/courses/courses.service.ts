import { AppError } from "../../core/errors.js";
import {
  coursesRepository,
  type CourseRecord,
  type EnrollmentRecord,
  type LessonRecord,
} from "./courses.repository.js";

export function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface CreateCourseDTO {
  title: string;
  slug?: string;
  description: string;
  coverUrl?: string;
  workloadHours?: number;
}

export interface UpdateCourseDTO {
  title?: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  workloadHours?: number;
}

export interface CreateLessonDTO {
  title: string;
  orderIndex?: number;
  durationSeconds?: number;
}

export interface UpdateLessonDTO {
  title?: string;
  orderIndex?: number;
  durationSeconds?: number;
}

export class CoursesService {
  public async createCourse(dto: CreateCourseDTO): Promise<CourseRecord> {
    if (!dto.title || dto.title.trim().length < 3) {
      throw new AppError(400, "O título do curso deve ter pelo menos 3 caracteres");
    }

    if (!dto.description || dto.description.trim().length < 5) {
      throw new AppError(400, "A descrição do curso deve ter pelo menos 5 caracteres");
    }

    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.title);
    const existing = coursesRepository.findCourseBySlug(slug);
    if (existing) {
      throw new AppError(409, `O slug '${slug}' já está em uso por outro curso`);
    }

    return coursesRepository.createCourse({
      title: dto.title.trim(),
      slug,
      description: dto.description.trim(),
      coverUrl: dto.coverUrl,
      workloadHours: dto.workloadHours ?? 0,
    });
  }

  public async updateCourse(id: number, dto: UpdateCourseDTO): Promise<CourseRecord> {
    const course = coursesRepository.findCourseById(id);
    if (!course) {
      throw new AppError(404, "Curso não encontrado");
    }

    let slug = course.slug;
    if (dto.slug && dto.slug !== course.slug) {
      slug = slugify(dto.slug);
      const existing = coursesRepository.findCourseBySlug(slug);
      if (existing && existing.id !== id) {
        throw new AppError(409, `O slug '${slug}' já está em uso`);
      }
    }

    const updated = coursesRepository.updateCourse(id, {
      ...dto,
      slug,
    });

    if (!updated) {
      throw new AppError(400, "Não foi possível atualizar o curso");
    }

    return updated;
  }

  public async deleteCourse(id: number): Promise<void> {
    const course = coursesRepository.findCourseById(id);
    if (!course) {
      throw new AppError(404, "Curso não encontrado");
    }

    coursesRepository.deleteCourse(id);
  }

  public async listCourses(userId?: number): Promise<CourseRecord[]> {
    return coursesRepository.listCourses(userId);
  }

  public async getCourseBySlug(
    slug: string,
    userId?: number
  ): Promise<{
    course: CourseRecord;
    lessons: LessonRecord[];
    enrollment: EnrollmentRecord | null;
  }> {
    const course = coursesRepository.findCourseBySlug(slug);
    if (!course) {
      throw new AppError(404, "Curso não encontrado");
    }

    const lessons = coursesRepository.findLessonsByCourseId(course.id, userId);
    const enrollment = userId ? coursesRepository.findEnrollment(userId, course.id) : null;

    return { course, lessons, enrollment };
  }

  public async createLesson(courseId: number, dto: CreateLessonDTO): Promise<LessonRecord> {
    const course = coursesRepository.findCourseById(courseId);
    if (!course) {
      throw new AppError(404, "Curso não encontrado");
    }

    if (!dto.title || dto.title.trim().length < 2) {
      throw new AppError(400, "O título da aula deve ter pelo menos 2 caracteres");
    }

    const orderIndex =
      dto.orderIndex !== undefined
        ? dto.orderIndex
        : coursesRepository.getNextLessonOrderIndex(courseId);

    try {
      return coursesRepository.createLesson({
        courseId,
        title: dto.title.trim(),
        orderIndex,
        durationSeconds: dto.durationSeconds ?? 0,
      });
    } catch (err: any) {
      if (err.message && err.message.includes("UNIQUE constraint failed")) {
        throw new AppError(409, `Já existe uma aula na posição ${orderIndex} para este curso`);
      }
      throw err;
    }
  }

  public async updateLesson(id: number, dto: UpdateLessonDTO): Promise<LessonRecord> {
    const lesson = coursesRepository.findLessonById(id);
    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }

    try {
      const updated = coursesRepository.updateLesson(id, dto);
      if (!updated) {
        throw new AppError(400, "Não foi possível atualizar a aula");
      }
      return updated;
    } catch (err: any) {
      if (err.message && err.message.includes("UNIQUE constraint failed")) {
        throw new AppError(409, "Conflito de ordem com outra aula existente");
      }
      throw err;
    }
  }

  public async deleteLesson(id: number): Promise<void> {
    const lesson = coursesRepository.findLessonById(id);
    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }

    coursesRepository.deleteLesson(id);
  }

  public async enroll(userId: number, courseId: number): Promise<EnrollmentRecord> {
    const course = coursesRepository.findCourseById(courseId);
    if (!course) {
      throw new AppError(404, "Curso não encontrado");
    }

    const existing = coursesRepository.findEnrollment(userId, courseId);
    if (existing) {
      throw new AppError(409, "Você já está matriculado neste curso");
    }

    return coursesRepository.createEnrollment(userId, courseId);
  }
}

export const coursesService = new CoursesService();
