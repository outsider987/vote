from fastapi import APIRouter, Depends, Header, Request, UploadFile, File
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.vote import MemberCreate, MemberUpdate, MemberResponse, GroupCreate, GroupUpdate, GroupResponse
from fastapi.responses import JSONResponse
from app.services.member_service import MemberService
from app.services.group_service import GroupService
from app.utils.case_utils import to_camel_case
from app.services.auth_service import require_auth
from typing import Optional
from io import BytesIO

router = APIRouter(prefix="/members", tags=["members"])
member_service = MemberService()
group_service = GroupService()

# Group routes
@router.post("/groups")
@require_auth(body_model=GroupCreate)
async def create_group(
    request: Request,
    body: Optional[GroupCreate] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    group = group_service.create_group(db, body,current_user.id)
    return JSONResponse({"message": "群組建立成功", "group_id": group.id})

@router.get("/groups")
@require_auth()
async def get_groups(
    request: Request,
    db: Session = Depends(get_db),
    body: dict = None,
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    
    groups = group_service.get_groups(db, current_user.id)
    return to_camel_case(groups)

@router.put("/groups/{group_id}")
@require_auth(body_model=GroupUpdate)
async def update_group(
    request: Request,
    group_id: str,
    body: Optional[GroupUpdate] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    group = group_service.update_group(db, group_id, body)
    return JSONResponse({"message": "群組更新成功"})

@router.delete("/groups/{group_id}")
@require_auth()
async def delete_group(
    request: Request,
    group_id: str,
    db: Session = Depends(get_db),
    body: dict = None,
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    group_service.delete_group(db, group_id)
    return JSONResponse({"message": "群組刪除成功"})

# Member routes
@router.post("")
@require_auth(body_model=MemberCreate)
async def create_member(
    request: Request,
    body: Optional[MemberCreate] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    member = member_service.create_member(db, body)
    return JSONResponse({"message": "成員建立成功", "member_id": member.id})

@router.get("")
@require_auth()
async def get_members(
    request: Request,
    group_id: Optional[str] = None,
    db: Session = Depends(get_db),
    body: dict = None,
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    members = member_service.get_members(db, group_id)
    return to_camel_case(members)

@router.put("/{member_id}")
@require_auth(body_model=MemberUpdate)
async def update_member(
    request: Request,
    member_id: str,
    body: Optional[MemberUpdate] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    member = member_service.update_member(db, member_id, body)
    return JSONResponse({"message": "成員更新成功"})

@router.delete("/{member_id}")
@require_auth()
async def delete_member(
    request: Request,
    member_id: str,
    db: Session = Depends(get_db),
    body: dict = None,
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    member_service.delete_member(db, member_id)
    return JSONResponse({"message": "成員刪除成功"})

# Excel routes
@router.get("/template")
@require_auth()
async def download_template(
    request: Request,
    db: Session = Depends(get_db),
    body: dict = None,
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    """Download Excel template for member list"""
    return member_service.generate_excel_template(db)

@router.post("/upload")
@require_auth()
async def upload_excel(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    body: dict = None,
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    """Upload Excel file and create members"""
    contents = await file.read()
    members = member_service.process_excel_upload(BytesIO(contents), current_user.id)
    created_members = member_service.create_members_bulk(db, members)
    return JSONResponse({"message": f"成功建立 {len(created_members)} 位成員"}) 