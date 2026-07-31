'use client';

import React, { useState, useEffect } from 'react';
import { Unit } from '@/features/leads/types';
import {
  fetchUnits,
  createUnit,
  updateUnit,
  toggleUnitStatus,
  deleteUnit,
} from '@/features/units/api';
import { Plus, Edit2, Trash2, Store, Power, X, AlertCircle } from 'lucide-react';

export const UnitManagement: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const data = await fetchUnits(false);
      setUnits(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingUnit(null);
    setName('');
    setCode('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setName(unit.name);
    setCode(unit.code);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleToggleActive = async (unit: Unit) => {
    try {
      await toggleUnitStatus(unit.id);
      loadUnits();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (unit: Unit) => {
    if (!confirm(`Deseja realmente excluir a loja "${unit.name}"?`)) return;
    try {
      await deleteUnit(unit.id);
      loadUnits();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir loja');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome da loja');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      if (editingUnit) {
        await updateUnit(editingUnit.id, {
          name: name.trim(),
          code: code.trim() || undefined,
        });
      } else {
        await createUnit({
          name: name.trim(),
          code: code.trim() || undefined,
          is_active: true,
        });
      }
      setIsModalOpen(false);
      loadUnits();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar loja');
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
            <Store className="w-5 h-5 text-brand-600" />
            Gestão de Lojas e Unidades
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre e gerencie as lojas da rede para vinculação de supervisores, atendentes e distribuição de leads.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-4 py-2.5 rounded-2xl shadow-sm shadow-brand-500/20 flex items-center gap-1.5 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" /> Nova Loja
        </button>
      </div>

      {/* Units Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">
            Carregando lojas...
          </div>
        ) : units.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">
            Nenhuma loja cadastrada. Clique no botão acima para criar a primeira loja.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-[11px] font-semibold tracking-wider uppercase">
                  <th className="py-3 px-4">Nome da Loja</th>
                  <th className="py-3 px-4">Código / Sigla</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {units.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <Store className="w-4 h-4 text-slate-400 shrink-0" />
                      {unit.name}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium">
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-md text-[11px]">
                        {unit.code}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleActive(unit)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                          unit.is_active !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        {unit.is_active !== false ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(unit)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Editar Loja"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(unit)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Excluir Loja"
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

      {/* Modal Create / Edit Store */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                {editingUnit ? 'Editar Loja' : 'Nova Loja'}
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
                  Nome da Loja / Unidade
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Unidade 1 - São Paulo, Loja Centro"
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
                  placeholder="Ex: U1, SP-CENTER (Deixe em branco para auto-gerar)"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
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
                  className="px-4 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-5 text-xs font-semibold shadow-sm shadow-brand-500/20"
                >
                  {submitting ? 'Salvando...' : 'Salvar Loja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
