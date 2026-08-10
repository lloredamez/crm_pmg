'use client';

import React, { useState, useEffect } from 'react';
import { Lead } from '@/features/leads/types';
import { Clock, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface LeadTimerBadgeProps {
  lead: Lead;
}

export const LeadTimerBadge: React.FC<LeadTimerBadgeProps> = ({ lead }) => {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    // Timer simples a cada 1 segundo para atualizar o relógio local
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Status terminais não exibem timer de estresse
  if (lead.status === 'converted' || lead.status === 'lost') {
    return (
      <span className="text-xs text-slate-400 font-medium px-2 py-0.5 rounded-full bg-slate-100/60 border border-slate-200/50 inline-flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-slate-400" />
        Concluído
      </span>
    );
  }

  if (lead.status === 'expired') {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-rose-100 text-rose-800 border-rose-300 inline-flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        Estourado
      </span>
    );
  }

  // Determina o tempo alvo (Target Expiration)
  let targetTimeMs: number | null = null;
  let totalDurationMs: number = 60 * 1000; // Padrão: 1 min SLA

  if (lead.disposition_timeout_at) {
    targetTimeMs = new Date(lead.disposition_timeout_at).getTime();
    if (lead.dispositioned_at) {
      totalDurationMs = Math.max(
        1,
        targetTimeMs - new Date(lead.dispositioned_at).getTime()
      );
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
      const slaMins = lead.unassigned_sla_minutes || 15;
      totalDurationMs = slaMins * 60 * 1000;
      targetTimeMs = assignedMs + totalDurationMs;
    }
  }

  // Sem timer ativo
  if (!targetTimeMs || isNaN(targetTimeMs)) {
    return <span className="text-xs text-slate-400 italic px-2">-</span>;
  }

  const remainingMs = targetTimeMs - now;

  // Se já estourou o tempo
  if (remainingMs <= 0) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-rose-100 text-rose-800 border-rose-300 inline-flex items-center gap-1 shrink-0">
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
      className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 transition-all ${badgeStyle}`}
      title={`Tempo restante de SLA: ${formattedTime}`}
    >
      <IconComponent className={`w-3.5 h-3.5 shrink-0 ${iconStyle}`} />
      <span className="font-mono">{formattedTime}</span>
    </span>
  );
};
