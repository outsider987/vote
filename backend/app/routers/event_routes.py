from fastapi import APIRouter, Depends, Header, Request, UploadFile, File
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.vote import EventCreate, EventUpdate
from fastapi.responses import JSONResponse
from app.services.event_service import EventService
from app.services.ticket_service import TicketService
from app.utils.case_utils import to_camel_case
from app.services.auth_service import require_auth
from app.models.models import Event
from typing import Optional
from io import BytesIO

router = APIRouter(prefix="/events", tags=["events"])
event_service = EventService()
ticket_service = TicketService()


@router.post("")
@require_auth(body_model=EventCreate)
async def create_event(
    request: Request,
    body: Optional[EventCreate] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    # Create event
    event = event_service.create_event(db, body, current_user)

    # Generate tickets in bulk
    tickets = ticket_service.generate_tickets_bulk(db, event.id, event.member_count)
    ticket_codes = [ticket.vote_code for ticket in tickets]

    return JSONResponse(
        {"event_id": event.id, "message": "活動建立成功", "tickets": ticket_codes}
    )


@router.post("/{event_id}/toggle-voting")
@require_auth()
async def toggle_voting(
    request: Request,
    event_id: str, 
    start_voting: bool, 
    db: Session = Depends(get_db),
    body: dict = None,
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    event = event_service.toggle_voting(db, event_id, start_voting)
    status = "開始" if start_voting else "停止"
    return JSONResponse({"message": f"投票已{status}"})


@router.get("")
@require_auth()
async def get_events(
    request: Request,
    db: Session = Depends(get_db),
    body: dict = None,
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    if(current_user.role.name == 'admin'):
        events = db.query(Event).all()
    else:
        events = db.query(Event).filter(Event.admin_id == current_user.id).all()
    camel_case_events = to_camel_case(events)
    return camel_case_events


@router.delete("/{event_id}")
@require_auth()
async def delete_event(
    request: Request,   
    event_id: str, 
    db: Session = Depends(get_db),
    body: dict = None,
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    event_service.delete_event(db, event_id)
    return JSONResponse({"message": "活動刪除成功"})


@router.get("/template")
# @require_auth()
async def download_template(
    # authorization: Optional[str] = Header(None)
):
    """Download Excel template for event creation"""
    return event_service.generate_excel_template()


@router.post("/upload")
@require_auth()
async def upload_excel(
    request: Request,
    body: dict = None,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    """Upload Excel file and return processed options"""
    contents = await file.read()
    options = event_service.process_excel_upload(BytesIO(contents))
    return JSONResponse({"options": options})


@router.put("/{event_id}")
@require_auth(body_model=EventUpdate)
async def update_event(
    request: Request,
    event_id: str,
    body: Optional[EventUpdate] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    current_user: dict = None
):
    """Update an existing event"""
    event = event_service.update_event(db, event_id, body.model_dump(exclude_unset=True))
    return JSONResponse({"message": "活動更新成功"})
