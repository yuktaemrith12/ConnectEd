-- Migration: 18_ai_tutor.sql
-- AI Tutor feature — subject-specific RAG-powered tutors
-- Run after all previous migrations in MySQL Workbench
Use connected_app;

CREATE TABLE IF NOT EXISTS ai_tutors (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    class_id      INT NOT NULL,
    subject_id    INT NOT NULL,
    teacher_id    INT NOT NULL,
    display_name  VARCHAR(255),
    system_prompt TEXT,
    is_active     TINYINT(1) DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_class_subject (class_id, subject_id),
    FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)  ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id)     ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_tutor_chapters (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    tutor_id     INT NOT NULL,
    term         VARCHAR(50),
    chapter_name VARCHAR(255),
    topic        VARCHAR(255),
    sort_order   INT DEFAULT 0,
    is_unlocked  TINYINT(1) DEFAULT 1,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tutor_term_chapter (tutor_id, term, chapter_name),
    FOREIGN KEY (tutor_id) REFERENCES ai_tutors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_tutor_documents (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    tutor_id          INT NOT NULL,
    chapter_id        INT NULL,
    doc_type          ENUM('handbook','curriculum','lesson','worksheet',
                           'homework','mock_test','past_paper','marking_scheme','other')
                      DEFAULT 'other',
    original_filename VARCHAR(500),
    storage_path      VARCHAR(500),
    file_size_bytes   BIGINT,
    mime_type         VARCHAR(100),
    is_indexed        TINYINT(1) DEFAULT 0,
    is_enabled        TINYINT(1) DEFAULT 1,
    uploaded_by       INT NOT NULL,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tutor_enabled (tutor_id, is_enabled),
    FOREIGN KEY (tutor_id)    REFERENCES ai_tutors(id)          ON DELETE CASCADE,
    FOREIGN KEY (chapter_id)  REFERENCES ai_tutor_chapters(id)  ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)              ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_tutor_transcripts (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    tutor_id            INT NOT NULL,
    chapter_id          INT NULL,
    recording_id        INT NULL,
    raw_transcript      LONGTEXT,
    approved_transcript LONGTEXT NULL,
    status              ENUM('pending','approved','rejected') DEFAULT 'pending',
    reviewed_by         INT NULL,
    reviewed_at         DATETIME NULL,
    is_indexed          TINYINT(1) DEFAULT 0,
    is_enabled          TINYINT(1) DEFAULT 1,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tutor_status (tutor_id, status),
    FOREIGN KEY (tutor_id)    REFERENCES ai_tutors(id)          ON DELETE CASCADE,
    FOREIGN KEY (chapter_id)  REFERENCES ai_tutor_chapters(id)  ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id)              ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ai_tutor_chat_sessions (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    tutor_id         INT NOT NULL,
    student_id       INT NOT NULL,
    mode             ENUM('learn','revision','practice','exam_prep','recap') DEFAULT 'learn',
    started_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tutor_student (tutor_id, student_id),
    FOREIGN KEY (tutor_id)   REFERENCES ai_tutors(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id)     ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_tutor_chat_messages (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    session_id   INT NOT NULL,
    role         ENUM('user','assistant','system') NOT NULL,
    content      LONGTEXT NOT NULL,
    sources_json JSON NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_created (session_id, created_at),
    FOREIGN KEY (session_id) REFERENCES ai_tutor_chat_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_tutor_vector_chunks (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    tutor_id      INT NOT NULL,
    document_id   INT NULL,
    transcript_id INT NULL,
    chunk_index   INT,
    chunk_text    TEXT,
    vector_id     VARCHAR(255),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tutor (tutor_id),
    FOREIGN KEY (tutor_id)      REFERENCES ai_tutors(id)              ON DELETE CASCADE,
    FOREIGN KEY (document_id)   REFERENCES ai_tutor_documents(id)     ON DELETE CASCADE,
    FOREIGN KEY (transcript_id) REFERENCES ai_tutor_transcripts(id)   ON DELETE CASCADE
);
