"""Deklarativ asos — faqat Base class.

Engine va session factory db/session.py da joylashgan.
Modellar faqat Base ni import qiladi (engine yo'q) —
shu sabab modellar import vaqtida DB ulanishini talab qilmaydi.
"""
import uuid

from sqlalchemy import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Barcha SQLAlchemy modellari shu klassdan meros oladi.

    Nima uchun UUID primary key?
    Ketma-ket raqamlar (1, 2, 3) orqali URL manipulyatsiyasi orqali
    boshqa foydalanuvchi ma'lumotlariga kirish mumkin.
    UUID (e.g. 550e8400-e29b-41d4-a716-446655440000) bilan bu hujum
    amalda mumkin emas.
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
