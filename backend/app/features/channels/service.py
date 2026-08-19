from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.models.channel import Channel
from app.models.unit import Unit
from app.models.disposition import Disposition
from app.schemas.channel import ChannelCreate, ChannelUpdate

class ChannelService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_channels(self, active_only: bool = False) -> List[Channel]:
        query = select(Channel).options(
            selectinload(Channel.units),
            selectinload(Channel.dispositions)
        ).order_by(Channel.name.asc())
        if active_only:
            query = query.where(Channel.is_active.is_(True))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_channel_by_id(self, channel_id: UUID) -> Optional[Channel]:
        query = select(Channel).options(
            selectinload(Channel.units),
            selectinload(Channel.dispositions)
        ).where(Channel.id == channel_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_channel(self, channel_in: ChannelCreate) -> Channel:
        code = channel_in.code
        if not code or not code.strip():
            count_res = await self.db.execute(select(func.count(Channel.id)))
            count = count_res.scalar() or 0
            code = f"CH_{count + 1}"

        units = []
        if channel_in.unit_ids:
            units_res = await self.db.execute(select(Unit).where(Unit.id.in_(channel_in.unit_ids)))
            units = list(units_res.scalars().all())

        dispositions = []
        if channel_in.disposition_ids:
            disp_res = await self.db.execute(select(Disposition).where(Disposition.id.in_(channel_in.disposition_ids)))
            dispositions = list(disp_res.scalars().all())

        channel = Channel(
            name=channel_in.name.strip(),
            code=code.upper().strip(),
            is_active=channel_in.is_active,
            units=units,
            dispositions=dispositions
        )
        self.db.add(channel)
        await self.db.commit()
        return await self.get_channel_by_id(channel.id)

    async def update_channel(self, channel_id: UUID, channel_in: ChannelUpdate) -> Optional[Channel]:
        channel = await self.get_channel_by_id(channel_id)
        if not channel:
            return None

        if channel_in.name is not None:
            channel.name = channel_in.name.strip()
        if channel_in.code is not None and channel_in.code.strip():
            channel.code = channel_in.code.upper().strip()
        if channel_in.is_active is not None:
            channel.is_active = channel_in.is_active

        if channel_in.unit_ids is not None:
            units_res = await self.db.execute(select(Unit).where(Unit.id.in_(channel_in.unit_ids)))
            channel.units = list(units_res.scalars().all())

        if channel_in.disposition_ids is not None:
            disp_res = await self.db.execute(select(Disposition).where(Disposition.id.in_(channel_in.disposition_ids)))
            channel.dispositions = list(disp_res.scalars().all())

        await self.db.commit()
        return await self.get_channel_by_id(channel_id)

    async def toggle_active(self, channel_id: UUID) -> Optional[Channel]:
        channel = await self.get_channel_by_id(channel_id)
        if not channel:
            return None
        channel.is_active = not channel.is_active
        await self.db.commit()
        return await self.get_channel_by_id(channel_id)

    async def delete_channel(self, channel_id: UUID) -> bool:
        channel = await self.get_channel_by_id(channel_id)
        if not channel:
            return False
        await self.db.delete(channel)
        await self.db.commit()
        return True
