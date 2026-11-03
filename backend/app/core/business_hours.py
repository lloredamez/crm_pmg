from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional
from app.core.config import settings

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

def get_effective_elapsed_sla_minutes(start_dt: datetime, end_dt: datetime, tz_name: Optional[str] = None) -> float:
    """
    Calcula os minutos decorridos entre start_dt e end_dt considerando apenas
    as horas úteis (fora da janela noturna, por padrão das 07:00 às 19:00).
    Evita que leads recebidos durante a noite estourem SLA imediatamente ao início do dia.
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
    while cur_date <= end_local.date():
        # Janela de expediente ativo no dia: end_hour (ex: 07:00) até start_hour (ex: 19:00)
        day_start = datetime.combine(cur_date, time(end_hour, 0), tzinfo=tz)
        day_end = datetime.combine(cur_date, time(start_hour, 0), tzinfo=tz)

        window_start = max(start_local, day_start)
        window_end = min(end_local, day_end)

        if window_end > window_start:
            total_active_seconds += (window_end - window_start).total_seconds()

        cur_date += timedelta(days=1)

    return total_active_seconds / 60.0

