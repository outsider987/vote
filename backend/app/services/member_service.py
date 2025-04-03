from sqlalchemy.orm import Session
from app.models.models import Member, Group
from app.schemas.vote import MemberCreate, MemberUpdate
from app.errors.handlers import VotingError, ErrorCodes
import uuid
import logging
import pandas as pd
from io import BytesIO
from fastapi.responses import StreamingResponse
from typing import List, Optional

logger = logging.getLogger(__name__)


class MemberService:
    @staticmethod
    def create_member(
        db: Session, member_data: MemberCreate, admin_id: int = None
    ) -> Member:
        try:
            # Check if group exists and belongs to the admin
            group = db.query(Group).filter(Group.id == member_data.group_id).first()
            if not group:
                raise VotingError(
                    status_code=404,
                    message="群組不存在",
                    error_code=ErrorCodes.GROUP_NOT_FOUND,
                )

            # If admin_id is provided, verify the group belongs to the admin
            if admin_id and group.admin_id != admin_id:
                raise VotingError(
                    status_code=403,
                    message="無權限操作此群組",
                    error_code="PERMISSION_DENIED",
                )

            # Check if email already exists
            existing_member = (
                db.query(Member)
                .filter(
                    (Member.email == member_data.email)
                    & (Member.group_id == member_data.group_id)
                )
                .first()
            )
            if existing_member:
                raise VotingError(
                    status_code=400,
                    message="此電子郵件已被使用",
                    error_code=ErrorCodes.EMAIL_ALREADY_EXISTS,
                )

            db_member = Member(**member_data.model_dump())
            db.add(db_member)
            db.commit()
            db.refresh(db_member)
            return db_member
        except VotingError:
            db.rollback()
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create member: {str(e)}")
            # Create a new VotingError
            raise VotingError(
                status_code=500,
                message="Failed to create member",
                error_code="MEMBER_CREATION_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def get_members(
        db: Session, group_id: str = None, current_user: dict = None
    ) -> list[Member]:
        try:
            if current_user.id:
                # Get groups belonging to this admin
                if current_user.role == "admin":
                    admin_groups = db.query(Group).all()
                else:
                    admin_groups = (
                        db.query(Group).filter(Group.admin_id == current_user.id).all()
                    )
                admin_group_ids = [group.id for group in admin_groups]

                query = db.query(Member).filter(Member.group_id.in_(admin_group_ids))
                if group_id:
                    # If group_id is also specified, make sure it belongs to the admin
                    if int(group_id) in admin_group_ids:
                        query = query.filter(Member.group_id == group_id)
                    else:
                        # Return empty list if the group doesn't belong to admin
                        return []
            else:
                # No admin_id specified, filter by group_id if provided
                query = db.query(Member)
                if group_id:
                    query = query.filter(Member.group_id == group_id)

            return query.all()
        except VotingError:
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            logger.error(f"Failed to fetch members: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to fetch members",
                error_code="MEMBER_FETCH_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def update_member(db: Session, member_id: str, member_data: MemberUpdate) -> Member:
        try:
            member = db.query(Member).filter(Member.id == member_id).first()
            if not member:
                raise VotingError(
                    status_code=404,
                    message="成員不存在",
                    error_code=ErrorCodes.MEMBER_NOT_FOUND,
                )

            # If updating email, check if it's already taken
            if member_data.email and member_data.email != member.email:
                existing_member = (
                    db.query(Member)
                    .filter(
                        (Member.email == member_data.email)
                        & (Member.group_id == member.group_id)
                    )
                    .first()
                )
                if existing_member:
                    raise VotingError(
                        status_code=400,
                        message="此電子郵件已被使用",
                        error_code=ErrorCodes.EMAIL_ALREADY_EXISTS,
                    )

            # If updating group_id, check if group exists
            if member_data.group_id and member_data.group_id != member.group_id:
                group = db.query(Group).filter(Group.id == member_data.group_id).first()
                if not group:
                    raise VotingError(
                        status_code=404,
                        message="群組不存在",
                        error_code=ErrorCodes.GROUP_NOT_FOUND,
                    )

            # Update only provided fields
            for field, value in member_data.model_dump(exclude_unset=True).items():
                setattr(member, field, value)

            db.commit()
            db.refresh(member)
            return member
        except VotingError:
            db.rollback()
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update member: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to update member",
                error_code="MEMBER_UPDATE_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def delete_member(db: Session, member_id: str) -> None:
        try:
            member = db.query(Member).filter(Member.id == member_id).first()
            if not member:
                raise VotingError(
                    status_code=404,
                    message="成員不存在",
                    error_code=ErrorCodes.MEMBER_NOT_FOUND,
                )
            db.delete(member)
            db.commit()
        except VotingError:
            db.rollback()
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete member: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to delete member",
                error_code="MEMBER_DELETE_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def generate_excel_template(db: Session) -> StreamingResponse:
        """Generate an Excel template for member list"""
        try:
            # Create sample data
            sample_data = {
                "name": ["張三", "李四"],
                "email": ["zhangsan@example.com", "lisi@example.com"],
                "phone": ["0912345678", "0923456789"],
                "group_id": ["1", "1"],
            }
            df = pd.DataFrame(sample_data)

            # Create Excel writer object
            output = BytesIO()
            with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
                df.to_excel(writer, sheet_name="成員名單", index=False)
                worksheet = writer.sheets["成員名單"]

                # Add column widths
                worksheet.set_column("A:A", 15)  # name
                worksheet.set_column("B:B", 30)  # email
                worksheet.set_column("C:C", 15)  # phone
                worksheet.set_column("D:D", 10)  # group_id

                # Add instructions
                worksheet.write(0, 4, "填寫說明:")
                worksheet.write(1, 4, "1. name: 成員姓名(必填)")
                worksheet.write(2, 4, "2. email: 電子郵件(必填)")
                worksheet.write(3, 4, "3. phone: 電話(選填)")
                worksheet.write(4, 4, "4. group_id: 群組ID(必填)")
                worksheet.write(5, 4, "5. 請勿修改欄位名稱")

                # Group ID
                group_query = db.query(Group).all()
                group_list = [group.id for group in group_query]
                worksheet.write(0, 6, "群組ID列表:")
                for i, group_id in enumerate(group_list):
                    worksheet.write(i + 1, 6, group_id)

            output.seek(0)

            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": "attachment; filename=member_template.xlsx"
                },
            )
        except VotingError:
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            logger.error(f"Failed to generate Excel template: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to generate Excel template",
                error_code="TEMPLATE_GENERATION_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def process_excel_upload(file: BytesIO, admin_id: int) -> List[dict]:
        """Process uploaded Excel file and return member list"""
        try:
            df = pd.read_excel(file)
            required_columns = ["name", "email", "group_id"]

            # Validate columns
            if not all(col in df.columns for col in required_columns):
                raise ValueError(
                    "Excel file must contain 'name', 'email', and 'group_id' columns"
                )

            # Convert to list of dictionaries
            members = df.to_dict("records")

            # Validate data
            for member in members:
                if not isinstance(member["name"], str) or not member["name"].strip():
                    raise ValueError("Invalid or empty name found")
                if not isinstance(member["email"], str) or not member["email"].strip():
                    raise ValueError("Invalid or empty email found")
                if not isinstance(member["group_id"], (int, float)):
                    raise ValueError("Invalid group_id format")

            return members
        except VotingError:
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            logger.error(f"Failed to process Excel file: {str(e)}")
            raise VotingError(
                status_code=400,
                message="Failed to process Excel file",
                error_code="EXCEL_PROCESSING_FAILED",
                details={"error": str(e)},
            )

    @staticmethod
    def create_members_bulk(
        db: Session, members: List[dict], admin_id: int = None
    ) -> List[Member]:
        """Create multiple members in bulk"""
        try:
            # If admin_id is provided, get all groups belonging to this admin
            admin_group_ids = []
            member_emails = []
            if admin_id:
                admin_groups = db.query(Group).filter(Group.admin_id == admin_id).all()
                admin_group_ids = [group.id for group in admin_groups]
            for member in members:
                member_emails.append(member["email"])
            query_members = (
                db.query(Member)
                .filter(
                    Member.group_id.in_(admin_group_ids)
                    & Member.email.in_(member_emails)
                )
                .all()
            )
            if query_members:
                raise VotingError(
                    status_code=400,
                    message="群組中已有成員",
                    error_code="GROUP_ALREADY_HAS_MEMBERS",
                )

            db_members = []
            for member_data in members:
                # Verify the group belongs to the admin if admin_id is provided
                if admin_id and int(member_data["group_id"]) not in admin_group_ids:
                    raise VotingError(
                        status_code=403,
                        message=f"群組 {member_data['group_id']} 不屬於此管理員",
                        error_code="PERMISSION_DENIED",
                    )

                member = Member(
                    name=member_data["name"],
                    email=member_data["email"],
                    phone=member_data.get("phone"),
                    group_id=member_data["group_id"],
                )
                db.add(member)
                db_members.append(member)
            db.commit()
            for member in db_members:
                db.refresh(member)
            return db_members
        except VotingError:
            db.rollback()
            # Re-raise VotingError without catching it
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create members in bulk: {str(e)}")
            raise VotingError(
                status_code=500,
                message="Failed to create members",
                error_code="MEMBER_CREATION_FAILED",
                details={"error": str(e)},
            )
