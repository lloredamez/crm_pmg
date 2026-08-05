'use client';

import React, { useState, useEffect } from 'react';
import { Lead, Disposition } from '@/features/leads/types';
import { fetchDispositions, tabulateLead } from '@/features/dispositions/api';
import { X, Tag, Clock, CheckCircle, AlertCircle, Save } from 'lucide-react';

interface TabulateLeadModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TabulateLeadModal: React.FC<TabulateLeadModalProps> = ({
  lead,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [selectedDispId, setSelectedDispId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && lead) {
      loadActiveDispositions();
      setNotes('');
      setErrorMsg('');
    }
  }, [isOpen, lead?.id]);

  const loadActiveDispositions = async () => {
    setLoading(true);
    try {
      const data = await fetchDispositions(true);
      setDispositions(data);
      if (data.length > 0) {
        // Preselect current lead disposition or first active
        const match = data.find((d) => d.id === lead?.disposition_id);
        setSelectedDispId(match ? match.id : data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  const dispCategory = lead.disposition?.category?.toLowerCase() || '';
  const isTerminal =
    lead.status === 'converted' ||
    lead.status === 'lost' ||
    dispCategory.includes('venda') ||
    dispCategory.includes('perda') ||
    dispCategory.includes('sucesso') ||
    dispCategory.includes('fechado') ||
    dispCategory.includes('sem interesse');

  const selectedDisp = dispositions.find((d) => d.id === selectedDispId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTerminal) {
      setErrorMsg('Este lead atingiu o final do fluxo e não pode mais ser tabulado.');
      return;
    }
    if (!selectedDispId) {
      setErrorMsg('Selecione uma tabulação para o atendimento');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await tabulateLead(lead.id, {
        disposition_id: selectedDispId,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao tabular lead');
    } finally {
      setSubmitting(false);
    }
  };

  // Group dispositions by category
  const categories = Array.from(new Set(dispositions.map((d) => d.category)));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Tabular Atendimento</h3>
              <p className="text-xs text-slate-400">Cliente: <span className="font-semibold text-slate-700">{lead.name}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isTerminal && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Este lead atingiu o final do fluxo (Venda/Perda) e não pode receber novas tabulações.</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Carregando opções de tabulação...
          </div>
        ) : dispositions.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Nenhuma tabulação ativa cadastrada no sistema.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selecione a Tabulação
              </label>
              <select
                value={selectedDispId}
                onChange={(e) => setSelectedDispId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                {categories.map((cat) => (
                  <optgroup key={cat} label={`Categoria: ${cat}`}>
                    {dispositions
                      .filter((d) => d.category === cat)
                      .map((disp) => (
                        <option key={disp.id} value={disp.id}>
                          {disp.name} {disp.has_timeout && disp.timeout_minutes ? `(Estouro: ${disp.timeout_minutes / 60}h)` : '(Sem Estouros)'}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Timeout Preview Box */}
            {selectedDisp && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Tempo Limite SLA:</span>
                    <span className="text-slate-500 text-[11px]">
                      {selectedDisp.has_timeout && selectedDisp.timeout_minutes
                        ? `O lead terá ${selectedDisp.timeout_minutes / 60}h para nova interação antes da reatribuição.`
                        : 'Esta tabulação não expira por tempo.'}
                    </span>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                  selectedDisp.has_timeout ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {selectedDisp.has_timeout ? 'Com Estouro' : 'Sem Estouro'}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Observações do Atendimento
              </label>
              <textarea
                rows={3}
                placeholder="Insira detalhes adicionais sobre esta tabulação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none font-normal"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting || isTerminal}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm shadow-brand-500/20 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> {submitting ? 'Salvando...' : 'Confirmar Tabulação'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
