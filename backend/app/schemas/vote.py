from typing import List
from datetime import date
from pydantic import BaseModel, Field
from uuid import UUID

class EventBase(BaseModel):
    event_date: date
    member_count: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=255)
    options: List[str]
    votes_per_user: int = Field(gt=0)
    show_count: int = Field(gt=0)

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: UUID

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
    candidate_ids: List[str]

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