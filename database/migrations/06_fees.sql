-- ============================================================
--  ConnectEd — 06: Fees & Payments
--  Domain: academic_periods, fee_plans (with evolution columns),
--          fee_payments, fee_installments, fee_notification_events
--  Depends on: 03_profiles.sql (student_profiles)
--
--  Consolidates: old 06_fees_module.sql + 08_fees_evolution.sql
-- ============================================================

USE connected_app;

-- Academic Periods
CREATE TABLE IF NOT EXISTS academic_periods (
    id         INT          NOT NULL AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    start_date DATE         NOT NULL,
    end_date   DATE         NOT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_academic_periods_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fee Plans
CREATE TABLE IF NOT EXISTS fee_plans (
    id                 INT            NOT NULL AUTO_INCREMENT,
    student_id         INT            NOT NULL,
    academic_period_id INT            NULL,
    total_amount       DECIMAL(10,2)  NOT NULL,
    base_amount        DECIMAL(10,2)  NOT NULL,
    discount_amount    DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    due_date           DATE           NOT NULL,
    created_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_feeplan_student
        FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_feeplan_period
        FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fee Payments
CREATE TABLE IF NOT EXISTS fee_payments (
    id             INT            NOT NULL AUTO_INCREMENT,
    fee_plan_id    INT            NOT NULL,
    amount_paid    DECIMAL(10,2)  NOT NULL,
    payment_date   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method ENUM('Cash', 'Bank Transfer', 'Card') NOT NULL DEFAULT 'Cash',
    transaction_id VARCHAR(100)   NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_payment_plan
        FOREIGN KEY (fee_plan_id) REFERENCES fee_plans(id) ON DELETE CASCADE,
    CONSTRAINT uq_transaction_id UNIQUE (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fee Installments
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

-- Fee Notification Events
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
