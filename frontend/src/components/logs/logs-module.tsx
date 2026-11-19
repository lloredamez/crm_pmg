'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRightLeft,
  ClipboardEdit,
  Clock,
  RefreshCw,
  Search,
  AlertTriangle,
  UserCheck,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Channel, User } from '@/features/leads/types';
import {
  fetchActivityLogs,
  fetchTransferLogs,
  fetchLeadChangeLogs,
} from '@/features/logs/api';
import { cn } from '@/lib/utils';

interface LogsModuleProps {
  channels: Channel[];
  users: User[];
  initialChannelCode?: string;
}

type LogSection = 'activity' | 'transfers' | 'lead-changes';

function getTodayLocalISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  return `${s}s`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function StatusBadge({ status }: { status?: string | null }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    online: {
      label: 'Online',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
    },
    busy: {
      label: 'Ocupado',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
    },
    offline: {
      label: 'Indisponível / Offline',
      cls: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
    },
  };
  const info = map[status || ''] || {
    label: status || '-',
    cls: 'bg-slate-50 text-slate-500 border-slate-200',
    dot: 'bg-slate-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
        info.cls
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', info.dot)} />
      {info.label}
    </span>
  );
}

function SourceLabel({ source }: { source: string }) {
  const labels: Record<string, string> = {
    login: 'Login',
    manual: 'Alteração Manual',
    inactivity_timeout: 'Inatividade (Auto)',
    deactivated: 'Usuário Desativado',
    created: 'Cadastro',
  };
  return (
    <span className="text-xs text-slate-600 font-medium">
      {labels[source] || source}
    </span>
  );
}

