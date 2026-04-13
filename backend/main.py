import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# App initialization
# ---------------------------------------------------------------------------

app = FastAPI(
    title="EduFlow API",
    description="AI asosidagi interaktiv ta'lim platformasi — Backend API",
    version="2.0.0",
    docs_url="/docs",        # Swagger UI
    redoc_url="/redoc",      # ReDoc
    openapi_url="/openapi.json",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3001",  # development default
).split(",")

# Lokal tarmoq (192.168.x.x) dan istalgan portga brauzer kirishiga ruxsat
ALLOW_LOCAL_NETWORK = os.getenv("ALLOW_LOCAL_NETWORK", "true").lower() == "true"

LOCAL_NETWORK_REGEX = r"http://(localhost|127\.0\.0\.1)(:\d+)?|http://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=LOCAL_NETWORK_REGEX if ALLOW_LOCAL_NETWORK else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

from backend.api.routes import auth, courses, classes, assignments, ai, dashboard, organizations, topics, subjects, live_sessions, users
app.include_router(auth.router,          prefix="/api/v1/auth",          tags=["Auth"])
app.include_router(courses.router,       prefix="/api/v1/courses",       tags=["Courses"])
app.include_router(classes.router,       prefix="/api/v1/classes",       tags=["Classes"])
app.include_router(assignments.router,   prefix="/api/v1/assignments",   tags=["Assignments"])
app.include_router(ai.router,            prefix="/api/v1/ai",            tags=["AI"])
app.include_router(dashboard.router,     prefix="/api/v1/dashboard",     tags=["Dashboard"])
app.include_router(organizations.router, prefix="/api/v1/organizations", tags=["Organizations"])
app.include_router(topics.router,        prefix="/api/v1/modules",       tags=["Topics"])
app.include_router(subjects.router,      prefix="/api/v1/subjects",      tags=["Subjects"])
app.include_router(live_sessions.router, prefix="/api/v1")
app.include_router(users.router,         prefix="/api/v1/users",         tags=["Users"])

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["System"])
async def health_check():
    """Server ishlayaptimi tekshirish uchun. Deploy monitoring uchun ham ishlatiladi."""
    return {"status": "ok", "version": app.version}


@app.get("/", tags=["System"])
async def root():
    return {
        "name": "EduFlow API",
        "version": app.version,
        "docs": "/docs",
    }
