CREATE TRIGGER trg_update_progress_after_insert
AFTER INSERT ON lesson_progress
BEGIN
  UPDATE enrollments
  SET
    progress_percent = (
      SELECT ROUND(
        (COUNT(lp.id) * 100.0) /
        MAX(1, (SELECT COUNT(*) FROM lessons WHERE course_id = (SELECT course_id FROM lessons WHERE id = NEW.lesson_id))),
        1
      )
      FROM lesson_progress lp
      JOIN lessons l ON lp.lesson_id = l.id
      WHERE lp.user_id = NEW.user_id
        AND l.course_id = (SELECT course_id FROM lessons WHERE id = NEW.lesson_id)
    ),
    completed_at = CASE
      WHEN (
        SELECT COUNT(lp.id)
        FROM lesson_progress lp
        JOIN lessons l ON lp.lesson_id = l.id
        WHERE lp.user_id = NEW.user_id
          AND l.course_id = (SELECT course_id FROM lessons WHERE id = NEW.lesson_id)
      ) = (
        SELECT COUNT(*)
        FROM lessons
        WHERE course_id = (SELECT course_id FROM lessons WHERE id = NEW.lesson_id)
      )
      THEN CURRENT_TIMESTAMP
      ELSE NULL
    END
  WHERE user_id = NEW.user_id
    AND course_id = (SELECT course_id FROM lessons WHERE id = NEW.lesson_id);
END;

CREATE TRIGGER trg_update_progress_after_delete
AFTER DELETE ON lesson_progress
BEGIN
  UPDATE enrollments
  SET
    progress_percent = COALESCE((
      SELECT ROUND(
        (COUNT(lp.id) * 100.0) /
        MAX(1, (SELECT COUNT(*) FROM lessons WHERE course_id = (SELECT course_id FROM lessons WHERE id = OLD.lesson_id))),
        1
      )
      FROM lesson_progress lp
      JOIN lessons l ON lp.lesson_id = l.id
      WHERE lp.user_id = OLD.user_id
        AND l.course_id = (SELECT course_id FROM lessons WHERE id = OLD.lesson_id)
    ), 0.0),
    completed_at = CASE
      WHEN (
        SELECT COUNT(lp.id)
        FROM lesson_progress lp
        JOIN lessons l ON lp.lesson_id = l.id
        WHERE lp.user_id = OLD.user_id
          AND l.course_id = (SELECT course_id FROM lessons WHERE id = OLD.lesson_id)
      ) = (
        SELECT COUNT(*)
        FROM lessons
        WHERE course_id = (SELECT course_id FROM lessons WHERE id = OLD.lesson_id)
      )
      AND (
        SELECT COUNT(*)
        FROM lessons
        WHERE course_id = (SELECT course_id FROM lessons WHERE id = OLD.lesson_id)
      ) > 0
      THEN CURRENT_TIMESTAMP
      ELSE NULL
    END
  WHERE user_id = OLD.user_id
    AND course_id = (SELECT course_id FROM lessons WHERE id = OLD.lesson_id);
END;

CREATE TRIGGER trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_courses_updated_at
AFTER UPDATE ON courses
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_lessons_updated_at
AFTER UPDATE ON lessons
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE lessons SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
