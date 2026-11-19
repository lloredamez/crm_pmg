from uuid import UUID
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional, List, Tuple, Dict, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc, or_, and_
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.unit import Unit
from app.models.channel import Channel
from app.models.lead import Lead
from app.models.bucket_lead import BucketLead
from app.models.lead_assignment import LeadAssignment
from app.models.sla_breach import SlaBreach
from app.models.lead_event import LeadEvent
from app.models.user_status_log import UserStatusLog
from app.core.business_hours import get_active_holidays_set
from app.features.calendar.service import CalendarService
from app.schemas.logs import (
    CalendarSummary,
    ConsultantActivitySummary,
    ActivityLogItem,
    ActivityLogsResponse,
    TransferLogItem,
    TransferLogsResponse,
    LeadChangeLogItem,
    LeadChangeLogsResponse,
)


class LogsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _get_allowed_unit_ids(self, current_user: User) -> Optional[List[UUID]]:
        if current_user.role == "admin":
            return None
        if current_user.role == "manager":
            managed = current_user.managed_unit_ids or []
            if managed:
                return list(managed)
            return [current_user.unit_id] if current_user.unit_id else []
        if current_user.role == "supervisor":
            return [current_user.unit_id] if current_user.unit_id else []
        return [current_user.unit_id] if current_user.unit_id else []

    async def _get_channel_unit_ids(self, channel_code: Optional[str]) -> Optional[List[UUID]]:
        if not channel_code or channel_code.lower() == "all":
            return None
        res = await self.db.execute(
            select(Channel)
            .options(selectinload(Channel.units))
            .where(func.lower(Channel.code) == func.lower(channel_code.strip()))
        )
        channel = res.scalar_one_or_none()
        if not channel:
            return []
        if not channel.units:
            # Canal sem restrição explícita de unidades participa de todas
            return None
        return [u.id for u in channel.units]

    async def _resolve_date_range(
        self, start_date: Optional[date], end_date: Optional[date]
    ) -> Tuple[date, date, datetime, datetime, object, Set[date]]:
        cal_service = CalendarService(self.db)
        config = await cal_service.get_or_create_config()
        tz = ZoneInfo(config.timezone or "America/Sao_Paulo")
        now_local = datetime.now(tz)

        eff_start = start_date or now_local.date()
        eff_end = end_date or eff_start
        if eff_end < eff_start:
            eff_end = eff_start

        range_start_local = datetime.combine(eff_start, time(0, 0, 0), tzinfo=tz)
        range_end_local = datetime.combine(eff_end, time(23, 59, 59, 999999), tzinfo=tz)

        holiday_dates = await get_active_holidays_set(
            self.db, start_year=eff_start.year - 1, end_year=eff_end.year + 1
        )
        return (
            eff_start,
            eff_end,
            range_start_local.astimezone(timezone.utc),
            range_end_local.astimezone(timezone.utc),
            config,
            holiday_dates,
        )

    def _build_work_windows(
        self,
        eff_start: date,
        eff_end: date,
        config,
        holiday_dates: Set[date],
    ) -> List[Tuple[datetime, datetime]]:
        tz = ZoneInfo(config.timezone or "America/Sao_Paulo")
        work_days = set(config.work_days if isinstance(config.work_days, list) else [0, 1, 2, 3, 4])
        windows: List[Tuple[datetime, datetime]] = []

        cur_day = eff_start
        while cur_day <= eff_end:
            is_weekend = cur_day.weekday() >= 5
            is_holiday = config.pause_on_holidays and (cur_day in holiday_dates)
            is_work_day = (cur_day.weekday() in work_days) and not (config.pause_on_weekends and is_weekend) and not is_holiday

            if is_work_day:
                if config.pause_night_shift and config.work_end_hour > config.work_start_hour:
                    w_start = datetime.combine(cur_day, time(config.work_start_hour, 0), tzinfo=tz)
                    w_end = datetime.combine(cur_day, time(config.work_end_hour, 0), tzinfo=tz)
                else:
                    w_start = datetime.combine(cur_day, time(0, 0), tzinfo=tz)
                    w_end = datetime.combine(cur_day + timedelta(days=1), time(0, 0), tzinfo=tz)
                windows.append((w_start.astimezone(timezone.utc), w_end.astimezone(timezone.utc)))

            cur_day += timedelta(days=1)

        return windows

    @staticmethod
    def _intersect_intervals(
        intervals: List[Tuple[datetime, datetime]],
        windows: List[Tuple[datetime, datetime]],
    ) -> int:
        total_seconds = 0.0
        for a, b in intervals:
            if b <= a:
                continue
            for w_start, w_end in windows:
                start = max(a, w_start)
                end = min(b, w_end)
                if end > start:
                    total_seconds += (end - start).total_seconds()
        return int(round(total_seconds))

    async def get_activity_logs(
        self,
        current_user: User,
        channel_code: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        attendant_id: Optional[UUID] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> ActivityLogsResponse:
        eff_start, eff_end, range_start_utc, range_end_utc, config, holiday_dates = (
            await self._resolve_date_range(start_date, end_date)
        )
        now_utc = datetime.now(timezone.utc)
        effective_end_utc = min(range_end_utc, now_utc)

        allowed_unit_ids = self._get_allowed_unit_ids(current_user)
        channel_unit_ids = await self._get_channel_unit_ids(channel_code)

        # Interseção de unidades permitidas
        effective_unit_ids: Optional[List[UUID]] = None
        if allowed_unit_ids is not None and channel_unit_ids is not None:
            effective_unit_ids = [uid for uid in allowed_unit_ids if uid in set(channel_unit_ids)]
        elif allowed_unit_ids is not None:
            effective_unit_ids = allowed_unit_ids
        elif channel_unit_ids is not None:
            effective_unit_ids = channel_unit_ids

        # Buscar consultores/usuários elegíveis
        user_stmt = select(User).options(selectinload(User.unit)).where(User.is_active.is_(True))
        if effective_unit_ids is not None:
            if not effective_unit_ids:
                return ActivityLogsResponse(
                    calendar_summary=CalendarSummary(
                        work_start_hour=config.work_start_hour,
                        work_end_hour=config.work_end_hour,
                        timezone=config.timezone,
                        work_days=config.work_days or [0, 1, 2, 3, 4],
                    ),
                    consultants=[],
                    events=[],
                    total_events=0,
                )
            user_stmt = user_stmt.where(User.unit_id.in_(effective_unit_ids))

        if attendant_id:
            user_stmt = user_stmt.where(User.id == attendant_id)
        if search and search.strip():
            term = f"%{search.strip()}%"
            user_stmt = user_stmt.where(or_(User.name.ilike(term), User.email.ilike(term)))

        user_stmt = user_stmt.order_by(User.name.asc())
        users_res = await self.db.execute(user_stmt)
        users = list(users_res.scalars().all())

        if not users:
            return ActivityLogsResponse(
                calendar_summary=CalendarSummary(
                    work_start_hour=config.work_start_hour,
                    work_end_hour=config.work_end_hour,
                    timezone=config.timezone,
                    work_days=config.work_days or [0, 1, 2, 3, 4],
                ),
                consultants=[],
                events=[],
                total_events=0,
            )

        user_ids = [u.id for u in users]
        user_map = {u.id: u for u in users}

        # Buscar último status antes de range_start_utc para cada usuário
        prev_subq = (
            select(
                UserStatusLog.user_id,
                UserStatusLog.new_status,
                func.row_number()
                .over(partition_by=UserStatusLog.user_id, order_by=UserStatusLog.changed_at.desc())
                .label("rn"),
            )
            .where(UserStatusLog.user_id.in_(user_ids), UserStatusLog.changed_at < range_start_utc)
            .subquery()
        )
        prev_res = await self.db.execute(
            select(prev_subq.c.user_id, prev_subq.c.new_status).where(prev_subq.c.rn == 1)
        )
        initial_status_map: Dict[UUID, str] = {row[0]: row[1] for row in prev_res.all()}

        # Buscar todos os logs dentro do intervalo para cálculo de jornada
        logs_in_range_res = await self.db.execute(
            select(UserStatusLog)
            .where(
                UserStatusLog.user_id.in_(user_ids),
                UserStatusLog.changed_at >= range_start_utc,
                UserStatusLog.changed_at <= range_end_utc,
            )
            .order_by(UserStatusLog.changed_at.asc())
        )
        all_logs_asc = list(logs_in_range_res.scalars().all())

        logs_by_user: Dict[UUID, List[UserStatusLog]] = {uid: [] for uid in user_ids}
        for lg in all_logs_asc:
            logs_by_user[lg.user_id].append(lg)

        work_windows = self._build_work_windows(eff_start, eff_end, config, holiday_dates)
        expected_work_seconds = int(
            round(sum((w_end - w_start).total_seconds() for w_start, w_end in work_windows))
        )

        consultants_summary: List[ConsultantActivitySummary] = []
        for u in users:
            u_logs = logs_by_user.get(u.id, [])
            cur_status = initial_status_map.get(u.id, "offline")
            online_since: Optional[datetime] = range_start_utc if cur_status == "online" else None
            intervals: List[Tuple[datetime, datetime]] = []

            for lg in u_logs:
                ts = min(lg.changed_at, effective_end_utc)
                if online_since is not None and lg.new_status != "online":
                    if ts > online_since:
                        intervals.append((online_since, ts))
                    online_since = None
                elif online_since is None and lg.new_status == "online":
                    online_since = ts

            if online_since is not None and effective_end_utc > online_since:
                intervals.append((online_since, effective_end_utc))

            online_total_seconds = int(round(sum((b - a).total_seconds() for a, b in intervals)))
            online_work_seconds = self._intersect_intervals(intervals, work_windows)

            consultants_summary.append(
                ConsultantActivitySummary(
                    user_id=u.id,
                    user_name=u.name,
                    role=u.role,
                    current_status=u.status,
                    unit_name=u.unit.name if u.unit else None,
                    online_work_seconds=online_work_seconds,
                    online_total_seconds=online_total_seconds,
                    expected_work_seconds=expected_work_seconds,
                    transitions_count=len(u_logs),
                )
            )

        # Lista paginada em ordem decrescente (mais recentes primeiro)
        total_events = len(all_logs_asc)
        logs_desc = list(reversed(all_logs_asc))
        paged_logs = logs_desc[offset : offset + limit]

        events = [
            ActivityLogItem(
                id=lg.id,
                user_id=lg.user_id,
                user_name=user_map[lg.user_id].name if lg.user_id in user_map else "-",
                unit_name=user_map[lg.user_id].unit.name if (lg.user_id in user_map and user_map[lg.user_id].unit) else None,
                previous_status=lg.previous_status,
                new_status=lg.new_status,
                source=lg.source,
                changed_at=lg.changed_at,
            )
            for lg in paged_logs
        ]

        return ActivityLogsResponse(
            calendar_summary=CalendarSummary(
                work_start_hour=config.work_start_hour,
                work_end_hour=config.work_end_hour,
                timezone=config.timezone,
                work_days=config.work_days or [0, 1, 2, 3, 4],
            ),
            consultants=consultants_summary,
            events=events,
            total_events=total_events,
        )

    async def get_transfer_logs(
        self,
        current_user: User,
        channel_code: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        event_type: Optional[str] = None,
        attendant_id: Optional[UUID] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> TransferLogsResponse:
        _, _, range_start_utc, range_end_utc, _, _ = await self._resolve_date_range(start_date, end_date)
        allowed_unit_ids = self._get_allowed_unit_ids(current_user)

        lead_name_expr = func.coalesce(Lead.name, BucketLead.name, "-")
        lead_phone_expr = func.coalesce(Lead.phone, BucketLead.phone)
        channel_expr = func.coalesce(Lead.channel_code, BucketLead.channel_code)
        unit_id_expr = func.coalesce(Lead.unit_id, BucketLead.unit_id)

        transfer_types = ["assigned", "claimed_from_bucket", "reassigned", "sla_breached"]

        base_filters = [
            LeadEvent.created_at >= range_start_utc,
            LeadEvent.created_at <= range_end_utc,
        ]

        if allowed_unit_ids is not None:
            if not allowed_unit_ids:
                return TransferLogsResponse(
                    items=[],
                    total=0,
                    total_system_assigned=0,
                    total_claimed_from_bucket=0,
                    total_manual_reassigned=0,
                    total_breaches=0,
                )
            base_filters.append(unit_id_expr.in_(allowed_unit_ids))

        if channel_code and channel_code.lower() != "all":
            base_filters.append(func.lower(channel_expr) == func.lower(channel_code.strip()))

        if attendant_id:
            base_filters.append(LeadEvent.attendant_id == attendant_id)

        if search and search.strip():
            term = f"%{search.strip()}%"
            base_filters.append(
                or_(
                    lead_name_expr.ilike(term),
                    lead_phone_expr.ilike(term),
                    LeadEvent.attendant_name.ilike(term),
                    LeadEvent.title.ilike(term),
                    LeadEvent.description.ilike(term),
                )
            )

        # Contadores totais por tipo (antes do filtro de event_type específico)
        stats_stmt = (
            select(
                func.count(LeadEvent.id).filter(LeadEvent.event_type == "assigned"),
                func.count(LeadEvent.id).filter(LeadEvent.event_type == "claimed_from_bucket"),
                func.count(LeadEvent.id).filter(LeadEvent.event_type == "reassigned"),
                func.count(LeadEvent.id).filter(LeadEvent.event_type == "sla_breached"),
            )
            .select_from(LeadEvent)
            .outerjoin(Lead, Lead.id == LeadEvent.lead_id)
            .outerjoin(BucketLead, BucketLead.id == LeadEvent.lead_id)
            .where(LeadEvent.event_type.in_(transfer_types), *base_filters)
        )
        stats_res = await self.db.execute(stats_stmt)
        total_sys, total_claimed, total_reassigned, total_breaches = stats_res.one()

        if event_type and event_type != "all" and event_type in transfer_types:
            target_types = [event_type]
        else:
            target_types = transfer_types

        count_stmt = (
            select(func.count(LeadEvent.id))
            .select_from(LeadEvent)
            .outerjoin(Lead, Lead.id == LeadEvent.lead_id)
            .outerjoin(BucketLead, BucketLead.id == LeadEvent.lead_id)
            .where(LeadEvent.event_type.in_(target_types), *base_filters)
        )
        total = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(
                LeadEvent,
                lead_name_expr.label("lead_name"),
                lead_phone_expr.label("lead_phone"),
                channel_expr.label("channel_code"),
                Unit.name.label("unit_name"),
            )
            .select_from(LeadEvent)
            .outerjoin(Lead, Lead.id == LeadEvent.lead_id)
            .outerjoin(BucketLead, BucketLead.id == LeadEvent.lead_id)
            .outerjoin(Unit, Unit.id == unit_id_expr)
            .where(LeadEvent.event_type.in_(target_types), *base_filters)
            .order_by(LeadEvent.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        rows = (await self.db.execute(stmt)).all()
        items: List[TransferLogItem] = []
        for ev, l_name, l_phone, ch_code, u_name in rows:
            meta = ev.event_metadata if isinstance(ev.event_metadata, dict) else {}
            items.append(
                TransferLogItem(
                    id=ev.id,
                    lead_id=ev.lead_id,
                    lead_name=l_name or "-",
                    lead_phone=l_phone,
                    channel_code=ch_code,
                    unit_name=u_name,
                    event_type=ev.event_type,
                    attendant_id=ev.attendant_id,
                    attendant_name=ev.attendant_name,
                    reassigned_by_name=meta.get("reassigned_by_name"),
                    breach_type=meta.get("breach_type"),
                    title=ev.title,
                    description=ev.description,
                    created_at=ev.created_at,
                )
            )

        return TransferLogsResponse(
            items=items,
            total=total,
            total_system_assigned=total_sys or 0,
            total_claimed_from_bucket=total_claimed or 0,
            total_manual_reassigned=total_reassigned or 0,
            total_breaches=total_breaches or 0,
        )

    async def get_lead_change_logs(
        self,
        current_user: User,
        channel_code: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        event_type: Optional[str] = None,
        attendant_id: Optional[UUID] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> LeadChangeLogsResponse:
        _, _, range_start_utc, range_end_utc, _, _ = await self._resolve_date_range(start_date, end_date)
        allowed_unit_ids = self._get_allowed_unit_ids(current_user)

        lead_name_expr = func.coalesce(Lead.name, BucketLead.name, "-")
        channel_expr = func.coalesce(Lead.channel_code, BucketLead.channel_code)
        unit_id_expr = func.coalesce(Lead.unit_id, BucketLead.unit_id)

        allowed_event_types = ["tabulated", "details_updated", "status_updated"]
        if event_type and event_type != "all" and event_type in allowed_event_types:
            target_types = [event_type]
        else:
            target_types = allowed_event_types

        base_filters = [
            LeadEvent.event_type.in_(target_types),
            LeadEvent.created_at >= range_start_utc,
            LeadEvent.created_at <= range_end_utc,
        ]

        if allowed_unit_ids is not None:
            if not allowed_unit_ids:
                return LeadChangeLogsResponse(items=[], total=0)
            base_filters.append(unit_id_expr.in_(allowed_unit_ids))

        if channel_code and channel_code.lower() != "all":
            base_filters.append(func.lower(channel_expr) == func.lower(channel_code.strip()))

        if attendant_id:
            base_filters.append(LeadEvent.attendant_id == attendant_id)

        if search and search.strip():
            term = f"%{search.strip()}%"
            base_filters.append(
                or_(
                    lead_name_expr.ilike(term),
                    LeadEvent.attendant_name.ilike(term),
                    LeadEvent.title.ilike(term),
                    LeadEvent.description.ilike(term),
                )
            )

        count_stmt = (
            select(func.count(LeadEvent.id))
            .select_from(LeadEvent)
            .outerjoin(Lead, Lead.id == LeadEvent.lead_id)
            .outerjoin(BucketLead, BucketLead.id == LeadEvent.lead_id)
            .where(*base_filters)
        )
        total = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(
                LeadEvent,
                lead_name_expr.label("lead_name"),
                channel_expr.label("channel_code"),
                Unit.name.label("unit_name"),
            )
            .select_from(LeadEvent)
            .outerjoin(Lead, Lead.id == LeadEvent.lead_id)
            .outerjoin(BucketLead, BucketLead.id == LeadEvent.lead_id)
            .outerjoin(Unit, Unit.id == unit_id_expr)
            .where(*base_filters)
            .order_by(LeadEvent.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        rows = (await self.db.execute(stmt)).all()
        items = [
            LeadChangeLogItem(
                id=ev.id,
                lead_id=ev.lead_id,
                lead_name=l_name or "-",
                channel_code=ch_code,
                unit_name=u_name,
                event_type=ev.event_type,
                attendant_id=ev.attendant_id,
                attendant_name=ev.attendant_name,
                title=ev.title,
                description=ev.description,
                event_metadata=ev.event_metadata or {},
                created_at=ev.created_at,
            )
            for ev, l_name, ch_code, u_name in rows
        ]

        return LeadChangeLogsResponse(items=items, total=total)
