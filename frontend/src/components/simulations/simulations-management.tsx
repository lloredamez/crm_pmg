'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calculator,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  Building2,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { fetchSimulations, createSimulation } from '@/features/simulations/api';
import { Simulation, SimulationPaginationResponse } from '@/features/leads/types';
import { useSocket } from '@/features/socket/socket-provider';
import { useAuth } from '@/features/auth/auth-provider';

// Utilitário para formatar CPF enquanto digita ou exibe
const formatCpf = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

// Formatação de Moeda BRL
const formatCurrency = (val?: number | null): string => {
  if (val === undefined || val === null) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
};

// Formatação de Data
const formatDate = (isoString?: string): string => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
};

export const SimulationsManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { user } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cpfInput, setCpfInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Consulta de Simulações via React Query
  const { data, isLoading, isFetching, refetch } = useQuery<SimulationPaginationResponse>({
    queryKey: ['simulations', page, debouncedSearch, statusFilter],
    queryFn: () =>
      fetchSimulations({
        page,
        limit: 15,
        search: debouncedSearch,
        status: statusFilter,
      }),
    refetchInterval: 10000, // Polling de contingência a cada 10s
  });

  // Listener WebSocket para Atualizações em Tempo Real
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
    };

    socket.on('simulation:created', handleUpdate);
    socket.on('simulation:updated', handleUpdate);

    return () => {
      socket.off('simulation:created', handleUpdate);
      socket.off('simulation:updated', handleUpdate);
    };
  }, [socket, queryClient]);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpf(e.target.value);
    setCpfInput(formatted);
    setFormError(null);
  };

  const handleSubmitSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = cpfInput.replace(/\D/g, '');
    if (cleanDigits.length !== 11) {
      setFormError('Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await createSimulation(cleanDigits);
      setFormSuccess('Simulação criada e enviada com sucesso para processamento!');
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
      setTimeout(() => {
        setIsModalOpen(false);
        setCpfInput('');
        setFormSuccess(null);
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'Falha ao criar simulação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const renderStatusBadge = (sim: Simulation) => {
    const st = (sim.simulation_status || 'pending').toLowerCase();
    if (st === 'completed' || st === 'aprovado' || st === 'concluido' || st === 'concluído') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Concluído
        </span>
      );
    }
    if (st === 'failed' || st === 'error' || st === 'reprovado' || st === 'rejeitado') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 shadow-sm">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          Recusado / Erro
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm animate-pulse">
        <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
        Aguardando Retorno
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Banner / Header do Módulo */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Módulo de Simulações
            </h1>
          </div>

          <button
            onClick={() => {
              setIsModalOpen(true);
              setFormError(null);
              setFormSuccess(null);
            }}
            className="inline-flex items-center justify-center gap-2.5 bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm shadow-lg shadow-brand-500/25 transition-all cursor-pointer whitespace-nowrap self-start md:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nova Simulação</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por CPF ou Nome do cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Aguardando Retorno</option>
              <option value="completed">Concluídos</option>
              <option value="failed">Recusados / Erro</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {(search || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Atualizar lista"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Tabela de Simulações */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3.5 px-5">Nome do Cliente</th>
                <th className="py-3.5 px-5">CPF</th>
                <th className="py-3.5 px-5">Valor Liberado</th>
                <th className="py-3.5 px-5">Qtd. Parcelas</th>
                <th className="py-3.5 px-5">Valor Parcela</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Consultor</th>
                <th className="py-3.5 px-5 text-right">Data / Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    Carregando simulações...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-slate-700 text-sm">Nenhuma simulação encontrada</p>
                      <p className="text-xs text-slate-400 text-center">
                        {search || statusFilter !== 'all'
                          ? 'Tente ajustar os filtros ou a busca para localizar os dados.'
                          : 'Clique em "Nova Simulação" para cadastrar um CPF e iniciar uma consulta.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((sim) => {
                  const isPending = (sim.simulation_status || 'pending').toLowerCase() === 'pending';
                  return (
                    <tr
                      key={sim.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-default"
                    >
                      {/* Nome */}
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                          {isPending && (!sim.name || sim.name === 'Aguardando simulação...') ? (
                            <span className="text-slate-400 italic font-normal">
                              Aguardando dados...
                            </span>
                          ) : (
                            sim.name
                          )}
                        </div>
                        {sim.banco && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            Banco: {sim.banco} {sim.tabela ? `• ${sim.tabela}` : ''}
                          </div>
                        )}
                      </td>

                      {/* CPF */}
                      <td className="py-3.5 px-5 font-mono text-slate-700 font-semibold tracking-tight">
                        {sim.cpf || '-'}
                      </td>

                      {/* Valor Liberado */}
                      <td className="py-3.5 px-5 font-bold text-emerald-600">
                        {sim.valor_liberado !== undefined && sim.valor_liberado !== null ? (
                          formatCurrency(sim.valor_liberado)
                        ) : (
                          <span className="text-slate-300 font-normal">-</span>
                        )}
                      </td>

                      {/* Quantidade de Parcelas */}
                      <td className="py-3.5 px-5 text-slate-700">
                        {sim.quantidade_parcelas ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-800 text-[11px]">
                            {sim.quantidade_parcelas}x
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">-</span>
                        )}
                      </td>

                      {/* Valor Parcela */}
                      <td className="py-3.5 px-5 font-semibold text-slate-900">
                        {sim.valor_parcela !== undefined && sim.valor_parcela !== null ? (
                          formatCurrency(sim.valor_parcela)
                        ) : (
                          <span className="text-slate-300 font-normal">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">{renderStatusBadge(sim)}</td>

                      {/* Consultor */}
                      <td className="py-3.5 px-5 text-slate-600">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          {sim.attendant_name || (sim.current_attendant_id === user?.id ? 'Você' : '-')}
                        </span>
                      </td>

                      {/* Data / Hora */}
                      <td className="py-3.5 px-5 text-right font-mono text-[11px] text-slate-400">
                        {formatDate(sim.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {total > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Exibindo <span className="font-semibold text-slate-700">{items.length}</span> de{' '}
              <span className="font-semibold text-slate-700">{total}</span> simulações
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 px-2">
                {page} / {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Nova Simulação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center font-bold">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Nova Simulação</h3>
                  <p className="text-[11px] text-slate-400">Consulta de crédito para cliente</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSimulation} className="mt-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-2xl flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  CPF do Cliente
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="000.000.000-00"
                  value={cpfInput}
                  onChange={handleCpfChange}
                  maxLength={14}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-semibold"
                />
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Ao enviar, este CPF será cadastrado como um lead no sistema e enviado ao webhook da esteira externa. Os dados calculados serão sincronizados automaticamente assim que concluídos.
                </p>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-3 rounded-2xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !cpfInput}
                  className="w-2/3 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs py-3 rounded-2xl shadow-md shadow-brand-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Enviando para esteira...</span>
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4" />
                      <span>Iniciar Simulação</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

