'use client';

import React, { useState, useEffect } from 'react';
import { Disposition, Channel, ChannelDispositionSla, Category } from '@/features/leads/types';
import {
  fetchDispositions,
  createDisposition,
  updateDisposition,
  toggleDispositionStatus,
  deleteDisposition,
  fetchChannelSlas,
  upsertChannelSla,
  deleteChannelSla,
} from '@/features/dispositions/api';
import { fetchChannels } from '@/features/channels/api';
import { fetchCategories } from '@/features/categories/api';
import { Plus, Edit2, Trash2, Tag, Power, X, Clock, AlertCircle, Sliders, Share2, Check } from 'lucide-react';

export const DispositionManagement: React.FC = () => {
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelSlas, setChannelSlas] = useState<ChannelDispositionSla[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Disposition Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDisp, setEditingDisp] = useState<Disposition | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Negociação');
  const [hasTimeout, setHasTimeout] = useState(true);
  const [timeoutHours, setTimeoutHours] = useState('2');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Channel SLA Modal State
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedDispId, setSelectedDispId] = useState('');
  const [slaTimeoutHours, setSlaTimeoutHours] = useState('1');
  const [savingSla, setSavingSla] = useState(false);
  const [slaErrorMsg, setSlaErrorMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dispData, channelData, slaData, catData] = await Promise.all([
        fetchDispositions(false),
        fetchChannels(false),
        fetchChannelSlas(),
        fetchCategories(true),
      ]);
      setDispositions(dispData);
      setChannels(channelData);
      setChannelSlas(slaData);
      setAvailableCategories(catData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingDisp(null);
    setName('');
    setCategory('Negociação');
    setHasTimeout(true);
    setTimeoutHours('2');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (disp: Disposition) => {
    setEditingDisp(disp);
    setName(disp.name);
    setCategory(disp.category);
    setHasTimeout(disp.has_timeout);
    setTimeoutHours(
      disp.timeout_minutes ? (disp.timeout_minutes / 60).toString() : '2'
    );
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleToggleActive = async (disp: Disposition) => {
    try {
      await toggleDispositionStatus(disp.id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (disp: Disposition) => {
    if (!confirm(`Deseja realmente excluir a tabulação "${disp.name}"?`)) return;
    try {
      await deleteDisposition(disp.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir tabulação');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome da tabulação');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const minutes = hasTimeout ? parseFloat((parseFloat(timeoutHours) * 60).toFixed(2)) : null;

    try {
      if (editingDisp) {
        await updateDisposition(editingDisp.id, {
          name,
          category,
          has_timeout: hasTimeout,
          timeout_minutes: minutes,
        });
      } else {
        await createDisposition({
          name,
          category,
          has_timeout: hasTimeout,
          timeout_minutes: minutes,
          is_active: true,
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar tabulação');
    } finally {
      setSubmitting(false);
    }
  };

  // SLA Override Handlers
  const handleOpenSlaModal = () => {
    setSelectedChannelId(channels.length > 0 ? channels[0].id : '');
    setSelectedDispId(dispositions.length > 0 ? dispositions[0].id : '');
    setSlaTimeoutHours('1');
    setSlaErrorMsg('');
    setIsSlaModalOpen(true);
  };

  const handleSaveSlaOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannelId || !selectedDispId) {
      setSlaErrorMsg('Selecione um canal e uma tabulação');
      return;
    }

    setSavingSla(true);
    setSlaErrorMsg('');
    const minutes = parseFloat((parseFloat(slaTimeoutHours) * 60).toFixed(2));

    try {
      await upsertChannelSla({
        channel_id: selectedChannelId,
        disposition_id: selectedDispId,
        timeout_minutes: minutes,
      });
      loadData();
      setSlaErrorMsg('');
    } catch (err: any) {
      setSlaErrorMsg(err.message || 'Erro ao salvar SLA do canal');
    } finally {
      setSavingSla(false);
    }
  };

  const handleDeleteSlaOverride = async (slaId: string) => {
    if (!confirm('Deseja remover esta sobrecarga de SLA e voltar ao tempo padrão?')) return;
    try {
      await deleteChannelSla(slaId);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir regra de SLA por canal');
    }
  };

  const formatHours = (minutes?: number | null) => {
    if (!minutes) return 'Sem estouro (infinito)';
    if (minutes < 1) return `${Math.round(minutes * 60)} seg`;
    if (minutes < 60) return `${minutes} min`;
    const hours = (minutes / 60).toFixed(1);
    return `${hours.replace('.0', '')}h (${minutes} min)`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Tabulações de Atendimento</h2>
            <p className="text-xs text-slate-400">
              Gerencie as opções de tabulação padrão e os tempos de estouro (SLA) customizados por canal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenSlaModal}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all font-semibold text-xs flex items-center gap-2"
          >
            <Sliders className="w-4 h-4 text-brand-600" />
            Configurar SLAs por Canal ({channelSlas.length})
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-all font-semibold text-xs flex items-center gap-2 shadow-sm shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            Nova Tabulação
          </button>
        </div>
      </div>

      {/* Dispositions Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Carregando tabulações...</div>
        ) : dispositions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhuma tabulação cadastrada. Clique em "Nova Tabulação" para começar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Nome da Tabulação</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Possui SLA?</th>
                  <th className="py-3.5 px-4">Tempo Padrão</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {dispositions.map((disp) => {
                  const isSemTabulacao = disp.category === 'Sem Tabulação' || disp.name.toLowerCase().includes('sem tabulação');
                  return (
                    <tr key={disp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{disp.name}</span>
                          {isSemTabulacao && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              SLA Inicial
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {disp.category}
                        </span>
                      </td>
                    <td className="py-3.5 px-4">
                      {disp.has_timeout ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <Clock className="w-3.5 h-3.5" /> Sim
                        </span>
                      ) : (
                        <span className="text-slate-400">Não</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {disp.has_timeout ? formatHours(disp.timeout_minutes) : '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleActive(disp)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          disp.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        {disp.is_active ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(disp)}
                          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(disp)}
                          className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create/Edit Disposition */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingDisp ? 'Editar Tabulação' : 'Nova Tabulação Padrão'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Tabulação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Em Contato, Vendido, Sem Interesse..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none font-medium"
                >
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {category && !availableCategories.some((c) => c.name === category) && (
                    <option value={category}>{category}</option>
                  )}
                </select>
              </div>

              <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800">
                    Possui Tempo de Estouro (SLA)?
                  </label>
                  <input
                    type="checkbox"
                    checked={hasTimeout}
                    onChange={(e) => setHasTimeout(e.target.checked)}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                </div>

                {hasTimeout && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1 font-medium">
                      Tempo Limite Padrão (em horas)
                    </label>
                    <select
                      value={timeoutHours}
                      onChange={(e) => setTimeoutHours(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none font-medium"
                    >
                      <option value="0.0083333">⚡ 30 Segundos (para testes)</option>
                      <option value="0.0166667">⚡ 1 Minuto (para testes)</option>
                      <option value="0.0833333">5 Minutos</option>
                      <option value="0.25">15 Minutos</option>
                      <option value="0.5">30 Minutos (0.5h)</option>
                      <option value="1">1 Hora</option>
                      <option value="2">2 Horas</option>
                      <option value="4">4 Horas</option>
                      <option value="8">8 Horas</option>
                      <option value="12">12 Horas</option>
                      <option value="24">24 Horas (1 dia)</option>
                      <option value="48">48 Horas (2 dias)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-brand-500/20"
                >
                  {submitting ? 'Salvando...' : 'Salvar Tabulação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Channel SLA Overrides */}
      {isSlaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-base">Configurar SLAs por Canal</h3>
              </div>
              <button
                onClick={() => setIsSlaModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {slaErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{slaErrorMsg}</span>
              </div>
            )}

            {/* Form to Add / Update Channel SLA */}
            <form onSubmit={handleSaveSlaOverride} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
              <span className="font-bold text-slate-800 block">Adicionar / Atualizar Exceção de SLA</span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Canal de Origem</label>
                  <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none"
                  >
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tabulação Padrão</label>
                  <select
                    value={selectedDispId}
                    onChange={(e) => setSelectedDispId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none"
                  >
                    {dispositions.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tempo Customizado</label>
                  <select
                    value={slaTimeoutHours}
                    onChange={(e) => setSlaTimeoutHours(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none"
                  >
                    <option value="0.0083333">⚡ 30 Segundos</option>
                    <option value="0.0166667">⚡ 1 Minuto</option>
                    <option value="0.0833333">5 Minutos</option>
                    <option value="0.25">15 Minutos</option>
                    <option value="0.5">30 Minutos</option>
                    <option value="1">1 Hora</option>
                    <option value="2">2 Horas</option>
                    <option value="4">4 Horas</option>
                    <option value="12">12 Horas</option>
                    <option value="24">24 Horas (1 dia)</option>
                    <option value="48">48 Horas (2 dias)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingSla}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {savingSla ? 'Salvando...' : 'Salvar SLA Customizado'}
                </button>
              </div>
            </form>

            {/* List of Existing Channel SLAs */}
            <div className="overflow-y-auto flex-1 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Exceções Ativas por Canal</span>
              {channelSlas.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400">
                  Nenhuma exceção cadastrada. Todos os canais estão usando os tempos padrão das tabulações.
                </div>
              ) : (
                <div className="space-y-2">
                  {channelSlas.map((sla) => {
                    const chan = channels.find((c) => c.id === sla.channel_id);
                    const disp = dispositions.find((d) => d.id === sla.disposition_id);
                    return (
                      <div key={sla.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 font-semibold text-slate-800">
                            <Share2 className="w-3.5 h-3.5 text-brand-600" />
                            <span>{chan ? chan.name : 'Canal'}</span>
                          </div>
                          <span className="text-slate-400">→</span>
                          <div className="font-semibold text-slate-700">
                            {disp ? disp.name : 'Tabulação'}
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 font-bold border border-brand-100">
                            {formatHours(sla.timeout_minutes)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteSlaOverride(sla.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Remover Exceção"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSlaModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
