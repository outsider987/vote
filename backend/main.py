# main.py
from typing import List
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import JSONResponse
from app.db.database import init_db, dispose_engine
from fastapi.middleware.cors import CORSMiddleware
from app.errors.handlers import VotingError, voting_exception_handler, ErrorCodes
from app.core.config import settings
import logging
from app.routers import router
import traceback

logger = logging.getLogger(__name__)
app = FastAPI(title="Voting System API")

# Add CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://vote.cashone.tw",
        # Add any additional origins as needed
    ],
    allow_credentials=True,  # Important for cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"],
    expose_headers=["Content-Type", "Authorization"],
    max_age=86400,  # Cache CORS response for 1 day
)

# Add exception handlers
@app.exception_handler(VotingError)
async def handle_voting_error(request: Request, exc: VotingError):
    return await voting_exception_handler(request, exc)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Get the full stack trace
    stack_trace = traceback.format_exc()
    
    # Log the error with stack trace
    logger.error(f"Unhandled error occurred: {str(exc)}\nStack trace:\n{stack_trace}")
    
    # Determine if we should show detailed error info
    error_detail = str(exc) if settings.DEBUG else "An unexpected error occurred"
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "message": "Internal Server Error",
                "code": "INTERNAL_SERVER_ERROR",
                "details": {
                    "error": error_detail,
                    "path": request.url.path,
                    # Only include stack trace in debug mode
                    "stack_trace": stack_trace if settings.DEBUG else None
                }
            }
        }
    )

# 儲存連線中的 WebSocket 客戶端
active_websockets: List[WebSocket] = []


app.include_router(
    router,
)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    try:
        init_db()
        logger.info("✅ Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize application: {str(e)}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup database connections on shutdown"""
    dispose_engine()


@app.get("/health")
async def health_check():
    """Health check endpoint to verify API is running"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
