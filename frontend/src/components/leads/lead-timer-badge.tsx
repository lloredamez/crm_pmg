'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lead } from '@/features/leads/types';
import { CalendarStatus } from '@/features/calendar/types';
import { fetchCalendarStatus } from '@/features/calendar/api';
import { Clock, Zap, AlertTriangle, CheckCircle2, PauseCircle } from 'lucide-react';

interface LeadTimerBadgeProps {
  lead: Lead;
}

// Cache compartilhado entre todas as linhas da tabela para evitar N requisições simultâneas
let cachedCalendarStatus: CalendarStatus | null = null;
let lastCalendarFetchMs = 0;
let inflightCalendarPromise: Promise<CalendarStatus | null> | null = null;
const CALENDAR_CACHE_TTL_MS = 15000;

async function getSharedCalendarStatus(): Promise<CalendarStatus | null> {
  const now = Date.now();
  if (cachedCalendarStatus && now - lastCalendarFetchMs < CALENDAR_CACHE_TTL_MS) {
    return cachedCalendarStatus;
  }
  if (inflightCalendarPromise) {
    return inflightCalendarPromise;
  }
  inflightCalendarPromise = fetchCalendarStatus()
    .then((status) => {
      cachedCalendarStatus = status;
      lastCalendarFetchMs = Date.now();
      return status;
    })
    .catch(() => cachedCalendarStatus)
    .finally(() => {
      inflightCalendarPromise = null;
    });

  return inflightCalendarPromise;
}

function formatLocalDateYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula os milissegundos úteis efetivos entre startMs e endMs,
 * descontando horário noturno, finais de semana e feriados ativos.
 * Espelha a lógica de `get_effective_elapsed_sla_minutes` do backend.
 */
function getEffectiveBusinessMsBetween(
  startMs: number,
  endMs: number,
  cal: CalendarStatus | null
): number {
  if (startMs >= endMs) return 0;

  const workStartHour = cal?.work_start_hour ?? 7;
  const workEndHour = cal?.work_end_hour ?? 19;
  const pauseWeekends = cal?.pause_on_weekends ?? true;
  const pauseHolidays = cal?.pause_on_holidays ?? true;
  const pauseNight = cal?.pause_night_shift ?? true;
  const holidaysSet = new Set(pauseHolidays ? cal?.active_holiday_dates ?? [] : []);

  let totalActiveMs = 0;

  const startDate = new Date(startMs);
  const curDay = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
    0,
    0,
    0,
    0
  );

  const endDate = new Date(endMs);
  const lastDay = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
    0,
    0,
    0,
    0
  );

  while (curDay.getTime() <= lastDay.getTime()) {
    const dayOfWeek = curDay.getDay(); // 0 = Dom, 6 = Sáb
    const isWeekend = pauseWeekends && (dayOfWeek === 0 || dayOfWeek === 6);
    const dateKey = formatLocalDateYYYYMMDD(curDay);
    const isHoliday = holidaysSet.has(dateKey);

    if (!isWeekend && !isHoliday) {
      const y = curDay.getFullYear();
      const m = curDay.getMonth();
      const d = curDay.getDate();

      if (!pauseNight || workStartHour === workEndHour) {
        const dayStart = new Date(y, m, d, 0, 0, 0, 0).getTime();
        const dayEnd = new Date(y, m, d, 24, 0, 0, 0).getTime();
        const wStart = Math.max(startMs, dayStart);
        const wEnd = Math.min(endMs, dayEnd);
        if (wEnd > wStart) {
          totalActiveMs += wEnd - wStart;
        }
      } else if (workEndHour > workStartHour) {
        // Turno comercial padrão (ex: 07:00 às 19:00)
        const dayStart = new Date(y, m, d, workStartHour, 0, 0, 0).getTime();
        const dayEnd = new Date(y, m, d, workEndHour, 0, 0, 0).getTime();
        const wStart = Math.max(startMs, dayStart);
        const wEnd = Math.min(endMs, dayEnd);
        if (wEnd > wStart) {
          totalActiveMs += wEnd - wStart;
        }
      } else {
        // Caso a janela de pausa seja diurna (ex: pausa das 14h às 18h -> workEndHour=14, workStartHour=18)
        const win1Start = new Date(y, m, d, 0, 0, 0, 0).getTime();
        const win1End = new Date(y, m, d, workEndHour, 0, 0, 0).getTime();
        const w1Start = Math.max(startMs, win1Start);
        const w1End = Math.min(endMs, win1End);
        if (w1End > w1Start) {
          totalActiveMs += w1End - w1Start;
        }

        const win2Start = new Date(y, m, d, workStartHour, 0, 0, 0).getTime();
        const win2End = new Date(y, m, d, 24, 0, 0, 0).getTime();
        const w2Start = Math.max(startMs, win2Start);
        const w2End = Math.min(endMs, win2End);
        if (w2End > w2Start) {
          totalActiveMs += w2End - w2Start;
        }
      }
    }

    curDay.setDate(curDay.getDate() + 1);
  }

  return totalActiveMs;
}

