'use client';

import React, { useState, useEffect } from 'react';
import { Channel, Unit, Disposition } from '@/features/leads/types';
import {
  fetchChannels,
  createChannel,
  updateChannel,
  toggleChannelStatus,
  deleteChannel,
} from '@/features/channels/api';
import { fetchUnits } from '@/features/units/api';
import { fetchDispositions } from '@/features/dispositions/api';
import { Plus, Edit2, Trash2, Share2, Power, X, AlertCircle, Store, Check, Tag } from 'lucide-react';

export const ChannelManagement: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [selectedDispIds, setSelectedDispIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [channelsData, unitsData, dispData] = await Promise.all([
        fetchChannels(false),
        fetchUnits(false),
        fetchDispositions(false),
      ]);
      setChannels(channelsData);
      setUnits(unitsData);
      setDispositions(dispData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingChannel(null);
    setName('');
    setCode('');
    // By default select all active units and dispositions
    setSelectedUnitIds(units.map((u) => u.id));
    setSelectedDispIds(dispositions.map((d) => d.id));
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setName(channel.name);
    setCode(channel.code);
    setSelectedUnitIds(channel.units ? channel.units.map((u) => u.id) : []);
    setSelectedDispIds(channel.dispositions ? channel.dispositions.map((d) => d.id) : []);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleToggleUnitSelection = (unitId: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  const handleToggleDispSelection = (dispId: string) => {
    setSelectedDispIds((prev) =>
      prev.includes(dispId) ? prev.filter((id) => id !== dispId) : [...prev, dispId]
    );
  };

  const handleToggleActive = async (channel: Channel) => {
    try {
      await toggleChannelStatus(channel.id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (channel: Channel) => {
    if (!confirm(`Deseja realmente excluir o canal "${channel.name}"?`)) return;
    try {
      await deleteChannel(channel.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir canal');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome do canal');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      if (editingChannel) {
        await updateChannel(editingChannel.id, {
          name: name.trim(),
          code: code.trim() || undefined,
          unit_ids: selectedUnitIds,
          disposition_ids: selectedDispIds,
        });
      } else {
        await createChannel({
          name: name.trim(),
          code: code.trim() || undefined,
          is_active: true,
          unit_ids: selectedUnitIds,
          disposition_ids: selectedDispIds,
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar canal de leads');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-brand-600" />
            Canais de Leads
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre os canais de captação (ex: Meta Ads, Google, WhatsApp), associe lojas participantes e defina as tabulações disponíveis para cada canal.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-4 py-2.5 rounded-2xl shadow-sm shadow-brand-500/20 flex items-center gap-1.5 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" /> Novo Canal
        </button>
      </div>

      {/* Channels Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">
            Carregando canais de leads...
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">
            Nenhum canal cadastrado. Clique no botão acima para criar o primeiro canal de leads.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[11px] font-semibold tracking-wider uppercase">
                  <th className="py-3 px-4">Nome do Canal</th>
                  <th className="py-3 px-4">Código / Chave</th>
                  <th className="py-3 px-4">Lojas Participantes</th>
                  <th className="py-3 px-4">Tabulações Disponíveis</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {channels.map((channel) => (
                  <tr key={channel.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-brand-600 shrink-0" />
                      {channel.name}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium">
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-md text-[11px]">
                        {channel.code}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {channel.units && channel.units.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {channel.units.map((unit) => (
                            <span
                              key={unit.id}
                              className="inline-flex items-center gap-1 bg-brand-50 text-brand-800 border border-brand-200/80 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            >
                              <Store className="w-3 h-3 text-brand-600" />
                              {unit.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Nenhuma loja associada</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {channel.dispositions && channel.dispositions.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {channel.dispositions.map((disp) => (
                            <span
                              key={disp.id}
                              className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            >
                              <Tag className="w-3 h-3 text-amber-600" />
                              {disp.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Todas as tabulações</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleActive(channel)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                          channel.is_active !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        {channel.is_active !== false ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(channel)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Editar Canal"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(channel)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Excluir Canal"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal Create / Edit Channel */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl sm:max-w-153.75 w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                {editingChannel ? 'Editar Canal de Leads' : 'Novo Canal de Leads'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Canal
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Meta Ads (Insta/FB), Google Pesquisa, WhatsApp Direct"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código / Sigla (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: META_ADS, GOOGLE_ADS (Deixe em branco para auto-gerar)"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Multi-select Unit Selection */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                <label className="block text-xs font-semibold text-slate-800">
                  Lojas Participantes deste Canal
                </label>
                <p className="text-[11px] text-slate-500">
                  Selecione as lojas/unidades que receberão e enviarão leads através deste canal:
                </p>

                {units.length === 0 ? (
                  <div className="text-xs text-slate-400 italic py-2">
                    Nenhuma loja cadastrada no sistema.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-40 overflow-y-auto">
                    {units.map((unit) => {
                      const isSelected = selectedUnitIds.includes(unit.id);
                      return (
                        <div
                          key={unit.id}
                          onClick={() => handleToggleUnitSelection(unit.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-brand-50/80 border-brand-300 text-brand-900 font-semibold shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-brand-600 border-brand-600 text-black'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-3" />}
                          </div>
                          <span className="truncate">{unit.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Multi-select Disposition Selection */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                <label className="block text-xs font-semibold text-slate-800">
                  Tabulações Disponíveis neste Canal
                </label>
                <p className="text-[11px] text-slate-500">
                  Selecione as tabulações que os atendentes poderão atribuir aos leads deste canal:
                </p>

                {dispositions.length === 0 ? (
                  <div className="text-xs text-slate-400 italic py-2">
                    Nenhuma tabulação cadastrada no sistema.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-40 overflow-y-auto">
                    {dispositions.map((disp) => {
                      const isSelected = selectedDispIds.includes(disp.id);
                      return (
                        <div
                          key={disp.id}
                          onClick={() => handleToggleDispSelection(disp.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-50/80 border-amber-300 text-amber-900 font-semibold shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-3" />}
                          </div>
                          <span className="truncate">{disp.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-black text-xs font-semibold shadow-sm shadow-brand-500/20"
                >
                  {submitting ? 'Salvando...' : 'Salvar Canal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
