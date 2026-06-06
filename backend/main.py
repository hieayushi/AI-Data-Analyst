"""
main.py — FastAPI application entry point for AI Data Analyst.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import upload, query, schema

app = FastAPI(
    title="AI Data Analyst",
    description="Natural language to SQL — powered by Azure GPT-4.1 + text-embedding-ada-002 + Qdrant",
    version="1.0.0",
)

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(query.router)
app.include_router(schema.router)


@app.get("/")
async def root():
    return {"message": "AI Data Analyst API is running.", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}
