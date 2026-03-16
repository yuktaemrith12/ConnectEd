-- Migration 17: AI Study Materials
-- Stores transcription + notes + illustration jobs for the Transcript-to-Notes feature.
Use connected_app;

CREATE TABLE IF NOT EXISTS ai_study_materials (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    student_id       INT NOT NULL,
    source_type      ENUM('upload', 'class_recording') NOT NULL DEFAULT 'upload',
    source_reference VARCHAR(500)  NULL,
    language         VARCHAR(20)   NOT NULL DEFAULT 'en',
    status           ENUM('processing', 'completed', 'failed') NOT NULL DEFAULT 'processing',
    current_stage    VARCHAR(50)   NULL,
    transcript       LONGTEXT      NULL,
    notes_markdown   LONGTEXT      NULL,
    illustration_url LONGTEXT      NULL,
    error_message    TEXT          NULL,
    created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_asm_student FOREIGN KEY (student_id)
        REFERENCES users(id) ON DELETE CASCADE
);
