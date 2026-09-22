import { db } from "../../db/connection.js";
import type { LessonRecord } from "../courses/courses.repository.js";

export interface MaterialRecord {
  id: number;
  lesson_id: number;
  title: string;
  file_path: string;
  file_type: string;
  created_at: string;
}

export class MediaRepository {
  public updateLessonVideo(
    lessonId: number,
    videoFilename: string,
    durationSeconds?: number
  ): LessonRecord | null {
    const stmt = db.prepare(`
      UPDATE lessons
      SET video_filename = ?,
          duration_seconds = COALESCE(?, duration_seconds)
      WHERE id = ?
      RETURNING *
    `);

    return (stmt.get(videoFilename, durationSeconds ?? null, lessonId) as LessonRecord) || null;
  }

  public createMaterial(data: {
    lessonId: number;
    title: string;
    filePath: string;
    fileType: string;
  }): MaterialRecord {
    const stmt = db.prepare(`
      INSERT INTO lesson_materials (lesson_id, title, file_path, file_type)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);

    return stmt.get(
      data.lessonId,
      data.title,
      data.filePath,
      data.fileType
    ) as MaterialRecord;
  }

  public findMaterialsByLessonId(lessonId: number): MaterialRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM lesson_materials
      WHERE lesson_id = ?
      ORDER BY created_at ASC
    `);
    return stmt.all(lessonId) as MaterialRecord[];
  }

  public findMaterialById(id: number): MaterialRecord | null {
    const stmt = db.prepare("SELECT * FROM lesson_materials WHERE id = ?");
    return (stmt.get(id) as MaterialRecord) || null;
  }

  public deleteMaterial(id: number): boolean {
    const stmt = db.prepare("DELETE FROM lesson_materials WHERE id = ?");
    const info = stmt.run(id);
    return info.changes > 0;
  }
}

export const mediaRepository = new MediaRepository();
