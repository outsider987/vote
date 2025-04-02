from sqlalchemy.orm import Session, joinedload
from app.models.models import Event
from app.schemas.vote import EventCreate
from app.errors.handlers import VotingError, ErrorCodes
import uuid
import logging
from datetime import datetime, timedelta
import pandas as pd
from io import BytesIO
from fastapi.responses import StreamingResponse
from app.models.models import Admin

logger = logging.getLogger(__name__)


class EventService:
    @staticmethod
    def create_event(
        db: Session, event_data: EventCreate, current_user: Admin
    ) -> Event:
        try:
            event_id = str(uuid.uuid4())
            db_event = Event(
                id=event_id,
                **event_data.model_dump(),
                is_voting_started=False,
                admin_id=current_user.id,
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
                details={"error": str(e)},
            )

    @staticmethod
    def toggle_voting(db: Session, event_id: str, start_voting: bool) -> Event:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise VotingError(
                status_code=404,
                message="活動不存在",
                error_code=ErrorCodes.EVENT_NOT_FOUND,
            )

        event.is_voting_started = start_voting
        if start_voting:
            event.start_time = datetime.now().time()
            event.end_time = None
        else:
            event.end_time = (datetime.now() + timedelta(minutes=30)).time()
        db.commit()
        return event

    @staticmethod
    def get_events(
        db: Session,
        page: int = 1,
        page_size: int = 10,
        title: str = None,
        status: str = None,
        group_id: str = None,
        current_user: Admin = None,
    ) -> tuple[list[Event], int]:
        try:
            # Start with a base query
            query = db.query(Event)

            # Apply user filter (admin sees all, others see only their events)
            if current_user.role != "admin":
                query = query.filter(Event.admin_id == current_user.id)

            # Apply title filter if provided
            if title:
                query = query.filter(Event.title.ilike(f"%{title}%"))

            # Apply status filter if provided
            if status:
                if status == "active":
                    query = query.filter(Event.is_voting_started == True)
                elif status == "inactive":
                    query = query.filter(Event.is_voting_started == False)
                elif status == "archived":
                    query = query.filter(Event.is_archived == True)

            # Apply group filter if provided
            if group_id:
                query = query.filter(Event.group_id == group_id)

            # Get total count before pagination
            total = query.count()

            # Apply pagination
            events = (
                query.options(joinedload(Event.group))
                .order_by(Event.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
                .all()
            )

            return events, total
        except Exception as e:
            logger.error(f"Failed to fetch events: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to fetch events",
                error_code="EVENT_FETCH_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def delete_event(db: Session, event_id: str) -> None:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise VotingError(
                status_code=404,
                message="活動不存在",
                error_code=ErrorCodes.EVENT_NOT_FOUND,
            )
        db.delete(event)
        db.commit()
        return event

    @staticmethod
    def generate_excel_template() -> StreamingResponse:
        """Generate an Excel template for event creation"""
        try:
            # Create sample data
            sample_data = {
                "number": [1, 2, 3],
                "text": ["候選人1", "候選人2", "候選人3"],
            }
            df = pd.DataFrame(sample_data)

            # Create Excel writer object
            output = BytesIO()
            with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
                df.to_excel(writer, sheet_name="候選人名單", index=False)
                worksheet = writer.sheets["候選人名單"]

                # Add some formatting
                worksheet.set_column("A:A", 15)  # Width of number column
                worksheet.set_column("B:B", 30)  # Width of text column

                # Add instructions
                worksheet.write(0, 3, "填寫說明:")
                worksheet.write(1, 3, "1. number: 候選人編號(必填)")
                worksheet.write(2, 3, "2. text: 候選人姓名(必填)")
                worksheet.write(3, 3, "3. 請勿修改欄位名稱")

            output.seek(0)

            # Return the Excel file
            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": "attachment; filename=vote_template.xlsx"
                },
            )
        except Exception as e:
            logger.error(f"Failed to generate Excel template: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to generate Excel template",
                error_code="TEMPLATE_GENERATION_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def process_excel_upload(file: BytesIO) -> list[dict]:
        """Process uploaded Excel file and return options list"""
        try:
            df = pd.read_excel(file)
            required_columns = ["number", "text"]

            # Validate columns
            if not all(col in df.columns for col in required_columns):
                raise ValueError("Excel file must contain 'number' and 'text' columns")

            # Convert to list of dictionaries
            options = df[["number", "text"]].to_dict("records")

            # Validate data
            for option in options:
                if not isinstance(option["number"], (int, float)) or not isinstance(
                    option["text"], str
                ):
                    raise ValueError("Invalid data format in Excel file")
                if not option["text"].strip():
                    raise ValueError("Empty candidate name found")

            return options
        except Exception as e:
            logger.error(f"Failed to process Excel file: {str(e)}")
            raise VotingError(
                status_code=400,
                message="Failed to process Excel file",
                error_code="EXCEL_PROCESSING_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def update_event(db: Session, event_id: str, event_data: dict) -> Event:
        """Update an existing event"""
        try:
            event = db.query(Event).filter(Event.id == event_id).first()
            if not event:
                raise VotingError(
                    status_code=404,
                    message="活動不存在",
                    error_code=ErrorCodes.EVENT_NOT_FOUND,
                )

            if event.is_voting_started:
                raise VotingError(
                    status_code=400,
                    message="投票已開始，無法修改活動",
                    error_code="VOTING_STARTED",
                )

            # Update only provided fields
            for field, value in event_data.items():
                if value is not None:
                    setattr(event, field, value)

            db.commit()
            db.refresh(event)
            return event
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update event: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to update event",
                error_code="EVENT_UPDATE_FAILED",
                details={"error": str(e)},
            )
