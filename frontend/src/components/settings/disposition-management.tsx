'use client';

import React, { useState, useEffect } from 'react';
import { Disposition } from '@/features/leads/types';
import {
  fetchDispositions,
  createDisposition,
  updateDisposition,
  toggleDispositionStatus,
  deleteDisposition,
} from '@/features/dispositions/api';
import { Plus, Edit2, Trash2, Tag, Power, X, Clock, AlertCircle } from 'lucide-react';

export const DispositionManagement: React.FC = () => {
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDisp, setEditingDisp] = useState<Disposition | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Negociação');
  const [hasTimeout, setHasTimeout] = useState(true);
  const [timeoutHours, setTimeoutHours] = useState('2');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadDispositions();
  }, []);

  const loadDispositions = async () => {
    setLoading(true);
    try {
      const data = await fetchDispositions(false);
      setDispositions(data);
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
      loadDispositions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (disp: Disposition) => {
    if (!confirm(`Deseja realmente excluir a tabulação "${disp.name}"?`)) return;
    try {
      await deleteDisposition(disp.id);
      loadDispositions();
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
      loadDispositions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar tabulação');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeout = (disp: Disposition) => {
    if (!disp.has_timeout || !disp.timeout_minutes) {
      return <span className="text-slate-400 italic">Sem estouro</span>;
    }
    if (disp.timeout_minutes < 1) {
      const sec = Math.round(disp.timeout_minutes * 60);
      return `${sec} Segundos`;
    }
    if (disp.timeout_minutes < 60) {
      return `${disp.timeout_minutes} min`;
    }
    const hours = disp.timeout_minutes / 60;
    if (Number.isInteger(hours)) {
      return `${hours}h (${disp.timeout_minutes} min)`;
    }
    return `${disp.timeout_minutes} min`;
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-brand-600" />
            Configuração de Tabulações
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre as opções de tabulação dos atendimentos e configure os tempos limite de estouro para transbordo.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-4 py-2.5 rounded-2xl shadow-sm shadow-brand-500/20 flex items-center gap-1.5 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" /> Nova Tabulação
        </button>
      </div>

      {/* Dispositions Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">
            Carregando tabulações...
          </div>
        ) : dispositions.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">
            Nenhuma tabulação cadastrada. Clique no botão acima para criar a primeira.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[11px] font-semibold tracking-wider uppercase">
                  <th className="py-3 px-4">Nome da Tabulação</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Tempo de Estouro</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {dispositions.map((disp) => (
                  <tr key={disp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {disp.name}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full text-[11px] font-medium">
                        {disp.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <Clock className="w-3.5 h-3.5 text-brand-600" />
                        {formatTimeout(disp)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleActive(disp)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                          disp.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
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
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Editar Tabulação"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(disp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Excluir Tabulação"
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

      {/* Modal Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                {editingDisp ? 'Editar Tabulação' : 'Nova Tabulação'}
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
                  Nome da Tabulação
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Em Contato, Formalização, Vendido"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                >
                  <option value="Negociação">Negociação</option>
                  <option value="Venda">Venda (Finalizado com Sucesso)</option>
                  <option value="Perda">Perda (Finalizado Sem Sucesso)</option>
                  <option value="Contato">Contato Inicial</option>
                </select>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
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
                      Tempo Limite de Estouro (em horas)
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
                    <p className="text-[10px] text-slate-400 mt-1">
                      Se o lead não receber nova interação após este tempo, ele será reatribuído automaticamente.
                    </p>
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
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-brand-500/20"
                >
                  {submitting ? 'Salvando...' : 'Salvar Tabulação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
