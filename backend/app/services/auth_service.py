from fastapi import Depends, HTTPException, Header, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Admin
import os
from functools import wraps
from typing import List, Optional
from typing import Optional, List, Type, TypeVar, Generic
from pydantic import BaseModel, ValidationError
import inspect

ModelType = TypeVar("ModelType", bound=BaseModel)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"


def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload:
            raise credentials_exception

        # Create a dictionary with user information from payload
        user_info = {
            "id": int(payload.get("user_id")),
            "username": payload.get("sub"),
            "role": payload.get("role"),
            "email": payload.get("email"),
            "is_active": payload.get("is_active", True),
            "created_at": payload.get("created_at"),
            "ui_permissions": payload.get("ui_permissions", []),
            "api_permissions": payload.get("api_permissions", []),
        }

        # Create a simple object with the user information
        class UserInfo:
            def __init__(self, **kwargs):
                for key, value in kwargs.items():
                    setattr(self, key, value)

        return UserInfo(**user_info)

    except JWTError:
        raise credentials_exception


def get_token_data(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def has_permission(token: str, required_permission: str) -> bool:
    """Check if the token has the required permission"""
    payload = get_token_data(token)
    if not payload:
        return False

    api_permissions = payload.get("api_permissions", [])
    return required_permission in api_permissions


def require_auth(
    required_permissions: Optional[List[str]] = None,
    body_model: Optional[Type[ModelType]] = None,
):
    """
    Decorator that performs authentication (and optional body validation)
    while preserving the original function signature.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Retrieve the Request object from either kwargs or args.
            request: Optional[Request] = kwargs.get("request")
            if request is None:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            if request is None:
                raise RuntimeError("Request object not found in endpoint parameters")
            
            # Extract and check the authorization header.
            authorization = request.headers.get("authorization")
            if not authorization or not authorization.startswith("Bearer "):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authenticated",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            token = authorization.split(" ")[1]

            # Validate token and retrieve current user.
            try:
                current_user = get_current_user(token)
            except Exception as e:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from e

            # Validate required permissions, if provided.
            if required_permissions:
                token_data = get_token_data(token)
                if not token_data or not any(
                    perm in token_data.get("api_permissions", []) for perm in required_permissions
                ):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Insufficient permissions",
                    )
            
            # If a body_model is provided, manually validate the request body.
            # (This will override FastAPI’s built-in validation, so use with care.)
            if body_model:
                try:
                    body_data = await request.json()
                    validated_body = body_model(**body_data)
                    kwargs["body"] = validated_body  # Inject validated body into kwargs.
                except ValidationError as e:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=[{"msg": err["msg"], "loc": err["loc"]} for err in e.errors()],
                    )
            
            # Inject the current_user into kwargs.
            kwargs["current_user"] = current_user
            
            return await func(*args, **kwargs)
        
        # Preserve the original signature so FastAPI can correctly inspect it.
        wrapper.__signature__ = inspect.signature(func)
        return wrapper
    return decorator