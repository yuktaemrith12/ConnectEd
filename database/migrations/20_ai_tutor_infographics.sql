-- Migration 20: AI Tutor Infographics
-- Tracks DALL-E 3 generated infographics per assistant chat message.
-- Includes a concept_hash for intelligent caching (same tutor + concept = reuse image).
USE connected_app;

CREATE TABLE IF NOT EXISTS ai_tutor_infographics (
    id                  INT          AUTO_INCREMENT PRIMARY KEY,
    tutor_id            INT          NOT NULL,
    message_id          INT          NOT NULL,
    prompt_used         TEXT,
    normalized_concept  VARCHAR(500),
    concept_hash        VARCHAR(64),
    storage_path        VARCHAR(500),
    accessibility_alt   TEXT,
    created_at          DATETIME     DEFAULT NOW(),

    CONSTRAINT fk_infographic_tutor
        FOREIGN KEY (tutor_id)   REFERENCES ai_tutors(id)              ON DELETE CASCADE,
    CONSTRAINT fk_infographic_msg
        FOREIGN KEY (message_id) REFERENCES ai_tutor_chat_messages(id) ON DELETE CASCADE,

    INDEX idx_infographic_concept_hash (tutor_id, concept_hash)
);
