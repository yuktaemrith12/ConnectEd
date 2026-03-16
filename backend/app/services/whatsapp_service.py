"""
WhatsApp notification service — Meta Cloud API (no SDK, plain HTTP).

One reminder: the access token you gave me expires in ~24 hours. When it stops working, go back to Meta Developer Console → WhatsApp → API Setup and generate a new one, then update META_WHATSAPP_TOKEN in .env. To get a permanent token later, you'd create a System User in Meta Business Settings.

Set these env vars in your .env file:
    META_WHATSAPP_TOKEN       = your permanent or temporary access token
    META_PHONE_NUMBER_ID      = phone number ID from Meta Developer Console
    FRONTEND_URL              = base URL of the frontend, e.g. http://localhost:5173
"""

import logging
import urllib.parse
from typing import Optional

import requests

logger = logging.getLogger("connected.whatsapp")

_API_VERSION = "v22.0"


def _get_credentials():
    from app.core.config import settings
    token    = getattr(settings, "META_WHATSAPP_TOKEN",  None)
    phone_id = getattr(settings, "META_PHONE_NUMBER_ID", None)
    return token, phone_id


def send(to_phone: str, body: str) -> bool:
    """Send a plain-text WhatsApp message."""
    try:
        token, phone_id = _get_credentials()
        if not token or not phone_id:
            logger.warning("WhatsApp send skipped — META_WHATSAPP_TOKEN / META_PHONE_NUMBER_ID not set in .env")
            return False

        to_clean = to_phone.lstrip("+")
        url      = f"https://graph.facebook.com/{_API_VERSION}/{phone_id}/messages"
        headers  = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload  = {
            "messaging_product": "whatsapp",
            "to":   to_clean,
            "type": "text",
            "text": {"preview_url": False, "body": body},
        }

        resp = requests.post(url, json=payload, headers=headers, timeout=10)

        if resp.status_code == 200:
            msg_id = resp.json().get("messages", [{}])[0].get("id", "—")
            logger.info("WhatsApp sent to %s — message ID: %s", to_phone, msg_id)
            return True
        else:
            logger.error("WhatsApp send failed to %s — %d: %s", to_phone, resp.status_code, resp.text)
            return False

    except Exception as exc:
        logger.error("WhatsApp send exception to %s: %s", to_phone, exc)
        return False


def send_interactive(
    to_phone: str,
    body: str,
    button_text: str,
    button_url: str,
    footer: str = "ConnectEd",
) -> bool:
    """
    Send a WhatsApp interactive message with a CTA URL button.
    Requires HTTPS URL in production; falls back to plain text via dispatch().
    """
    try:
        token, phone_id = _get_credentials()
        if not token or not phone_id:
            return False

        to_clean = to_phone.lstrip("+")
        url      = f"https://graph.facebook.com/{_API_VERSION}/{phone_id}/messages"
        headers  = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload  = {
            "messaging_product": "whatsapp",
            "to":   to_clean,
            "type": "interactive",
            "interactive": {
                "type": "cta_url",
                "body":   {"text": body},
                "footer": {"text": footer},
                "action": {
                    "name": "cta_url",
                    "parameters": {
                        "display_text": button_text,
                        "url":          button_url,
                    },
                },
            },
        }

        resp = requests.post(url, json=payload, headers=headers, timeout=10)

        if resp.status_code == 200:
            msg_id = resp.json().get("messages", [{}])[0].get("id", "—")
            logger.info("WhatsApp interactive sent to %s — message ID: %s", to_phone, msg_id)
            return True
        else:
            logger.warning(
                "WhatsApp interactive failed (%d) to %s: %s — falling back to text",
                resp.status_code, to_phone, resp.text,
            )
            return False

    except Exception as exc:
        logger.error("WhatsApp interactive exception to %s: %s", to_phone, exc)
        return False


def dispatch(to_phone: str, body: str, button_text: str, page_path: str) -> bool:
    """
    Send notification with a CTA button when FRONTEND_URL is configured.
    Falls back to plain text automatically.

    page_path — relative path starting with '/', e.g. '/parent/attendance'
    """
    try:
        from app.core.config import settings as _cfg
        frontend_url = getattr(_cfg, "FRONTEND_URL", "").rstrip("/")
    except Exception:
        frontend_url = ""

    if frontend_url:
        # Always route through the login page with the destination as ?from=
        # so users without an active session are prompted to log in first.
        encoded_path = urllib.parse.quote(page_path, safe="/")
        full_url = f"{frontend_url}/?from={encoded_path}"
        if send_interactive(to_phone, body, button_text, full_url):
            return True

    # Fall back to plain text
    return send(to_phone, body)
