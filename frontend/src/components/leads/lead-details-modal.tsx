'use client';

import React, { useState, useEffect } from 'react';
import { Lead } from '@/features/leads/types';
import { updateLeadDetails } from '@/features/leads/api';
import { formatDate, formatPhone, formatCpf } from '@/lib/utils';
import { X, Lock, Edit3, Save, FileText, CheckCircle } from 'lucide-react';

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
  const [verifiedCpf, setVerifiedCpf] = useState('');
  const [proposalNumber, setProposalNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (lead) {
      setVerifiedCpf(lead.verified_cpf || '');
      setProposalNumber(lead.proposal_number || '');
      setNotes(lead.notes || '');
      setSavedSuccess(false);
    }
  }, [lead]);

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
              <h3 className="font-bold text-slate-900 text-base">Ficha de Dados & Proposta</h3>
              <p className="text-xs text-slate-400">
                Visualização completa dos dados do lead e edição de proposta/observação.
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

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
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
        </div>
      </div>
    </div>
  );
};
