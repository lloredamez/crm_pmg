'use client';

import React, { useState, useEffect } from 'react';
import { Lead, Disposition, Channel } from '@/features/leads/types';
import { fetchDispositions, tabulateLead } from '@/features/dispositions/api';
import { fetchChannels } from '@/features/channels/api';
import { getEffectiveChannelFields } from '@/features/channels/constants';
import { X, Tag, Clock, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';

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
  const { user } = useAuth();
  const isManagerOrSupervisor = user?.role === 'manager' || user?.role === 'supervisor';
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedDispId, setSelectedDispId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [leadFields, setLeadFields] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && lead) {
      loadActiveDispositions();
      setNotes('');
      setErrorMsg('');

      const initial: Record<string, any> = {
        name: lead.name || '',
        phone: lead.phone || '',
        cpf: lead.cpf || '',
        verified_cpf: lead.verified_cpf || '',
        email: lead.email || '',
        product_name: lead.product_name || lead.product || '',
        campaign_name: lead.campaign_name || '',
        proposal_number: lead.proposal_number || '',
        banco: lead.banco || '',
        tabela: lead.tabela || '',
        prazo: lead.prazo !== undefined && lead.prazo !== null ? String(lead.prazo) : '',
        margem: lead.margem !== undefined && lead.margem !== null ? String(lead.margem) : '',
        valor_liberado: lead.valor_liberado !== undefined && lead.valor_liberado !== null ? String(lead.valor_liberado) : '',
        ...(lead.custom_fields || {}),
      };
      setLeadFields(initial);
    }
  }, [isOpen, lead?.id]);

  const loadActiveDispositions = async () => {
    setLoading(true);
    try {
      const [data, channelsData] = await Promise.all([
        fetchDispositions(true),
        fetchChannels(true),
      ]);

      setChannels(channelsData);

      let available = data;
      if (lead?.channel_code && channelsData.length > 0) {
        const leadChan = channelsData.find(
          (c) => c.code.toUpperCase() === lead.channel_code?.toUpperCase()
        );
        if (leadChan && leadChan.dispositions && leadChan.dispositions.length > 0) {
          const allowedIds = new Set(leadChan.dispositions.map((d) => d.id));
          available = data.filter((d) => allowedIds.has(d.id));
        }
      }

      setDispositions(available);
      if (available.length > 0) {
        // Preselect current lead disposition or first active
        const match = available.find((d) => d.id === lead?.disposition_id);
        setSelectedDispId(match ? match.id : available[0].id);
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
    dispCategory.includes('ganho') ||
    dispCategory.includes('sem interesse');

  const selectedDisp = dispositions.find((d) => d.id === selectedDispId);

  // Tabulação de Ganho (Venda, Ganho, Sucesso, Fechado)
  const isWonDisposition = Boolean(
    selectedDisp && (
      selectedDisp.category?.toLowerCase().includes('venda') ||
      selectedDisp.category?.toLowerCase().includes('ganho') ||
      selectedDisp.category?.toLowerCase().includes('sucesso') ||
      selectedDisp.category?.toLowerCase().includes('fechado') ||
      selectedDisp.name?.toLowerCase().includes('venda') ||
      selectedDisp.name?.toLowerCase().includes('ganho')
    )
  );

  const leadChannel = channels.find(
    (c) => c.code.toUpperCase() === lead?.channel_code?.toUpperCase()
  );
  const effectiveChannelFields = getEffectiveChannelFields(leadChannel?.allowed_fields);
  const requiredFields = effectiveChannelFields.filter((f) => f.required);
  const editableFields = effectiveChannelFields.filter((f) => !f.isReadOnly);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isManagerOrSupervisor) {
      setErrorMsg('Gerentes e supervisores não têm permissão para tabular leads.');
      return;
    }
    if (isTerminal) {
      setErrorMsg('Este lead atingiu o final do fluxo e não pode mais ser tabulado.');
      return;
    }
    if (!selectedDispId) {
      setErrorMsg('Selecione uma tabulação para o atendimento');
      return;
    }

    // Se for tabulação de ganho, validar preenchimento de todos os campos obrigatórios
    if (isWonDisposition) {
      const missingLabels: string[] = [];
      for (const rf of requiredFields) {
        const val = leadFields[rf.key];
        if (
          val === undefined ||
          val === null ||
          (typeof val === 'string' && val.trim() === '')
        ) {
          missingLabels.push(rf.label);
        }
      }

      if (missingLabels.length > 0) {
        setErrorMsg(
          `Para tabulação de ganho, é obrigatório preencher todos os campos obrigatórios: ${missingLabels.join(', ')}.`
        );
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      let payloadLeadFields: Record<string, any> | undefined = undefined;

      if (isWonDisposition) {
        const parsedPrazo =
          typeof leadFields.prazo === 'string' && leadFields.prazo.trim() !== ''
            ? parseInt(leadFields.prazo, 10)
            : typeof leadFields.prazo === 'number'
            ? leadFields.prazo
            : null;

        const parsedMargem =
          typeof leadFields.margem === 'string' && leadFields.margem.trim() !== ''
            ? parseFloat(leadFields.margem.replace(',', '.'))
            : typeof leadFields.margem === 'number'
            ? leadFields.margem
            : null;

        const parsedValorLiberado =
          typeof leadFields.valor_liberado === 'string' &&
          leadFields.valor_liberado.trim() !== ''
            ? parseFloat(leadFields.valor_liberado.replace(',', '.'))
            : typeof leadFields.valor_liberado === 'number'
            ? leadFields.valor_liberado
            : null;

        const standardKeys = [
          'name',
          'phone',
          'cpf',
          'verified_cpf',
          'email',
          'product_name',
          'campaign_name',
          'proposal_number',
          'banco',
          'tabela',
          'prazo',
          'margem',
          'valor_liberado',
        ];

        const custom_fields: Record<string, any> = {};
        Object.keys(leadFields).forEach((k) => {
          if (!standardKeys.includes(k)) {
            custom_fields[k] = leadFields[k];
          }
        });

        payloadLeadFields = {
          name: typeof leadFields.name === 'string' && leadFields.name.trim() !== '' ? leadFields.name.trim() : lead.name,
          phone: typeof leadFields.phone === 'string' && leadFields.phone.trim() !== '' ? leadFields.phone.trim() : lead.phone,
          cpf: leadFields.cpf ? String(leadFields.cpf).trim() : null,
          verified_cpf: leadFields.verified_cpf ? String(leadFields.verified_cpf).trim() : null,
          email: leadFields.email ? String(leadFields.email).trim() : null,
          product_name: leadFields.product_name ? String(leadFields.product_name).trim() : null,
          campaign_name: leadFields.campaign_name ? String(leadFields.campaign_name).trim() : null,
          proposal_number: leadFields.proposal_number ? String(leadFields.proposal_number).trim() : null,
          banco: leadFields.banco ? String(leadFields.banco).trim() : null,
          tabela: leadFields.tabela ? String(leadFields.tabela).trim() : null,
          prazo: isNaN(parsedPrazo as number) ? null : parsedPrazo,
          margem: isNaN(parsedMargem as number) ? null : parsedMargem,
          valor_liberado: isNaN(parsedValorLiberado as number) ? null : parsedValorLiberado,
          custom_fields,
        };
      }

      await tabulateLead(lead.id, {
        disposition_id: selectedDispId,
        notes: notes.trim() || undefined,
        lead_fields: payloadLeadFields,
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
      <div className={`bg-white rounded-3xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[92vh] ${
        isWonDisposition ? 'max-w-2xl' : 'max-w-lg'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl font-bold flex items-center justify-center ${
              isWonDisposition ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
            }`}>
              {isWonDisposition ? <CheckCircle2 className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
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
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-2xl flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Este lead atingiu o final do fluxo (Venda/Perda) e não pode receber novas tabulações.</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-2xl flex items-center gap-2 shrink-0">
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
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selecione a Tabulação
              </label>
              <select
                value={selectedDispId}
                onChange={(e) => {
                  setSelectedDispId(e.target.value);
                  setErrorMsg('');
                }}
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

            {/* Seção Especial: Campos Obrigatórios da Tabulação de Ganho */}
            {isWonDisposition && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                        Campos Obrigatórios da Venda / Ganho
                      </h4>
                      <p className="text-[11px] text-emerald-700">
                        {requiredFields.length > 0
                          ? 'Os campos marcados com * são obrigatórios para registrar o ganho.'
                          : 'Preencha os dados da proposta comercial antes de confirmar o ganho.'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/70 text-emerald-800">
                    Ganho
                  </span>
                </div>

                {editableFields.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {editableFields.map((field) => {
                      const val = leadFields[field.key] ?? '';
                      const isRequired = !!field.required;
                      const isWideTextarea = field.type === 'textarea';

                      return (
                        <div
                          key={field.key}
                          className={isWideTextarea ? 'sm:col-span-2' : ''}
                        >
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {field.label}{' '}
                            {isRequired && (
                              <span className="text-rose-500 font-bold">*</span>
                            )}
                          </label>

                          {field.type === 'select' ? (
                            <select
                              value={val}
                              onChange={(e) =>
                                setLeadFields((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              className={`w-full border rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                                isRequired && !val
                                  ? 'border-rose-300 focus:border-rose-500'
                                  : 'border-slate-200 focus:border-emerald-500'
                              }`}
                            >
                              <option value="">Selecione...</option>
                              {(field.options || []).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : field.type === 'boolean' ? (
                            <div className="flex items-center gap-2 pt-1.5">
                              <input
                                type="checkbox"
                                id={`tab_field_${field.key}`}
                                checked={!!val}
                                onChange={(e) =>
                                  setLeadFields((prev) => ({
                                    ...prev,
                                    [field.key]: e.target.checked,
                                  }))
                                }
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                              />
                              <label
                                htmlFor={`tab_field_${field.key}`}
                                className="text-xs text-slate-700 cursor-pointer select-none"
                              >
                                {field.placeholder || 'Ativado'}
                              </label>
                            </div>
                          ) : field.type === 'textarea' ? (
                            <textarea
                              rows={2}
                              value={val}
                              placeholder={
                                field.placeholder ||
                                `Preencha ${field.label.toLowerCase()}...`
                              }
                              onChange={(e) =>
                                setLeadFields((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              className={`w-full border rounded-xl p-2.5 text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                                isRequired && !val
                                  ? 'border-rose-300 focus:border-rose-500'
                                  : 'border-slate-200 focus:border-emerald-500'
                              }`}
                            />
                          ) : (
                            <input
                              type={
                                field.type === 'number'
                                  ? 'number'
                                  : field.type === 'date'
                                  ? 'date'
                                  : 'text'
                              }
                              value={val}
                              placeholder={
                                field.placeholder ||
                                (field.type === 'currency' ? '0,00' : '')
                              }
                              onChange={(e) =>
                                setLeadFields((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              className={`w-full border rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                                isRequired && !val
                                  ? 'border-rose-300 focus:border-rose-500'
                                  : 'border-slate-200 focus:border-emerald-500'
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700">
                    Nenhum campo editável associado ao canal deste lead.
                  </p>
                )}
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

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
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
                className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isWonDisposition
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                    : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'
                }`}
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
