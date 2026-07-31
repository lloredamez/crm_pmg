'use client';

import React, { useState } from 'react';
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
import { formatDate, formatPhone, formatCpf, cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-provider';
import { Search, ArrowUpDown, UserCheck, Clock, FileText, Tag } from 'lucide-react';

interface LeadTableProps {
  leads: Lead[];
  users: User[];
  total: number;
  page: number;
  pages: number;
  onPageChange: (newPage: number) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenLeadModal?: (lead: Lead) => void;
  onOpenDetailsModal?: (lead: Lead) => void;
  onOpenTabulateModal?: (lead: Lead) => void;
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
  searchQuery,
  onSearchChange,
  onOpenLeadModal,
  onOpenDetailsModal,
  onOpenTabulateModal,
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
    { id: 'assigned', label: 'Em Atendimento' },
    { id: 'in_progress', label: 'Em Progresso' },
    { id: 'converted', label: 'Convertidos' },
    { id: 'expired', label: 'Estouro SLA (Timeout)' },
  ];

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
      accessorKey: 'cpf',
      header: 'CPF',
      cell: ({ row }) => (
        <div className="text-xs font-medium text-slate-700">
          {formatCpf(row.original.cpf)}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Nome',
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <div className="flex items-center gap-3">
            <div
              className="font-semibold text-slate-900 text-xs hover:text-brand-600 cursor-pointer"
              onClick={() => onOpenDetailsModal?.(lead)}
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
      cell: ({ row }) => (
        <div className="text-xs font-medium text-slate-600">
          {formatPhone(row.original.phone)}
        </div>
      ),
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
                <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                  {storeName}
                </span>
              );
            },
          },
        ]
      : []),
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        let badgeStyle = 'badge-slate';
        let statusLabel: string = status;

        if (status === 'new') {
          badgeStyle = 'badge-purple';
          statusLabel = 'Novo / Na Fila';
        } else if (status === 'assigned') {
          badgeStyle = 'badge-purple';
          statusLabel = 'Em Atendimento';
        } else if (status === 'in_progress') {
          badgeStyle = 'badge-mint';
          statusLabel = 'Em Interação';
        } else if (status === 'converted') {
          badgeStyle = 'badge-mint';
          statusLabel = 'Convertido';
        } else if (status === 'expired') {
          badgeStyle = 'badge-pink';
          statusLabel = 'Timeout SLA';
        }

        const dispName = row.original.disposition?.name;

        return (
          <div className="flex flex-col gap-1 items-start">
            <span className={badgeStyle}>{statusLabel}</span>
            {dispName && (
              <span className="text-[10px] bg-brand-50 text-brand-700 font-semibold px-2 py-0.5 rounded-full border border-brand-200">
                🏷️ {dispName}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Ações',
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenTabulateModal?.(lead)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Tabular Lead"
            >
              <Tag className="w-4 h-4" />
            </button>

            <button
              onClick={() => onOpenDetailsModal?.(lead)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Ver Dados & Editar Proposta / Observações"
            >
              <FileText className="w-4 h-4" />
            </button>

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
                {users.map((u) => (
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

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
      {/* Control Bar: Pill Filters + Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Filter Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
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
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, fone, campanha..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-full pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
          />
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
              {users.map((u) => (
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
