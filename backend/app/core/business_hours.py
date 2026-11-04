import os
from datetime import datetime, time, timedelta, timezone, date
from zoneinfo import ZoneInfo
from typing import Optional, Tuple, Set
from app.core.config import settings


def _get_env_business_hours() -> Tuple[int, int, str]:
    """
    Lê dinamicamente NIGHT_SHIFT_START_HOUR, NIGHT_SHIFT_END_HOUR e BUSINESS_TIMEZONE
    dos arquivos .env caso tenham sido alterados em tempo de execução sem restart do container.
    Retorna (night_start_hour, night_end_hour, timezone_str).
    """
    night_start = settings.NIGHT_SHIFT_START_HOUR
    night_end = settings.NIGHT_SHIFT_END_HOUR
    tz_str = settings.BUSINESS_TIMEZONE

    for env_path in [".env", "../.env", "/app/.env", "/home/raul/project/crm_leads/.env", "/home/raul/project/crm_leads/backend/.env"]:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k == "NIGHT_SHIFT_START_HOUR" and v.isdigit():
                            night_start = int(v)
                        elif k == "NIGHT_SHIFT_END_HOUR" and v.isdigit():
                            night_end = int(v)
                        elif k == "BUSINESS_TIMEZONE" and v:
                            tz_str = v
            except Exception:
                pass

    return night_start, night_end, tz_str


def is_weekend(check_dt: Optional[datetime] = None, tz_name: Optional[str] = None) -> bool:
    """Retorna True se for Sábado (5) ou Domingo (6)."""
    _, _, env_tz = _get_env_business_hours()
    tz = ZoneInfo(tz_name or env_tz)
    if check_dt is None:
        local_dt = datetime.now(tz)
    else:
        local_dt = check_dt.astimezone(tz) if check_dt.tzinfo else check_dt.replace(tzinfo=timezone.utc).astimezone(tz)
    return local_dt.weekday() >= 5


def is_night_shift(
    now_dt: Optional[datetime] = None,
    tz_name: Optional[str] = None,
    night_start_hour: Optional[int] = None,
    night_end_hour: Optional[int] = None,
) -> bool:
    """
    Retorna True se o horário estiver dentro da janela noturna
    (por padrão entre 19:00 e 07:00 no fuso America/Sao_Paulo).
    """
    env_night_start, env_night_end, env_tz = _get_env_business_hours()
    tz = ZoneInfo(tz_name or env_tz)
    if now_dt is None:
        now_local = datetime.now(tz)
    else:
        now_local = now_dt.astimezone(tz) if now_dt.tzinfo else now_dt.replace(tzinfo=timezone.utc).astimezone(tz)

    start_hour = night_start_hour if night_start_hour is not None else env_night_start
    end_hour = night_end_hour if night_end_hour is not None else env_night_end

    if start_hour > end_hour:
        return now_local.hour >= start_hour or now_local.hour < end_hour
    elif start_hour < end_hour:
        return start_hour <= now_local.hour < end_hour
    return False


async def is_night_shift_now(session=None, now_dt: Optional[datetime] = None) -> bool:
    """
    Verifica de forma assíncrona se o momento atual está no horário noturno,
    consultando primeiro a configuração do Calendário no banco de dados (CalendarConfig)
    e fazendo fallback para as variáveis de ambiente (.env).
    """
    env_night_start, env_night_end, env_tz = _get_env_business_hours()

    if session is not None:
        try:
            from app.features.calendar.service import CalendarService
            cal_service = CalendarService(session)
            config = await cal_service.get_or_create_config()
            tz_name = config.timezone or env_tz

            # Se o usuário alterou o expediente no painel de Calendário, usa os horários do banco;
            # caso contrário, permite que o .env também sobrescreva se tiver sido customizado.
            if config.work_end_hour != 19 or config.work_start_hour != 7:
                night_start = config.work_end_hour
                night_end = config.work_start_hour
            else:
                night_start = env_night_start
                night_end = env_night_end

            return is_night_shift(
                now_dt=now_dt,
                tz_name=tz_name,
                night_start_hour=night_start,
                night_end_hour=night_end,
            )
        except Exception:
            pass

    return is_night_shift(now_dt=now_dt, tz_name=env_tz, night_start_hour=env_night_start, night_end_hour=env_night_end)


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
        return True, "Horário Noturno"
    return False, None


