import json
from fastapi import (
    APIRouter,
    Depends,
    Header,
    Request,
    Form,
)
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.vote_service import VoteService
from app.services.ticket_service import TicketService
from fastapi.responses import JSONResponse, StreamingResponse
from typing import List, Optional
import asyncio
from app.schemas.vote import Vote, ArchivedCreate
from app.errors.handlers import VotingError
from app.services.auth_service import require_auth
from app.models.models import Event
import pandas as pd
import io
from urllib.parse import quote

router = APIRouter(prefix="/votes", tags=["votes"])
# active_websockets: List[WebSocket] = []
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
    if not event:
        raise VotingError(
            status_code=404,
            message="找不到對應的投票事件",
            error_code="EVENT_NOT_FOUND",
        )

    if len(vote.candidate) == 0:
        raise VotingError(
            status_code=400,
            message="請至少選擇 1 人",
            error_code="INVALID_VOTE_COUNT",
        )

    try:
        candidate_list = [json.loads(candidate) for candidate in vote.candidate]

        # Extra validation for manually input candidates
        event_options = event.options
        if isinstance(event_options, str):
            event_options = json.loads(event_options)

        valid_numbers = [option.get("number") for option in event_options]

        for candidate in candidate_list:
            candidate_number = candidate.get("number")
            if candidate_number not in valid_numbers:
                raise VotingError(
                    status_code=400,
                    message=f"無效的候選人編號: {candidate_number}",
                    error_code="INVALID_CANDIDATE",
                )

        vote_service.submit_vote(
            db, vote.vote_code, candidate_list
        )  # Use existing instance

        return JSONResponse({"message": "投票成功"})

    except json.JSONDecodeError:
        raise VotingError(
            status_code=400,
            message="無效的候選人數據格式",
            error_code="INVALID_CANDIDATE_FORMAT",
        )


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
    vote_counts, event, total_votes = vote_service.get_vote_counts(db, event_id)
    return {"vote_counts": vote_counts, "event": event, "total_votes": total_votes}


@router.post("/archive/{event_id}")
@require_auth()
async def archive_vote_result(
    request: Request,
    event_id: str,
    vote_result: dict,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    body: dict = None,
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
    request: Request,
    event_id: str,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    body: dict = None,
):
    archived_result = vote_service.get_archived_record(db, event_id)
    if not archived_result:
        raise VotingError(
            status_code=404, message="找不到封存記錄", error_code="ARCHIVE_NOT_FOUND"
        )
    return archived_result


@router.get("/candidates/{event_id}")
async def get_vote_candidates(event_id: str, db: Session = Depends(get_db)):
    votes = vote_service.get_vote_candidates(db, event_id)
    return {"votes": votes}


