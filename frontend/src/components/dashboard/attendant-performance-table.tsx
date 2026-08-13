'use client';

import React, { useState, useMemo } from 'react';
import { Lead, User } from '@/features/leads/types';
import { formatCurrency } from '@/lib/utils';
import {
  Calendar,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  Filter,
  RotateCcw,
  DollarSign,
  Building2,
} from 'lucide-react';

import { useAuth } from '@/features/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { fetchAttendantPerformance } from '@/features/leads/api';

interface AttendantPerformanceTableProps {
  leads: Lead[];
  users: User[];
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const AttendantPerformanceTable: React.FC<AttendantPerformanceTableProps> = ({
  leads,
  users,
}) => {
  const { user: currentUser } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');

  const { data: perfResponse } = useQuery({
    queryKey: ['attendant-performance', selectedYear, selectedMonth],
    queryFn: () => fetchAttendantPerformance({ year: selectedYear, month: selectedMonth }),
    enabled: !!currentUser,
    refetchInterval: 5000,
  });

  // Filter users based on supervisor/manager unit authorization
  const allowedUsers = useMemo(() => {
    if (!currentUser) return users;
    if (currentUser.role === 'admin') return users;

    if (currentUser.role === 'manager') {
      const managedUnitIds =
        currentUser.managed_unit_ids || (currentUser.unit_id ? [currentUser.unit_id] : []);
      if (managedUnitIds.length > 0) {
        return users.filter((u) => u.unit_id && managedUnitIds.includes(u.unit_id));
      }
      if (currentUser.unit_id) {
        return users.filter((u) => u.unit_id === currentUser.unit_id);
      }
      return users;
    }

    if (currentUser.role === 'supervisor') {
      if (currentUser.unit_id) {
        return users.filter((u) => u.unit_id === currentUser.unit_id);
      }
      return users;
    }

    if (currentUser.role === 'attendant') {
      return users.filter((u) => u.id === currentUser.id);
    }

    return users;
  }, [users, currentUser]);

  // Extract available years from leads or defaults
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    years.add(currentYear - 1);
    years.add(currentYear - 2);
    leads.forEach((l) => {
      const dateStr = l.dispositioned_at || l.assigned_at || l.created_at;
      if (dateStr) {
        const y = new Date(dateStr).getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [leads, currentYear]);

  // Filter leads based on selected Year and Month (fallback)
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const dateStr = lead.dispositioned_at || lead.assigned_at || lead.created_at;
      if (!dateStr) return true;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;

      if (selectedYear !== 'all' && d.getFullYear() !== selectedYear) {
        return false;
      }

      if (selectedMonth !== 'all' && d.getMonth() !== selectedMonth) {
        return false;
      }

      return true;
    });
  }, [leads, selectedYear, selectedMonth]);

  // Group and compute metrics per attendant
  const performanceData = useMemo(() => {
    if (perfResponse?.items && perfResponse.items.length > 0) {
      return perfResponse.items.map((item) => ({
        id: String(item.id),
        name: item.name,
        email: item.email || '',
        role: item.role || 'attendant',
        status: item.status || 'offline',
        totalLeads: item.total_leads,
        vendas: item.vendas,
        perdas: item.perdas,
        outros: item.outros,
        valorTotalLiberado: item.valor_total_liberado,
      }));
    }

    const allowedUserIdsSet = new Set(allowedUsers.map((u) => String(u.id).toLowerCase()));
    const attendantMap: Record<
      string,
      {
        id: string;
        name: string;
        email: string;
        role: string;
        status: string;
        totalLeads: number;
        vendas: number;
        perdas: number;
        outros: number;
        valorTotalLiberado: number;
      }
    > = {};

    const userMap = new Map(users.map((u) => [String(u.id).toLowerCase(), u]));

    // Initialize map for registered attendants within user scope
    allowedUsers.forEach((u) => {
      if (u.role === 'attendant') {
        const key = String(u.id).toLowerCase();
        const liveUser = userMap.get(key) || u;
        attendantMap[key] = {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: liveUser.status || 'offline',
          totalLeads: 0,
          vendas: 0,
          perdas: 0,
          outros: 0,
          valorTotalLiberado: 0,
        };
      }
    });

    // Populate stats from filtered leads
    filteredLeads.forEach((lead) => {
      const rawAttendantId = lead.current_attendant_id || lead.current_attendant?.id;
      if (rawAttendantId) {
        const attendantKey = String(rawAttendantId).toLowerCase();

        if (currentUser?.role === 'admin' || allowedUserIdsSet.has(attendantKey)) {
          if (!attendantMap[attendantKey]) {
            const rawName = lead.current_attendant?.name || 'Atendente';
            const liveUser = userMap.get(attendantKey);
            attendantMap[attendantKey] = {
              id: String(rawAttendantId),
              name: rawName,
              email: lead.current_attendant?.email || '',
              role: lead.current_attendant?.role || 'attendant',
              status: liveUser?.status || lead.current_attendant?.status || 'offline',
              totalLeads: 0,
              vendas: 0,
              perdas: 0,
              outros: 0,
              valorTotalLiberado: 0,
            };
          }

          const stats = attendantMap[attendantKey];
          stats.totalLeads += 1;

          const status = (lead.status || '').toLowerCase();
          const dispCategory = (lead.disposition?.category || '').toLowerCase();
          const dispName = (lead.disposition?.name || lead.current_disposition_name || '').toLowerCase();

          const isVenda =
            status === 'converted' ||
            dispCategory.includes('venda') ||
            dispCategory.includes('vendido') ||
            dispCategory.includes('sucesso') ||
            dispCategory.includes('fechado') ||
            dispCategory.includes('ganho') ||
            dispCategory.includes('pago') ||
            dispName.includes('venda') ||
            dispName.includes('vendido') ||
            dispName.includes('fechado') ||
            dispName.includes('convertido') ||
            dispName.includes('pago');

          const isPerda =
            status === 'lost' ||
            dispCategory.includes('perda') ||
            dispCategory.includes('perdido') ||
            dispCategory.includes('sem interesse') ||
            dispCategory.includes('recusado') ||
            dispCategory.includes('cancelado') ||
            dispCategory.includes('desistência') ||
            dispName.includes('perda') ||
            dispName.includes('perdido') ||
            dispName.includes('sem interesse') ||
            dispName.includes('desistência');

          if (isVenda) {
            stats.vendas += 1;
            const valor = lead.valor_liberado ? Number(lead.valor_liberado) : 0;
            if (!isNaN(valor)) {
              stats.valorTotalLiberado += valor;
            }
          } else if (isPerda) {
            stats.perdas += 1;
          } else {
            stats.outros += 1;
          }
        }
      }
    });

    return Object.values(attendantMap)
      .filter((item) => item.role === 'attendant' || item.totalLeads > 0)
      .sort((a, b) => {
        if (b.vendas !== a.vendas) return b.vendas - a.vendas;
        return b.valorTotalLiberado - a.valorTotalLiberado;
      });
  }, [perfResponse, filteredLeads, allowedUsers, currentUser, users]);

  // Overall totals calculation
  const totals = useMemo(() => {
    return performanceData.reduce(
      (acc, curr) => {
        acc.totalLeads += curr.totalLeads;
        acc.vendas += curr.vendas;
        acc.perdas += curr.perdas;
        acc.valorTotalLiberado += curr.valorTotalLiberado;
        return acc;
      },
      { totalLeads: 0, vendas: 0, perdas: 0, valorTotalLiberado: 0 }
    );
  }, [performanceData]);

  const hasActiveFilters = selectedYear !== 'all' || selectedMonth !== 'all';

  const handleResetFilters = () => {
    setSelectedYear('all');
    setSelectedMonth('all');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-8">
      {/* Table Header & Date Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
              <Award className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Desempenho por Atendente
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Relatório de Vendas, Perdas e Valor Total Liberado por Atendente.
          </p>
        </div>

        {/* Year and Month Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-brand-600" />
            <span className="font-semibold text-slate-500">Ano:</span>
            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos os Anos</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-brand-600" />
            <span className="font-semibold text-slate-500">Mês:</span>
            <select
              value={selectedMonth}
              onChange={(e) =>
                setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos os Meses</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={idx} value={idx}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-200/60 rounded-xl px-3 py-1.5 transition-all"
              title="Limpar filtro de período"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Período</span>
            </button>
          )}
        </div>
      </div>

      {/* Performance Grid Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[11px] font-semibold tracking-wider uppercase">
              <th className="py-3.5 px-4">Atendente</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-center">Total Leads</th>
              <th className="py-3.5 px-4 text-center">Nº de Vendas</th>
              <th className="py-3.5 px-4 text-center">Nº de Perdas</th>
              <th className="py-3.5 px-4 text-center">Taxa de Conversão</th>
              <th className="py-3.5 px-4 text-right">Valor Total Liberado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
            {performanceData.length > 0 ? (
              performanceData.map((item) => {
                const conversionRate =
                  item.totalLeads > 0 ? ((item.vendas / item.totalLeads) * 100).toFixed(1) : '0.0';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Atendente Name & Initial */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                          {item.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">{item.name}</div>
                          {item.email && (
                            <div className="text-[10px] text-slate-400">{item.email}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status em Tempo Real */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-full text-[11px] ${
                          item.status === 'online'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                            : item.status === 'busy'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                            : 'bg-slate-100 text-slate-600 border border-slate-200/80'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.status === 'online'
                              ? 'bg-emerald-500 animate-pulse'
                              : item.status === 'busy'
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                          }`}
                        />
                        {item.status === 'online'
                          ? 'Online'
                          : item.status === 'busy'
                          ? 'Ocupado'
                          : 'Offline'}
                      </span>
                    </td>

                    {/* Total Leads */}
                    <td className="py-3.5 px-4 text-center font-medium text-slate-700">
                      {item.totalLeads}
                    </td>

                    {/* Número de Vendas */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {item.vendas}
                      </span>
                    </td>

                    {/* Número de Perdas */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-full text-xs">
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        {item.perdas}
                      </span>
                    </td>

                    {/* Taxa de Conversão */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-medium text-slate-700">
                        {conversionRate}%
                      </span>
                    </td>

                    {/* Valor Total Liberado */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 text-xs">
                      {formatCurrency(item.valorTotalLiberado)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                  Nenhum registro de atendimento encontrado no período selecionado.
                </td>
              </tr>
            )}
          </tbody>

          {/* Footer Totals Row */}
          {performanceData.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100/80 font-bold text-slate-900 border-t-2 border-slate-200 text-xs">
                <td className="py-3.5 px-4 uppercase tracking-wider text-[11px] font-bold text-slate-700">
                  Total Geral
                </td>
                <td className="py-3.5 px-4 text-center text-slate-400 font-normal text-xs">-</td>
                <td className="py-3.5 px-4 text-center">{totals.totalLeads}</td>
                <td className="py-3.5 px-4 text-center text-emerald-700 font-bold">
                  {totals.vendas}
                </td>
                <td className="py-3.5 px-4 text-center text-rose-700 font-bold">
                  {totals.perdas}
                </td>
                <td className="py-3.5 px-4 text-center">
                  {totals.totalLeads > 0
                    ? ((totals.vendas / totals.totalLeads) * 100).toFixed(1)
                    : '0.0'}
                  %
                </td>
                <td className="py-3.5 px-4 text-right text-brand-700 font-extrabold text-sm">
                  {formatCurrency(totals.valorTotalLiberado)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
