from sqlalchemy.orm import Session
from app.models.models import Event
from app.schemas.vote import EventCreate
from app.errors.handlers import VotingError, ErrorCodes
import uuid
import logging

logger = logging.getLogger(__name__)

class EventService:
    @staticmethod
    def create_event(db: Session, event_data: EventCreate) -> Event:
        try:
            event_id = str(uuid.uuid4())
            db_event = Event(
                id=event_id,
                **event_data.model_dump(),
                is_voting_started=False
            )
            db.add(db_event)
            db.commit()
            db.refresh(db_event)
            return db_event
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create event: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to create event",
                error_code="EVENT_CREATION_FAILED",
                details={"error": str(e)}
            )

    @staticmethod
    def toggle_voting(db: Session, event_id: str, start_voting: bool) -> Event:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise VotingError(
                status_code=404,
                message="活動不存在",
                error_code=ErrorCodes.EVENT_NOT_FOUND
            )
        
        event.is_voting_started = start_voting
        db.commit()
        return event

    @staticmethod
    def get_events(db: Session) -> list[Event]:
        try:
            events = db.query(Event).all()
            return events
        except Exception as e:
            logger.error(f"Failed to fetch events: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to fetch events",
                error_code="EVENT_FETCH_FAILED",
                details={"error": str(e)}
            ) 

    @staticmethod
    def delete_event(db: Session, event_id: str) -> None:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise VotingError(
                status_code=404,
                message="活動不存在",
                error_code=ErrorCodes.EVENT_NOT_FOUND
            )
        db.delete(event)
        db.commit()
        return event
    