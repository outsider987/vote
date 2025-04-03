from sqlalchemy.orm import Session, joinedload
from app.models.models import Group
from app.schemas.vote import GroupCreate, GroupUpdate
from app.errors.handlers import VotingError, ErrorCodes
import uuid
import logging

logger = logging.getLogger(__name__)

class GroupService:
    @staticmethod
    def create_group(db: Session, group_data: GroupCreate, admin_id: int) -> Group:
        try:
            
            db_group = Group(
                **group_data.model_dump(),
                admin_id=admin_id
            )
            db.add(db_group)
            db.commit()
            db.refresh(db_group)
            return db_group
        except VotingError:
            db.rollback()
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create group: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to create group",
                error_code="GROUP_CREATION_FAILED",
                details={"error": str(e)}
            )

    @staticmethod
    def get_groups(db: Session, current_user: dict) -> list[Group]:
        try:
            if current_user.role == "admin":
                return db.query(Group).options(joinedload(Group.role)).all()
            else:
                return db.query(Group).filter(Group.admin_id == current_user.id).all()
        except VotingError:
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            logger.error(f"Failed to fetch groups: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to fetch groups",
                error_code="GROUP_FETCH_FAILED",
                details={"error": str(e)}
            )

    @staticmethod
    def update_group(db: Session, group_id: str, group_data: GroupUpdate) -> Group:
        try:
            group = db.query(Group).filter(Group.id == group_id).first()
            if not group:
                raise VotingError(
                    status_code=404,
                    message="群組不存在",
                    error_code=ErrorCodes.GROUP_NOT_FOUND
                )

            # Update only provided fields
            for field, value in group_data.model_dump(exclude_unset=True).items():
                setattr(group, field, value)

            db.commit()
            db.refresh(group)
            return group
        except VotingError:
            db.rollback()
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update group: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to update group",
                error_code="GROUP_UPDATE_FAILED",
                details={"error": str(e)}
            )

    @staticmethod
    def delete_group(db: Session, group_id: str) -> None:
        try:
            group = db.query(Group).filter(Group.id == group_id).first()
            if not group:
                raise VotingError(
                    status_code=404,
                    message="群組不存在",
                    error_code=ErrorCodes.GROUP_NOT_FOUND
                )
            db.delete(group)
            db.commit()
        except VotingError:
            db.rollback()
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete group: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to delete group",
                error_code="GROUP_DELETE_FAILED",
                details={"error": str(e)}
            ) 