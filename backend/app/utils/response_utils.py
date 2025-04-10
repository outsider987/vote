import uuid
from typing import Any, Optional
from fastapi.responses import JSONResponse

def create_response(
    data: Any = None,
    success: bool = True,
    code: str = "SUCCESS",
    message: Optional[str] = None,
    status_code: int = 200
) -> JSONResponse:
    """
    Create a standardized API response.
    
    Args:
        data: The response data
        success: Whether the operation was successful
        code: Response code for frontend handling
        message: Optional message to include in response
        status_code: HTTP status code
    
    Returns:
        JSONResponse with standardized format
    """
    response = {
        "requestId": str(uuid.uuid4()),
        "data": data,
        "success": success,
        "code": code
    }
    
    if message:
        response["message"] = message
        
    return JSONResponse(
        content=response,
        status_code=status_code
    ) 