import json
from fastapi import APIRouter, Depends, Header, WebSocket, WebSocketDisconnect, Form
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.vote_service import VoteService
from app.services.ticket_service import TicketService
from fastapi.responses import JSONResponse
from typing import List, Optional
import asyncio
from app.schemas.vote import Vote, ArchivedCreate
from app.errors.handlers import VotingError
from app.services.auth_service import require_auth
from app.models.models import Event

router = APIRouter(prefix="/votes", tags=["votes"])
active_websockets: List[WebSocket] = []
ticket_service = TicketService()
vote_service = VoteService()  # Create single instance at module level


@router.get("/info/{vote_code}")
async def get_vote_info(vote_code: str, db: Session = Depends(get_db)):
    ticket = ticket_service.get_vote_info(db, vote_code)
    return JSONResponse(
        {
            "event_id": ticket.event.id,
            "title": ticket.event.title,
            "options": ticket.event.options,
            "votes_per_user": ticket.event.votes_per_user,
        }
    )


@router.post("")
async def submit_vote(vote: Vote = Form(...), db: Session = Depends(get_db)):

    event = db.query(Event).filter(Event.id == vote.event_id).first()
    if len(vote.candidate) == 0:
        raise VotingError(
            status_code=400,
            message="請至少選擇 1 人",
            error_code="INVALID_VOTE_COUNT",
        )
    # if len(vote.candidate) != event.votes_per_user:
    #     raise VotingError(
    #         status_code=400,
    #         message=f"請選擇 {event.votes_per_user} 人",
    #         error_code="INVALID_VOTE_COUNT",
    #     )
    candidate_list = [json.loads(candidate) for candidate in vote.candidate]

    print(candidate_list)

    vote_service.submit_vote(
        db, vote.vote_code, candidate_list
    )  # Use existing instance

    # Get updated vote counts and broadcast to websocket clients
    # vote_counts = vote_service.get_vote_counts(db, vote.vote_code)
    # for ws in active_websockets:
    #     await ws.send_json(vote_counts)

    return JSONResponse({"message": "投票成功"})


# @router.websocket("/ws/vote-updates")
# async def vote_updates(websocket: WebSocket, db: Session = Depends(get_db)):
#     await websocket.accept()
#     active_websockets.append(websocket)

#     try:
#         while True:
#             vote_counts = vote_service.get_vote_counts(
#                 db, None
#             )  # Use existing instance
#             await websocket.send_json(vote_counts)
#             await asyncio.sleep(2)
#     except WebSocketDisconnect:
#         active_websockets.remove(websocket)


@router.get("/counts/{event_id}")
async def get_event_vote_counts(event_id: str, db: Session = Depends(get_db)):
    vote_counts, event = vote_service.get_vote_counts(db, event_id)
    return {"vote_counts": vote_counts, "event": event}


@router.post("/archive/{event_id}")
@require_auth()
async def archive_vote_result(
    event_id: str,
    vote_result: dict,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    # Get current vote counts

    # remaining_tickets = ticket_service.get_remaining_tickets(db, event_id)
    # if len(remaining_tickets) != 0:
    #     raise VotingError(
    #         status_code=400,
    #         message=f"投票尚未結束,剩餘票數: {len(remaining_tickets)}",
    #         details={"remaining_tickets": [ticket.vote_code for ticket in remaining_tickets]},
    #         error_code="VOTE_NOT_ENDED",
    #     )

    event = db.query(Event).filter(Event.id == event_id).first()
    if len(vote_result["vote_result"]["selected"]) != event.required_count:
        raise VotingError(
            status_code=400,
            message=f"請選擇 {event.required_count } 人",
            error_code="INVALID_VOTE_COUNT",
        )

    if len(vote_result["vote_result"]["backup"]) != event.backup_count:
        raise VotingError(
            status_code=400,
            message=f"請選擇 {event.backup_count} 人",
            error_code="INVALID_VOTE_COUNT",
        )

    # Create archived record
    vote_service.create_archived_record(db, event_id, vote_result)

    return JSONResponse({"message": "投票結果已封存"})


@router.get("/archive/{event_id}")
@require_auth()
async def get_archived_result(
    event_id: str,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    archived_result = vote_service.get_archived_record(db, event_id)
    if not archived_result:
        raise VotingError(
            status_code=404, message="找不到封存記錄", error_code="ARCHIVE_NOT_FOUND"
        )
    return archived_result
