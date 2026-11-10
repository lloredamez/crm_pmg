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
  ChevronDown,
  Layers,
  Sparkles,
  Phone,
  User,
} from 'lucide-react';
import { fetchSimulations, createSimulation } from '@/features/simulations/api';
import { Simulation, SimulationOffer, SimulationPaginationResponse } from '@/features/leads/types';
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

// Utilitário para formatar Celular enquanto digita
const formatPhoneInput = (val: string): string => {
  let digits = val.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// Formatação para exibição do Celular
const formatPhone = (val?: string | null): string => {
  if (!val) return '-';
  const digits = val.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return val;
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

// Formatação apenas de Data (dd/mm/aaaa)
const formatDateOnly = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};

// Formatação de CEP
const formatCep = (cep?: string | null): string => {
  if (!cep) return '-';
  const clean = cep.replace(/\D/g, '');
  if (clean.length === 8) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return cep;
};

// Formatação de Taxa de Juros
const formatTaxa = (val?: number | null): string => {
  if (val === undefined || val === null) return '-';
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`;
};

export const SimulationsManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { user } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Controle de linhas expandidas para exibir o histórico de simulações do lead
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cpfInput, setCpfInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhoneInput(formatted);
    setFormError(null);
  };

  const handleSubmitSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = cpfInput.replace(/\D/g, '');
    if (cleanDigits.length !== 11) {
      setFormError('Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }

    const cleanPhone = phoneInput.replace(/\D/g, '');
    if (!cleanPhone) {
      setFormError('Por favor, informe o número de celular com DDD.');
      return;
    }
    if (cleanPhone.length !== 11 && cleanPhone.length !== 10) {
      setFormError('Por favor, informe um número de celular válido com DDD (ex: (11) 99999-9999).');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await createSimulation({
        cpf: cleanDigits,
        phone: phoneInput.trim(),
        notes: notesInput.trim() || undefined,
      });
      setFormSuccess('Simulação criada e enviada com sucesso para processamento!');
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
      setTimeout(() => {
        setIsModalOpen(false);
        setCpfInput('');
        setPhoneInput('');
        setNotesInput('');
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

  const renderOfferStatusBadge = (status?: string | null) => {
    const st = (status || 'pending').toLowerCase();
    if (st === 'completed' || st === 'aprovado' || st === 'concluido' || st === 'concluído') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          Concluído
        </span>
      );
    }
    if (st === 'failed' || st === 'error' || st === 'reprovado' || st === 'rejeitado') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-500" />
          Recusado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
        <Clock className="w-3 h-3 text-amber-500 animate-spin" />
        Pendente
      </span>
    );
  };

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
              setCpfInput('');
              setPhoneInput('');
              setNotesInput('');
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
              placeholder="Buscar por CPF, Celular ou Nome do cliente..."
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
                <th className="py-3.5 px-3 w-10 text-center"></th>
                <th className="py-3.5 px-5">Nome do Cliente</th>
                <th className="py-3.5 px-5">CPF</th>
                <th className="py-3.5 px-5">Celular</th>
                <th className="py-3.5 px-5 text-center">Cotações</th>
                <th className="py-3.5 px-5">Consultor</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Data de Cadastro</th>
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
                  const isExpanded = expandedRows.has(sim.id);
                  const offersCount = sim.total_offers || sim.offers?.length || 0;

                  return (
                    <React.Fragment key={sim.id}>
                      <tr
                        className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${isExpanded ? 'bg-slate-50/60' : ''
                          }`}
                        onClick={() => toggleRow(sim.id)}
                      >
                        {/* Seta de Expansão */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(sim.id);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 transition-all cursor-pointer"
                            title={isExpanded ? 'Recolher simulações' : 'Ver simulações deste cliente'}
                          >
                            <ChevronRight
                              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-brand-600' : 'text-slate-400'
                                }`}
                            />
                          </button>
                        </td>

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
                          {(sim.notes || sim.observacoes) && (
                            <div
                              className="text-[11px] text-slate-500 font-normal mt-0.5 line-clamp-1 max-w-xs"
                              title={sim.notes || sim.observacoes || ''}
                            >
                              <span className="text-slate-400 font-medium">Obs:</span>{' '}
                              {sim.notes || sim.observacoes}
                            </div>
                          )}
                        </td>

                        {/* CPF */}
                        <td className="py-3.5 px-5 font-mono text-slate-700 font-semibold tracking-tight whitespace-nowrap">
                          {sim.cpf || '-'}
                        </td>

                        {/* Celular */}
                        <td className="py-3.5 px-5 font-mono text-slate-700 font-medium whitespace-nowrap">
                          {sim.phone ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-800">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {formatPhone(sim.phone)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Quantidade de Simulações / Cotações */}
                        <td className="py-3.5 px-5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors ${offersCount > 0
                              ? 'bg-indigo-50/80 text-indigo-700 border-indigo-200/60'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                          >
                            <Layers className="w-3 h-3 text-indigo-500" />
                            {offersCount} {offersCount === 1 ? 'cotação' : 'cotações'}
                          </span>
                        </td>

                        {/* Consultor */}
                        <td className="py-3.5 px-5 text-slate-600">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                            {sim.attendant_name || (sim.current_attendant_id === user?.id ? 'Você' : '-')}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-5">{renderStatusBadge(sim)}</td>

                        {/* Data / Hora */}
                        <td className="py-3.5 px-5 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {formatDate(sim.created_at)}
                        </td>
                      </tr>

                      {/* Sub-tabela Expandida com o Histórico de Simulações */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-y border-slate-200/80 animate-in fade-in-50 duration-150">
                          <td colSpan={8} className="p-4 sm:p-6">
                            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-4">
                              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                    <Calculator className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900">
                                      Simulações para este CPF ({offersCount})
                                    </h4>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCpfInput(sim.cpf || '');
                                    setPhoneInput(sim.phone || '');
                                    setNotesInput('');
                                    setIsModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/60 rounded-xl transition-all cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Nova Cotação</span>
                                </button>
                              </div>

                              {/* Limites Máximos do Cliente (Produto, Valor Bruto Máximo, Valor Liberado Máximo, Prazo Máximo, Parcela Máxima) */}
                              {(sim.valor_bruto_maximo !== undefined && sim.valor_bruto_maximo !== null ||
                                sim.margem !== undefined && sim.margem !== null ||
                                sim.valor_liberado_maximo !== undefined && sim.valor_liberado_maximo !== null ||
                                sim.valor_liberado !== undefined && sim.valor_liberado !== null ||
                                sim.prazo_maximo !== undefined && sim.prazo_maximo !== null ||
                                sim.prazo !== undefined && sim.prazo !== null ||
                                sim.nome_produto || sim.NomeProduto) && (
                                <div className={`grid grid-cols-2 ${(sim.nome_produto || sim.NomeProduto) ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs`}>
                                  {(sim.nome_produto || sim.NomeProduto) && (
                                    <div>
                                      <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Produto</span>
                                      <span className="font-bold text-brand-700 truncate block" title={sim.nome_produto || sim.NomeProduto || undefined}>
                                        {sim.nome_produto || sim.NomeProduto}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Valor Bruto Máx.</span>
                                    <span className="font-bold text-slate-900">
                                      {(sim.valor_bruto_maximo ?? sim.margem) !== undefined && (sim.valor_bruto_maximo ?? sim.margem) !== null
                                        ? formatCurrency(sim.valor_bruto_maximo ?? sim.margem)
                                        : '-'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Valor Máx. Liberado</span>
                                    <span className="font-bold text-emerald-600">
                                      {formatCurrency(sim.valor_liberado_maximo ?? sim.valor_liberado)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Prazo Máximo</span>
                                    <span className="font-bold text-slate-800">
                                      {(sim.prazo_maximo || sim.prazo) ? `${sim.prazo_maximo || sim.prazo}x` : '-'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Parcela Máxima</span>
                                    <span className="font-bold text-slate-900">
                                      {formatCurrency(sim.valor_parcela_maximo ?? sim.valor_parcela)}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Dados Cadastrais do Cliente (se fornecidos pelo webhook) */}
                              {sim.cadastral_data && (
                                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs">
                                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                                    <User className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Dados Cadastrais do Cliente</span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                                    {/* Pessoal & Financeiro */}
                                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/70 text-slate-700">
                                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-0.5 border-b border-slate-100">
                                        Pessoal & Renda
                                      </div>
                                      <div>
                                        <span className="text-slate-400">Nascimento:</span>{' '}
                                        <strong className="font-semibold text-slate-800">
                                          {formatDateOnly(sim.cadastral_data.data_nascimento)}
                                        </strong>
                                      </div>
                                      <div>
                                        <span className="text-slate-400">Sexo / Est. Civil:</span>{' '}
                                        <span className="font-medium text-slate-800">
                                          {sim.cadastral_data.sexo || '-'}
                                          {sim.cadastral_data.estado_civil ? ` • ${sim.cadastral_data.estado_civil}` : ''}
                                        </span>
                                      </div>
                                      {sim.cadastral_data.nome_mae && (
                                        <div className="truncate" title={sim.cadastral_data.nome_mae}>
                                          <span className="text-slate-400">Mãe:</span>{' '}
                                          <span className="font-medium text-slate-800">{sim.cadastral_data.nome_mae}</span>
                                        </div>
                                      )}
                                      {sim.cadastral_data.valor_renda !== undefined && sim.cadastral_data.valor_renda !== null && (
                                        <div className="text-emerald-700">
                                          <span className="text-slate-400 font-normal">Renda:</span>{' '}
                                          <strong className="font-bold">{formatCurrency(sim.cadastral_data.valor_renda)}</strong>
                                        </div>
                                      )}
                                      {sim.cadastral_data.numero_referencial_ipc && (
                                        <div className="text-[11px] text-slate-600">
                                          <span className="text-slate-400">Nº Ref. IPC:</span>{' '}
                                          <span className="font-mono">{sim.cadastral_data.numero_referencial_ipc}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Documento & Contato */}
                                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/70 text-slate-700">
                                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-0.5 border-b border-slate-100">
                                        Documento & Contato
                                      </div>
                                      <div>
                                        <span className="text-slate-400">Documento:</span>{' '}
                                        <strong className="font-semibold text-slate-800 font-mono">
                                          {sim.cadastral_data.tipo_documento ? `${sim.cadastral_data.tipo_documento}: ` : ''}
                                          {sim.cadastral_data.numero_documento || '-'}
                                        </strong>
                                      </div>
                                      {(sim.cadastral_data.orgao_emissor || sim.cadastral_data.uf_orgao_emissor || sim.cadastral_data.data_emissao) && (
                                        <div className="text-[11px] text-slate-600">
                                          <span className="text-slate-400">Emissão:</span>{' '}
                                          {sim.cadastral_data.orgao_emissor || ''}
                                          {sim.cadastral_data.uf_orgao_emissor ? `/${sim.cadastral_data.uf_orgao_emissor}` : ''}
                                          {sim.cadastral_data.data_emissao ? ` em ${formatDateOnly(sim.cadastral_data.data_emissao)}` : ''}
                                        </div>
                                      )}
                                      {(sim.cadastral_data.ddd_celular || sim.cadastral_data.numero_celular) && (
                                        <div className="font-mono text-[11px]">
                                          <span className="text-slate-400 font-sans">Celular:</span>{' '}
                                          {sim.cadastral_data.ddd_celular ? `(${sim.cadastral_data.ddd_celular}) ` : ''}
                                          {sim.cadastral_data.numero_celular || ''}
                                        </div>
                                      )}
                                      {sim.cadastral_data.email && (
                                        <div className="truncate text-[11px]" title={sim.cadastral_data.email}>
                                          <span className="text-slate-400">Email:</span>{' '}
                                          <span className="font-medium text-slate-800">{sim.cadastral_data.email}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Endereço */}
                                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/70 text-slate-700">
                                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-0.5 border-b border-slate-100">
                                        Endereço
                                      </div>
                                      <div>
                                        <span className="font-semibold text-slate-900">
                                          {sim.cadastral_data.tipo_logradouro ? `${sim.cadastral_data.tipo_logradouro} ` : ''}
                                          {sim.cadastral_data.logradouro || '-'}
                                        </span>
                                        {sim.cadastral_data.numero ? `, ${sim.cadastral_data.numero}` : ''}
                                      </div>
                                      <div className="text-slate-600 text-[11px]">
                                        {sim.cadastral_data.bairro ? `${sim.cadastral_data.bairro}, ` : ''}
                                        {sim.cadastral_data.cidade || ''}
                                        {sim.cadastral_data.uf ? ` - ${sim.cadastral_data.uf}` : ''}
                                      </div>
                                      <div className="font-mono text-[11px] text-slate-600">
                                        <span className="text-slate-400 font-sans">CEP:</span>{' '}
                                        {formatCep(sim.cadastral_data.cep)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {(!sim.offers || sim.offers.length === 0) ? (
                                <div className="py-8 text-center text-slate-400 text-xs">
                                  Nenhuma cotação detalhada registrada ainda para este cliente.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                        <th className="py-2.5 px-3.5">Data / Hora</th>
                                        <th className="py-2.5 px-3.5">Atendente</th>
                                        <th className="py-2.5 px-3.5">Valor Bruto</th>
                                        <th className="py-2.5 px-3.5">Valor Liberado</th>
                                        <th className="py-2.5 px-3.5">Parcelas</th>
                                        <th className="py-2.5 px-3.5">Valor Parcela</th>
                                        <th className="py-2.5 px-3.5">Taxa de Juros</th>
                                        <th className="py-2.5 px-3.5 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                      {sim.offers.map((offer: SimulationOffer) => (
                                        <tr
                                          key={offer.id}
                                          className="hover:bg-slate-50/80 transition-colors"
                                        >
                                          {/* Data / Hora */}
                                          <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                            {formatDate(offer.created_at)}
                                          </td>

                                          {/* Atendente */}
                                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                              {offer.attendant_name || (offer.attendant_id === user?.id ? 'Você' : (offer.attendant_id || '-'))}
                                            </span>
                                          </td>

                                          {/* Valor Bruto */}
                                          <td className="py-2.5 px-3.5 font-semibold text-slate-800 whitespace-nowrap">
                                            {formatCurrency(offer.valor_bruto)}
                                          </td>

                                          {/* Valor Liberado */}
                                          <td className="py-2.5 px-3.5 font-bold text-emerald-600 whitespace-nowrap">
                                            {formatCurrency(offer.valor_liberado)}
                                          </td>

                                          {/* Parcelas */}
                                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                                            {offer.parcela || offer.quantidade_parcelas ? (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-800 text-[11px]">
                                                {offer.parcela || offer.quantidade_parcelas}x
                                              </span>
                                            ) : (
                                              <span className="text-slate-300 font-normal">-</span>
                                            )}
                                          </td>

                                          {/* Valor Parcela */}
                                          <td className="py-2.5 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                                            {formatCurrency(offer.valor_parcela)}
                                          </td>

                                          {/* Taxa de Juros */}
                                          <td className="py-2.5 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                                            {formatTaxa(offer.taxa_juros)}
                                          </td>

                                          {/* Status */}
                                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                                            {renderOfferStatusBadge(offer.status)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
                onClick={() => {
                  setIsModalOpen(false);
                  setCpfInput('');
                  setPhoneInput('');
                  setNotesInput('');
                  setFormError(null);
                }}
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>CPF do Cliente</span>
                  <span className="text-[10px] font-normal text-slate-400">Obrigatório</span>
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
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Celular do Cliente (com DDD)</span>
                  <span className="text-[10px] font-normal text-slate-400">Obrigatório</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="(00) 00000-0000"
                    value={phoneInput}
                    onChange={handlePhoneChange}
                    maxLength={15}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Observações (opcional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais ou detalhes da simulação..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setCpfInput('');
                    setPhoneInput('');
                    setNotesInput('');
                    setFormError(null);
                  }}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-3 rounded-2xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !cpfInput || !phoneInput}
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

