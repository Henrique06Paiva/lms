import { db } from "../../db/connection.js";

export interface CourseRecord {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover_url: string | null;
  workload_hours: number;
  created_at: string;
  updated_at: string;
  total_lessons?: number;
  enrollment_id?: number | null;
  progress_percent?: number | null;
  completed_at?: string | null;
}

export interface LessonRecord {
  id: number;
  course_id: number;
  title: string;
  order_index: number;
  video_filename: string | null;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
  is_completed?: number;
}

export interface EnrollmentRecord {
  id: number;
  user_id: number;
  course_id: number;
  progress_percent: number;
  completed_at: string | null;
  enrolled_at: string;
}

export class CoursesRepository {
  public createCourse(data: {
    title: string;
    slug: string;
    description: string;
    coverUrl?: string | null;
    workloadHours?: number;
  }): CourseRecord {
    const stmt = db.prepare(`
      INSERT INTO courses (title, slug, description, cover_url, workload_hours)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      data.title,
      data.slug,
      data.description,
      data.coverUrl ?? null,
      data.workloadHours ?? 0
    ) as CourseRecord;
  }

  public updateCourse(
    id: number,
    data: {
      title?: string;
      slug?: string;
      description?: string;
      coverUrl?: string | null;
      workloadHours?: number;
    }
  ): CourseRecord | null {
    const stmt = db.prepare(`
      UPDATE courses
      SET title = COALESCE(?, title),
          slug = COALESCE(?, slug),
          description = COALESCE(?, description),
          cover_url = COALESCE(?, cover_url),
          workload_hours = COALESCE(?, workload_hours)
      WHERE id = ?
      RETURNING *
    `);

    return (
      (stmt.get(
        data.title ?? null,
        data.slug ?? null,
        data.description ?? null,
        data.coverUrl ?? null,
        data.workloadHours ?? null,
        id
      ) as CourseRecord) || null
    );
  }

  public deleteCourse(id: number): boolean {
    const stmt = db.prepare("DELETE FROM courses WHERE id = ?");
    const info = stmt.run(id);
    return info.changes > 0;
  }

  public findCourseById(id: number): CourseRecord | null {
    const stmt = db.prepare("SELECT * FROM courses WHERE id = ?");
    return (stmt.get(id) as CourseRecord) || null;
  }

  public findCourseBySlug(slug: string): CourseRecord | null {
    const stmt = db.prepare("SELECT * FROM courses WHERE slug = ?");
    return (stmt.get(slug) as CourseRecord) || null;
  }

  public listCourses(userId?: number): CourseRecord[] {
    if (userId) {
      const stmt = db.prepare(`
        SELECT 
          c.*,
          e.id AS enrollment_id,
          e.progress_percent,
          e.completed_at,
          (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS total_lessons
        FROM courses c
        LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = ?
        ORDER BY c.created_at DESC
      `);
      return stmt.all(userId) as CourseRecord[];
    }

    const stmt = db.prepare(`
      SELECT 
        c.*,
        NULL AS enrollment_id,
        NULL AS progress_percent,
        NULL AS completed_at,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS total_lessons
      FROM courses c
      ORDER BY c.created_at DESC
    `);
    return stmt.all() as CourseRecord[];
  }

  public createLesson(data: {
    courseId: number;
    title: string;
    orderIndex: number;
    durationSeconds?: number;
  }): LessonRecord {
    const stmt = db.prepare(`
      INSERT INTO lessons (course_id, title, order_index, duration_seconds)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      data.courseId,
      data.title,
      data.orderIndex,
      data.durationSeconds ?? 0
    ) as LessonRecord;
  }

  public findLessonById(id: number): LessonRecord | null {
    const stmt = db.prepare("SELECT * FROM lessons WHERE id = ?");
    return (stmt.get(id) as LessonRecord) || null;
  }

  public findLessonsByCourseId(courseId: number, userId?: number): LessonRecord[] {
    if (userId) {
      const stmt = db.prepare(`
        SELECT 
          l.*,
          CASE WHEN lp.id IS NOT NULL THEN 1 ELSE 0 END AS is_completed
        FROM lessons l
        LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
        WHERE l.course_id = ?
        ORDER BY l.order_index ASC
      `);
      return stmt.all(userId, courseId) as LessonRecord[];
    }

    const stmt = db.prepare(`
      SELECT 
        l.*,
        0 AS is_completed
      FROM lessons l
      WHERE l.course_id = ?
      ORDER BY l.order_index ASC
    `);
    return stmt.all(courseId) as LessonRecord[];
  }

  public getNextLessonOrderIndex(courseId: number): number {
    const stmt = db.prepare(`
      SELECT COALESCE(MAX(order_index), 0) + 1 AS next_index
      FROM lessons
      WHERE course_id = ?
    `);
    const row = stmt.get(courseId) as { next_index: number };
    return row.next_index;
  }

  public updateLesson(
    id: number,
    data: {
      title?: string;
      orderIndex?: number;
      durationSeconds?: number;
      videoFilename?: string | null;
    }
  ): LessonRecord | null {
    const stmt = db.prepare(`
      UPDATE lessons
      SET title = COALESCE(?, title),
          order_index = COALESCE(?, order_index),
          duration_seconds = COALESCE(?, duration_seconds),
          video_filename = COALESCE(?, video_filename)
      WHERE id = ?
      RETURNING *
    `);

    return (
      (stmt.get(
        data.title ?? null,
        data.orderIndex ?? null,
        data.durationSeconds ?? null,
        data.videoFilename ?? null,
        id
      ) as LessonRecord) || null
    );
  }

  public deleteLesson(id: number): boolean {
    const stmt = db.prepare("DELETE FROM lessons WHERE id = ?");
    const info = stmt.run(id);
    return info.changes > 0;
  }

  public createEnrollment(userId: number, courseId: number): EnrollmentRecord {
    const stmt = db.prepare(`
      INSERT INTO enrollments (user_id, course_id)
      VALUES (?, ?)
      RETURNING *
    `);
    return stmt.get(userId, courseId) as EnrollmentRecord;
  }

  public findEnrollment(userId: number, courseId: number): EnrollmentRecord | null {
    const stmt = db.prepare(`
      SELECT * FROM enrollments
      WHERE user_id = ? AND course_id = ?
    `);
    return (stmt.get(userId, courseId) as EnrollmentRecord) || null;
  }
}

export const coursesRepository = new CoursesRepository();
