from sqlalchemy.orm import Session
from app.models.models import Ticket, Event
from app.errors.handlers import VotingError, ErrorCodes
import uuid

class TicketService:
    @staticmethod
    def generate_ticket(db: Session, event_id: str) -> Ticket:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise VotingError(
                status_code=404,
                message="活動不存在",
                error_code=ErrorCodes.EVENT_NOT_FOUND
            )
        
        try:
            vote_code = str(uuid.uuid4())
            db_ticket = Ticket(vote_code=vote_code, event_id=event_id)
            db.add(db_ticket)
            db.commit()
            db.refresh(db_ticket)
            return db_ticket
        except Exception as e:
            db.rollback()
            raise VotingError(
                status_code=500,
                message="Failed to generate ticket",
                error_code="TICKET_GENERATION_FAILED",
                details={"error": str(e)}
            )

    @staticmethod
    def generate_tickets_bulk(db: Session, event_id: str, count: int) -> list[Ticket]:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise VotingError(
                status_code=404,
                message="活動不存在",
                error_code=ErrorCodes.EVENT_NOT_FOUND
            )
        
        try:
            tickets = []
            for _ in range(count):
                vote_code = str(uuid.uuid4())
                tickets.append(Ticket(vote_code=vote_code, event_id=event_id))
            
            db.bulk_save_objects(tickets)
            db.commit()
            return tickets
        except Exception as e:
            db.rollback()
            raise VotingError(
                status_code=500,
                message="Failed to generate tickets",
                error_code="TICKET_GENERATION_FAILED",
                details={"error": str(e)}
            ) 