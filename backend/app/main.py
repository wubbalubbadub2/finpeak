"""FastAPI application."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import upload, transactions, categories, reports, sheets, users

app = FastAPI(title="KZ Finance API", version="2.0.0")

# CORS — allow frontend (local + deployed)
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
extra_origin = os.environ.get("FRONTEND_URL")
if extra_origin:
    allowed_origins.append(extra_origin)
# Allow all Vercel preview deployments
allowed_origins_regex = r"https://.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origins_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(sheets.router, prefix="/api")
app.include_router(users.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
