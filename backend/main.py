from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.auth import router as auth_router
from backend.admin.admin_users import router as admin_users_router
from backend.admin.admin_classes import router as admin_classes_router
from backend.admin.admin_timetable import router as admin_timetable_router
from backend.admin.admin_dashboard import router as admin_dashboard_router


# ---------------------------------------------------
# App initialization (ONLY ONCE)
# ---------------------------------------------------
app = FastAPI(
    title="ConnectEd API",
    description="""
Welcome to the **ConnectEd Backend API**

This API powers the ConnectEd education platform, including:
- Authentication & role-based access
- User management (Admins, Teachers, Students)
- Class allocation
- Timetable management
- Admin dashboard analytics

Use the endpoints below to explore and test the system.
""",
    version="1.0.0",
)


# ---------------------------------------------------
# CORS (LOCAL + PRODUCTION)
# ---------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # ⬇️ replace this with your actual Vercel URL AFTER frontend deploy
        "https://connected.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------
# Root route (health check)
# ---------------------------------------------------
@app.get("/")
def root():
    return {
        "status": "running",
        "app": "ConnectEd API",
        "docs": "/docs",
    }


# ---------------------------------------------------
# Routers
# ---------------------------------------------------
app.include_router(auth_router)
app.include_router(admin_users_router)
app.include_router(admin_classes_router)
app.include_router(admin_timetable_router)
app.include_router(admin_dashboard_router)
