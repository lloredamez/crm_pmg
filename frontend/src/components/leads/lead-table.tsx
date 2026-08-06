'use client';

import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { Lead, User } from '@/features/leads/types';
import { formatDate, formatPhone, formatCpf, formatCurrency, cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-provider';
import { LeadTimerBadge } from './lead-timer-badge';
import { Search, ArrowUpDown, UserCheck, Clock, FileText, Tag, Eye, EyeOff, Package, Landmark, Table, DollarSign, Calculator, Filter, RotateCcw, X, ShoppingBag, UserPlus } from 'lucide-react';


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
  attendantFilter?: string;
  onAttendantFilterChange?: (attendantId: string) => void;
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
  attendantFilter = 'all',
  onAttendantFilterChange,
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

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedBulkAttendant, setSelectedBulkAttendant] = useState<string>('');

  const filterTabs = [
    { id: 'all', label: 'Todos' },
    { id: 'new', label: 'Balde de Leads 🛒' },
    { id: 'assigned', label: 'Em Atendimento' },
    { id: 'converted', label: 'Vendas' },
    { id: 'lost', label: 'Perdas' },
  ];

  const allowedReassignUsers = useMemo(() => {
    // Apenas usuários com papel de 'attendant' podem receber reatribuições
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

  const columns: ColumnDef<Lead>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 text-slate-500 font-medium text-xs hover:text-slate-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Data Lead <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {formatDate(row.original.created_at || row.original.assigned_at)}
        </div>
      ),
    },
    {
      id: 'sla_timer',
      header: 'Timer SLA',
      cell: ({ row }) => <LeadTimerBadge lead={row.original} />,
    },
    {
      accessorKey: 'cpf',
      header: 'CPF',
      cell: ({ row }) => {
        const lead = row.original;
        const isRevealed = lead.is_revealed;
        return (
          <div className="text-xs font-medium">
            {isRevealed ? (
              <span className="text-slate-800 font-semibold">{formatCpf(lead.cpf)}</span>
            ) : (
              <span className="text-slate-400 font-mono tracking-widest select-none">***.***.***-**</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'name',
      header: 'Nome',
      cell: ({ row }) => {
        const lead = row.original;
        const isRevealed = lead.is_revealed;
        return (
          <div className="flex items-center gap-3">
            <div
              className={`font-semibold text-xs ${
                isRevealed
                  ? 'text-slate-900 hover:text-brand-600 cursor-pointer'
                  : 'text-slate-500 cursor-not-allowed opacity-60'
              }`}
              onClick={() => isRevealed && onOpenDetailsModal?.(lead)}
              title={
                isRevealed
                  ? 'Ver dados do lead'
                  : 'Clique no olho para revelar os dados do lead primeiro'
              }
            >
              {lead.name}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'phone',
      header: 'Telefone',
      cell: ({ row }) => {
        const lead = row.original;
        const isRevealed = lead.is_revealed;
        return (
          <div className="text-xs font-medium">
            {isRevealed ? (
              <span className="text-slate-800 font-semibold">{formatPhone(lead.phone)}</span>
            ) : (
              <span className="text-slate-400 font-mono tracking-wider select-none">(***) *****-****</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'product_name',
      header: 'Produto',
      cell: ({ row }) => {
        const lead = row.original;
        const productName = lead.product_name || lead.product || lead.campaign_name || '-';
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <Package className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <span>{productName}</span>
          </div>
        );
      },
    },

    ...(isSupervisorRole || isManagerOrAdminRole
      ? [
          {
            accessorKey: 'current_attendant',
            header: 'Atendente',
            cell: ({ row }: { row: any }) => {
              const lead = row.original;
              const rawName =
                lead.current_attendant?.name ||
                users.find((u) => u.id === lead.current_attendant_id)?.name ||
                lead.attendant_name;

              if (!rawName) {
                return <span className="text-xs text-slate-400 italic">Na Fila</span>;
              }

              const cleanName = rawName.split('(')[0].trim();

              return (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-semibold text-slate-800">{cleanName}</span>
                </div>
              );
            },
          },
        ]
      : []),
    ...(isManagerOrAdminRole
      ? [
          {
            accessorKey: 'unit',
            header: 'Loja',
            cell: ({ row }: { row: any }) => {
              const storeName = row.original.unit?.name || row.original.unit_name || 'Loja Principal';
              return (
                <span className="text-xs font-medium text-slate-700 px-2.5 py-1 rounded-full">
                  {storeName}
                </span>
              );
            },
          },
        ]
      : []),
    {
      accessorKey: 'current_disposition_name',
      header: 'Tabulação Atual',
      cell: ({ row }) => {
        const lead = row.original;
        const currentDisp = lead.current_disposition_name;

        if (currentDisp) {
          return (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-brand-50 text-brand-700 border-brand-200 inline-flex items-center gap-1">
              <Tag className="w-3 h-3 shrink-0" />
              {currentDisp}
            </span>
          );
        }

        return (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-slate-100 text-slate-500 border-slate-200 italic">
            Sem Tabulação
          </span>
        );
      },
    },
    {
      accessorKey: 'disposition',
      header: 'Última Tabulação',
      cell: ({ row }) => {
        const lead = row.original;
        const dispName = lead.disposition?.name;
        const dispCategory = lead.disposition?.category?.toLowerCase() || '';

        if (dispName) {
          let badgeClass = 'bg-brand-50 text-brand-700 border-brand-200';
          if (dispCategory.includes('venda') || lead.status === 'converted') {
            badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          } else if (dispCategory.includes('perda') || lead.status === 'lost') {
            badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
          }

          return (
            <div className="flex flex-col gap-0.5 items-start">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${badgeClass}`}>
                <Tag className="w-3 h-3 shrink-0" />
                {dispName}
              </span>
            </div>
          );
        }

        if (lead.status === 'expired') {
          return (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-rose-50 text-rose-700 border-rose-200 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Timeout SLA
            </span>
          );
        }

        return (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-slate-100 text-slate-500 border-slate-200 italic">
            Sem Tabulação
          </span>
        );
      },
    },


    {
      id: 'actions',
      header: 'Ações',
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
          <div className="flex items-center gap-2">
            {isUnassigned ? (
              canClaimLead ? (
                <button
                  onClick={() => onClaimLead?.(lead.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all"
                  title="Pegar este lead do Balde para o seu atendimento"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Pegar Lead</span>
                </button>
              ) : (
                <div className="invisible flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 pointer-events-none" aria-hidden="true">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Pegar Lead</span>
                </div>
              )
            ) : (
              <>
                <button
                  onClick={() => !isRevealDisabled && onRevealLead?.(lead)}
                  disabled={isRevealDisabled}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isManagerOrSupervisorRole
                      ? 'text-slate-300 bg-slate-50 cursor-not-allowed opacity-40'
                      : isRevealed
                      ? 'text-emerald-600 bg-emerald-50 cursor-default'
                      : 'text-slate-500 hover:text-brand-600 hover:bg-brand-50'
                  }`}
                  title={
                    isManagerOrSupervisorRole
                      ? 'Ação de revelar dados restrita a atendentes'
                      : isRevealed
                      ? 'Dados revelados (Em Contato)'
                      : 'Ver Telefone & CPF (Tabular como Em Contato)'
                  }
                >
                  <Eye className={`w-4 h-4 ${isManagerOrSupervisorRole ? 'text-slate-300' : isRevealed ? 'text-emerald-600' : 'text-slate-500 hover:text-brand-600'}`} />
                </button>

                <button
                  onClick={() => !isTabulateDisabled && onOpenTabulateModal?.(lead)}
                  disabled={isTabulateDisabled}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isTabulateDisabled
                      ? 'text-slate-300 bg-slate-50 cursor-not-allowed opacity-40'
                      : 'text-slate-500 hover:text-brand-600 hover:bg-brand-50'
                  }`}
                  title={
                    isManagerOrSupervisorRole
                      ? 'Ação de tabulação restrita a atendentes'
                      : !isRevealed
                      ? 'Clique no olho para revelar os dados do lead primeiro'
                      : isTerminal
                      ? 'Lead no final do fluxo (Venda/Perda) - Tabulação desabilitada'
                      : 'Tabular Lead'
                  }
                >
                  <Tag className="w-4 h-4" />
                </button>

                <button
                  onClick={() => isRevealed && onOpenDetailsModal?.(lead)}
                  disabled={!isRevealed}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isRevealed
                      ? 'text-slate-500 hover:text-brand-600 hover:bg-brand-50'
                      : 'text-slate-300 bg-slate-50 cursor-not-allowed opacity-50'
                  }`}
                  title={
                    isRevealed
                      ? 'Ver Dados & Editar Proposta / Observações'
                      : 'Clique no olho para revelar os dados do lead primeiro'
                  }
                >
                  <FileText className="w-4 h-4" />
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
                className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none"
              >
                <option value="" disabled>Reatribuir...</option>
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
  ];

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

  const availableBancos = Array.from(
    new Set(leads.map((l) => l.banco).filter((b): b is string => !!b && b.trim() !== ''))
  );
  const availableTabelas = Array.from(
    new Set(leads.map((l) => l.tabela).filter((t): t is string => !!t && t.trim() !== ''))
  );

  const hasActiveFilters =
    statusFilter !== 'all' ||
    bancoFilter !== 'all' ||
    tabelaFilter !== 'all' ||
    attendantFilter !== 'all' ||
    !!searchQuery;

  const handleResetFilters = () => {
    onStatusFilterChange('all');
    onBancoFilterChange?.('all');
    onTabelaFilterChange?.('all');
    onAttendantFilterChange?.('all');
    onSearchChange('');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
      {/* Header Controls: Status Tabs + Filters + Search */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Pill Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {filterTabs.map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onStatusFilterChange(tab.id)}
                  className={cn(
                    'pill-tab text-xs',
                    isActive ? 'pill-tab-active' : 'pill-tab-inactive'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente, fone, CPF, campanha..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-full pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
        </div>

        {/* Dropdown Header Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100/80">
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 mr-2">
            <Filter className="w-3.5 h-3.5 text-brand-600" />
            <span>Filtros do Cabeçalho:</span>
          </div>

          {/* Banco Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs">
            <Landmark className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={bancoFilter}
              onChange={(e) => onBancoFilterChange?.(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos os Bancos</option>
              {availableBancos.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Tabela Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs">
            <Table className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={tabelaFilter}
              onChange={(e) => onTabelaFilterChange?.(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Todas as Tabelas</option>
              {availableTabelas.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Atendente Filter Dropdown (Supervisor / Manager / Admin) */}
          {(isSupervisorRole || isManagerOrAdminRole) && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={attendantFilter}
                onChange={(e) => onAttendantFilterChange?.(e.target.value)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
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

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-200/60 rounded-xl px-3 py-1.5 transition-all ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedLeadIds.length > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-3 mb-4 flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-900">
            <UserCheck className="w-4 h-4 text-brand-600" />
            <span>{selectedLeadIds.length} leads selecionados para transferência em lote</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedBulkAttendant}
              onChange={(e) => setSelectedBulkAttendant(e.target.value)}
              className="text-xs bg-white border border-brand-300 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none"
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
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded-xl transition-all"
            >
              Confirmar Transferência
            </button>
          </div>
        </div>
      )}

      {/* Table Data */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[11px] font-semibold tracking-wider uppercase">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3 px-4">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-3.5 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-400">
                  Nenhum lead encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
        <div>
          Mostrando <span className="font-semibold text-slate-800">{leads.length}</span> de <span className="font-semibold text-slate-800">{total}</span> leads
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span>Página {page} de {pages}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
};
