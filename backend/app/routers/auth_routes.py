from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
import os
import json
from app.db.database import get_db
from app.models.models import Admin, Role

router = APIRouter()

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY","your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Define function to create access token
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login")
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    user = db.query(Admin).options(joinedload(Admin.role).joinedload(Role.permissions)).filter(Admin.username == form_data.username).first()
    if not user or form_data.password != user.password:  # Note: In production, use proper password hashing
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user role and permissions
    role_name = None
    ui_permissions = []
    api_permissions = []
    
    if user.role:
        role_name = user.role.name
        for p in user.role.permissions:
            if p.type == "ui":
                ui_permissions.append(p.path)
            else:  # api
                api_permissions.append(p.path)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.username, 
            "role": role_name,
            "ui_permissions": ui_permissions,
            "api_permissions": api_permissions,
            "user_id": str(user.id),
            "email": user.email if hasattr(user, 'email') else None,
            "is_active": user.is_active if hasattr(user, 'is_active') else True,
            "created_at": str(user.created_at) if hasattr(user, 'created_at') else None
        }, 
        expires_delta=access_token_expires
    )
    
    # Set content type explicitly to ensure proper parsing on frontend
    response.headers["Content-Type"] = "application/json"
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": str(user.id),
        "username": user.username,
        "role": role_name,
        "ui_permissions": ui_permissions,
        "api_permissions": api_permissions
    }
