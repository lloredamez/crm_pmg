import logging
from uuid import UUID
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional, List, Tuple
from sqlalchemy import select, and_, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar import CalendarConfig, Holiday
from app.schemas.calendar import (
    CalendarConfigUpdate,
    HolidayCreate,
    HolidayUpdate,
    CalendarStatusResponse
)

logger = logging.getLogger(__name__)

# Feriados Nacionais Brasileiros padrão para bootstrap
DEFAULT_BRAZILIAN_HOLIDAYS = [
    {"date": date(2026, 1, 1), "name": "Ano Novo", "holiday_type": "national", "is_recurring": True},
    {"date": date(2026, 4, 21), "name": "Tiradentes", "holiday_type": "national", "is_recurring": True},
    {"date": date(2026, 5, 1), "name": "Dia do Trabalho", "holiday_type": "national", "is_recurring": True},
    {"date": date(2026, 9, 7), "name": "Independência do Brasil", "holiday_type": "national", "is_recurring": True},
    {"date": date(2026, 10, 12), "name": "Nossa Senhora Aparecida", "holiday_type": "national", "is_recurring": True},
    {"date": date(2026, 11, 2), "name": "Finados", "holiday_type": "national", "is_recurring": True},
    {"date": date(2026, 11, 15), "name": "Proclamação da República", "holiday_type": "national", "is_recurring": True},
    {"date": date(2026, 11, 20), "name": "Dia da Consciência Negra", "holiday_type": "national", "is_recurring": True},
    {"date": date(2026, 12, 25), "name": "Natal", "holiday_type": "national", "is_recurring": True},
]

