import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Ticket
from app.services.ticket_service import TicketService
from fastapi.responses import JSONResponse

from app.utils.case_utils import to_camel_case
router = APIRouter(prefix="/tickets", tags=["tickets"])
ticket_service = TicketService()

@router.post("/generate-ticket")
async def generate_ticket(
    event_id: str,
    db: Session = Depends(get_db)
):
    ticket = ticket_service.generate_ticket(db, event_id)
    return JSONResponse({
        "vote_code": ticket.vote_code,
        "message": "票券生成成功"
    })

@router.get("/{vote_code}")
async def get_ticket(
    vote_code: str,
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.vote_code == vote_code).first()
    if ticket:
        ticket_with_event = {
            **to_camel_case(ticket.__dict__),
            "event": to_camel_case(ticket.event.__dict__)
        }
        return ticket_with_event
    return None

@router.get("/event/{event_id}")
async def get_ticket(
    event_id: str,
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.event_id == event_id).first()
    camel_case_ticket = to_camel_case(ticket)
    return camel_case_ticket

@router.get("/event/{event_id}/tickets")
async def get_tickets_by_event_id(
    event_id: str,
    db: Session = Depends(get_db)
):
    tickets = db.query(Ticket).filter(Ticket.event_id == event_id).all()
    camel_case_tickets = to_camel_case(tickets)
    return camel_case_tickets

