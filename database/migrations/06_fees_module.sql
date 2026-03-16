-- ============================================================
-- Migration 06: Fees Module
-- Run after: 05_attendance_module.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS fee_plans (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    student_id   INT             NOT NULL,
    total_amount DECIMAL(10, 2)  NOT NULL,
    due_date     DATE            NOT NULL,
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_feeplan_student
        FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fee_payments (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    fee_plan_id    INT             NOT NULL,
    amount_paid    DECIMAL(10, 2)  NOT NULL,
    payment_date   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method ENUM('Cash', 'Bank Transfer', 'Card') NOT NULL DEFAULT 'Cash',
    transaction_id VARCHAR(100)    NULL,

    CONSTRAINT fk_payment_plan
        FOREIGN KEY (fee_plan_id) REFERENCES fee_plans(id) ON DELETE CASCADE,
    CONSTRAINT uq_transaction_id UNIQUE (transaction_id)
);