def add_business_minutes(
    start_dt: datetime,
    minutes_to_add: float,
    holiday_dates: Optional[Set[date]] = None,
    tz_name: Optional[str] = None,
    night_start_hour: Optional[int] = None,
    night_end_hour: Optional[int] = None,
    pause_weekends: bool = True
) -> datetime:
    """
    Soma minutos considerando apenas expediente útil (07:00 às 19:00, excluindo finais de semana e feriados).
    """
    env_night_start, env_night_end, env_tz = _get_env_business_hours()
    tz = ZoneInfo(tz_name or env_tz)
    current = start_dt.astimezone(tz) if start_dt.tzinfo else start_dt.replace(tzinfo=timezone.utc).astimezone(tz)

    start_hour = night_start_hour if night_start_hour is not None else env_night_start # 19
    end_hour = night_end_hour if night_end_hour is not None else env_night_end         # 7
    remaining_seconds = minutes_to_add * 60.0
    holidays = holiday_dates or set()

    def advance_to_next_valid_work_start(dt: datetime) -> datetime:
        next_dt = dt
        while True:
            # Se estiver fora de hora (noite)
            if start_hour > end_hour:
                is_night = next_dt.hour >= start_hour or next_dt.hour < end_hour
            elif start_hour < end_hour:
                is_night = start_hour <= next_dt.hour < end_hour
            else:
                is_night = False

            if is_night:
                if start_hour > end_hour and next_dt.hour >= start_hour:
                    next_day = next_dt.date() + timedelta(days=1)
                    next_dt = datetime.combine(next_day, time(end_hour, 0), tzinfo=tz)
                else:
                    next_dt = datetime.combine(next_dt.date(), time(end_hour, 0), tzinfo=tz)

            # Se caiu em fim de semana ou feriado, pula dia inteiro para o início do próximo expediente
            is_weekend_day = pause_weekends and (next_dt.weekday() >= 5)
            is_holiday_day = next_dt.date() in holidays

            if is_weekend_day or is_holiday_day:
                next_day = next_dt.date() + timedelta(days=1)
                next_dt = datetime.combine(next_day, time(end_hour, 0), tzinfo=tz)
            else:
                if not is_night:
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


async def get_active_holidays_set(session, start_year: int = 2024, end_year: int = 2030) -> Set[date]:
    """Retorna conjunto de datas de feriados ativos para o intervalo de anos fornecido."""
    from sqlalchemy import select
    from app.models.calendar import Holiday
    res = await session.execute(select(Holiday).where(Holiday.is_active.is_(True)))
    holidays = res.scalars().all()
    dates: Set[date] = set()
    for h in holidays:
        if h.is_recurring:
            for y in range(start_year, end_year + 1):
                try:
                    dates.add(date(y, h.date.month, h.date.day))
                except ValueError:
                    pass
        else:
            dates.add(h.date)
    return dates


async def calculate_smart_business_deadline(
    session,
    start_dt: datetime,
    minutes_to_add: float,
    tz_name: Optional[str] = None
) -> datetime:
    """
    Agendamento Inteligente:
    Calcula o momento exato de expiração somando minutes_to_add em tempo útil,
    desconsiderando noites, finais de semana e feriados cadastrados no sistema.
    """
    from app.features.calendar.service import CalendarService
    env_night_start, env_night_end, env_tz = _get_env_business_hours()
    cal_service = CalendarService(session)
    config = await cal_service.get_or_create_config()

    tz = ZoneInfo(tz_name or config.timezone or env_tz)
    start_local = start_dt.astimezone(tz) if start_dt.tzinfo else start_dt.replace(tzinfo=timezone.utc).astimezone(tz)

    cur_year = start_local.year
    holiday_dates = await get_active_holidays_set(session, start_year=cur_year - 1, end_year=cur_year + 2)

    hols_to_use = holiday_dates if config.pause_on_holidays else set()

    if config.work_end_hour != 19 or config.work_start_hour != 7:
        eff_night_start = config.work_end_hour
        eff_night_end = config.work_start_hour
    else:
        eff_night_start = env_night_start
        eff_night_end = env_night_end

    return add_business_minutes(
        start_dt=start_local,
        minutes_to_add=minutes_to_add,
        holiday_dates=hols_to_use,
        tz_name=tz_name or config.timezone or env_tz,
        night_start_hour=eff_night_start if config.pause_night_shift else 24,
        night_end_hour=eff_night_end if config.pause_night_shift else 0,
        pause_weekends=config.pause_on_weekends
    )
