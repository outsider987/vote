import json
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import String, cast, func
from app.models.models import Vote, Ticket, Event, Archived
from app.errors.handlers import VotingError, ErrorCodes
from typing import Any, Dict, List,Tuple
import uuid
from collections import defaultdict


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

        # Validate candidates - handle both event options and group members
        event_options = event.options
        if isinstance(event_options, str):
            event_options = json.loads(event_options)
            
        valid_numbers = [option.get("number") for option in event_options]
        
        for candidate in candidates:
            # Check if this is a group member candidate (has id) or event option candidate (has number)
            if "id" in candidate:
                # Group member validation could be added here if needed
                continue
            else:
                candidate_number = candidate.get("number")
                if candidate_number is None or candidate_number not in valid_numbers:
                    raise VotingError(
                        status_code=400,
                        message=f"無效的候選人編號: {candidate_number}",
                        error_code="INVALID_CANDIDATE",
                        details={
                            "invalid_candidate": candidate,
                            "valid_numbers": valid_numbers,
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
            # 1) Query all votes for the event
            all_votes = db.query(Vote).filter(Vote.event_id == event_id).all()
            
            # 2) Fetch the event itself
            event = db.query(Event).filter(Event.id == event_id).first()
            if not event:
                raise VotingError(
                    status_code=404,
                    message="找不到對應的投票事件",
                    error_code="EVENT_NOT_FOUND"
                )

            # 3) Build a mapping from candidate number -> aggregated vote count
            vote_mapping = defaultdict(int)

            for vote in all_votes:
                # If vote.candidate is already a dict, no need to json.loads()
                if isinstance(vote.candidate, str):
                    candidate_data = json.loads(vote.candidate)
                else:
                    candidate_data = vote.candidate
                
                candidate_number = candidate_data.get("number")
                if candidate_number is not None:
                    vote_mapping[candidate_number] += 1

            # 4) Parse event.options if it's stored as JSON text
            options = event.options
            if isinstance(options, str):
                options = json.loads(options)

            # 5) Build the result list, preserving the order in event.options
            result = []
            for candidate in options:
                number = candidate.get("number")
                count = vote_mapping.get(number, 0)  # default to 0 if no votes
                result.append({
                    "candidate": candidate,
                    "count": count
                })
                
            total_votes = sum(vote["count"] for vote in result)

            return result, event, total_votes

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

                