function TransferEventBadge({ eventType }: { eventType: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    assigned: {
      label: 'Atribuição do Sistema',
      cls: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    claimed_from_bucket: {
      label: 'Pegou do Balde',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    reassigned: {
      label: 'Atribuído por Alguém',
      cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    sla_breached: {
      label: 'Estourou (SLA)',
      cls: 'bg-rose-50 text-rose-700 border-rose-200',
    },
  };
  const info = map[eventType] || {
    label: eventType,
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
        info.cls
      )}
    >
      {info.label}
    </span>
  );
}

export const LogsModule: React.FC<LogsModuleProps> = ({
  channels,
  users,
  initialChannelCode,
}) => {
  const today = useMemo(() => getTodayLocalISO(), []);
  const [activeSection, setActiveSection] = useState<LogSection>('activity');
  const [selectedChannel, setSelectedChannel] = useState<string>(
    initialChannelCode && initialChannelCode !== '' ? initialChannelCode : 'all'
  );
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [attendantId, setAttendantId] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [transferType, setTransferType] = useState<string>('all');
  const [leadChangeType, setLeadChangeType] = useState<string>('all');
  const [pageOffset, setPageOffset] = useState<number>(0);
  const pageLimit = 50;

  const commonParams = {
    channel_code: selectedChannel,
    start_date: startDate,
    end_date: endDate,
    attendant_id: attendantId,
    search,
    limit: pageLimit,
    offset: pageOffset,
  };

  const activityQuery = useQuery({
    queryKey: ['logs', 'activity', commonParams],
    queryFn: () => fetchActivityLogs(commonParams),
    enabled: activeSection === 'activity',
  });

  const transfersQuery = useQuery({
    queryKey: ['logs', 'transfers', commonParams, transferType],
    queryFn: () =>
      fetchTransferLogs({
        ...commonParams,
        event_type: transferType,
      }),
    enabled: activeSection === 'transfers',
  });

  const leadChangesQuery = useQuery({
    queryKey: ['logs', 'lead-changes', commonParams, leadChangeType],
    queryFn: () =>
      fetchLeadChangeLogs({
        ...commonParams,
        event_type: leadChangeType,
      }),
    enabled: activeSection === 'lead-changes',
  });

  const handleRefresh = () => {
    if (activeSection === 'activity') activityQuery.refetch();
    else if (activeSection === 'transfers') transfersQuery.refetch();
    else leadChangesQuery.refetch();
  };

  const isFetching =
    (activeSection === 'activity' && activityQuery.isFetching) ||
    (activeSection === 'transfers' && transfersQuery.isFetching) ||
    (activeSection === 'lead-changes' && leadChangesQuery.isFetching);

  const sections = [
    {
      id: 'activity' as LogSection,
      label: 'Registros de Atividade',
      description: 'Online, offline, indisponível e jornada',
      icon: Activity,
    },
    {
      id: 'transfers' as LogSection,
      label: 'Transferências & SLA',
      description: 'Atribuição, estouro e reatribuição',
      icon: ArrowRightLeft,
    },
    {
      id: 'lead-changes' as LogSection,
      label: 'Tabulações & Ficha do Lead',
      description: 'Tabulações e alterações cadastrais',
      icon: ClipboardEdit,
    },
  ];

  const totalItems =
    activeSection === 'activity'
      ? activityQuery.data?.total_events ?? 0
      : activeSection === 'transfers'
      ? transfersQuery.data?.total ?? 0
      : leadChangesQuery.data?.total ?? 0;

  return (
    <div className="space-y-5">
      {/* Header & Section Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Módulo de Logs por Canal
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditoria completa de jornada dos consultores, transferências de leads, estouros de SLA, tabulações e alterações na ficha.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors self-start lg:self-auto cursor-pointer"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Atualizar Logs
          </button>
        </div>

        {/* 3 Session Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setActiveSection(sec.id);
                  setPageOffset(0);
                }}
                className={cn(
                  'flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                  isActive
                    ? 'bg-brand-50/80 border-brand-300 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/70'
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-slate-500 border border-slate-200'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-xs font-bold truncate',
                      isActive ? 'text-brand-900' : 'text-slate-800'
                    )}
                  >
                    {sec.label}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{sec.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Shared Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-slate-100">
          {/* Canal */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Canal
            </label>
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedChannel}
                onChange={(e) => {
                  setSelectedChannel(e.target.value);
                  setPageOffset(0);
                }}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                <option value="all">Todos os canais</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.code}>
                    {ch.name} ({ch.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data Início */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Data Início
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPageOffset(0);
                }}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Data Fim */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Data Fim
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPageOffset(0);
                }}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Consultor */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Consultor / Usuário
            </label>
            <select
              value={attendantId}
              onChange={(e) => {
                setAttendantId(e.target.value);
                setPageOffset(0);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            >
              <option value="all">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Busca */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPageOffset(0);
                }}
                placeholder="Nome, lead, detalhe..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: ACTIVITY LOGS */}
      {activeSection === 'activity' && (
        <div className="space-y-5">
          {activityQuery.isError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-4">
              Erro ao carregar logs de atividade: {(activityQuery.error as Error)?.message}
            </div>
          )}

          {/* Jornada Info Banner */}
          {activityQuery.data?.calendar_summary && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-slate-700">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>
                  <strong>Jornada de Trabalho configurada:</strong>{' '}
                  {String(activityQuery.data.calendar_summary.work_start_hour).padStart(2, '0')}:00 às{' '}
                  {String(activityQuery.data.calendar_summary.work_end_hour).padStart(2, '0')}:00 (
                  {activityQuery.data.calendar_summary.timezone})
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                {activityQuery.data.consultants.length} consultores listados
              </span>
            </div>
          )}

          {/* Consultants Work-Hours Summary */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Tempo Online na Jornada de Trabalho
              </h2>
              <span className="text-[11px] text-slate-400">
                Calculado a partir das transições de status dentro do expediente
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Consultor</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Status Atual</th>
                    <th className="px-4 py-3">Online na Jornada</th>
                    <th className="px-4 py-3">Online Total</th>
                    <th className="px-4 py-3 text-right">Alterações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {activityQuery.isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Carregando resumo dos consultores...
                      </td>
                    </tr>
                  ) : !activityQuery.data?.consultants.length ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Nenhum consultor encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    activityQuery.data.consultants.map((c) => (
                        <tr key={c.user_id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-semibold text-slate-900">{c.user_name}</td>
                          <td className="px-4 py-3 text-slate-500">{c.unit_name || '-'}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={c.current_status} />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-emerald-700">
                              {formatDuration(c.online_work_seconds)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDuration(c.online_total_seconds)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">
                            {c.transitions_count}
                          </td>
                        </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Status Transitions Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Histórico de Registros (Online / Offline / Indisponível)
              </h2>
              <span className="text-[11px] text-slate-500">
                {activityQuery.data?.total_events ?? 0} registros
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Data / Hora</th>
                    <th className="px-4 py-3">Consultor</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Status Anterior</th>
                    <th className="px-4 py-3">Novo Status</th>
                    <th className="px-4 py-3">Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {activityQuery.isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Carregando eventos...
                      </td>
                    </tr>
                  ) : !activityQuery.data?.events.length ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Nenhum registro de mudança de status no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    activityQuery.data.events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                          {formatDateTime(ev.changed_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{ev.user_name}</td>
                        <td className="px-4 py-3 text-slate-500">{ev.unit_name || '-'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={ev.previous_status} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={ev.new_status} />
                        </td>
                        <td className="px-4 py-3">
                          <SourceLabel source={ev.source} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: TRANSFERS & SLA */}
      {activeSection === 'transfers' && (
        <div className="space-y-5">
          {transfersQuery.isError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-4">
              Erro ao carregar logs de transferência: {(transfersQuery.error as Error)?.message}
            </div>
          )}

          {/* Transfer Type Sub-Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'assigned', label: 'Atribuição do Sistema' },
              { id: 'claimed_from_bucket', label: 'Pegou do Balde' },
              { id: 'reassigned', label: 'Atribuído por Alguém' },
              { id: 'sla_breached', label: 'Estourou (SLA)' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTransferType(t.id);
                  setPageOffset(0);
                }}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                  transferType === t.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Logs de Transferência, Distribuição e Estouro
              </h2>
              <span className="text-[11px] text-slate-500">
                {transfersQuery.data?.total ?? 0} registros
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Hora do Log</th>
                    <th className="px-4 py-3">Lead / Canal</th>
                    <th className="px-4 py-3">Origem / Tipo</th>
                    <th className="px-4 py-3">Atendente</th>
                    <th className="px-4 py-3">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {transfersQuery.isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Carregando logs de transferência...
                      </td>
                    </tr>
                  ) : !transfersQuery.data?.items.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Nenhum log de transferência encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    transfersQuery.data.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                          {formatDateTime(item.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{item.lead_name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.channel_code && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                {item.channel_code}
                              </span>
                            )}
                            {item.unit_name && (
                              <span className="text-[10px] text-slate-400">{item.unit_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <TransferEventBadge eventType={item.event_type} />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.attendant_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{item.title}</div>
                          {item.reassigned_by_name && (
                            <div className="text-[11px] text-indigo-600 mt-0.5">
                              Atribuído por: <strong>{item.reassigned_by_name}</strong>
                            </div>
                          )}
                          {item.breach_type && (
                            <div className="text-[11px] text-rose-600 mt-0.5">
                              Tipo: {item.breach_type === 'first_contact_timeout' ? 'Estouro de 1º Contato' : 'Estouro de Tabulação'}
                            </div>
                          )}
                          {item.description && !item.reassigned_by_name && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: TABULATIONS & LEAD SHEET CHANGES */}
      {activeSection === 'lead-changes' && (
        <div className="space-y-4">
          {leadChangesQuery.isError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-4">
              Erro ao carregar tabulações e alterações: {(leadChangesQuery.error as Error)?.message}
            </div>
          )}

          {/* Type Sub-Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'tabulated', label: 'Tabulações' },
              { id: 'details_updated', label: 'Alterações na Ficha' },
              { id: 'status_updated', label: 'Mudanças de Status' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setLeadChangeType(t.id);
                  setPageOffset(0);
                }}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                  leadChangeType === t.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Tabulações e Alterações na Ficha do Lead
              </h2>
              <span className="text-[11px] text-slate-500">
                {leadChangesQuery.data?.total ?? 0} registros
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Data / Hora</th>
                    <th className="px-4 py-3">Lead / Canal</th>
                    <th className="px-4 py-3">Responsável</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Detalhes / Campos Alterados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {leadChangesQuery.isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Carregando registros...
                      </td>
                    </tr>
                  ) : !leadChangesQuery.data?.items.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Nenhuma tabulação ou alteração encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    leadChangesQuery.data.items.map((item) => {
                      const isTab = item.event_type === 'tabulated';
                      const isDetails = item.event_type === 'details_updated';
                      const changes = item.event_metadata?.changes || [];

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 align-top">
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                            {formatDateTime(item.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{item.lead_name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {item.channel_code && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                  {item.channel_code}
                                </span>
                              )}
                              {item.unit_name && (
                                <span className="text-[10px] text-slate-400">{item.unit_name}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {item.attendant_name || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={cn(
                                'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                                isTab
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isDetails
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              )}
                            >
                              {isTab
                                ? 'Tabulação'
                                : isDetails
                                ? 'Alteração na Ficha'
                                : 'Status'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{item.title}</div>
                            {isDetails && changes.length > 0 ? (
                              <div className="mt-1.5 space-y-1">
                                {changes.map((ch, idx) => (
                                  <div
                                    key={`${item.id}-${ch.field}-${idx}`}
                                    className="text-[11px] bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1 flex flex-wrap items-center gap-1.5"
                                  >
                                    <span className="font-semibold text-slate-700">{ch.label}:</span>
                                    <span className="text-slate-400 line-through">
                                      {ch.old !== null && ch.old !== undefined && ch.old !== ''
                                        ? String(ch.old)
                                        : 'vazio'}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span className="font-semibold text-brand-700">
                                      {ch.new !== null && ch.new !== undefined && ch.new !== ''
                                        ? String(ch.new)
                                        : 'vazio'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              item.description && (
                                <p className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-wrap">
                                  {item.description}
                                </p>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {totalItems > pageLimit && (
        <div className="bg-white rounded-2xl border border-slate-200/80 px-5 py-3 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Exibindo {pageOffset + 1} – {Math.min(pageOffset + pageLimit, totalItems)} de {totalItems}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageOffset((prev) => Math.max(0, prev - pageLimit))}
              disabled={pageOffset === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
            <button
              onClick={() => setPageOffset((prev) => prev + pageLimit)}
              disabled={pageOffset + pageLimit >= totalItems}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              Próximo
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
