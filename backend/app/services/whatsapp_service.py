"""
WhatsApp notification service — Meta Cloud API (no SDK, plain HTTP).

Required .env vars:
    META_WHATSAPP_TOKEN        = permanent system-user access token (see docs/whatsapp_setup)
    META_PHONE_NUMBER_ID       = phone number ID from Meta Developer Console
    META_WEBHOOK_VERIFY_TOKEN  = arbitrary secret matching the Meta Dev Console webhook config
    WHATSAPP_USE_TEMPLATES     = false (dev) | true (production, after templates are approved)
    FRONTEND_URL               = base URL of the frontend, e.g. https://yourapp.com
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


def _is_opted_out(phone: str) -> bool:
    """Return True if this phone number has been added to the opt-out registry."""
    try:
        from app.core.database import SessionLocal
        from app.models.extensions import WhatsAppOptout
        phone_e164 = f"+{phone}" if not phone.startswith("+") else phone
        _db = SessionLocal()
        try:
            return _db.query(WhatsAppOptout).filter(WhatsAppOptout.phone_number == phone_e164).first() is not None
        finally:
            _db.close()
    except Exception:
        return False


def send_template(
    to_phone: str,
    template_name: str,
    language_code: str = "en",
    body_params: list = None,
    cta_url: str = None,
) -> bool:
    """
    Send a pre-approved WhatsApp Message Template.
    Required for cold push notifications (user hasn't messaged in 24h).

    body_params — ordered list of strings matching {{1}}, {{2}}, ... in the template body.
    cta_url     — optional dynamic URL suffix for a CTA URL button (index 0).
    """
    try:
        token, phone_id = _get_credentials()
        if not token or not phone_id:
            logger.warning("WhatsApp template send skipped — credentials not set")
            return False

        to_clean   = to_phone.lstrip("+")
        url        = f"https://graph.facebook.com/{_API_VERSION}/{phone_id}/messages"
        headers    = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        components = []

        if body_params:
            components.append({
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in body_params],
            })

        if cta_url:
            components.append({
                "type": "button",
                "sub_type": "url",
                "index": "0",
                "parameters": [{"type": "text", "text": cta_url}],
            })

        payload = {
            "messaging_product": "whatsapp",
            "to": to_clean,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components,
            },
        }

        resp = requests.post(url, json=payload, headers=headers, timeout=10)

        if resp.status_code == 200:
            msg_id = resp.json().get("messages", [{}])[0].get("id", "—")
            logger.info("WhatsApp template '%s' sent to %s — ID: %s", template_name, to_phone, msg_id)
            return True
        else:
            logger.error("WhatsApp template '%s' failed to %s — %d: %s",
                         template_name, to_phone, resp.status_code, resp.text)
            return False

    except Exception as exc:
        logger.error("WhatsApp template exception to %s: %s", to_phone, exc)
        return False


def dispatch(
    to_phone: str,
    body: str,
    button_text: str,
    page_path: str,
    template_name: str = None,
    body_params: list = None,
) -> bool:
    """
    Send a WhatsApp notification, routing via approved template in production
    or free-form interactive/text in dev.

    page_path     — relative path starting with '/', e.g. '/parent/attendance'
    template_name — Meta-approved template name; used when WHATSAPP_USE_TEMPLATES=True
    body_params   — ordered parameter list matching {{1}}, {{2}}, ... in the template
    """
    if _is_opted_out(to_phone):
        logger.info("WhatsApp send skipped — %s has opted out", to_phone)
        return False

    try:
        from app.core.config import settings as _cfg
        use_templates = getattr(_cfg, "WHATSAPP_USE_TEMPLATES", False)
        frontend_url  = getattr(_cfg, "FRONTEND_URL", "").rstrip("/")
    except Exception:
        use_templates = False
        frontend_url  = ""

    cta_url = None
    if frontend_url:
        encoded_path = urllib.parse.quote(page_path, safe="/")
        cta_url = f"{frontend_url}/?from={encoded_path}"

    # Production path: use approved template
    if use_templates and template_name:
        if send_template(to_phone, template_name, body_params=body_params, cta_url=cta_url):
            return True

    # Dev / fallback path: free-form interactive with CTA button, then plain text
    if cta_url:
        if send_interactive(to_phone, body, button_text, cta_url):
            return True

    return send(to_phone, body)