@router.get("/export/{event_id}")
@require_auth()
async def export_vote_data(
    request: Request,
    event_id: str,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    body: dict = None,
    current_user: dict = None
):
    # Get event details
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise VotingError(
            status_code=404, message="找不到活動", error_code="EVENT_NOT_FOUND"
        )

    if not event.is_archived:
        raise VotingError(
            status_code=400, message="活動尚未封存", error_code="EVENT_NOT_ARCHIVED"
        )

    # Get all tickets and votes for this event
    tickets = ticket_service.get_ticket_by_event_id(db, event_id)
    votes = vote_service.get_vote_candidates(db, event_id)
    vote_counts, _, total_votes = vote_service.get_vote_counts(db, event_id)

    # Create DataFrame for tickets and votes
    tickets_data = []
    used_votes = 0
    map_vote_count = {}
    for ticket in tickets:
        ticket_votes = [v for v in votes if v["vote_code"] == str(ticket.vote_code)]
        candidates = [v["candidate"] for v in ticket_votes]
        used_votes += len(candidates)
        if len(candidates) not in map_vote_count:
            map_vote_count[len(candidates)] = 0
        map_vote_count[len(candidates)] += 1
        tickets_data.append(
            {
                "票券ID": ticket.vote_code,
                "使用狀態": "已使用" if ticket.used else "未使用",
                "使用時間": ticket.created_at if ticket.used else None,
                "投票對象JSON格式": (
                    json.dumps(candidates, ensure_ascii=False) if candidates else None
                ),
            }
        )

    # Create votes data list
    votes_data = []
    for vote in votes:
        votes_data.append(
            {
                "投票ID": vote["vote_id"],
                "票券ID": vote["vote_code"],
                "投票選項JSON格式": json.dumps(vote["candidate"], ensure_ascii=False),
                "候選人編號": vote["candidate"]["number"],
                "候選人姓名": vote["candidate"]["text"],
                "投票時間": vote["created_at"],
            }
        )

    # Create statistics data
    total_tickets = len(tickets)
    used_tickets = sum(1 for t in tickets if t.used)
    unused_tickets = total_tickets - used_tickets
    total_sohuld_be_votes = total_tickets * event.required_count

    statistics_data = [
        {"統計項目": "總票根", "數量": total_tickets},
        {"統計項目": "已使用票根", "數量": used_tickets},
        {"統計項目": "未使用票根", "數量": unused_tickets},
        {
            "統計項目": "使用率",
            "數量": (
                f"{(used_tickets/total_tickets*100):.2f}%"
                if total_tickets > 0
                else "0%"
            ),
        },
        {
            "統計項目": "總投票數",
            "數量": total_sohuld_be_votes,
        },
        {
            "統計項目": "未使用票數",
            "數量": (total_sohuld_be_votes) - used_votes,
            "百分比": f"{(100 - (used_votes/total_sohuld_be_votes*100)):.2f}%",
        },
        {
            "統計項目": "已投票數",
            "數量": used_votes,
            "百分比": f"{(used_votes/total_sohuld_be_votes*100):.2f}%",
        },
        {
            "統計項目": "廢票數",
            "數量": total_sohuld_be_votes - used_votes,
            "百分比": f"{(100 - (used_votes/total_sohuld_be_votes*100)):.2f}%",
        },
        {
            "統計項目": "總投票率",
            "數量": (
                f"{(total_votes/(total_tickets*event.required_count) *100):.2f}%"
                if total_tickets > 0
                else "0%"
            ),
        },
    ]

    # Create vote counts data
    vote_counts_data = [
        {"候選人": vc["candidate"]["text"], "得票數": vc["count"]} for vc in vote_counts
    ]

    # Create Excel file with multiple sheets
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        # Tickets sheet
        df_tickets = pd.DataFrame(tickets_data)
        df_tickets.to_excel(writer, sheet_name="票券資訊", index=False)

        # Votes sheet
        df_votes = pd.DataFrame(votes_data)
        df_votes.to_excel(writer, sheet_name="投票記錄", index=False)

        # Statistics sheet
        df_stats = pd.DataFrame(statistics_data)
        df_stats.to_excel(writer, sheet_name="統計資訊", index=False)
        workbook = writer.book
        worksheet = writer.sheets["統計資訊"]

        style = workbook.add_format(
            {
                "bg_color": "#DA9695",
                "bold": True,
                "font_size": 14,
                "border": 1,
            }
        )
        worksheet.write("A13", "驗證", style)
        worksheet.write("B13", "投幾票", style)
        worksheet.write("C13", "人", style)
        worksheet.write("D13", "票數", style)

        data_start_row = 14
        # Write your data rows
        for i, (key, value) in enumerate(map_vote_count.items()):
            current_row = data_start_row + i
            worksheet.write(f"B{current_row}", key)
            worksheet.write(f"C{current_row}", value)
            worksheet.write(f"D{current_row}", key * value)

        # Calculate the last row with data
        last_data_row = data_start_row + i

        # The sum row will be immediately after the last data row
        sum_row = last_data_row + 1

        # Write formulas for the sum of columns C and D

        worksheet.write_formula(
            f"C{sum_row}", f"=SUM(C{data_start_row}:C{last_data_row})", style
        )
        worksheet.write_formula(
            f"D{sum_row}", f"=SUM(D{data_start_row}:D{last_data_row})", style
        )

        # Vote counts sheet
        df_counts = pd.DataFrame(vote_counts_data)
        df_counts.to_excel(writer, sheet_name="得票統計", index=False)

        # Get workbook and add formats
        workbook = writer.book
        header_format = workbook.add_format(
            {"bold": True, "bg_color": "#D9D9D9", "border": 1}
        )

        # Format each sheet
        for sheet_name in writer.sheets:
            worksheet = writer.sheets[sheet_name]
            # Get the correct DataFrame for the current sheet
            if sheet_name == "票券資訊":
                df = df_tickets
            elif sheet_name == "投票記錄":
                df = df_votes
            elif sheet_name == "統計資訊":
                df = df_stats
            else:  # '得票統計'
                df = df_counts

            # Apply header format
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
            # Set column width
            worksheet.set_column(0, len(df.columns) - 1, 20)

    # Prepare the response
    output.seek(0)
    filename = f"{event.title}_投票資料.xlsx"

    # Encode filename according to RFC 5987
    encoded_filename = quote(filename.encode("utf-8"))

    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Access-Control-Expose-Headers": "Content-Disposition",
    }

    return StreamingResponse(output, headers=headers)
