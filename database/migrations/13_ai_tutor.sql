-- ============================================================
--  ConnectEd — 19: AI Tutor (RAG)
--  Domain: ai_tutors, chapters, documents, transcripts,
--          chat_sessions, chat_messages, vector_chunks, infographics
--  Depends on: all prior migrations
-- ============================================================

USE connected_app;

-- ── AI Tutors ─────────────────────────────────────────────────
-- One configurable RAG tutor per class × subject.
CREATE TABLE IF NOT EXISTS ai_tutors (
    id             INT          NOT NULL AUTO_INCREMENT,
    class_id       INT          NOT NULL,
    subject_id     INT          NOT NULL,
    teacher_id     INT          NOT NULL,
    display_name   VARCHAR(255) NULL,
    system_prompt  TEXT         NULL,
    personality    ENUM('strict','supportive','neutral') NOT NULL DEFAULT 'supportive',
    teaching_style ENUM('concise','detailed','step_by_step') NOT NULL DEFAULT 'detailed',
    tone           ENUM('formal','friendly','academic') NOT NULL DEFAULT 'friendly',
    emphasis_topics JSON        NULL,
    icon_emoji     VARCHAR(10)  NULL,
    is_active      TINYINT(1)   NOT NULL DEFAULT 0,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tutor_class_subject (class_id, subject_id),
    CONSTRAINT fk_tutor_class   FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE,
    CONSTRAINT fk_tutor_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_tutor_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Chapters ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tutor_chapters (
    id           INT          NOT NULL AUTO_INCREMENT,
    tutor_id     INT          NOT NULL,
    term         VARCHAR(50)  NULL,
    chapter_name VARCHAR(255) NULL,
    topic        VARCHAR(255) NULL,
    sort_order   INT          NOT NULL DEFAULT 0,
    is_unlocked  TINYINT(1)   NOT NULL DEFAULT 1,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tutor_term_chapter (tutor_id, term, chapter_name),
    CONSTRAINT fk_chapter_tutor FOREIGN KEY (tutor_id) REFERENCES ai_tutors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Documents ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tutor_documents (
    id                INT          NOT NULL AUTO_INCREMENT,
    tutor_id          INT          NOT NULL,
    chapter_id        INT          NULL,
    doc_type          ENUM('handbook','curriculum','lesson','worksheet','homework',
                           'mock_test','past_paper','marking_scheme','other') DEFAULT 'other',
    original_filename VARCHAR(500) NULL,
    storage_path      VARCHAR(500) NULL,
    file_size_bytes   BIGINT       NULL,
    mime_type         VARCHAR(100) NULL,
    is_indexed        TINYINT(1)   NOT NULL DEFAULT 0,
    is_enabled        TINYINT(1)   NOT NULL DEFAULT 1,
    uploaded_by       INT          NOT NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_doc_tutor_enabled (tutor_id, is_enabled),
    CONSTRAINT fk_doc_tutor     FOREIGN KEY (tutor_id)    REFERENCES ai_tutors(id)         ON DELETE CASCADE,
    CONSTRAINT fk_doc_chapter   FOREIGN KEY (chapter_id)  REFERENCES ai_tutor_chapters(id) ON DELETE SET NULL,
    CONSTRAINT fk_doc_uploader  FOREIGN KEY (uploaded_by) REFERENCES users(id)             ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Transcripts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tutor_transcripts (
    id                  INT         NOT NULL AUTO_INCREMENT,
    tutor_id            INT         NOT NULL,
    chapter_id          INT         NULL,
    recording_id        INT         NULL,
    raw_transcript      LONGTEXT    NULL,
    approved_transcript LONGTEXT    NULL,
    status              ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reviewed_by         INT         NULL,
    reviewed_at         DATETIME    NULL,
    is_indexed          TINYINT(1)  NOT NULL DEFAULT 0,
    is_enabled          TINYINT(1)  NOT NULL DEFAULT 1,
    created_at          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_transcript_tutor_status (tutor_id, status),
    CONSTRAINT fk_transcript_tutor   FOREIGN KEY (tutor_id)     REFERENCES ai_tutors(id)         ON DELETE CASCADE,
    CONSTRAINT fk_transcript_chapter FOREIGN KEY (chapter_id)   REFERENCES ai_tutor_chapters(id) ON DELETE SET NULL,
    CONSTRAINT fk_transcript_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)             ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Chat Sessions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tutor_chat_sessions (
    id               INT     NOT NULL AUTO_INCREMENT,
    tutor_id         INT     NOT NULL,
    student_id       INT     NOT NULL,
    mode             ENUM('learn','revision','practice','exam_prep','recap') NOT NULL DEFAULT 'learn',
    started_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_session_tutor_student (tutor_id, student_id),
    CONSTRAINT fk_session_tutor   FOREIGN KEY (tutor_id)   REFERENCES ai_tutors(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_student FOREIGN KEY (student_id) REFERENCES users(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Chat Messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tutor_chat_messages (
    id            INT      NOT NULL AUTO_INCREMENT,
    session_id    INT      NOT NULL,
    role          ENUM('user','assistant','system') NOT NULL,
    content       LONGTEXT NOT NULL,
    sources_json  JSON     NULL,
    confidence    ENUM('high','medium','low') NULL,
    response_type VARCHAR(50) NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_msg_session_created (session_id, created_at),
    CONSTRAINT fk_msg_session FOREIGN KEY (session_id) REFERENCES ai_tutor_chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Vector Chunks ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tutor_vector_chunks (
    id            INT          NOT NULL AUTO_INCREMENT,
    tutor_id      INT          NOT NULL,
    document_id   INT          NULL,
    transcript_id INT          NULL,
    chunk_index   INT          NULL,
    chunk_text    TEXT         NULL,
    vector_id     VARCHAR(255) NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_chunk_tutor (tutor_id),
    CONSTRAINT fk_chunk_tutor      FOREIGN KEY (tutor_id)      REFERENCES ai_tutors(id)            ON DELETE CASCADE,
    CONSTRAINT fk_chunk_document   FOREIGN KEY (document_id)   REFERENCES ai_tutor_documents(id)   ON DELETE CASCADE,
    CONSTRAINT fk_chunk_transcript FOREIGN KEY (transcript_id) REFERENCES ai_tutor_transcripts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Infographics ──────────────────────────────────────────────
-- DALL-E 3 image cache, keyed by concept_hash to avoid duplicate generation.
CREATE TABLE IF NOT EXISTS ai_tutor_infographics (
    id                 INT          NOT NULL AUTO_INCREMENT,
    tutor_id           INT          NOT NULL,
    message_id         INT          NOT NULL,
    prompt_used        TEXT         NULL,
    normalized_concept VARCHAR(500) NULL,
    concept_hash       VARCHAR(64)  NULL,
    storage_path       VARCHAR(500) NULL,
    accessibility_alt  TEXT         NULL,
    created_at         DATETIME     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    INDEX idx_infographic_concept (tutor_id, concept_hash),
    CONSTRAINT fk_infographic_tutor FOREIGN KEY (tutor_id)   REFERENCES ai_tutors(id)             ON DELETE CASCADE,
    CONSTRAINT fk_infographic_msg   FOREIGN KEY (message_id) REFERENCES ai_tutor_chat_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
