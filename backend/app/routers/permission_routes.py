from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.db.database import get_db
from app.models.models import Permission, Role, Admin
from app.schemas.vote import (
    # PermissionCreate, 
    # PermissionResponse, 
    PermissionUpdate,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    AdminResponse,
    AdminUpdate,
    PermissionTreeCreate
)
from app.services.auth_service import require_auth
from fastapi.responses import JSONResponse
from uuid import UUID

router = APIRouter(prefix="/permissions", tags=["permissions"])

def build_permission_tree(permissions: List[Permission]) -> List[dict]:
    """Build a tree structure from flat permissions list"""
    permission_dict = {p.id: p.to_dict() for p in permissions}
    tree = []
    
    for permission in permissions:
        if permission.parent_id is None:
            tree.append(permission_dict[permission.id])
        else:
            parent = permission_dict.get(permission.parent_id)
            if parent:
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(permission_dict[permission.id])
    
    return tree

@router.get("/tree")
@require_auth()
async def get_permission_tree(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    """Get permissions in tree structure"""
    permissions = db.query(Permission).order_by(Permission.order).all()
    return build_permission_tree(permissions)

@router.post("/")
@require_auth()
async def create_permission(
    permission: PermissionTreeCreate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    """Create a new permission with tree structure support"""
    # Check if permission with this code already exists
    existing_permission = db.query(Permission).filter(Permission.path == permission.path).first()
    if existing_permission:
        raise HTTPException(status_code=400, detail=f"Permission with code '{permission.code}' already exists")
    
    # Validate type
    if permission.type not in ["ui", "api"]:
        raise HTTPException(status_code=400, detail="Permission type must be either 'ui' or 'api'")
    
    # Create new permission
    db_permission = Permission(
        name=permission.name,
        description=permission.description,
        type=permission.type,
        path=permission.path,
        parent_id=permission.parent_id,
        order=permission.order
    )
    db.add(db_permission)
    db.commit()
    db.refresh(db_permission)
    return db_permission

@router.put("/{permission_id}")
@require_auth()
async def update_permission(
    permission_id: int,
    permission_update: PermissionUpdate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    """Update a permission"""
    permission = db.query(Permission).filter(Permission.id == str(permission_id)).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    if permission_update.name:
        permission.name = permission_update.name
    if permission_update.description is not None:
        permission.description = permission_update.description
    if permission_update.type is not None:
        if permission_update.type not in ["ui", "api"]:
            raise HTTPException(status_code=400, detail="Permission type must be either 'ui' or 'api'")
        permission.type = permission_update.type
    if permission_update.path is not None:
        permission.path = permission_update.path
    if permission_update.parent_id is not None:
        permission.parent_id = permission_update.parent_id
    if permission_update.order is not None:
        permission.order = permission_update.order
    
    db.commit()
    db.refresh(permission)
    return permission

@router.get("/",)
@require_auth()
async def get_permissions(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    permissions = db.query(Permission).all()
    return permissions

# @router.get("/{permission_id}", )
# @require_auth()
# async def get_permission(
#     permission_id: UUID,
#     db: Session = Depends(get_db),
#     authorization: Optional[str] = Header(None),
#     current_user: dict = None
# ):
#     permission = db.query(Permission).filter(Permission.id == str(permission_id)).first()
#     if not permission:
#         raise HTTPException(status_code=404, detail="Permission not found")
#     return permission

@router.delete("/{permission_id}")
@require_auth()
async def delete_permission(
    permission_id: int,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    permission = db.query(Permission).filter(Permission.id == str(permission_id)).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    db.delete(permission)
    db.commit()
    return JSONResponse({"message": "Permission deleted successfully"})

# # Role management endpoints
@router.post("/roles")
@require_auth()
async def create_role(
    role: RoleCreate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    # Check if role with this name already exists
    existing_role = db.query(Role).filter(Role.name == role.name).first()
    if existing_role:
        raise HTTPException(status_code=400, detail=f"Role with name '{role.name}' already exists")
    
    # Create new role
    db_role = Role(
        name=role.name,
        description=role.description
    )
    
    # Add permissions if provided
    if role.permission_ids:
        for permission_id in role.permission_ids:
            permission = db.query(Permission).filter(Permission.id == str(permission_id)).first()
            if permission:
                db_role.permissions.append(permission)
    
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

@router.get("/roles", )
@require_auth()
async def get_roles(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    roles = db.query(Role).options(joinedload(Role.permissions)).all()
    return roles

@router.get("/roles/{role_id}", )
@require_auth()
async def get_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    role = db.query(Role).filter(Role.id == str(role_id)).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role

@router.put("/roles/{role_id}", )
@require_auth()
async def update_role(
    role_id: UUID,
    role_update: RoleUpdate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    role = db.query(Role).filter(Role.id == str(role_id)).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role_update.name:
        role.name = role_update.name
    if role_update.description is not None:
        role.description = role_update.description
    
    # Update permissions if provided
    if role_update.permission_ids is not None:
        # Clear existing permissions
        role.permissions = []
        # Add new permissions
        for permission_id in role_update.permission_ids:
            permission = db.query(Permission).filter(Permission.id == str(permission_id)).first()
            if permission:
                role.permissions.append(permission)
    
    db.commit()
    db.refresh(role)
    return role

@router.delete("/roles/{role_id}")
@require_auth()
async def delete_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    role = db.query(Role).filter(Role.id == str(role_id)).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    db.delete(role)
    db.commit()
    return JSONResponse({"message": "Role deleted successfully"})

# # Admin role assignment endpoint
@router.put("/assign/{admin_id}", )
@require_auth()
async def assign_role_to_admin(
    admin_id: int,
    admin_update: AdminUpdate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    admin = db.query(Admin).filter(Admin.id == str(admin_id)).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    if admin_update.role_id:
        role = db.query(Role).filter(Role.id == str(admin_update.role_id)).first()
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        admin.role_id = str(admin_update.role_id)
    else:
        admin.role_id = None
    
    if admin_update.username:
        admin.username = admin_update.username
    
    if admin_update.password:
        admin.password = admin_update.password
    
    db.commit()
    db.refresh(admin)
    return admin

@router.get("/admins")
@require_auth()
async def get_admins(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    try:
        admins = db.query(Admin).options(joinedload(Admin.role)).all()
        return admins
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
