'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calculator,
  Plus,
  Search,
  Filter,
  RotateCcw,
  History,
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
  DollarSign,
  CreditCard,
  Pencil,
  Landmark,
  Send,
} from 'lucide-react';
import {
  fetchSimulations,
  createSimulation,
  requestSimulationQuote,
  reprocessSimulationQuote,
  typeSimulationOffer,
  fetchSimulationOfferHistory,
  updateSimulationCadastralData,
  fetchBanks,
} from '@/features/simulations/api';
import { Simulation, SimulationOffer, SimulationOfferHistory, SimulationPaginationResponse, Bank } from '@/features/leads/types';
import { useSocket } from '@/features/socket/socket-provider';
import { useAuth } from '@/features/auth/auth-provider';

// Utilitário para formatar CPF enquanto digita ou exibe
const formatCpf = (val?: string | null): string => {
  if (!val) return '-';
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

// Utilitário para formatar Moeda enquanto digita
const formatCurrencyInput = (val: string): string => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCurrencyToNumber = (val: string): number => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
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

  // Modal State (Nova Simulação por CPF)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cpfInput, setCpfInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Modal State (Nova Cotação por Lead existente)
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [selectedLeadForQuote, setSelectedLeadForQuote] = useState<Simulation | null>(null);
  const [quoteType, setQuoteType] = useState<'valor_emprestimo' | 'valor_parcela'>('valor_emprestimo');
  const [quoteValueInput, setQuoteValueInput] = useState('');
  const [quoteNotesInput, setQuoteNotesInput] = useState('');
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteFormError, setQuoteFormError] = useState<string | null>(null);
  const [quoteFormSuccess, setQuoteFormSuccess] = useState<string | null>(null);

  // Modal de Edição de Dados Cadastrais
  const [isCadastralModalOpen, setIsCadastralModalOpen] = useState(false);
  const [selectedLeadForCadastral, setSelectedLeadForCadastral] = useState<Simulation | null>(null);
  const [activeCadastralTab, setActiveCadastralTab] = useState<'pessoal' | 'documento' | 'endereco' | 'bancario'>('pessoal');
  const [isSavingCadastral, setIsSavingCadastral] = useState(false);
  const [cadastralFormError, setCadastralFormError] = useState<string | null>(null);
  const [cadastralFormSuccess, setCadastralFormSuccess] = useState<string | null>(null);

  // Reprocessamento de Cotações
  const [reprocessingOfferId, setReprocessingOfferId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => {
        setActionFeedback(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  const handleReprocessOffer = async (leadId: string, offerId: string) => {
    try {
      setReprocessingOfferId(offerId);
      setActionFeedback(null);
      await reprocessSimulationQuote(leadId, offerId);
      setActionFeedback({
        type: 'success',
        message: 'Cotação enviada para reprocessamento no webhook com sucesso!',
      });
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Falha ao reprocessar cotação.',
      });
    } finally {
      setReprocessingOfferId(null);
    }
  };

  // Digitação de Proposta (Ação de Digitar)
  const [typingOfferId, setTypingOfferId] = useState<string | null>(null);
  const [nowTime, setNowTime] = useState<number>(Date.now());

  // Atualização periódica do relógio para atualizar estado de expiração (5 minutos)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const isOfferExpiredForTyping = (offer: SimulationOffer, currentNow: number): boolean => {
    const dateStr = offer.updated_at || offer.created_at;
    if (!dateStr) return true;
    const updateTime = new Date(dateStr).getTime();
    if (isNaN(updateTime)) return true;
    // Mais de 5 minutos (5 * 60 * 1000 = 300.000 ms)
    return currentNow - updateTime > 5 * 60 * 1000;
  };

  const handleTypeOffer = async (leadId: string, offer: SimulationOffer) => {
    if (isOfferExpiredForTyping(offer, Date.now())) {
      setActionFeedback({
        type: 'error',
        message: 'A digitação está desabilitada: a última atualização desta oferta ocorreu há mais de 5 minutos.',
      });
      return;
    }

    try {
      setTypingOfferId(offer.id);
      setActionFeedback(null);
      await typeSimulationOffer(leadId, offer.id);
      setActionFeedback({
        type: 'success',
        message: 'Todos os dados do cliente e da proposta foram enviados ao webhook para digitação com sucesso!',
      });
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Falha ao enviar proposta para digitação.',
      });
    } finally {
      setTypingOfferId(null);
    }
  };

  // Modal de Histórico da Cotação
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedOfferForHistory, setSelectedOfferForHistory] = useState<{
    offer: SimulationOffer;
    sim: Simulation;
  } | null>(null);
  const [offerHistoryData, setOfferHistoryData] = useState<SimulationOfferHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handleOpenOfferHistory = async (sim: Simulation, offer: SimulationOffer) => {
    setSelectedOfferForHistory({ sim, offer });
    setIsHistoryModalOpen(true);

    if (offer.history && offer.history.length > 0) {
      setOfferHistoryData(offer.history);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const hist = await fetchSimulationOfferHistory(sim.id, offer.id);
      setOfferHistoryData(hist || []);
    } catch {
      setOfferHistoryData([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Consulta da lista oficial de Bancos para o Select
  const { data: banksData } = useQuery<Bank[]>({
    queryKey: ['banks'],
    queryFn: fetchBanks,
    staleTime: 1000 * 60 * 30, // 30 minutos de cache
  });
  const banks = banksData || [];

  // Estado dos campos do formulário cadastral
  const [cadForm, setCadForm] = useState({
    data_nascimento: '',
    sexo: '',
    estado_civil: '',
    nome_mae: '',
    valor_renda: '',
    numero_referencial_ipc: '',
    tipo_documento: '',
    numero_documento: '',
    orgao_emissor: '',
    uf_orgao_emissor: '',
    data_emissao: '',
    ddd_celular: '',
    numero_celular: '',
    email: '',
    cep: '',
    tipo_logradouro: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    // Dados Bancários
    banco_numero: '',
    banco_nome: '',
    agencia: '',
    conta: '',
    conta_digito: '',
  });

  const handleOpenEditCadastral = (sim: Simulation, tab: 'pessoal' | 'documento' | 'endereco' | 'bancario' = 'pessoal') => {
    setSelectedLeadForCadastral(sim);
    setActiveCadastralTab(tab);
    setCadastralFormError(null);
    setCadastralFormSuccess(null);

    const c = sim.cadastral_data;
    setCadForm({
      data_nascimento: c?.data_nascimento ? c.data_nascimento.split('T')[0] : '',
      sexo: c?.sexo || '',
      estado_civil: c?.estado_civil || '',
      nome_mae: c?.nome_mae || '',
      valor_renda: c?.valor_renda !== undefined && c?.valor_renda !== null ? String(c.valor_renda) : '',
      numero_referencial_ipc: c?.numero_referencial_ipc !== undefined && c?.numero_referencial_ipc !== null ? String(c.numero_referencial_ipc) : '',
      tipo_documento: c?.tipo_documento || '',
      numero_documento: c?.numero_documento || '',
      orgao_emissor: c?.orgao_emissor || '',
      uf_orgao_emissor: c?.uf_orgao_emissor || '',
      data_emissao: c?.data_emissao ? c.data_emissao.split('T')[0] : '',
      ddd_celular: c?.ddd_celular || '',
      numero_celular: c?.numero_celular || '',
      email: c?.email || '',
      cep: c?.cep || '',
      tipo_logradouro: c?.tipo_logradouro || '',
      logradouro: c?.logradouro || '',
      numero: c?.numero || '',
      bairro: c?.bairro || '',
      cidade: c?.cidade || '',
      uf: c?.uf || '',
      banco_numero: c?.banco_numero || '',
      banco_nome: c?.banco_nome || '',
      agencia: c?.agencia || '',
      conta: c?.conta || '',
      conta_digito: c?.conta_digito || '',
    });

    setIsCadastralModalOpen(true);
  };

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

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForQuote) return;

    const numericValue = parseCurrencyToNumber(quoteValueInput);
    if (!numericValue || numericValue <= 0) {
      setQuoteFormError('Por favor, informe um valor válido para a simulação.');
      return;
    }

    setIsSubmittingQuote(true);
    setQuoteFormError(null);
    setQuoteFormSuccess(null);

    try {
      await requestSimulationQuote(selectedLeadForQuote.id, {
        tipo_simulacao: quoteType,
        valor_simulado: numericValue,
        produto_id: selectedLeadForQuote.produto_id ?? selectedLeadForQuote.ProdutoId ?? undefined,
        notes: quoteNotesInput.trim() || undefined,
      });

      setQuoteFormSuccess('Cotação solicitada e enviada com sucesso ao webhook!');
      queryClient.invalidateQueries({ queryKey: ['simulations'] });

      setTimeout(() => {
        setIsQuoteModalOpen(false);
        setSelectedLeadForQuote(null);
        setQuoteValueInput('');
        setQuoteNotesInput('');
        setQuoteFormSuccess(null);
      }, 1200);
    } catch (err: any) {
      setQuoteFormError(err.message || 'Falha ao solicitar cotação.');
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const handleSaveCadastral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForCadastral) return;

    setIsSavingCadastral(true);
    setCadastralFormError(null);
    setCadastralFormSuccess(null);

    try {
      const payload: Record<string, any> = {
        data_nascimento: cadForm.data_nascimento.trim() || null,
        sexo: cadForm.sexo.trim() || null,
        estado_civil: cadForm.estado_civil.trim() || null,
        nome_mae: cadForm.nome_mae.trim() || null,
        valor_renda: cadForm.valor_renda ? parseFloat(cadForm.valor_renda) : null,
        numero_referencial_ipc: cadForm.numero_referencial_ipc ? parseInt(cadForm.numero_referencial_ipc, 10) : null,
        tipo_documento: cadForm.tipo_documento.trim() || null,
        numero_documento: cadForm.numero_documento.trim() || null,
        orgao_emissor: cadForm.orgao_emissor.trim() || null,
        uf_orgao_emissor: cadForm.uf_orgao_emissor.trim() || null,
        data_emissao: cadForm.data_emissao.trim() || null,
        ddd_celular: cadForm.ddd_celular.trim() || null,
        numero_celular: cadForm.numero_celular.trim() || null,
        email: cadForm.email.trim() || null,
        cep: cadForm.cep.replace(/\D/g, '') || null,
        tipo_logradouro: cadForm.tipo_logradouro.trim() || null,
        logradouro: cadForm.logradouro.trim() || null,
        numero: cadForm.numero.trim() || null,
        bairro: cadForm.bairro.trim() || null,
        cidade: cadForm.cidade.trim() || null,
        uf: cadForm.uf.trim().toUpperCase() || null,
        banco_numero: cadForm.banco_numero.trim() || null,
        banco_nome: cadForm.banco_nome.trim() || null,
        agencia: cadForm.agencia.trim() || null,
        conta: cadForm.conta.trim() || null,
        conta_digito: cadForm.conta_digito.trim() || null,
      };

      await updateSimulationCadastralData(selectedLeadForCadastral.id, payload);
      setCadastralFormSuccess('Dados cadastrais atualizados com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['simulations'] });

      setTimeout(() => {
        setIsCadastralModalOpen(false);
        setSelectedLeadForCadastral(null);
        setCadastralFormSuccess(null);
      }, 900);
    } catch (err: any) {
      setCadastralFormError(err.message || 'Falha ao salvar dados cadastrais.');
    } finally {
      setIsSavingCadastral(false);
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
                  const valorBrutoMax = sim.valor_bruto_maximo ?? sim.margem;
                  const isValorBrutoZeroOrNull =
                    valorBrutoMax === null ||
                    valorBrutoMax === undefined ||
                    Number(valorBrutoMax) <= 0 ||
                    isNaN(Number(valorBrutoMax));

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
                                  disabled={isValorBrutoZeroOrNull}
                                  title={
                                    isValorBrutoZeroOrNull
                                      ? 'Não é possível solicitar cotação: Valor Bruto Máximo é nulo ou zero'
                                      : 'Solicitar nova cotação personalizada'
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isValorBrutoZeroOrNull) return;
                                    setSelectedLeadForQuote(sim);
                                    setQuoteType('valor_emprestimo');
                                    setQuoteValueInput('');
                                    setQuoteNotesInput('');
                                    setQuoteFormError(null);
                                    setQuoteFormSuccess(null);
                                    setIsQuoteModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/60 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
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

                              {/* Dados Cadastrais do Cliente */}
                              {sim.cadastral_data ? (
                                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs">
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                                    <div className="flex items-center gap-2">
                                      <User className="w-3.5 h-3.5 text-indigo-500" />
                                      <span>Dados Cadastrais do Cliente</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditCadastral(sim, 'pessoal');
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-white hover:bg-indigo-50 border border-indigo-200/70 rounded-lg transition-colors cursor-pointer"
                                      title="Editar todos os dados cadastrais"
                                    >
                                      <Pencil className="w-3 h-3" />
                                      <span>Editar Cadastro</span>
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                                    {/* Pessoal & Financeiro */}
                                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/70 text-slate-700">
                                      <div className="flex items-center justify-between pb-0.5 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                          Pessoal & Renda
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditCadastral(sim, 'pessoal');
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                          title="Editar dados pessoais e renda"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
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
                                      <div className="flex items-center justify-between pb-0.5 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                          Documento & Contato
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditCadastral(sim, 'documento');
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                          title="Editar documento e contato"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
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
                                      <div className="flex items-center justify-between pb-0.5 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                          Endereço
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditCadastral(sim, 'endereco');
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                          title="Editar endereço"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
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

                                    {/* Dados Bancários */}
                                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/70 text-slate-700">
                                      <div className="flex items-center justify-between pb-0.5 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                          Dados Bancários
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditCadastral(sim, 'bancario');
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                          title="Editar dados bancários"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div>
                                        <span className="text-slate-400">Banco:</span>{' '}
                                        <strong className="font-semibold text-slate-800" title={sim.cadastral_data.banco_nome || undefined}>
                                          {sim.cadastral_data.banco_numero
                                            ? `${sim.cadastral_data.banco_numero} - `
                                            : ''}
                                          {sim.cadastral_data.banco_nome || '-'}
                                        </strong>
                                      </div>
                                      <div>
                                        <span className="text-slate-400">Agência:</span>{' '}
                                        <span className="font-mono font-medium text-slate-800">
                                          {sim.cadastral_data.agencia || '-'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400">Conta:</span>{' '}
                                        <span className="font-mono font-medium text-slate-800">
                                          {sim.cadastral_data.conta || '-'}
                                          {sim.cadastral_data.conta_digito ? `-${sim.cadastral_data.conta_digito}` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2 text-slate-500">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Nenhum dado cadastral registrado para este cliente.</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditCadastral(sim, 'pessoal');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-white hover:bg-indigo-50 border border-indigo-200/70 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span>Cadastrar Dados</span>
                                  </button>
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
                                        <th className="py-2.5 px-3.5 text-center">Ações</th>
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
                                            <div className="font-semibold text-slate-700">
                                              {formatDate(offer.updated_at || offer.created_at)}
                                            </div>
                                            {offer.updated_at && offer.updated_at !== offer.created_at && (
                                              <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                                                Criado: {formatDate(offer.created_at)}
                                              </div>
                                            )}
                                          </td>

                                          {/* Atendente */}
                                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                              {offer.attendant_name || (offer.attendant_id === user?.id ? 'Você' : (offer.attendant_id || '-'))}
                                            </span>
                                            {offer.history && offer.history.some((h) => h.action === 'reprocessed') && (
                                              <div className="text-[10px] text-indigo-600 font-semibold mt-0.5 flex items-center gap-1">
                                                <RotateCcw className="w-2.5 h-2.5" />
                                                <span>
                                                  Reprocessado por{' '}
                                                  {offer.history.find((h) => h.action === 'reprocessed')?.user_name || 'Consultor'}
                                                </span>
                                              </div>
                                            )}
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

                                          {/* Ações */}
                                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1.5 justify-center">
                                              {/* Digitar Proposta no Webhook */}
                                              {(() => {
                                                const isExpired = isOfferExpiredForTyping(offer, nowTime);
                                                return (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (!isExpired) {
                                                        handleTypeOffer(sim.id, offer);
                                                      }
                                                    }}
                                                    disabled={isExpired || typingOfferId === offer.id}
                                                    className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all ${
                                                      isExpired
                                                        ? 'text-slate-300 bg-slate-50 border-slate-200 cursor-not-allowed opacity-40'
                                                        : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border-slate-200/80 hover:border-emerald-300 cursor-pointer group/type shadow-xs'
                                                    }`}
                                                    title={
                                                      isExpired
                                                        ? 'Digitação desabilitada: última atualização da oferta ocorreu há mais de 5 minutos'
                                                        : 'Digitar proposta: envia todos os dados do cliente para o webhook'
                                                    }
                                                  >
                                                    <Send
                                                      className={`w-3.5 h-3.5 ${
                                                        typingOfferId === offer.id
                                                          ? 'animate-pulse text-emerald-600'
                                                          : !isExpired
                                                          ? 'group-hover/type:translate-x-0.5 group-hover/type:-translate-y-0.5 transition-transform'
                                                          : ''
                                                      }`}
                                                    />
                                                  </button>
                                                );
                                              })()}

                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleReprocessOffer(sim.id, offer.id);
                                                }}
                                                disabled={reprocessingOfferId === offer.id}
                                                className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                                title="Reprocessar cotação no webhook"
                                              >
                                                <RotateCcw
                                                  className={`w-3.5 h-3.5 ${
                                                    reprocessingOfferId === offer.id
                                                      ? 'animate-spin text-indigo-600'
                                                      : 'group-hover/btn:-rotate-180 transition-transform duration-300'
                                                  }`}
                                                />
                                              </button>

                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenOfferHistory(sim, offer);
                                                }}
                                                className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 border border-slate-200/80 transition-all cursor-pointer group/hist"
                                                title="Ver histórico de quem criou e quem reprocessou"
                                              >
                                                <History className="w-3.5 h-3.5 transition-transform group-hover/hist:rotate-[-20deg]" />
                                              </button>
                                            </div>
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

      {/* Modal de Nova Cotação Personalizada (Webhook) */}
      {isQuoteModalOpen && selectedLeadForQuote && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md sm:max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Nova Cotação</h3>
                  <p className="text-[11px] text-slate-400">Simulação por valor de empréstimo ou parcela</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsQuoteModalOpen(false);
                  setSelectedLeadForQuote(null);
                  setQuoteValueInput('');
                  setQuoteNotesInput('');
                  setQuoteFormError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumo do Lead */}
            <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cliente</span>
                  <p className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                    {selectedLeadForQuote.name || 'Cliente'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">CPF</span>
                  <p className="text-xs font-mono font-bold text-slate-700">{formatCpf(selectedLeadForQuote.cpf)}</p>
                </div>
              </div>

              {(selectedLeadForQuote.nome_produto || selectedLeadForQuote.NomeProduto || selectedLeadForQuote.produto_id || selectedLeadForQuote.ProdutoId) && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Produto</span>
                    <span className="font-bold text-brand-700">
                      {selectedLeadForQuote.nome_produto || selectedLeadForQuote.NomeProduto || `ID: ${selectedLeadForQuote.produto_id || selectedLeadForQuote.ProdutoId}`}
                    </span>
                  </div>
                  {(selectedLeadForQuote.valor_liberado_maximo || selectedLeadForQuote.valor_liberado) && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Máx. Liberado</span>
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(selectedLeadForQuote.valor_liberado_maximo ?? selectedLeadForQuote.valor_liberado)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitQuote} className="mt-4 space-y-4">
              {quoteFormError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{quoteFormError}</span>
                </div>
              )}

              {quoteFormSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-2xl flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{quoteFormSuccess}</span>
                </div>
              )}

              {/* Seletor do Tipo de Simulação */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Tipo de Simulação
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setQuoteType('valor_emprestimo')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      quoteType === 'valor_emprestimo'
                        ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${quoteType === 'valor_emprestimo' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full border ${quoteType === 'valor_emprestimo' ? 'bg-brand-600 border-brand-600' : 'border-slate-300'}`} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 block">Valor de Empréstimo</span>
                    <span className="text-[10px] text-slate-500">Valor desejado a liberar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuoteType('valor_parcela')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      quoteType === 'valor_parcela'
                        ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${quoteType === 'valor_parcela' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full border ${quoteType === 'valor_parcela' ? 'bg-brand-600 border-brand-600' : 'border-slate-300'}`} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 block">Valor de Parcela</span>
                    <span className="text-[10px] text-slate-500">Parcela mensal máxima</span>
                  </button>
                </div>
              </div>

              {/* Input de Valor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>
                    {quoteType === 'valor_emprestimo' ? 'Valor do Empréstimo a Simular' : 'Valor da Parcela Desejada'}
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">Obrigatório</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="R$ 0,00"
                  value={quoteValueInput}
                  onChange={(e) => {
                    setQuoteValueInput(formatCurrencyInput(e.target.value));
                    setQuoteFormError(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-bold"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Observações (opcional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais para este cálculo..."
                  value={quoteNotesInput}
                  onChange={(e) => setQuoteNotesInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium resize-none"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsQuoteModalOpen(false);
                    setSelectedLeadForQuote(null);
                    setQuoteValueInput('');
                    setQuoteNotesInput('');
                    setQuoteFormError(null);
                  }}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-3 rounded-2xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuote || !quoteValueInput}
                  className="w-2/3 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs py-3 rounded-2xl shadow-md shadow-brand-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmittingQuote ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Enviando Cotação...</span>
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4" />
                      <span>Solicitar Cotação</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Dados Cadastrais */}
      {isCadastralModalOpen && selectedLeadForCadastral && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Editar Dados Cadastrais</h3>
                  <p className="text-[11px] text-slate-400">
                    Cliente: <strong className="text-slate-700">{selectedLeadForCadastral.name || 'Cliente'}</strong> ({formatCpf(selectedLeadForCadastral.cpf)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCadastralModalOpen(false);
                  setSelectedLeadForCadastral(null);
                  setCadastralFormError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas de Navegação */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-4 p-1 bg-slate-100/80 rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => setActiveCadastralTab('pessoal')}
                className={`py-2 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeCadastralTab === 'pessoal'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span className="truncate">Pessoal</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCadastralTab('documento')}
                className={`py-2 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeCadastralTab === 'documento'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="truncate">Documento</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCadastralTab('endereco')}
                className={`py-2 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeCadastralTab === 'endereco'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span className="truncate">Endereço</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCadastralTab('bancario')}
                className={`py-2 px-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeCadastralTab === 'bancario'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span className="truncate">Bancário</span>
              </button>
            </div>

            {/* Formulário com Scroll */}
            <form onSubmit={handleSaveCadastral} className="mt-4 flex-1 overflow-y-auto pr-1 space-y-4">
              {cadastralFormError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cadastralFormError}</span>
                </div>
              )}

              {cadastralFormSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-2xl flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{cadastralFormSuccess}</span>
                </div>
              )}

              {/* Aba: Pessoal & Renda */}
              {activeCadastralTab === 'pessoal' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Data de Nascimento
                      </label>
                      <input
                        type="date"
                        value={cadForm.data_nascimento}
                        onChange={(e) => setCadForm({ ...cadForm, data_nascimento: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Sexo
                      </label>
                      <select
                        value={cadForm.sexo}
                        onChange={(e) => setCadForm({ ...cadForm, sexo: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="">Selecione...</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Estado Civil
                      </label>
                      <select
                        value={cadForm.estado_civil}
                        onChange={(e) => setCadForm({ ...cadForm, estado_civil: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="">Selecione...</option>
                        <option value="Solteiro">Solteiro(a)</option>
                        <option value="Casado">Casado(a)</option>
                        <option value="Divorciado">Divorciado(a)</option>
                        <option value="Viúvo">Viúvo(a)</option>
                        <option value="União Estável">União Estável</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Renda Mensal (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={cadForm.valor_renda}
                        onChange={(e) => setCadForm({ ...cadForm, valor_renda: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nome da Mãe
                    </label>
                    <input
                      type="text"
                      placeholder="Nome completo da mãe"
                      value={cadForm.nome_mae}
                      onChange={(e) => setCadForm({ ...cadForm, nome_mae: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Número Referencial IPC
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 17195116"
                      value={cadForm.numero_referencial_ipc}
                      onChange={(e) => setCadForm({ ...cadForm, numero_referencial_ipc: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Aba: Documento & Contato */}
              {activeCadastralTab === 'documento' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Tipo Documento
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: RG, CNH"
                        value={cadForm.tipo_documento}
                        onChange={(e) => setCadForm({ ...cadForm, tipo_documento: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Número do Documento
                      </label>
                      <input
                        type="text"
                        placeholder="Número do documento"
                        value={cadForm.numero_documento}
                        onChange={(e) => setCadForm({ ...cadForm, numero_documento: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Órgão Emissor
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: SSP"
                        value={cadForm.orgao_emissor}
                        onChange={(e) => setCadForm({ ...cadForm, orgao_emissor: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        UF Emissor
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="Ex: SP"
                        value={cadForm.uf_orgao_emissor}
                        onChange={(e) => setCadForm({ ...cadForm, uf_orgao_emissor: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Data de Emissão
                      </label>
                      <input
                        type="date"
                        value={cadForm.data_emissao}
                        onChange={(e) => setCadForm({ ...cadForm, data_emissao: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        DDD Celular
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="Ex: 11"
                        value={cadForm.ddd_celular}
                        onChange={(e) => setCadForm({ ...cadForm, ddd_celular: e.target.value.replace(/\D/g, '') })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Número Celular
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 999999999"
                        value={cadForm.numero_celular}
                        onChange={(e) => setCadForm({ ...cadForm, numero_celular: e.target.value.replace(/\D/g, '') })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      E-mail do Cliente
                    </label>
                    <input
                      type="email"
                      placeholder="cliente@email.com"
                      value={cadForm.email}
                      onChange={(e) => setCadForm({ ...cadForm, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Aba: Endereço */}
              {activeCadastralTab === 'endereco' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        CEP
                      </label>
                      <input
                        type="text"
                        maxLength={9}
                        placeholder="00000-000"
                        value={cadForm.cep}
                        onChange={(e) => setCadForm({ ...cadForm, cep: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Tipo Logradouro
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Rua, Av."
                        value={cadForm.tipo_logradouro}
                        onChange={(e) => setCadForm({ ...cadForm, tipo_logradouro: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Número
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 123"
                        value={cadForm.numero}
                        onChange={(e) => setCadForm({ ...cadForm, numero: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Logradouro (Rua / Endereço)
                    </label>
                    <input
                      type="text"
                      placeholder="Nome da rua ou avenida"
                      value={cadForm.logradouro}
                      onChange={(e) => setCadForm({ ...cadForm, logradouro: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Bairro
                      </label>
                      <input
                        type="text"
                        placeholder="Nome do bairro"
                        value={cadForm.bairro}
                        onChange={(e) => setCadForm({ ...cadForm, bairro: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        UF (Estado)
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="Ex: SP"
                        value={cadForm.uf}
                        onChange={(e) => setCadForm({ ...cadForm, uf: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Cidade
                    </label>
                    <input
                      type="text"
                      placeholder="Nome da cidade"
                      value={cadForm.cidade}
                      onChange={(e) => setCadForm({ ...cadForm, cidade: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Aba: Dados Bancários */}
              {activeCadastralTab === 'bancario' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Banco (Instituição Financeira)</span>
                      <span className="text-[10px] font-normal text-slate-400">
                        {banks.length} bancos disponíveis
                      </span>
                    </label>
                    <select
                      value={cadForm.banco_numero}
                      onChange={(e) => {
                        const code = e.target.value;
                        const sel = banks.find((b) => b.code === code);
                        setCadForm({
                          ...cadForm,
                          banco_numero: code,
                          banco_nome: sel ? sel.name : '',
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium cursor-pointer"
                    >
                      <option value="">Selecione um banco...</option>
                      {banks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.code} - {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {cadForm.banco_nome && (
                    <div className="p-2.5 bg-indigo-50/70 border border-indigo-200/60 rounded-xl text-xs flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="text-[11px] text-indigo-800 font-semibold">
                        Código: <strong className="font-mono">{cadForm.banco_numero}</strong> • {cadForm.banco_nome}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Agência
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 0001"
                        value={cadForm.agencia}
                        onChange={(e) => setCadForm({ ...cadForm, agencia: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Conta
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 1234567"
                        value={cadForm.conta}
                        onChange={(e) => setCadForm({ ...cadForm, conta: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Dígito da Conta
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="Ex: 8"
                        value={cadForm.conta_digito}
                        onChange={(e) => setCadForm({ ...cadForm, conta_digito: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Botões do Rodapé */}
              <div className="flex gap-2.5 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsCadastralModalOpen(false);
                    setSelectedLeadForCadastral(null);
                    setCadastralFormError(null);
                  }}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-3 rounded-2xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCadastral}
                  className="w-2/3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs py-3 rounded-2xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSavingCadastral ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Histórico da Cotação */}
      {isHistoryModalOpen && selectedOfferForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Cabeçalho do Modal */}
            <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Histórico da Cotação
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedOfferForHistory.sim.name || 'Cliente'} • CPF:{' '}
                    <span className="font-mono font-semibold text-slate-700">
                      {formatCpf(selectedOfferForHistory.sim.cpf)}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setSelectedOfferForHistory(null);
                  setOfferHistoryData([]);
                }}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumo da Cotação Selecionada */}
            <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Valor Liberado:</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(selectedOfferForHistory.offer.valor_liberado)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Parcelas:</span>
                <span className="font-semibold text-slate-800">
                  {selectedOfferForHistory.offer.parcela || selectedOfferForHistory.offer.quantidade_parcelas
                    ? `${selectedOfferForHistory.offer.parcela || selectedOfferForHistory.offer.quantidade_parcelas}x de ${formatCurrency(selectedOfferForHistory.offer.valor_parcela)}`
                    : '-'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Status atual:</span>
                {renderOfferStatusBadge(selectedOfferForHistory.offer.status)}
              </div>
              {selectedOfferForHistory.offer.id_condicao_financiamento && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Condição:</span>
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {selectedOfferForHistory.offer.id_condicao_financiamento}
                  </span>
                </div>
              )}
            </div>

            {/* Conteúdo / Tabela de Histórico */}
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Clock className="w-6 h-6 animate-spin text-amber-500" />
                  <span>Carregando histórico...</span>
                </div>
              ) : (
                (() => {
                  const records =
                    offerHistoryData.length > 0
                      ? offerHistoryData
                      : [
                          {
                            id: 'initial',
                            simulation_offer_id: selectedOfferForHistory.offer.id,
                            simulation_lead_id: selectedOfferForHistory.sim.id,
                            action: 'created',
                            user_name:
                              selectedOfferForHistory.offer.attendant_name ||
                              (selectedOfferForHistory.offer.attendant_id === user?.id
                                ? 'Você'
                                : selectedOfferForHistory.sim.attendant_name || 'Consultor'),
                            created_at: selectedOfferForHistory.offer.created_at,
                            custom_fields: selectedOfferForHistory.offer.custom_fields,
                          },
                        ];

                  return (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-3.5">Data / Hora</th>
                            <th className="py-2.5 px-3.5 text-center">Ação</th>
                            <th className="py-2.5 px-3.5">Responsável</th>
                            <th className="py-2.5 px-3.5">Detalhes / Observações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                          {records.map((item, idx) => {
                            const isCreation = item.action === 'created';
                            const isReprocess = item.action === 'reprocessed';
                            const isTyped = item.action === 'typed' || item.action === 'digitar';

                            return (
                              <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                {/* Data / Hora */}
                                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                  {formatDate(item.created_at)}
                                </td>

                                {/* Ação */}
                                <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                  {isCreation ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                      Criação da Cotação
                                    </span>
                                  ) : isReprocess ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      <RotateCcw className="w-3 h-3 text-indigo-500" />
                                      Reprocessamento
                                    </span>
                                  ) : isTyped ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                      <Send className="w-3 h-3 text-emerald-600" />
                                      Digitação de Proposta
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                      {item.action}
                                    </span>
                                  )}
                                </td>

                                {/* Responsável */}
                                <td className="py-3 px-3.5 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    {item.user_name || 'Sistema'}
                                  </span>
                                </td>

                                {/* Detalhes */}
                                <td className="py-3 px-3.5 text-slate-600 text-[11px]">
                                  {item.custom_fields?.valor_simulado ? (
                                    <div>
                                      <span className="font-semibold text-slate-800">
                                        Simulado: {formatCurrency(item.custom_fields.valor_simulado)}
                                      </span>{' '}
                                      <span className="text-slate-400">
                                        ({item.custom_fields.tipo_simulacao === 'valor_parcela' ? 'por parcela' : 'por empréstimo'})
                                      </span>
                                    </div>
                                  ) : null}
                                  {item.custom_fields?.notes ? (
                                    <div className="text-slate-500 italic mt-0.5">
                                      Obs: {item.custom_fields.notes}
                                    </div>
                                  ) : null}
                                  {!item.custom_fields?.valor_simulado && !item.custom_fields?.notes && (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setSelectedOfferForHistory(null);
                  setOfferHistoryData([]);
                }}
                className="bg-slate-200/80 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast de Ações / Reprocessamento */}
      {actionFeedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 duration-300 ${
            actionFeedback.type === 'success'
              ? 'bg-slate-900/95 text-emerald-400 border-emerald-500/30 backdrop-blur-md'
              : 'bg-slate-900/95 text-rose-400 border-rose-500/30 backdrop-blur-md'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="text-white">{actionFeedback.message}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="ml-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

