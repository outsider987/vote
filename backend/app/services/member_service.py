from sqlalchemy.orm import Session
from app.models.models import Member, Group
from app.schemas.vote import MemberCreate, MemberUpdate
from app.errors.handlers import VotingError, ErrorCodes
import uuid
import logging

logger = logging.getLogger(__name__)

class MemberService:
    @staticmethod
    def create_member(db: Session, member_data: MemberCreate) -> Member:
        try:
            # Check if group exists
            group = db.query(Group).filter(Group.id == member_data.group_id).first()
            if not group:
                raise VotingError(
                    status_code=404,
                    message="群組不存在",
                    error_code=ErrorCodes.GROUP_NOT_FOUND
                )

            # Check if email already exists
            existing_member = db.query(Member).filter(Member.email == member_data.email).first()
            if existing_member:
                raise VotingError(
                    status_code=400,
                    message="此電子郵件已被使用",
                    error_code="EMAIL_ALREADY_EXISTS"
                )

            member_id = str(uuid.uuid4())
            db_member = Member(
                id=member_id,
                **member_data.model_dump()
            )
            db.add(db_member)
            db.commit()
            db.refresh(db_member)
            return db_member
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create member: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to create member",
                error_code="MEMBER_CREATION_FAILED",
                details={"error": str(e)}
            )

    @staticmethod
    def get_members(db: Session, group_id: str = None) -> list[Member]:
        try:
            query = db.query(Member)
            if group_id:
                query = query.filter(Member.group_id == group_id)
            return query.all()
        except Exception as e:
            logger.error(f"Failed to fetch members: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to fetch members",
                error_code="MEMBER_FETCH_FAILED",
                details={"error": str(e)}
            )

    @staticmethod
    def update_member(db: Session, member_id: str, member_data: MemberUpdate) -> Member:
        try:
            member = db.query(Member).filter(Member.id == member_id).first()
            if not member:
                raise VotingError(
                    status_code=404,
                    message="成員不存在",
                    error_code=ErrorCodes.MEMBER_NOT_FOUND
                )

            # If updating email, check if it's already taken
            if member_data.email and member_data.email != member.email:
                existing_member = db.query(Member).filter(Member.email == member_data.email).first()
                if existing_member:
                    raise VotingError(
                        status_code=400,
                        message="此電子郵件已被使用",
                        error_code="EMAIL_ALREADY_EXISTS"
                    )

            # If updating group_id, check if group exists
            if member_data.group_id and member_data.group_id != member.group_id:
                group = db.query(Group).filter(Group.id == member_data.group_id).first()
                if not group:
                    raise VotingError(
                        status_code=404,
                        message="群組不存在",
                        error_code=ErrorCodes.GROUP_NOT_FOUND
                    )

            # Update only provided fields
            for field, value in member_data.model_dump(exclude_unset=True).items():
                setattr(member, field, value)

            db.commit()
            db.refresh(member)
            return member
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update member: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to update member",
                error_code="MEMBER_UPDATE_FAILED",
                details={"error": str(e)}
            )

    @staticmethod
    def delete_member(db: Session, member_id: str) -> None:
        try:
            member = db.query(Member).filter(Member.id == member_id).first()
            if not member:
                raise VotingError(
                    status_code=404,
                    message="成員不存在",
                    error_code=ErrorCodes.MEMBER_NOT_FOUND
                )
            db.delete(member)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete member: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to delete member",
                error_code="MEMBER_DELETE_FAILED",
                details={"error": str(e)}
            ) 