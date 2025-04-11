from sqlalchemy.orm import Session
from app.models.models import Ticket, Event, Group
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
    @staticmethod
    def get_ticket_by_vote_code(db: Session, vote_code: str) -> Ticket:
        return db.query(Ticket).filter(Ticket.vote_code == vote_code).first()
    
    @staticmethod
    def get_ticket_by_event_id(db: Session, event_id: str) -> Ticket:
        return db.query(Ticket).filter(Ticket.event_id == event_id).all()
    

    @staticmethod
    def get_remaining_tickets(db: Session, event_id: str) -> int:
        try:
            tickets = db.query(Ticket).filter(Ticket.event_id == event_id).filter(Ticket.used == False).all()
            return tickets
        except Exception as e:
            raise VotingError(
                status_code=500,
                message="Failed to get remaining tickets",
                error_code="TICKET_GET_FAILED",
                details={"error": str(e)}
            )

    @staticmethod
    def get_vote_info(db: Session, vote_code: str):
        ticket = db.query(Ticket).filter(Ticket.vote_code == vote_code).first()
        if not ticket:
            raise VotingError(
                status_code=404,
                message="票券不存在",
                error_code=ErrorCodes.TICKET_NOT_FOUND
            )
        
        # Get group members if group_id exists
        event = ticket.event
        group_members = []
        if event and event.group_id:
            group = db.query(Group).filter(Group.id == event.group_id).first()
            if group and group.members:
                group_members = [
                    {"id": member.id, "text": member.name}
                    for member in group.members
                ]

        return {
            "event_id": ticket.event.id,
            "title": ticket.event.title,
            "options": ticket.event.options,
            "votes_per_user": ticket.event.votes_per_user,
            "group_members": group_members,
            "used": ticket.used,
            "event": {
                "id": ticket.event.id,
                "title": ticket.event.title,
                "options": ticket.event.options,
                "votes_per_user": ticket.event.votes_per_user,
                "is_voting_started": ticket.event.is_voting_started,
                "group_id": ticket.event.group_id,
                "group_members": group_members
            }
        }