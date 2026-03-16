USE connected_app;

-- =====================================================
-- 1) assignments: add answer_sheet_path (if missing)
-- =====================================================

SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'connected_app'
      AND TABLE_NAME = 'assignments'
      AND COLUMN_NAME = 'answer_sheet_path'
);

SET @sql := IF(@col_exists = 0,
    'ALTER TABLE assignments ADD COLUMN answer_sheet_path VARCHAR(500) NULL AFTER location;',
    'SELECT "answer_sheet_path already exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =====================================================
-- 2) submissions: add is_onsite (if missing)
-- =====================================================

SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'connected_app'
      AND TABLE_NAME = 'submissions'
      AND COLUMN_NAME = 'is_onsite'
);

SET @sql := IF(@col_exists = 0,
    'ALTER TABLE submissions ADD COLUMN is_onsite TINYINT(1) NOT NULL DEFAULT 0 AFTER ai_reviewed;',
    'SELECT "is_onsite already exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =====================================================
-- 3) ai_reviews: add annotations (if missing)
-- =====================================================

SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'connected_app'
      AND TABLE_NAME = 'ai_reviews'
      AND COLUMN_NAME = 'annotations'
);

SET @sql := IF(@col_exists = 0,
    'ALTER TABLE ai_reviews ADD COLUMN annotations JSON NULL AFTER rubric_alignment;',
    'SELECT "annotations already exists";'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;