from sqlalchemy import (
    Column,
    String,
    Date,
    Integer,
    Boolean,
    JSON,
    ForeignKey,
    TIMESTAMP,
    DateTime,
    Time,
    text,
    Table,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
from uuid import uuid4
from datetime import datetime


# Role-Permission association table
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', String(36), ForeignKey('roles.id', ondelete="CASCADE")),
    Column('permission_id', String(36), ForeignKey('permissions.id', ondelete="CASCADE")),
)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = {"extend_existing": True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    admin_id = Column(Integer, ForeignKey("admins.id", ondelete="CASCADE"), nullable=False)
    event_date = Column(DateTime, nullable=False)
    member_count = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    options = Column(JSON, nullable=False)
    votes_per_user = Column(Integer, nullable=False)
    required_count = Column(Integer, nullable=False)
    backup_count = Column(Integer, nullable=False)
    is_voting_started = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    created_at = Column(
        TIMESTAMP, server_default=func.now() + text("interval '8 hours'")
    )

    tickets = relationship(
        "Ticket", back_populates="event", cascade="all, delete-orphan"
    )
    votes = relationship("Vote", back_populates="event", cascade="all, delete-orphan")
    archived = relationship(
        "Archived", back_populates="event", cascade="all, delete-orphan"
    )


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = {"extend_existing": True}

    vote_code = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    event_id = Column(
        String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="tickets")
    votes = relationship("Vote", back_populates="ticket", cascade="all, delete-orphan")


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = {"extend_existing": True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    event_id = Column(
        String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    vote_code = Column(
        String(36), ForeignKey("tickets.vote_code", ondelete="CASCADE"), nullable=False
    )
    candidate = Column(JSON, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    event = relationship("Event", back_populates="votes")
    ticket = relationship("Ticket", back_populates="votes")


class Permission(Base):
    __tablename__ = "permissions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    type = Column(String(10), nullable=False, default="api")  # 'ui' or 'api'
    path = Column(String(255), nullable=False)  # e.g., "admin/roles"
    parent_id = Column(String(36), ForeignKey("permissions.id"), nullable=True)
    order = Column(Integer, default=0)  # For sorting in tree structure
    
    # Relationships
    parent = relationship("Permission", remote_side=[id], backref="children")
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
          
            "description": self.description,
            "type": self.type,
            "path": self.path,
            "parent_id": self.parent_id,
            "order": self.order,
            "children": [child.to_dict() for child in sorted(self.children, key=lambda x: x.order)]
        }


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = {"extend_existing": True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(255), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relationships
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    admins = relationship("Admin", back_populates="role")


class Admin(Base):
    __tablename__ = "admins"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(255), nullable=False)
    password = Column(String(255), nullable=False)
    role_id = Column(String(36), ForeignKey("roles.id"), nullable=True)
    
    # Relationship
    role = relationship("Role", back_populates="admins")


class Archived(Base):
    __tablename__ = "archived"
    __table_args__ = {"extend_existing": True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    event_id = Column(
        String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    vote_result = Column(JSON, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    event = relationship("Event", back_populates="archived")
