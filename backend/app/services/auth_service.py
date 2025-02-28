from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Admin
import os
from functools import wraps

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

def require_auth():
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
            # kwargs['current_user'] = current_user
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
