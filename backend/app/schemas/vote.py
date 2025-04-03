from typing import List, Optional
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
    group_id: Optional[int] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: str | None = None
    options: List[dict[str, str | int]] | None = None
    required_count: int | None = None
    backup_count: int | None = None
    votes_per_user: int | None = None
    group_id: int | None = None


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
    event_id: str


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


# Permission Schemas
class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str = "api"  # 'ui' or 'api'


class PermissionCreate(PermissionBase):
    pass


class PermissionTreeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str
    path: str
    parent_id: Optional[int | str] = None
    order: Optional[int] = 0


class PermissionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    path: Optional[str] = None
    parent_id: Optional[str] = None
    order: Optional[int] = None


class PermissionResponse(PermissionBase):
    id: UUID

    class Config:
        from_attributes = True


class PermissionTreeResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    type: str
    path: str
    parent_id: Optional[str] = None
    order: int
    children: Optional[List["PermissionTreeResponse"]] = None

    class Config:
        from_attributes = True


# Role Schemas
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None


class RoleCreate(RoleBase):
    permission_ids: List[int] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[int]] = None


class RoleResponse(RoleBase):
    id: int
    permissions: List[PermissionResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# Admin Schema Updates
class AdminBase(BaseModel):
    username: str


class AdminCreate(AdminBase):
    password: str
    role_id: Optional[UUID] = None


class AdminUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role_id: Optional[UUID] = None


class AdminResponse(AdminBase):
    id: UUID
    role: Optional[RoleResponse] = None

    class Config:
        from_attributes = True


# Group Schemas
class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class GroupResponse(GroupBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Member Schemas
class MemberBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    group_id: int


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    group_id: Optional[int] = None


class MemberResponse(MemberBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
