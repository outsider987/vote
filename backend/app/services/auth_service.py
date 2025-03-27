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
ModelType = TypeVar('ModelType', bound=BaseModel)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(Admin).filter(Admin.username == username).first()
    if user is None:
        raise credentials_exception
    return user

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
    body_model: Optional[Type[ModelType]] = None
):
    """
    Advanced authentication decorator with optional body validation.
    
    Args:
        required_permissions: List of permissions required to access the endpoint
        body_model: Pydantic model for body validation (optional)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(
            request: Request,
            db: Session = Depends(get_db),
            authorization: Optional[str] = Header(None),
            *args,
            **kwargs
        ):
            # Extract token from Authorization header
            if not authorization or not authorization.startswith('Bearer '):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            token = authorization.split(' ')[1]
            
            # Verify token and get current user
            try:
                current_user = get_current_user(token, db)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
            
            # Validate permissions if required
            if required_permissions:
                try:
                    token_data = get_token_data(token)
                    api_permissions = token_data.get("api_permissions", [])
                    
                    if not any(perm in api_permissions for perm in required_permissions):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Insufficient permissions"
                        )
                except Exception:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Permission verification failed"
                    )
            
            # Handle body validation if a model is provided
            validated_body = None
            if body_model:
                try:
                    # Try to parse request body
                    body_data = await request.json()
                    validated_body = body_model(**body_data)
                except ValidationError as e:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=[{"msg": err['msg'], "loc": err['loc']} for err in e.errors()]
                    )
            
            # Add validated data to kwargs
            kwargs.update({
                'current_user': current_user,
                'db': db,
                'body': validated_body
            })
            
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
