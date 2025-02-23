from sqlalchemy import Column, String, Date, Integer, Boolean, JSON, ForeignKey, TIMESTAMP, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
from uuid import uuid4
from datetime import datetime

class Event(Base):
    __tablename__ = "events"
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    event_date = Column(Date, nullable=False)
    member_count = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    options = Column(JSON, nullable=False)
    votes_per_user = Column(Integer, nullable=False)
    show_count = Column(Integer, nullable=False)
    is_voting_started = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    tickets = relationship("Ticket", back_populates="event", cascade="all, delete-orphan")
    votes = relationship("Vote", back_populates="event", cascade="all, delete-orphan")

class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = {'extend_existing': True}

    vote_code = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="tickets")
    votes = relationship("Vote", back_populates="ticket", cascade="all, delete-orphan")

class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    vote_code = Column(String(36), ForeignKey("tickets.vote_code", ondelete="CASCADE"), nullable=False)
    candidate = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    event = relationship("Event", back_populates="votes")
    ticket = relationship("Ticket", back_populates="votes") 