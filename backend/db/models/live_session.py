import enum
import uuid
from sqlalchemy import UUID, Enum, ForeignKey, JSON, String, Integer, Boolean  # noqa: F401
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.db.base import Base
from backend.db.mixin.timestamp import TimestampMixin


class GameType(str, enum.Enum):
    lucky_card = "lucky_card"
    blitz = "blitz"
    relay = "relay"
    question_duel = "question_duel"
    territory = "territory"
    pyramid = "pyramid"
    puzzle = "puzzle"
    # Placeholder games (UI-only, disabled):
    detective = "detective"
    racing = "racing"
    tug_of_war = "tug_of_war"
    crossword = "crossword"


class SessionStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    finished = "finished"


class LiveSession(Base, TimestampMixin):
    __tablename__ = "live_sessions"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    game_type: Mapped[GameType] = mapped_column(
        Enum(GameType, name="game_type"), nullable=False
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status"),
        default=SessionStatus.pending, nullable=False
    )
    session_type: Mapped[str] = mapped_column(String(20), nullable=False, default="group_battle")
    # class_ids: UUIDlar ro'yxati (JSON) — bu sessiyaga tegishli sinflar
    class_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    questions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    current_question_index: Mapped[int] = mapped_column(default=0, nullable=False)

    teams: Mapped[list["LiveSessionTeam"]] = relationship(
        "LiveSessionTeam", back_populates="session", lazy="select"
    )
    participants: Mapped[list["LiveSessionParticipant"]] = relationship(
        "LiveSessionParticipant", back_populates="session", lazy="select"
    )


class LiveSessionTeam(Base, TimestampMixin):
    __tablename__ = "live_session_teams"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#3B82F6")
    score: Mapped[int] = mapped_column(default=0, nullable=False)

    session: Mapped["LiveSession"] = relationship("LiveSession", back_populates="teams")
    members: Mapped[list["LiveSessionParticipant"]] = relationship(
        "LiveSessionParticipant", back_populates="team", lazy="select"
    )


class LiveSessionParticipant(Base, TimestampMixin):
    __tablename__ = "live_session_participants"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("live_session_teams.id", ondelete="SET NULL"), nullable=True
    )
    personal_score: Mapped[int] = mapped_column(default=0, nullable=False)
    # XP earned during this session — applied to User.xp only after session ends
    # DB: ALTER TABLE live_session_participants ADD COLUMN xp_earned INTEGER NOT NULL DEFAULT 0;
    xp_earned: Mapped[int] = mapped_column(default=0, nullable=False)
    answers: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_mvp: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    session: Mapped["LiveSession"] = relationship("LiveSession", back_populates="participants")
    team: Mapped["LiveSessionTeam | None"] = relationship("LiveSessionTeam", back_populates="members")
    student: Mapped["User"] = relationship("User", lazy="select")  # type: ignore
