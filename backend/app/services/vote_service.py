from sqlalchemy.orm import Session
from sqlalchemy import String, cast, func
from app.models.models import Vote, Ticket, Event
from app.errors.handlers import VotingError, ErrorCodes
from typing import Dict, List
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
    def get_vote_counts(db: Session, event_id: str) -> Dict[str, int]:
        try:
            vote_counts = (
                db.query(cast(Vote.candidate, String), func.count(Vote.id).label("count"))
                .filter(Vote.event_id == event_id)
                .group_by(cast(Vote.candidate, String))
                .all()
            )

            return {v[0]: v[1] for v in vote_counts}  # Ensure JSON is stringified
        except Exception as e:
            raise VotingError(
                status_code=500,
                message="投票計數失敗",
                error_code="VOTE_COUNT_FAILED",
                details={"error": str(e)},
            )
                
