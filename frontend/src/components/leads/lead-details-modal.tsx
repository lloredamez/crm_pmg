'use client';

import React, { useState, useEffect } from 'react';
import { Lead, LeadHistoryItem } from '@/features/leads/types';
import { updateLeadDetails, fetchLeadHistory } from '@/features/leads/api';
import { formatDate, formatPhone, formatCpf } from '@/lib/utils';
import { X, Lock, Edit3, Save, FileText, CheckCircle, History, Clock, User, AlertCircle, RefreshCw, Tag, MessageSquare } from 'lucide-react';

interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({
  lead,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [verifiedCpf, setVerifiedCpf] = useState('');
  const [proposalNumber, setProposalNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // History state
  const [historyItems, setHistoryItems] = useState<LeadHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (lead) {
      setVerifiedCpf(lead.verified_cpf || '');
      setProposalNumber(lead.proposal_number || '');
      setNotes(lead.notes || '');
      setSavedSuccess(false);
    }
  }, [lead?.id]);

  useEffect(() => {
    if (isOpen && lead && activeTab === 'history') {
      loadHistory();
    }
  }, [isOpen, lead?.id, lead?.current_attendant_id, activeTab]);


  const loadHistory = async () => {
    if (!lead) return;
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await fetchLeadHistory(lead.id);
      setHistoryItems(data);
    } catch (err: any) {
      console.error(err);
      setHistoryError(err.message || 'Erro ao carregar histórico');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen || !lead) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await updateLeadDetails(lead.id, {
        verified_cpf: verifiedCpf,
        proposal_number: proposalNumber,
        notes: notes,
      });
      setSavedSuccess(true);
      onRefresh();
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return 'Menos de 1 min';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      const remMins = mins % 60;
      return `${hrs}h ${remMins}min`;
    }
    return `${mins} min`;
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Em Atendimento</span>;
      case 'expired_timeout':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Estouro SLA (Timeout)</span>;
      case 'disposition_timeout':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Estouro SLA (Tabulação)</span>;
      case 'manually_reassigned':
      case 'bulk_manually_reassigned':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Reatribuído</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Concluído</span>;
      case 'tabulated':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">Tabulado</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };


  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Ficha de Dados & Histórico</h3>
              <p className="text-xs text-slate-400">
                Gerenciamento do lead e visualização da linha do tempo de atendimentos.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === 'details'
                ? 'border-brand-600 text-brand-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Ficha do Lead
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === 'history'
                ? 'border-brand-600 text-brand-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Histórico de Atendimento
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'details' ? (
            <>
              {/* Read-Only Data Section */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Dados do Lead (Somente Leitura)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 rounded-2xl p-4 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Nome do Lead</span>
                    <span className="font-semibold text-slate-800">{lead.name}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Telefone / WhatsApp</span>
                    <span className="font-semibold text-slate-800">{formatPhone(lead.phone)}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">CPF Cadastrado (Origem)</span>
                    <span className="font-semibold text-slate-800">{formatCpf(lead.cpf)}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">E-mail</span>
                    <span className="font-semibold text-slate-800">{lead.email || '-'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Campanha / Origem</span>
                    <span className="font-semibold text-slate-800">{lead.campaign_name || 'Meta Ads Direct'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Data de Cadastro</span>
                    <span className="font-semibold text-slate-800">{formatDate(lead.created_at)}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Atendente Alocado</span>
                    <span className="font-semibold text-slate-800">
                      {lead.current_attendant?.name || 'Na Fila'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Loja / Unidade</span>
                    <span className="font-semibold text-slate-800">
                      {lead.unit?.name || lead.unit_name || 'Loja Principal'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable Fields Section */}
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Campos Editáveis (Proposta & Observações)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      CPF Correto / Verificado
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 000.000.000-00"
                      value={verifiedCpf}
                      onChange={(e) => setVerifiedCpf(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Número da Proposta
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: PROP-2026-889"
                      value={proposalNumber}
                      onChange={(e) => setProposalNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Insira detalhes da proposta, negociação ou observações sobre o cliente..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none font-normal"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-brand-500/20 flex items-center gap-1.5 transition-all"
                  >
                    {savedSuccess ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-white" /> Salvo!
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* History Tab Content */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <History className="w-3.5 h-3.5" />
                  <span>Histórico de Atribuições & Passagens</span>
                </div>
                <button
                  onClick={loadHistory}
                  disabled={isLoadingHistory}
                  className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
                  <span className="text-xs font-medium">Carregando histórico do lead...</span>
                </div>
              ) : historyError ? (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-xs">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{historyError}</span>
                </div>
              ) : historyItems.length === 0 ? (
                <div className="py-12 text-center bg-slate-50/80 rounded-2xl border border-slate-100">
                  <User className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Nenhum registro de histórico encontrado</p>
                  <p className="text-xs text-slate-400 mt-1">Este lead ainda não passou por reatribuições ou estouros.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-100 ml-4 space-y-6 py-2">
                  {historyItems.map((item, idx) => {
                    const isTabulation = item.event_type === 'tabulation';
                    return (
                      <div key={item.id || idx} className="relative pl-6">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-2.25 top-1.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                          isTabulation
                            ? 'border-indigo-500 bg-indigo-50'
                            : item.status === 'active'
                            ? 'border-emerald-500 bg-emerald-50'
                            : item.status.includes('timeout')
                            ? 'border-rose-500 bg-rose-50'
                            : 'border-slate-300'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            isTabulation ? 'bg-indigo-500' : item.status === 'active' ? 'bg-emerald-500' : item.status.includes('timeout') ? 'bg-rose-500' : 'bg-slate-400'
                          }`} />
                        </div>

                        {/* Card Event Content */}
                        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 text-xs space-y-2 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-400" />
                              <span className="font-bold text-slate-900">{item.attendant_name}</span>
                              {item.attendant_email && (
                                <span className="text-slate-400 font-normal">({item.attendant_email})</span>
                              )}
                            </div>
                            <div>{renderStatusBadge(isTabulation ? 'tabulated' : item.status)}</div>
                          </div>

                          {isTabulation ? (
                            /* Tabulation Event Body */
                            <div className="space-y-2 pt-1 border-t border-slate-200/60">
                              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Data da Tabulação: <strong className="text-slate-700">{formatDate(item.assigned_at)}</strong></span>
                                </div>
                              </div>

                              <div className="bg-white/90 rounded-xl p-2.5 space-y-1.5 border border-slate-200/80">
                                {item.disposition_name && (
                                  <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                                    <Tag className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>Tabulação: <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{item.disposition_name}</span></span>
                                  </div>
                                )}
                                {item.disposition_notes && (
                                  <div className="flex items-start gap-1.5 text-slate-600 text-xs pt-0.5">
                                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                    <div>
                                      <span className="font-semibold text-slate-700 block">Observação:</span>
                                      <p className="text-slate-600 whitespace-pre-wrap mt-0.5 font-normal">{item.disposition_notes}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Assignment Event Body */
                            <>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-500 pt-1 border-t border-slate-200/60">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Início: <strong className="text-slate-700">{formatDate(item.assigned_at)}</strong></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Fim: <strong className="text-slate-700">{item.unassigned_at ? formatDate(item.unassigned_at) : 'Em andamento'}</strong></span>
                                </div>
                              </div>

                              {item.duration_seconds !== undefined && item.duration_seconds !== null && (
                                <div className="text-slate-400 text-[11px] font-medium pt-0.5">
                                  Duração no atendimento: <span className="text-slate-700 font-semibold">{formatDuration(item.duration_seconds)}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