function isMomentPaused(nowMs: number, cal: CalendarStatus | null): { paused: boolean; label: string } {
  if (cal) {
    if (cal.is_paused) {
      return { paused: true, label: cal.reason || 'Expediente Pausado' };
    }
    return { paused: false, label: '' };
  }

  // Fallback local enquanto o status do calendário ainda não carregou
  const nowDate = new Date(nowMs);
  const nowDay = nowDate.getDay();
  const nowHour = nowDate.getHours();
  if (nowDay === 0 || nowDay === 6) {
    return { paused: true, label: 'Fim de Semana' };
  }
  if (nowHour >= 19 || nowHour < 7) {
    return { paused: true, label: 'Horário Noturno' };
  }
  return { paused: false, label: '' };
}

export const LeadTimerBadge: React.FC<LeadTimerBadgeProps> = ({ lead }) => {
  const [now, setNow] = useState<number>(Date.now());
  const [calStatus, setCalStatus] = useState<CalendarStatus | null>(cachedCalendarStatus);
  const frozenRemainingMsRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const syncCalendar = async () => {
      const status = await getSharedCalendarStatus();
      if (mounted && status) {
        setCalStatus(status);
      }
    };

    syncCalendar();

    const interval = setInterval(() => {
      setNow(Date.now());
      syncCalendar();
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Status terminais não exibem timer de estresse
  if (lead.status === 'converted' || lead.status === 'lost') {
    return (
      <span className="text-xs text-slate-400 font-medium px-2 py-0.5 rounded-full bg-slate-100/60 border border-slate-200/50 inline-flex items-center gap-1 whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3 text-slate-400 shrink-0" />
        Concluído
      </span>
    );
  }

  if (lead.status === 'expired') {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-rose-100 text-rose-800 border-rose-300 inline-flex items-center gap-1.5 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        Estourado
      </span>
    );
  }

  // Checagem dinâmica se o momento atual é de expediente pausado (calendário / feriado / fim de semana / noite)
  const { paused: isCurrentlyPaused, label: pauseLabel } = isMomentPaused(now, calStatus);
  if (!isCurrentlyPaused) {
    frozenRemainingMsRef.current = null;
  }

  // Determina o tempo restante efetivo em horas úteis (remainingMs) e a duração total (totalDurationMs)
  let remainingMs: number | null = null;
  let totalDurationMs: number = 60 * 1000;

  if (lead.disposition_timeout_at) {
    const targetTimeMs = new Date(lead.disposition_timeout_at).getTime();
    if (!isNaN(targetTimeMs)) {
      const effectiveRemaining = getEffectiveBusinessMsBetween(now, targetTimeMs, calStatus);
      const startRefStr = lead.dispositioned_at || lead.assigned_at || lead.created_at;

      if (startRefStr) {
        const startRefMs = new Date(startRefStr).getTime();
        const effectiveTotal = getEffectiveBusinessMsBetween(startRefMs, targetTimeMs, calStatus);
        const fallbackSlaMs = (lead.unassigned_sla_minutes || 15) * 60 * 1000;
        const wallTotal = Math.max(1000, targetTimeMs - startRefMs);
        totalDurationMs = effectiveTotal > 0 ? effectiveTotal : (lead.dispositioned_at ? wallTotal : fallbackSlaMs);

        if (effectiveRemaining === 0 && isCurrentlyPaused && targetTimeMs > now) {
          // Caso o horário de pausa tenha sido alterado após o agendamento do lead
          const elapsedSinceStart = getEffectiveBusinessMsBetween(startRefMs, now, calStatus);
          remainingMs = Math.max(0, totalDurationMs - elapsedSinceStart);
        } else {
          remainingMs = effectiveRemaining;
        }
      } else {
        if (effectiveRemaining === 0 && isCurrentlyPaused && targetTimeMs > now) {
          if (frozenRemainingMsRef.current === null) {
            frozenRemainingMsRef.current = targetTimeMs - now;
          }
          remainingMs = frozenRemainingMsRef.current;
        } else {
          remainingMs = effectiveRemaining;
        }
      }
    }
  } else if (lead.status === 'assigned') {
    // Se o lead já teve interação após ser atribuído, o SLA de 1º contato foi cumprido
    const hasInteraction =
      lead.last_interaction_at &&
      lead.assigned_at &&
      new Date(lead.last_interaction_at) > new Date(lead.assigned_at);

    if (!hasInteraction) {
      const assignedTime = lead.assigned_at || lead.created_at;
      const assignedMs = new Date(assignedTime).getTime();
      if (!isNaN(assignedMs)) {
        const slaMins = lead.unassigned_sla_minutes || 15;
        totalDurationMs = slaMins * 60 * 1000;
        const elapsedBusinessMs = getEffectiveBusinessMsBetween(assignedMs, now, calStatus);
        remainingMs = Math.max(0, totalDurationMs - elapsedBusinessMs);
      }
    }
  }

  // Sem timer ativo
  if (remainingMs === null || isNaN(remainingMs)) {
    return <span className="text-xs text-slate-400 italic px-2">-</span>;
  }

  // Se já estourou o tempo útil
  if (remainingMs <= 0) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-rose-100 text-rose-800 border-rose-300 inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        00:00 (Estourado)
      </span>
    );
  }

  // Formatação dinâmica: Dias (ex: 1d), Horas (ex: 1h:23) ou Minutos/Segundos (ex: 15:30)
  const totalSeconds = Math.floor(remainingMs / 1000);
  let formattedTime = '';

  if (totalSeconds >= 86400) {
    const days = Math.floor(totalSeconds / 86400);
    formattedTime = `${days}d`;
  } else if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    formattedTime = `${hours}h:${String(mins).padStart(2, '0')}`;
  } else {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  if (isCurrentlyPaused) {
    return (
      <span
        className="text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 whitespace-nowrap bg-indigo-50/80 text-indigo-700 border-indigo-200/80 font-medium"
        title={`Timer pausado (${pauseLabel}). Tempo útil restante congelado em: ${formattedTime}`}
      >
        <PauseCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <span className="font-mono">{formattedTime}</span>
        <span className="text-[10px] text-indigo-500 font-semibold">(Pausado)</span>
      </span>
    );
  }

  // Porcentagem restante do tempo para determinar nível de alerta
  const ratio = Math.min(1, Math.max(0, remainingMs / totalDurationMs));

  // Níveis de Urgência:
  // Red (< 20% ou < 10s): Crítico
  // Yellow (20% - 50% ou < 30s): Atenção
  // Green (> 50%): Seguro
  let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let IconComponent = Clock;
  let iconStyle = 'text-emerald-600';

  if (ratio < 0.2 || totalSeconds <= 10) {
    badgeStyle = 'bg-rose-100 text-rose-700 border-rose-300 font-bold';
    IconComponent = Zap;
    iconStyle = 'text-rose-600';
  } else if (ratio < 0.5 || totalSeconds <= 30) {
    badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
    IconComponent = Clock;
    iconStyle = 'text-amber-600';
  }

  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 whitespace-nowrap transition-all ${badgeStyle}`}
      title={`Tempo restante de SLA: ${formattedTime}`}
    >
      <IconComponent className={`w-3.5 h-3.5 shrink-0 ${iconStyle}`} />
      <span className="font-mono">{formattedTime}</span>
    </span>
  );
};