class CalendarService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_config(self) -> CalendarConfig:
        res = await self.db.execute(select(CalendarConfig))
        config = res.scalars().first()
        if not config:
            config = CalendarConfig(
                pause_on_weekends=True,
                pause_on_holidays=True,
                pause_night_shift=True,
                work_start_hour=7,
                work_end_hour=19,
                work_days=[0, 1, 2, 3, 4], # Segunda a Sexta
                timezone="America/Sao_Paulo"
            )
            self.db.add(config)
            await self.db.commit()
            await self.db.refresh(config)
        return config

    async def update_config(self, config_in: CalendarConfigUpdate) -> CalendarConfig:
        config = await self.get_or_create_config()
        update_data = config_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(config, key, value)
        config.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(config)
        return config

    async def list_holidays(self, active_only: bool = False) -> List[Holiday]:
        query = select(Holiday)
        if active_only:
            query = query.where(Holiday.is_active.is_(True))
        query = query.order_by(Holiday.date.asc(), Holiday.name.asc())
        res = await self.db.execute(query)
        return list(res.scalars().all())

    async def create_holiday(self, holiday_in: HolidayCreate) -> Holiday:
        holiday = Holiday(
            date=holiday_in.date,
            name=holiday_in.name.strip(),
            holiday_type=holiday_in.holiday_type,
            is_recurring=holiday_in.is_recurring,
            is_active=holiday_in.is_active
        )
        self.db.add(holiday)
        await self.db.commit()
        await self.db.refresh(holiday)

        # Ajusta leads caso algum já estivesse agendado para vencer neste dia
        try:
            await self.adjust_leads_affected_by_holiday(holiday_in.date)
        except Exception as e:
            logger.warning(f"Erro ao ajustar leads após criar feriado: {e}")

        return holiday

    async def adjust_leads_affected_by_holiday(self, holiday_date: date):
        """
        Ao cadastrar um novo feriado, adia os leads com disposition_timeout_at
        que estavam previstos para vencer na data deste feriado.
        """
        from app.models.lead import Lead
        from app.core.business_hours import calculate_smart_business_deadline

        res = await self.db.execute(
            select(Lead).where(
                Lead.disposition_timeout_at.is_not(None),
                Lead.status.not_in(["converted", "lost"])
            )
        )
        leads = res.scalars().all()
        config = await self.get_or_create_config()
        tz = ZoneInfo(config.timezone or "America/Sao_Paulo")

        updated_count = 0
        for lead in leads:
            if lead.disposition_timeout_at:
                local_dt = lead.disposition_timeout_at.astimezone(tz)
                if local_dt.date() == holiday_date:
                    lead.disposition_timeout_at = await calculate_smart_business_deadline(
                        self.db, lead.disposition_timeout_at, 0
                    )
                    updated_count += 1
        if updated_count > 0:
            await self.db.commit()
            logger.info(f"Ajustados {updated_count} leads que estavam agendados no feriado {holiday_date}.")

    async def update_holiday(self, holiday_id: UUID, holiday_in: HolidayUpdate) -> Optional[Holiday]:
        res = await self.db.execute(select(Holiday).where(Holiday.id == holiday_id))
        holiday = res.scalar_one_or_none()
        if not holiday:
            return None
        update_data = holiday_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if key == "name" and value is not None:
                setattr(holiday, key, value.strip())
            else:
                setattr(holiday, key, value)
        await self.db.commit()
        await self.db.refresh(holiday)
        return holiday

    async def toggle_holiday(self, holiday_id: UUID) -> Optional[Holiday]:
        res = await self.db.execute(select(Holiday).where(Holiday.id == holiday_id))
        holiday = res.scalar_one_or_none()
        if not holiday:
            return None
        holiday.is_active = not holiday.is_active
        await self.db.commit()
        await self.db.refresh(holiday)
        return holiday

    async def delete_holiday(self, holiday_id: UUID) -> bool:
        res = await self.db.execute(select(Holiday).where(Holiday.id == holiday_id))
        holiday = res.scalar_one_or_none()
        if not holiday:
            return False
        await self.db.delete(holiday)
        await self.db.commit()
        return True

    async def is_worker_paused(self, check_dt: Optional[datetime] = None) -> Tuple[bool, Optional[str]]:
        """
        Avalia se o worker deve estar pausado de acordo com as configurações do calendário:
        1. Finais de semana (ou dias da semana não úteis)
        2. Feriados cadastrados / recorrentes
        3. Horário noturno
        """
        config = await self.get_or_create_config()
        tz = ZoneInfo(config.timezone or "America/Sao_Paulo")
        
        if check_dt is None:
            now_local = datetime.now(tz)
        else:
            now_local = check_dt.astimezone(tz) if check_dt.tzinfo else check_dt.replace(tzinfo=timezone.utc).astimezone(tz)

        cur_date = now_local.date()
        cur_weekday = now_local.weekday() # 0 = Seg, ..., 5 = Sab, 6 = Dom

        # 1. Checagem de Final de Semana / Dias da Semana
        if config.pause_on_weekends:
            work_days = config.work_days or [0, 1, 2, 3, 4]
            if cur_weekday not in work_days or cur_weekday >= 5:
                day_name = "Sábado" if cur_weekday == 5 else ("Domingo" if cur_weekday == 6 else f"Dia {cur_weekday}")
                return True, f"Final de Semana ({day_name})"

        # 2. Checagem de Feriados
        if config.pause_on_holidays:
            # Busca feriados ativos por data exata OU recorrentes que casem com mês e dia
            holidays_res = await self.db.execute(
                select(Holiday).where(
                    Holiday.is_active.is_(True),
                    or_(
                        Holiday.date == cur_date,
                        and_(
                            Holiday.is_recurring.is_(True),
                            extract("month", Holiday.date) == cur_date.month,
                            extract("day", Holiday.date) == cur_date.day
                        )
                    )
                )
            )
            holiday = holidays_res.scalars().first()
            if holiday:
                return True, f"Feriado ({holiday.name})"

        # 3. Checagem de Horário Noturno
        if config.pause_night_shift:
            from app.core.business_hours import is_night_shift_now
            is_night = await is_night_shift_now(session=self.db, now_dt=now_local)

            if is_night:
                return True, f"Horário Noturno ({now_local.strftime('%H:%M')})"

        return False, None

    async def get_current_status(self) -> CalendarStatusResponse:
        config = await self.get_or_create_config()
        tz = ZoneInfo(config.timezone or "America/Sao_Paulo")
        now_local = datetime.now(tz)
        cur_date = now_local.date()
        cur_weekday = now_local.weekday()

        is_weekend = cur_weekday >= 5 or (config.work_days and cur_weekday not in config.work_days)
        
        # Checar feriado
        holidays_res = await self.db.execute(
            select(Holiday).where(
                Holiday.is_active.is_(True),
                or_(
                    Holiday.date == cur_date,
                    and_(
                        Holiday.is_recurring.is_(True),
                        extract("month", Holiday.date) == cur_date.month,
                        extract("day", Holiday.date) == cur_date.day
                    )
                )
            )
        )
        holiday = holidays_res.scalars().first()
        is_holiday = holiday is not None
        holiday_name = holiday.name if holiday else None

        # Checar noturno e horários efetivos (Banco + .env)
        from app.core.business_hours import is_night_shift_now, _get_env_business_hours, get_active_holidays_set
        is_night = await is_night_shift_now(session=self.db, now_dt=now_local)

        env_night_start, env_night_end, _ = _get_env_business_hours()
        if config.work_end_hour != 19 or config.work_start_hour != 7:
            eff_work_end_hour = config.work_end_hour
            eff_work_start_hour = config.work_start_hour
        else:
            eff_work_end_hour = env_night_start
            eff_work_start_hour = env_night_end

        holiday_dates_set = await get_active_holidays_set(
            self.db, start_year=now_local.year - 1, end_year=now_local.year + 1
        )
        active_holiday_strs = sorted(d.isoformat() for d in holiday_dates_set)

        is_paused, reason = await self.is_worker_paused(now_local)

        return CalendarStatusResponse(
            is_paused=is_paused,
            reason=reason,
            current_time=now_local.strftime("%d/%m/%Y %H:%M:%S"),
            is_weekend=is_weekend,
            is_holiday=is_holiday,
            holiday_name=holiday_name,
            is_night_shift=is_night,
            work_start_hour=eff_work_start_hour,
            work_end_hour=eff_work_end_hour,
            pause_on_weekends=config.pause_on_weekends,
            pause_on_holidays=config.pause_on_holidays,
            pause_night_shift=config.pause_night_shift,
            active_holiday_dates=active_holiday_strs,
        )

