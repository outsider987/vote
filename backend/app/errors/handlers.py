from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any

class VotingError(HTTPException):
    def __init__(
        self,
        status_code: int,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(status_code=status_code)
        self.message = message
        self.error_code = error_code
        self.details = details or {}

async def voting_exception_handler(request: Request, exc: VotingError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.message,
                "code": exc.error_code,
                "details": exc.details
            }
        }
    )

class ErrorCodes:
    INVALID_TICKET = "INVALID_TICKET"
    TICKET_ALREADY_USED = "TICKET_ALREADY_USED"
    EVENT_NOT_FOUND = "EVENT_NOT_FOUND"
    VOTING_NOT_STARTED = "VOTING_NOT_STARTED"
    INVALID_VOTE_COUNT = "INVALID_VOTE_COUNT" 