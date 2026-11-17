'use client';

import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { Lead, User, Disposition, Channel, Unit } from '@/features/leads/types';
import { formatDate, formatPhone, formatCpf, formatCurrency, cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-provider';
import { getEffectiveChannelFields, isStandardField } from '@/features/channels/constants';
import { LeadTimerBadge } from './lead-timer-badge';
import {
  Search,
  Filter,
  ChevronDown,
  ShoppingBag,
  Eye,
  Tag,
  FileText,
  Clock,
  Landmark,
  Table as TableIcon,
  Store,
  UserCheck,
  RotateCcw,
} from 'lucide-react';

interface LeadTableProps {
  leads: Lead[];
  users: User[];
  total: number;
  page: number;
  pages: number;
  onPageChange: (newPage: number) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  bancoFilter?: string;
  onBancoFilterChange?: (banco: string) => void;
  tabelaFilter?: string;
  onTabelaFilterChange?: (tabela: string) => void;
  dispositionFilter?: string;
  onDispositionFilterChange?: (disposition: string) => void;
  channels?: Channel[];
  channelFilter?: string;
  onChannelFilterChange?: (channel: string) => void;
  dispositions?: Disposition[];
  attendantFilter?: string;
  onAttendantFilterChange?: (attendantId: string) => void;
  units?: Unit[];
  unitFilter?: string;
  onUnitFilterChange?: (unitId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenLeadModal?: (lead: Lead) => void;
  onOpenDetailsModal?: (lead: Lead) => void;
  onOpenTabulateModal?: (lead: Lead) => void;
  onRevealLead?: (lead: Lead) => void;
  onClaimLead?: (leadId: string) => void;
  onReassignSingle: (leadId: string, attendantId: string) => void;
  onBulkReassign: (leadIds: string[], attendantId: string) => void;
}

export const LeadTable: React.FC<LeadTableProps> = ({
  leads,
  users,
  total,
  page,
  pages,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  bancoFilter = 'all',
  onBancoFilterChange,
  tabelaFilter = 'all',
  onTabelaFilterChange,
  dispositionFilter = 'all',
  onDispositionFilterChange,
  channels = [],
  channelFilter = 'all',
  onChannelFilterChange,
  dispositions = [],
  attendantFilter = 'all',
  onAttendantFilterChange,
  units = [],
  unitFilter = 'all',
  onUnitFilterChange,
  searchQuery,
  onSearchChange,
  onOpenLeadModal,
  onOpenDetailsModal,
  onOpenTabulateModal,
  onRevealLead,
  onClaimLead,
  onReassignSingle,
  onBulkReassign,
}) => {
  const { user } = useAuth();
  const role = user?.role;
  const isSupervisorRole = role === 'supervisor';
  const isManagerOrAdminRole = role === 'manager' || role === 'admin';
  const isAdminRole = role === 'admin';

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedBulkAttendant, setSelectedBulkAttendant] = useState<string>('');
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  const filterTabs = [
    { id: 'all', label: 'Todos', badge: total },
    { id: 'new', label: 'Balde de Leads', icon: ShoppingBag },
    { id: 'assigned', label: 'Em Atendimento' },
    { id: 'converted', label: 'Vendas' },
    { id: 'lost', label: 'Perdas' },
  ];

  const allowedReassignUsers = useMemo(() => {
    const attendantUsers = users.filter((u) => u.role === 'attendant');
    if (!user) return attendantUsers;
    if (user.role === 'admin') return attendantUsers;

    if (user.role === 'manager') {
      const managedUnitIds =
        user.managed_unit_ids || (user.unit_id ? [user.unit_id] : []);
      if (managedUnitIds.length > 0) {
        return attendantUsers.filter((u) => u.unit_id && managedUnitIds.includes(u.unit_id));
      }
      if (user.unit_id) {
        return attendantUsers.filter((u) => u.unit_id === user.unit_id);
      }
      return attendantUsers;
    }

    if (user.role === 'supervisor') {
      if (user.unit_id) {
        return attendantUsers.filter((u) => u.unit_id === user.unit_id);
      }
      return attendantUsers;
    }

    return attendantUsers;
  }, [users, user]);

  const canBulkReassign = isSupervisorRole || isManagerOrAdminRole;

  const selectedChannel = useMemo(() => {
    if (!channels || channelFilter === 'all') return null;
    return channels.find((c) => c.code.toLowerCase() === channelFilter.toLowerCase()) || null;
  }, [channels, channelFilter]);

  const effectiveChannelFields = useMemo(() => {
    return getEffectiveChannelFields(selectedChannel?.allowed_fields);
  }, [selectedChannel]);

  const hasBancoField = useMemo(
    () => effectiveChannelFields.some((f) => f.key === 'banco'),
    [effectiveChannelFields]
  );
  const hasTabelaField = useMemo(
    () => effectiveChannelFields.some((f) => f.key === 'tabela'),
    [effectiveChannelFields]
  );

  const availableBancos = Array.from(
    new Set(leads.map((l) => l.banco).filter((b): b is string => !!b && b.trim() !== ''))
  );
  const availableTabelas = Array.from(
    new Set(leads.map((l) => l.tabela).filter((t): t is string => !!t && t.trim() !== ''))
  );

  const availableUnits = useMemo(() => {
    if (units && units.length > 0) return units;
    const map = new Map<string, string>();
    leads.forEach((l) => {
      const uid = l.unit_id || l.unit?.id;
      const uname = l.unit?.name || l.unit_name;
      if (uid && uname) {
        map.set(uid, uname);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name, code: name, is_active: true } as Unit));
  }, [units, leads]);

  const activeDropdownFiltersCount = useMemo(() => {
    let count = 0;
    if (unitFilter !== 'all') count++;
    if (bancoFilter !== 'all') count++;
    if (tabelaFilter !== 'all') count++;
    if (dispositionFilter !== 'all') count++;
    if (attendantFilter !== 'all') count++;
    return count;
  }, [unitFilter, bancoFilter, tabelaFilter, dispositionFilter, attendantFilter]);

  const hasActiveFilters = activeDropdownFiltersCount > 0 || statusFilter !== 'all' || !!searchQuery;

  const handleResetFilters = () => {
    onStatusFilterChange('all');
    onBancoFilterChange?.('all');
    onTabelaFilterChange?.('all');
    onDispositionFilterChange?.('all');
    onAttendantFilterChange?.('all');
    onUnitFilterChange?.('all');
    onSearchChange('');
  };

  // Suporte a campos personalizados do canal além dos padrões já agrupados
  const customDynamicColumns = useMemo<ColumnDef<Lead>[]>(() => {
    const customDefs = effectiveChannelFields.filter(
      (def) => !isStandardField(def.key) && def.showInTable !== false
    );
    if (customDefs.length === 0) return [];

    return customDefs.map((def) => {
      const key = def.key;
      return {
        id: `custom_${key}`,
        accessorKey: key as any,
        header: def.label,
        cell: ({ row }: { row: any }) => {
          const lead = row.original;
          const val = (lead as any)[key] ?? (lead as any).custom_fields?.[key];
          if (val === null || val === undefined || val === '') {
            return <span className="text-xs text-slate-400">-</span>;
          }
          if (def.type === 'currency' && (typeof val === 'number' || !isNaN(Number(val)))) {
            return <span className="text-xs font-semibold text-slate-800">{formatCurrency(Number(val))}</span>;
          }
          return (
            <span className="text-xs font-medium text-slate-700 truncate max-w-44 block" title={String(val)}>
              {String(val)}
            </span>
          );
        },
      };
    });
  }, [effectiveChannelFields]);

  // Colunas organizadas no estilo visual de layout.html (2 linhas por célula = sem scroll horizontal)
  const columns: ColumnDef<Lead>[] = useMemo(() => [
    ...(canBulkReassign
      ? [
        {
          id: 'select',
          header: ({ table }: { table: any }) => (
            <input
              type="checkbox"
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
              checked={table.getIsAllPageRowsSelected()}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
            />
          ),
          cell: ({ row }: { row: any }) => (
            <input
              type="checkbox"
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
            />
          ),
        },
      ]
      : []),
    {
      id: 'lead_info',
      header: 'Lead & Documento',
      cell: ({ row }) => {
        const lead = row.original;
        const isRevealed = lead.is_revealed;
        const isUnopenedAdmin = isAdminRole && !isRevealed;

        const cpfVal = lead.cpf || lead.verified_cpf;
        const formattedCpf = isRevealed || isAdminRole
          ? formatCpf(cpfVal) || '—'
          : '***.***.***-**';

        const formattedPhone = isRevealed || isAdminRole
          ? formatPhone(lead.phone) || 'Sem fone'
          : '(***) *****-****';

        return (
          <div className="flex flex-col items-start min-w-[200px] max-w-[280px]">
            <button
              type="button"
              onClick={() => (isRevealed || isAdminRole) && onOpenDetailsModal?.(lead)}
              className={cn(
                'font-semibold text-xs text-left leading-snug transition truncate w-full block',
                isRevealed
                  ? 'text-slate-900 hover:text-brand-600 cursor-pointer'
                  : isAdminRole
                    ? 'text-slate-500 hover:text-slate-700 cursor-pointer'
                    : 'text-slate-400 cursor-not-allowed opacity-60'
              )}
              title={
                isRevealed
                  ? 'Ver ficha do lead'
                  : isAdminRole
                    ? 'Ver dados do lead (não aberto pelo atendente)'
                    : 'Clique no olho para revelar os dados primeiro'
              }
            >
              {lead.name || 'Sem Nome'}
            </button>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 font-mono">
              <span>CPF: {formattedCpf}</span>
              <span className="text-slate-300">•</span>
              <span className="font-sans">{formattedPhone}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'entry_dates',
      header: isAdminRole ? 'Entrada / Atribuição' : 'Data Atribuição',
      cell: ({ row }) => {
        const lead = row.original;
        const dateAtrib = lead.assigned_at ? formatDate(lead.assigned_at) : 'Não atribuído';

        if (!isAdminRole) {
          return (
            <div className="flex flex-col items-start whitespace-nowrap">
              <span className="text-slate-800 font-medium text-xs">{dateAtrib}</span>
            </div>
          );
        }

        const dateLead = lead.created_at ? formatDate(lead.created_at) : '—';
        return (
          <div className="flex flex-col items-start whitespace-nowrap">
            <span className="text-slate-800 font-medium text-xs">{dateLead}</span>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Atrib: {dateAtrib}
            </div>
          </div>
        );
      },
    },
    {
      id: 'sla_timer',
      header: 'Timer SLA',
      cell: ({ row }) => (
        <div className="whitespace-nowrap flex items-center">
          <LeadTimerBadge lead={row.original} />
        </div>
      ),
    },
    {
      id: 'valor',
      header: () => <div className="text-right">Valor Liberado</div>,
      cell: ({ row }) => {
        const lead = row.original;
        const valor = lead.valor_liberado;

        return (
          <div className="flex flex-col items-end whitespace-nowrap text-right">
            <span className={cn('text-xs', valor ? 'font-bold text-slate-900' : 'text-slate-400')}>
              {valor ? formatCurrency(valor) : '—'}
            </span>
          </div>
        );
      },
    },
    ...((isSupervisorRole || isManagerOrAdminRole)
      ? [
        {
          id: 'attendant_loja',
          header: 'Atendente & Loja',
          cell: ({ row }: { row: any }) => {
            const lead = row.original;
            const rawName =
              lead.current_attendant?.name ||
              users.find((u) => u.id === lead.current_attendant_id)?.name ||
              (lead as any).attendant_name;

            const cleanName = rawName ? rawName.split('(')[0].trim() : 'Na Fila';
            const storeName = lead.unit?.name || lead.unit_name || 'Loja Principal';

            return (
              <div className="flex flex-col items-start max-w-[200px]">
                <div className="flex items-center gap-1.5 w-full">
                  <span
                    className={cn('w-2 h-2 rounded-full shrink-0', rawName ? 'bg-emerald-500' : 'bg-slate-300')}
                    title={rawName ? 'Atribuído' : 'Aguardando atribuição'}
                  />
                  <span className="font-medium text-slate-800 text-xs truncate" title={rawName || 'Na Fila'}>
                    {cleanName}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 pl-3.5 truncate w-full" title={storeName}>
                  {storeName}
                </div>
              </div>
            );
          },
        },
      ]
      : []),
    {
      id: 'tabulacao',
      header: 'Status Tabulação',
      cell: ({ row }) => {
        const lead = row.original;
        const currentDisp = lead.current_disposition_name;
        const disp = lead.disposition || dispositions.find((d) => d.id === lead.disposition_id);
        const dispName = disp?.name;
        const dispCategory =
          dispositions.find((d) => d.name.toLowerCase() === (currentDisp || dispName || '').toLowerCase())?.category?.toLowerCase() ||
          disp?.category?.toLowerCase() ||
          '';

        let badgeStyle = 'bg-brand-50 text-brand-700 border-brand-200/80';
        if (dispCategory.includes('venda') || lead.status === 'converted') {
          badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
        } else if (dispCategory.includes('perda') || lead.status === 'lost') {
          badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200/80';
        }

        let mainTag = null;
        if (lead.status === 'expired') {
          mainTag = (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-rose-50 text-rose-700 border-rose-200/80 whitespace-nowrap">
              <Clock className="w-3 h-3 opacity-75 shrink-0" />
              Timeout SLA
            </span>
          );
        } else if (currentDisp) {
          mainTag = (
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap', badgeStyle)}>
              <Tag className="w-3 h-3 opacity-75 shrink-0" />
              {currentDisp}
            </span>
          );
        } else {
          mainTag = (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-slate-100 text-slate-500 border-slate-200/80 italic whitespace-nowrap">
              Sem Tabulação
            </span>
          );
        }

        return (
          <div className="flex flex-col items-start whitespace-nowrap">
            {mainTag}
            {dispName && (
              <div className="text-[10px] text-slate-400 mt-0.5 pl-1">
                Ant: {dispName}
              </div>
            )}
          </div>
        );
      },
    },

    ...customDynamicColumns,

    {
      id: 'actions',
      header: () => <div className="text-right">Ações</div>,
      cell: ({ row }) => {
        const lead = row.original;
        const isRevealed = lead.is_revealed;
        const dispCategory = lead.disposition?.category?.toLowerCase() || '';
        const isTerminal =
          lead.status === 'converted' ||
          lead.status === 'lost' ||
          dispCategory.includes('venda') ||
          dispCategory.includes('perda') ||
          dispCategory.includes('sucesso') ||
          dispCategory.includes('fechado') ||
          dispCategory.includes('sem interesse');

        const isManagerOrSupervisorRole = user?.role === 'manager' || user?.role === 'supervisor';
        const canClaimLead = user?.role === 'attendant' || user?.role === 'admin';
        const isTabulateDisabled = !isRevealed || isTerminal || isManagerOrSupervisorRole;
        const isRevealDisabled = isRevealed || isManagerOrSupervisorRole;

        const isUnassigned = !lead.current_attendant_id || lead.status === 'new';

        return (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            {isUnassigned ? (
              canClaimLead ? (
                <button
                  onClick={() => onClaimLead?.(lead.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
                  title="Pegar este lead do Balde para o seu atendimento"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Pegar Lead</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-400 italic">No Balde</span>
              )
            ) : (
              <>
                <button
                  onClick={() => !isRevealDisabled && onRevealLead?.(lead)}
                  disabled={isRevealDisabled}
                  className={cn(
                    'p-1.5 rounded-lg transition',
                    isManagerOrSupervisorRole
                      ? 'text-slate-300 opacity-40 cursor-not-allowed'
                      : isRevealed
                        ? 'text-emerald-600 bg-emerald-50/80 cursor-default'
                        : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50'
                  )}
                  title={
                    isManagerOrSupervisorRole
                      ? 'Ação restrita a atendentes'
                      : isRevealed
                        ? 'Dados revelados'
                        : 'Ver telefone e CPF (Marca como Em Contato)'
                  }
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => !isTabulateDisabled && onOpenTabulateModal?.(lead)}
                  disabled={isTabulateDisabled}
                  className={cn(
                    'p-1.5 rounded-lg transition',
                    isTabulateDisabled
                      ? 'text-slate-300 opacity-40 cursor-not-allowed'
                      : 'text-slate-500 hover:text-brand-600 hover:bg-brand-50'
                  )}
                  title={
                    isManagerOrSupervisorRole
                      ? 'Ação restrita a atendentes'
                      : !isRevealed
                        ? 'Abra os dados do lead antes de tabular'
                        : isTerminal
                          ? 'Lead finalizado (Venda/Perda)'
                          : 'Tabular Lead'
                  }
                >
                  <Tag className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => (isRevealed || isAdminRole) && onOpenDetailsModal?.(lead)}
                  disabled={!isRevealed && !isAdminRole}
                  className={cn(
                    'p-1.5 rounded-lg transition',
                    !isRevealed && !isAdminRole
                      ? 'text-slate-300 opacity-40 cursor-not-allowed'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  )}
                  title="Ficha rápida / Detalhes"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {(isSupervisorRole || isManagerOrAdminRole) && (
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    onReassignSingle(lead.id, e.target.value);
                    e.target.value = '';
                  }
                }}
                className="text-[11px] bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2 py-1 text-slate-600 focus:outline-none transition cursor-pointer"
              >
                <option value="" disabled>
                  Reatribuir...
                </option>
                {allowedReassignUsers.map((u: User) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.status})
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      },
    },
  ], [
    canBulkReassign,
    isAdminRole,
    onOpenDetailsModal,
    users,
    dispositions,
    customDynamicColumns,
    user?.role,
    onClaimLead,
    onRevealLead,
    onOpenTabulateModal,
    allowedReassignUsers,
    onReassignSingle,
    isSupervisorRole,
    isManagerOrAdminRole,
  ]);

  const table = useReactTable({
    data: leads,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedLeadIds = Object.keys(rowSelection)
    .filter((idx) => rowSelection[idx])
    .map((idx) => leads[parseInt(idx)]?.id)
    .filter(Boolean);

  const handleBulkExecute = () => {
    if (selectedBulkAttendant && selectedLeadIds.length > 0) {
      onBulkReassign(selectedLeadIds, selectedBulkAttendant);
      setRowSelection({});
      setSelectedBulkAttendant('');
    }
  };

  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    if (pages <= 5) {
      for (let i = 1; i <= pages; i++) pageNumbers.push(i);
    } else {
      pageNumbers.push(1);
      if (page > 3) pageNumbers.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(pages - 1, page + 1);
      for (let i = start; i <= end; i++) {
        if (!pageNumbers.includes(i)) pageNumbers.push(i);
      }
      if (page < pages - 2) pageNumbers.push('...');
      if (!pageNumbers.includes(pages)) pageNumbers.push(pages);
    }
    return pageNumbers;
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* 1. Barra de Controle Unificada (Abas + Busca + Botão Filtros) */}
      <div className="p-3 sm:px-4 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white">
        {/* Abas Segmentadas à Esquerda */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto text-xs font-medium text-slate-600 shrink-0">
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onStatusFilterChange(tab.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md transition flex items-center gap-1.5 whitespace-nowrap',
                  isActive
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'hover:text-slate-900'
                )}
              >
                {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="text-[10px] font-semibold bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Busca Rápida + Toggle Filtros Avançados */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar nome, CPF ou telefone..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition"
            />
          </div>

          <button
            onClick={() => setIsFiltersOpen((prev) => !prev)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition shrink-0',
              isFiltersOpen || activeDropdownFiltersCount > 0
                ? 'bg-brand-50/70 border-brand-200 text-brand-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            )}
          >
            <Filter className="w-3.5 h-3.5 text-brand-500" />
            <span>Filtros</span>
            {activeDropdownFiltersCount > 0 && (
              <span className="bg-brand-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeDropdownFiltersCount}
              </span>
            )}
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
                isFiltersOpen && 'rotate-180'
              )}
            />
          </button>
        </div>
      </div>

      {/* 2. Gaveta de Filtros Avançados (Expansível) */}
      {isFiltersOpen && (
        <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200/80 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-center">
            {/* Loja */}
            {(isManagerOrAdminRole || availableUnits.length > 0) && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={unitFilter}
                  onChange={(e) => onUnitFilterChange?.(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer w-full"
                >
                  <option value="all">Todas as Lojas</option>
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Banco */}
            {hasBancoField && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={bancoFilter}
                  onChange={(e) => onBancoFilterChange?.(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer w-full"
                >
                  <option value="all">Todos os Bancos</option>
                  {availableBancos.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tabela */}
            {hasTabelaField && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                <TableIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={tabelaFilter}
                  onChange={(e) => onTabelaFilterChange?.(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer w-full"
                >
                  <option value="all">Todas as Tabelas</option>
                  {availableTabelas.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tabulação */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={dispositionFilter}
                onChange={(e) => onDispositionFilterChange?.(e.target.value)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer w-full"
              >
                <option value="all">Todas as Tabulações</option>
                <option value="sem_tabulacao">Sem Tabulação</option>
                {dispositions.length > 0
                  ? dispositions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.category})
                    </option>
                  ))
                  : Array.from(
                    new Set(
                      leads
                        .map((l) => l.disposition?.name)
                        .filter((d): d is string => !!d && d.trim() !== '')
                    )
                  ).map((dispName) => (
                    <option key={dispName} value={dispName}>
                      {dispName}
                    </option>
                  ))}
              </select>
            </div>

            {/* Atendente (Supervisor / Manager / Admin) */}
            {(isSupervisorRole || isManagerOrAdminRole) && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={attendantFilter}
                  onChange={(e) => onAttendantFilterChange?.(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer w-full"
                >
                  <option value="all">Todos os Atendentes</option>
                  {allowedReassignUsers.map((u: User) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Limpar Filtros */}
            {hasActiveFilters && (
              <div className="flex items-center justify-end">
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 px-2.5 py-1.5 rounded-lg transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Limpar filtros</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Barra de Ações em Lote */}
      {canBulkReassign && selectedLeadIds.length > 0 && (
        <div className="bg-brand-50 border-b border-brand-200/80 px-4 py-2 flex items-center justify-between text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 font-medium text-brand-900">
            <span className="bg-brand-600 text-white font-bold px-2 py-0.5 rounded-md">
              {selectedLeadIds.length}
            </span>
            <span>leads selecionados</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedBulkAttendant}
              onChange={(e) => setSelectedBulkAttendant(e.target.value)}
              className="text-xs bg-white border border-brand-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none"
            >
              <option value="">Selecione o Atendente Destino...</option>
              {allowedReassignUsers.map((u: User) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.status})
                </option>
              ))}
            </select>

            <button
              onClick={handleBulkExecute}
              disabled={!selectedBulkAttendant}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1 rounded-md transition shadow-xs"
            >
              Reatribuir
            </button>

            <button
              onClick={() => setRowSelection({})}
              className="text-brand-700 hover:underline px-2 py-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* 4. Tabela Otimizada (Zero scroll horizontal nos desktops normais) */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap"
              >
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-2.5 px-3">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                const isSelected = row.getIsSelected();
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'hover:bg-slate-50/90 transition group',
                      isSelected ? 'bg-brand-50/40' : undefined,
                      isAdminRole && !row.original.is_revealed && 'bg-slate-50/30'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-2.5 px-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-400">
                  Nenhum lead encontrado para os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Rodapé de Paginação Compacta */}
      <div className="px-4 py-2.5 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          Mostrando <span className="font-semibold text-slate-800">{leads.length}</span> de{' '}
          <span className="font-semibold text-slate-800">{total}</span> leads
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition"
          >
            Anterior
          </button>

          {getPageNumbers().map((p, idx) =>
            typeof p === 'number' ? (
              <button
                key={idx}
                onClick={() => onPageChange(p)}
                className={cn(
                  'px-2.5 py-1 rounded text-xs transition',
                  page === p
                    ? 'bg-slate-900 text-white font-medium'
                    : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                )}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="px-1 text-slate-400">
                {p}
              </span>
            )
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
            className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition"
          >
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
};
