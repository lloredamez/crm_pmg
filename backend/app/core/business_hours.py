from datetime import datetime, time, timedelta, timezone, date
from zoneinfo import ZoneInfo
from typing import Optional, Tuple, Set
from app.core.config import settings

def is_weekend(check_dt: Optional[datetime] = None, tz_name: Optional[str] = None) -> bool:
    """Retorna True se for Sábado (5) ou Domingo (6)."""
    tz = ZoneInfo(tz_name or settings.BUSINESS_TIMEZONE)
    if check_dt is None:
        local_dt = datetime.now(tz)
    else:
        local_dt = check_dt.astimezone(tz) if check_dt.tzinfo else check_dt.replace(tzinfo=timezone.utc).astimezone(tz)
    return local_dt.weekday() >= 5

def is_night_shift(now_dt: Optional[datetime] = None, tz_name: Optional[str] = None) -> bool:
    """
    Retorna True se o horário estiver dentro da janela noturna
    (por padrão entre 19:00 e 07:00 no fuso America/Sao_Paulo).
    """
    tz = ZoneInfo(tz_name or settings.BUSINESS_TIMEZONE)
    if now_dt is None:
        now_local = datetime.now(tz)
    else:
        now_local = now_dt.astimezone(tz) if now_dt.tzinfo else now_dt.replace(tzinfo=timezone.utc).astimezone(tz)

    start_hour = settings.NIGHT_SHIFT_START_HOUR
    end_hour = settings.NIGHT_SHIFT_END_HOUR

    if start_hour > end_hour:
        return now_local.hour >= start_hour or now_local.hour < end_hour
    else:
        return start_hour <= now_local.hour < end_hour

async def is_worker_paused_now(session=None, now_dt: Optional[datetime] = None) -> Tuple[bool, Optional[str]]:
    """
    Verifica se o worker deve estar pausado considerando:
    1. Calendário e Feriados no banco de dados (se session disponível)
    2. Fallback de Final de Semana (Sábado/Domingo)
    3. Fallback de Horário Noturno (19:00 - 07:00)
    """
    if session is not None:
        try:
            from app.features.calendar.service import CalendarService
            service = CalendarService(session)
            return await service.is_worker_paused(now_dt)
        except Exception:
            pass

    # Fallback síncrono/sem sessão ativa
    if is_weekend(now_dt):
        return True, "Final de Semana"
    if is_night_shift(now_dt):
        return True, "Horário Noturno (19:00 - 07:00)"
    return False, None

def get_effective_elapsed_sla_minutes(
    start_dt: datetime,
    end_dt: datetime,
    holiday_dates: Optional[Set[date]] = None,
    tz_name: Optional[str] = None
) -> float:
    """
    Calcula os minutos decorridos entre start_dt e end_dt considerando apenas
    as horas úteis (fora de noites, finais de semana e feriados).
    """
    tz = ZoneInfo(tz_name or settings.BUSINESS_TIMEZONE)
    start_local = start_dt.astimezone(tz) if start_dt.tzinfo else start_dt.replace(tzinfo=timezone.utc).astimezone(tz)
    end_local = end_dt.astimezone(tz) if end_dt.tzinfo else end_dt.replace(tzinfo=timezone.utc).astimezone(tz)

    if start_local >= end_local:
        return 0.0

    start_hour = settings.NIGHT_SHIFT_START_HOUR
    end_hour = settings.NIGHT_SHIFT_END_HOUR

    total_active_seconds = 0.0
    cur_date = start_local.date()
    holidays = holiday_dates or set()

    while cur_date <= end_local.date():
        # Finais de semana e feriados não acumulam tempo de SLA
        if cur_date.weekday() < 5 and cur_date not in holidays:
            day_start = datetime.combine(cur_date, time(end_hour, 0), tzinfo=tz)
            day_end = datetime.combine(cur_date, time(start_hour, 0), tzinfo=tz)

            window_start = max(start_local, day_start)
            window_end = min(end_local, day_end)

            if window_end > window_start:
                total_active_seconds += (window_end - window_start).total_seconds()

        cur_date += timedelta(days=1)

    return total_active_seconds / 60.0

def add_business_minutes(
    start_dt: datetime,
    minutes_to_add: float,
    holiday_dates: Optional[Set[date]] = None,
    tz_name: Optional[str] = None
) -> datetime:
    """
    Soma minutos considerando apenas expediente útil (07:00 às 19:00, excluindo finais de semana e feriados).
    """
    tz = ZoneInfo(tz_name or settings.BUSINESS_TIMEZONE)
    current = start_dt.astimezone(tz) if start_dt.tzinfo else start_dt.replace(tzinfo=timezone.utc).astimezone(tz)

    start_hour = settings.NIGHT_SHIFT_START_HOUR # 19
    end_hour = settings.NIGHT_SHIFT_END_HOUR     # 7
    remaining_seconds = minutes_to_add * 60.0
    holidays = holiday_dates or set()

    def advance_to_next_valid_work_start(dt: datetime) -> datetime:
        next_dt = dt
        while True:
            # Se estiver fora de hora (noite)
            if next_dt.hour >= start_hour:
                next_day = next_dt.date() + timedelta(days=1)
                next_dt = datetime.combine(next_day, time(end_hour, 0), tzinfo=tz)
            elif next_dt.hour < end_hour:
                next_dt = datetime.combine(next_dt.date(), time(end_hour, 0), tzinfo=tz)
            
            # Se caiu em fim de semana ou feriado, pula dia inteiro para as 07:00 do próximo
            if next_dt.weekday() >= 5 or next_dt.date() in holidays:
                next_day = next_dt.date() + timedelta(days=1)
                next_dt = datetime.combine(next_day, time(end_hour, 0), tzinfo=tz)
            else:
                break
        return next_dt

    current = advance_to_next_valid_work_start(current)

    while remaining_seconds > 0:
        day_end = datetime.combine(current.date(), time(start_hour, 0), tzinfo=tz)
        available_seconds = (day_end - current).total_seconds()

        if remaining_seconds <= available_seconds:
            current = current + timedelta(seconds=remaining_seconds)
            remaining_seconds = 0
        else:
            remaining_seconds -= available_seconds
            next_day = current.date() + timedelta(days=1)
            current = datetime.combine(next_day, time(end_hour, 0), tzinfo=tz)
            current = advance_to_next_valid_work_start(current)

    return current
