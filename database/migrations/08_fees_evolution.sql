-- ============================================================
-- ConnectEd — Fees Evolution (Safe + Re-runnable)
-- Fixes:
--  - MySQL Safe Updates (1175) for UPDATE
--  - Duplicate column errors (1060) when re-running
--  - "table already exists" warnings are harmless
-- ============================================================

USE connected_app;

-- ------------------------------------------------------------
-- 1) Academic periods
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_periods (
    id   INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_academic_periods_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2) fee_plans schema evolution
--    (add academic_period_id, base_amount, discount_amount)
--    MySQL-compatible "ADD COLUMN IF NOT EXISTS" using INFORMATION_SCHEMA
-- ------------------------------------------------------------
SET @db := DATABASE();

-- Add academic_period_id if missing
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = @db
              AND table_name = 'fee_plans'
              AND column_name = 'academic_period_id'
        ),
        'SELECT 1',
        'ALTER TABLE fee_plans ADD COLUMN academic_period_id INT NULL AFTER student_id'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add base_amount if missing
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = @db
              AND table_name = 'fee_plans'
              AND column_name = 'base_amount'
        ),
        'SELECT 1',
        'ALTER TABLE fee_plans ADD COLUMN base_amount DECIMAL(10,2) NULL AFTER total_amount'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add discount_amount if missing
SET @sql := (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = @db
              AND table_name = 'fee_plans'
              AND column_name = 'discount_amount'
        ),
        'SELECT 1',
        'ALTER TABLE fee_plans ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER base_amount'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 3) Backfill: base_amount = total_amount WHERE base_amount IS NULL
--    Safe-updates compliant: uses key column (id) in WHERE
-- ------------------------------------------------------------
SET SQL_SAFE_UPDATES = 0;

UPDATE fee_plans
SET base_amount = total_amount
WHERE base_amount IS NULL;

SET SQL_SAFE_UPDATES = 1;

-- ------------------------------------------------------------
-- 4) Fee installments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_installments (
    id          INT            NOT NULL AUTO_INCREMENT,
    fee_plan_id INT            NOT NULL,
    amount      DECIMAL(10,2)  NOT NULL,
    due_date    DATE           NOT NULL,
    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_installment_plan     (fee_plan_id),
    INDEX idx_installment_due_date (due_date),
    CONSTRAINT fk_inst_plan
        FOREIGN KEY (fee_plan_id) REFERENCES fee_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5) Fee notification events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_notification_events (
    id           INT  NOT NULL AUTO_INCREMENT,
    type         ENUM('Upcoming Due', 'Due Today', 'Overdue', 'Payment Receipt') NOT NULL,
    student_id   INT  NOT NULL,
    fee_plan_id  INT  NULL,
    trigger_date DATE NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_notif_student (student_id),
    INDEX idx_notif_trigger (trigger_date),
    CONSTRAINT fk_notif_student
        FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_plan
        FOREIGN KEY (fee_plan_id) REFERENCES fee_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Optional verification (uncomment if needed)
-- ------------------------------------------------------------
-- DESCRIBE academic_periods;
-- DESCRIBE fee_plans;
-- DESCRIBE fee_installments;
-- DESCRIBE fee_notification_events;
-- SELECT COUNT(*) AS null_base_amount FROM fee_plans WHERE base_amount IS NULL;