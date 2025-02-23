from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.vote import EventCreate
from fastapi.responses import JSONResponse
from app.services.event_service import EventService
from app.services.ticket_service import TicketService
from app.utils.case_utils import to_camel_case

router = APIRouter(prefix="/events", tags=["events"])
event_service = EventService()
ticket_service = TicketService()


@router.post("")
async def create_event(data: EventCreate, db: Session = Depends(get_db)):
    # Create event
    event = event_service.create_event(db, data)

    # Generate tickets in bulk
    tickets = ticket_service.generate_tickets_bulk(db, event.id, event.member_count)
    ticket_codes = [ticket.vote_code for ticket in tickets]

    return JSONResponse(
        {"event_id": event.id, "message": "活動建立成功", "tickets": ticket_codes}
    )


@router.post("/{event_id}/toggle-voting")
async def toggle_voting(event_id: str, start_voting: bool, db: Session = Depends(get_db)):
    event = event_service.toggle_voting(db, event_id, start_voting)
    status = "開始" if start_voting else "停止"
    return JSONResponse({"message": f"投票已{status}"})


@router.get("")
async def get_events(db: Session = Depends(get_db)):
    events = event_service.get_events(db)
    camel_case_events = to_camel_case(events)
    return camel_case_events


@router.delete("/{event_id}")
async def delete_event(event_id: str, db: Session = Depends(get_db)):
    event_service.delete_event(db, event_id)
    return JSONResponse({"message": "活動刪除成功"})
