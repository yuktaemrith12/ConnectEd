from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from admin.admin_users import router as admin_users_router
from admin.admin_classes import router as admin_classes_router
from admin.admin_timetable import router as admin_timetable_router
from admin.admin_dashboard import router as admin_dashboard_router


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
""",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # local dev
        "http://localhost:5173",
        "http://127.0.0.1:5173",

        # your Vercel domains (production / assigned)
        "https://connect-ed-neon.vercel.app",
        "https://connect-ed-yukta-emriths-projects.vercel.app",
    ],
    # ✅ also allows Vercel preview deployments automatically
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "running", "app": "ConnectEd API", "docs": "/docs"}


app.include_router(auth_router)
app.include_router(admin_users_router)
app.include_router(admin_classes_router)
app.include_router(admin_timetable_router)
app.include_router(admin_dashboard_router)
