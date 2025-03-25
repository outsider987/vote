from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Admin
import os
from functools import wraps
from typing import List, Optional

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

def require_auth(required_permissions: List[str] = None):
    """
    Decorator to require authentication and optionally specific permissions.
    
    Parameters:
    - required_permissions: List of permission codes that are required to access the endpoint.
                          If None, only authentication is required.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get the database session
            db = kwargs.get('db')
            if not db:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database session not found"
                )
            
            # Get the token from kwargs
            token = kwargs.get('token')
            if not token:
                # If token is not in kwargs, try to get it from the Authorization header
                auth_header = kwargs.get('authorization')
                if not auth_header or not auth_header.startswith('Bearer '):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Not authenticated",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                token = auth_header.split(' ')[1]
            
            # Verify the token and get the user
            current_user = get_current_user(token, db)
            
            # Check permissions if required
            if required_permissions:
                token_data = get_token_data(token)
                if not token_data:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token invalid or expired",
                    )
                
                api_permissions = token_data.get("api_permissions", [])
                has_required_permissions = any(perm in api_permissions for perm in required_permissions)
                
                if not has_required_permissions:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Insufficient permissions",
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
