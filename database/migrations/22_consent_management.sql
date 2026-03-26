-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 22: Consent Management System (GDPR Compliant)
-- Tables: consent_records, consent_audit_logs
-- ─────────────────────────────────────────────────────────────────────────────

-- Granular per-student consent records for AI biometric features
CREATE TABLE IF NOT EXISTS consent_records (
    id              INT           NOT NULL AUTO_INCREMENT,
    student_id      INT           NOT NULL,                         -- FK → users.id (the student)
    consent_type    VARCHAR(50)   NOT NULL,                         -- 'emotion_detection' | 'session_recording' | 'transcript_generation'
    status          VARCHAR(20)   NOT NULL DEFAULT 'pending',       -- 'pending' | 'granted' | 'refused' | 'withdrawn' | 'expired'
    granted_by      INT           NULL,                             -- FK → users.id (student or parent who acted)
    consent_version VARCHAR(10)   NOT NULL DEFAULT 'v1.0',
    expiry_date     DATE          NULL,                             -- Optional: end of academic year
    ip_address      VARCHAR(45)   NULL,                             -- For audit trail
    created_at      DATETIME      NOT NULL DEFAULT NOW(),
    updated_at      DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),

    PRIMARY KEY (id),
    UNIQUE KEY uq_consent_student_type (student_id, consent_type),
    CONSTRAINT fk_cr_student  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cr_grantor  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Full immutable audit trail for every consent state change
CREATE TABLE IF NOT EXISTS consent_audit_logs (
    log_id          INT           NOT NULL AUTO_INCREMENT,
    consent_id      INT           NOT NULL,
    action          VARCHAR(30)   NOT NULL,   -- 'granted' | 'refused' | 'withdrawn' | 'expired' | 'renewed' | 'blocked_attempt'
    performed_by    INT           NULL,       -- FK → users.id
    previous_status VARCHAR(20)   NULL,
    new_status      VARCHAR(20)   NULL,
    timestamp       DATETIME      NOT NULL DEFAULT NOW(),
    ip_address      VARCHAR(45)   NULL,
    notes           TEXT          NULL,

    PRIMARY KEY (log_id),
    CONSTRAINT fk_cal_consent   FOREIGN KEY (consent_id)   REFERENCES consent_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_cal_performer FOREIGN KEY (performed_by) REFERENCES users(id)           ON DELETE SET NULL
);

-- Index for fast student lookup
CREATE INDEX IF NOT EXISTS idx_cr_student   ON consent_records     (student_id);
CREATE INDEX IF NOT EXISTS idx_cal_consent  ON consent_audit_logs  (consent_id);
CREATE INDEX IF NOT EXISTS idx_cal_ts       ON consent_audit_logs  (timestamp);
