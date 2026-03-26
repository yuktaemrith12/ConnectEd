import logging
import time
import traceback

# Load .env into os.environ BEFORE any service modules read os.getenv()
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, users, students, teachers, parents, admin, admin_extensions, homework, assignments, messages, whatsapp, transcript_to_notes, ai_tutor
from app.api import video, consent
from app.core.config import settings
from app.services.ai.transcription_service import prewarm_mms

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("connected")

app = FastAPI(
    title="ConnectEd API",
    description="Backend API for the ConnectEd school management platform",
    version="0.1.0",
)


@app.on_event("startup")
async def startup_event():
    """Pre-warm the MMS Creole model in a background thread at server start.
    Eliminates the 30-120 s cold-start delay on the first Creole transcription."""
    prewarm_mms()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    logger.info(
        "[%s] %s - %d  (%.0fms)",
        request.method,
        request.url.path,
        response.status_code,
        ms,
    )
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception on [%s] %s\n%s",
        request.method,
        request.url.path,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router,     prefix="/api/v1/auth",     tags=["Auth"])
app.include_router(users.router,    prefix="/api/v1/users",    tags=["Users"])
app.include_router(students.router, prefix="/api/v1/students", tags=["Students"])
app.include_router(teachers.router, prefix="/api/v1/teachers", tags=["Teachers"])
app.include_router(parents.router,  prefix="/api/v1/parents",  tags=["Parents"])
app.include_router(admin.router,            prefix="/api/v1/admin", tags=["Admin"])
app.include_router(admin_extensions.router, prefix="/api/v1/admin", tags=["Admin Extensions"])
app.include_router(homework.router,     prefix="/api/v1/homework",     tags=["Homework"])
app.include_router(assignments.router,  prefix="/api/v1/assignments",  tags=["Assignments"])
app.include_router(messages.router,     prefix="/api/v1/messages",     tags=["Messages"])
app.include_router(whatsapp.router,           prefix="/api/v1/parents/whatsapp",     tags=["WhatsApp"])
app.include_router(whatsapp.router,           prefix="/api/v1/whatsapp",             tags=["WhatsApp"])
app.include_router(transcript_to_notes.router, prefix="/api/v1/transcript-to-notes", tags=["Transcript to Notes"])
app.include_router(ai_tutor.router,            prefix="/api/v1/ai-tutor",           tags=["AI Tutor"])
app.include_router(video.router,               prefix="/api/v1/video",               tags=["Video Conferencing"])
app.include_router(consent.router,             prefix="/api/v1/consent",             tags=["Consent Management"])

# Serve uploaded files (homework attachments, etc.)
import os as _os
_uploads_dir = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "uploads")
_os.makedirs(_uploads_dir, exist_ok=True)
_os.makedirs(_os.path.join(_uploads_dir, "recordings"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "ConnectEd API is running"}
