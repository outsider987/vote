from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Form
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.vote_service import VoteService
from app.services.ticket_service import TicketService
from fastapi.responses import JSONResponse
from typing import List
import asyncio

router = APIRouter(prefix="/votes", tags=["votes"])
active_websockets: List[WebSocket] = []
ticket_service = TicketService()
vote_service = VoteService()  # Create single instance at module level

@router.post("/generate-ticket")
async def generate_ticket(
    event_id: str,
    db: Session = Depends(get_db)
):
  
    ticket = ticket_service.generate_ticket(db, event_id)
    return JSONResponse({"vote_code": ticket.vote_code})

@router.get("/info/{vote_code}")
async def get_vote_info(
    vote_code: str,
    db: Session = Depends(get_db)
):
    ticket = ticket_service.get_vote_info(db, vote_code)
    return JSONResponse({
        "event_id": ticket.event.id,
        "title": ticket.event.title,
        "options": ticket.event.options,
        "votes_per_user": ticket.event.votes_per_user
    })

@router.post("")
async def submit_vote(
    vote_code: str = Form(...),
    candidate_ids: str = Form(...),
    db: Session = Depends(get_db)
):
    candidate_list = [cid.strip() for cid in candidate_ids.split(',')]
    vote_service.submit_vote(db, vote_code, candidate_list)  # Use existing instance
    
    # Get updated vote counts and broadcast to websocket clients
    vote_counts = vote_service.get_vote_counts(db, vote_code)
    for ws in active_websockets:
        await ws.send_json(vote_counts)
        
    return JSONResponse({"message": "投票成功"})

@router.websocket("/ws/updates")
async def vote_updates(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    await websocket.accept()
    active_websockets.append(websocket)
    
    try:
        while True:
            vote_counts = vote_service.get_vote_counts(db, None)  # Use existing instance
            await websocket.send_json(vote_counts)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        active_websockets.remove(websocket) 