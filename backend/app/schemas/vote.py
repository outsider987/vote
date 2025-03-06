from typing import List
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID

class EventBase(BaseModel):
    event_date: datetime
    member_count: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=255)
    options: List[dict[str, str | int]] = Field(default_factory=list)
    votes_per_user: int = Field(gt=0)
    required_count: int = Field(gt=0)
    backup_count: int = Field(gt=0)

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    title: str | None = None
    options: List[dict[str, str | int]] | None = None
    required_count: int | None = None
    backup_count: int | None = None
    votes_per_user: int | None = None

class EventResponse(EventBase):
    id: UUID
    is_archived: bool = False
    is_voting_started: bool = False
    start_time: datetime | None = None
    end_time: datetime | None = None

    class Config:
        from_attributes = True

class TicketCreate(BaseModel):
    event_id: UUID

class TicketResponse(BaseModel):
    vote_code: UUID
    event_id: UUID
    used: bool = False

    class Config:
        from_attributes = True

class VoteCreate(BaseModel):
    vote_code: UUID
    candidate: List[str]

class VoteResponse(BaseModel):
    id: UUID
    event_id: UUID
    vote_code: UUID
    candidate: str

    class Config:
        from_attributes = True

class VoteCount(BaseModel):
    candidate: str
    count: int

class VoteInfo(BaseModel):
    event_id: UUID
    title: str
    options: List[str]
    votes_per_user: int 
    
class Vote(BaseModel):
    candidate: List[str]
    vote_code: str

class ArchivedCreate(BaseModel):
    event_id: UUID
    vote_result: dict

class ArchivedResponse(BaseModel):
    id: UUID
    event_id: UUID
    vote_result: dict
    created_at: datetime

    class Config:
        from_attributes = True