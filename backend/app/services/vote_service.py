import json
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import String, cast, func
from app.models.models import Vote, Ticket, Event, Archived
from app.errors.handlers import VotingError, ErrorCodes
from typing import Any, Dict, List,Tuple
import uuid


class VoteService:
    @staticmethod
    def submit_vote(db: Session, vote_code: str, candidates: List[str]) -> None:
        ticket = db.query(Ticket).filter(Ticket.vote_code == vote_code).first()

        if not ticket:
            raise VotingError(
                status_code=400,
                message="票券無效",
                error_code=ErrorCodes.INVALID_TICKET,
            )

        if ticket.used:
            raise VotingError(
                status_code=400,
                message="票券已使用",
                error_code=ErrorCodes.TICKET_ALREADY_USED,
            )

        event = db.query(Event).filter(Event.id == ticket.event_id).first()
        if not event.is_voting_started:
            raise VotingError(
                status_code=400,
                message="投票尚未開始",
                error_code=ErrorCodes.VOTING_NOT_STARTED,
            )

        if len(candidates) > event.votes_per_user:
            raise VotingError(
                status_code=400,
                message=f"超過每人可投票數 (最多 {event.votes_per_user} 票)",
                error_code=ErrorCodes.INVALID_VOTE_COUNT,
                details={
                    "max_votes": event.votes_per_user,
                    "submitted_votes": len(candidates),
                },
            )

        try:
            ticket.used = True

            for candidate in candidates:
                vote = Vote(
                    id=str(uuid.uuid4()),
                    event_id=ticket.event_id,
                    vote_code=vote_code,
                    candidate=candidate,
                )
                db.add(vote)

            db.commit()
        except Exception as e:
            db.rollback()
            raise VotingError(
                status_code=500,
                message="投票處理失敗",
                error_code="VOTE_PROCESSING_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def get_vote_counts(db: Session, event_id: str) -> Tuple[List[Dict[str, Any]], Event]:
        try:
            # Query vote counts grouped by candidate (stored as JSON strings)
            vote_counts = (
                db.query(cast(Vote.candidate, String), func.count(Vote.id).label("count"))
                .filter(Vote.event_id == event_id)
                .group_by(cast(Vote.candidate, String))
                .all()
            )
            event = db.query(Event).filter(Event.id == event_id).first()

            # Build a mapping from candidate identifier (using candidate number) to vote count
            vote_mapping = {}
            for candidate_str, count in vote_counts:
                try:
                    candidate_data = json.loads(candidate_str)
                    candidate_number = candidate_data.get("number")
                    if candidate_number is not None:
                        vote_mapping[candidate_number] = count
                    else:
                        # Fallback: use the entire candidate string if no number is provided
                        vote_mapping[candidate_str] = count
                except Exception:
                    vote_mapping[candidate_str] = count

            # Ensure event.options is a list (parse it if it's stored as a JSON string)
            options = event.options
            if isinstance(options, str):
                options = json.loads(options)

            # Map each candidate from event.options with its vote count (default to 0 if not found)
            result = []
            for candidate in options:
                candidate_number = candidate.get("number")
                count = vote_mapping.get(candidate_number, 0)
                result.append({
                    "candidate": candidate,
                    "count": count
                })

            return result, event
        except Exception as e:
            raise VotingError(
                status_code=500,
                message="投票計數失敗",
                error_code="VOTE_COUNT_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def create_archived_record(db: Session, event_id: str, vote_result: dict) -> None:
        try:
            # Create archived record
            archived = Archived(
                id=str(uuid.uuid4()),
                event_id=event_id,
                vote_result=vote_result
            )
            db.add(archived)

            # Update event to archived
            event = db.query(Event).filter(Event.id == event_id).first()
            if event:
                event.is_archived = True

            db.commit()
        except Exception as e:
            db.rollback()
            raise VotingError(
                status_code=500,
                message="封存記錄失敗",
                error_code="ARCHIVE_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def get_archived_record(db: Session, event_id: str) -> dict:
        archived = db.query(Archived).filter(Archived.event_id == event_id).first()
        if not archived:
            return None
        return archived.vote_result

    @staticmethod
    def get_vote_candidates(db: Session, event_id: str) -> List[Dict[str, Any]]:
        try:
            votes = (
                db.query(Vote)
                .filter(Vote.event_id == event_id)
                .options(joinedload(Vote.event))
                .options(joinedload(Vote.ticket))
                .order_by(Vote.created_at.desc())
                .all()
            )
            
            result = []
            for vote in votes:
                candidate_data = json.loads(vote.candidate) if isinstance(vote.candidate, str) else vote.candidate
                result.append({
                    "vote_id": vote.id,
                    "vote_code": vote.vote_code,
                    "candidate": candidate_data,
                    "created_at": vote.created_at,
                    "event": {
                        "id": vote.event.id,
                        "title": vote.event.title
                    } if vote.event else None,
                    "ticket": {
                        "vote_code": vote.ticket.vote_code,
                        "used": vote.ticket.used
                    } if vote.ticket else None
                })
            
            return result
        except Exception as e:
            raise VotingError(
                status_code=500,
                message="獲取投票資訊失敗",
                error_code="GET_VOTES_FAILED",
                details={"error": str(e)},
            )

                
