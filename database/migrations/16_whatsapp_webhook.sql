-- Migration 23: WhatsApp Webhook Support
-- Adds delivery status tracking and opt-out registry for inbound webhook events.

-- Tracks per-message delivery status from Meta's status callbacks
CREATE TABLE IF NOT EXISTS whatsapp_delivery_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    wa_message_id   VARCHAR(128) NOT NULL,
    recipient_phone VARCHAR(20)  NOT NULL,
    status          ENUM('sent','delivered','read','failed') NOT NULL,
    error_code      INT          NULL,
    error_message   VARCHAR(255) NULL,
    event_key       VARCHAR(255) NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_msg_status (wa_message_id, status)
) ENGINE=InnoDB;

-- Opt-out registry — users who replied STOP (or UNSUBSCRIBE / CANCEL / OPTOUT)
CREATE TABLE IF NOT EXISTS whatsapp_optouts (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    opted_out_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
