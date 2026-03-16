-- ============================================================
-- Migration 19: AI Tutor Improvements
-- Adds personality/style/tone/icon to ai_tutors
-- Adds confidence/response_type to ai_tutor_chat_messages
-- ============================================================

ALTER TABLE ai_tutors
  ADD COLUMN personality ENUM('strict','supportive','neutral') NOT NULL DEFAULT 'supportive' AFTER system_prompt,
  ADD COLUMN teaching_style ENUM('concise','detailed','step_by_step') NOT NULL DEFAULT 'detailed' AFTER personality,
  ADD COLUMN tone ENUM('formal','friendly','academic') NOT NULL DEFAULT 'friendly' AFTER teaching_style,
  ADD COLUMN emphasis_topics JSON NULL AFTER tone,
  ADD COLUMN icon_emoji VARCHAR(10) NULL AFTER emphasis_topics;

ALTER TABLE ai_tutor_chat_messages
  ADD COLUMN confidence ENUM('high','medium','low') NULL AFTER sources_json,
  ADD COLUMN response_type VARCHAR(50) NULL AFTER confidence;