import { db } from "../../db/connection.js";
import type { EnrollmentRecord } from "../courses/courses.repository.js";

export class ProgressRepository {
  public markLessonComplete(userId: number, lessonId: number): void {
    const stmt = db.prepare(`
      INSERT INTO lesson_progress (user_id, lesson_id)
      VALUES (?, ?)
      ON CONFLICT(user_id, lesson_id) DO NOTHING
    `);
    stmt.run(userId, lessonId);
  }

  public isLessonCompleted(userId: number, lessonId: number): boolean {
    const stmt = db.prepare(`
      SELECT 1 FROM lesson_progress
      WHERE user_id = ? AND lesson_id = ?
    `);
    return !!stmt.get(userId, lessonId);
  }

  public resetCourseProgress(userId: number, courseId: number): void {
    const stmt = db.prepare(`
      DELETE FROM lesson_progress
      WHERE user_id = ?
        AND lesson_id IN (SELECT id FROM lessons WHERE course_id = ?)
    `);
    stmt.run(userId, courseId);
  }

  public getEnrollment(userId: number, courseId: number): EnrollmentRecord | null {
    const stmt = db.prepare(`
      SELECT * FROM enrollments
      WHERE user_id = ? AND course_id = ?
    `);
    return (stmt.get(userId, courseId) as EnrollmentRecord) || null;
  }
}

export const progressRepository = new ProgressRepository();
