'use client';

import React, { useState, useEffect } from 'react';
import { Category } from '@/features/leads/types';
import {
  fetchCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
} from '@/features/categories/api';
import { Plus, Edit2, Trash2, FolderKanban, Power, X, AlertCircle, Check, Tag } from 'lucide-react';

const COLOR_OPTIONS = [
  { id: 'amber', label: 'Amarelo / Negociação', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  { id: 'emerald', label: 'Verde / Sucesso', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { id: 'rose', label: 'Vermelho / Perda', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { id: 'blue', label: 'Azul / Atendimento', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  { id: 'purple', label: 'Roxo / Especial', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  { id: 'indigo', label: 'Índigo / Prioridade', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  { id: 'slate', label: 'Cinza / Geral', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' },
];

const getColorClasses = (colorName: string) => {
  const found = COLOR_OPTIONS.find((c) => c.id === colorName);
  if (found) return found;
  return COLOR_OPTIONS[3]; // default blue
};

export const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCategories(false);
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setColor('blue');
    setIsActive(true);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setColor(cat.color || 'blue');
    setIsActive(cat.is_active);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      await toggleCategoryStatus(cat.id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Deseja realmente excluir a categoria "${cat.name}"?`)) return;
    try {
      await deleteCategory(cat.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir categoria');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('O nome da categoria é obrigatório.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          is_active: isActive,
        });
      } else {
        await createCategory({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          is_active: isActive,
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar categoria.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = categories.filter((c) => c.is_active).length;
  const inactiveCount = categories.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Gerenciamento de Categorias</h2>
          </div>
          <p className="text-xs text-slate-500">
            Cadastre e edite as categorias utilizadas para agrupar tabulações de atendimento e organizar a jornada dos leads.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Categoria
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <div className="text-xs font-medium text-slate-400 mb-1">Total de Categorias</div>
          <div className="text-2xl font-bold text-slate-900">{categories.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <div className="text-xs font-medium text-slate-400 mb-1">Categorias Ativas</div>
          <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <div className="text-xs font-medium text-slate-400 mb-1">Categorias Inativas</div>
          <div className="text-2xl font-bold text-slate-400">{inactiveCount}</div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Carregando categorias...</div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center">
            <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Nenhuma categoria encontrada</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              Comece cadastrando uma nova categoria para agrupar suas tabulações.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 text-white rounded-xl text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Criar Primeira Categoria
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Categoria</th>
                  <th className="py-3.5 px-6">Descrição</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Criado em</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {categories.map((cat) => {
                  const colorTheme = getColorClasses(cat.color);
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border ${colorTheme.bg} ${colorTheme.text} ${colorTheme.border}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${colorTheme.dot}`} />
                            {cat.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 max-w-xs text-slate-600">
                        {cat.description || <span className="text-slate-300 italic">Sem descrição</span>}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            cat.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              cat.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {cat.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-400 text-[11px]">
                        {new Date(cat.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleActive(cat)}
                            title={cat.is_active ? 'Desativar Categoria' : 'Ativar Categoria'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              cat.is_active
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            title="Editar Categoria"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cat)}
                            title="Excluir Categoria"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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

      {/* Modal Create/Edit Category */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
                  <Tag className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Categoria <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Negociação, Venda, Perda, Atendimento..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  placeholder="Descreva a finalidade desta categoria..."
                  value={description}
                  rows={2}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-medium resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Cor de Destaque
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {COLOR_OPTIONS.map((c) => {
                    const isSelected = color === c.id;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setColor(c.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? `${c.bg} ${c.text} ${c.border} ring-2 ring-brand-500/30`
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${c.dot}`} />
                          <span className="truncate">{c.label.split('/')[0]}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="text-xs font-semibold text-slate-800">Categoria Ativa</label>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {submitting ? 'Salvando...' : editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
