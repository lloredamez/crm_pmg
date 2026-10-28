'use client';

import React, { useState, useEffect } from 'react';
import { Channel } from '@/features/leads/types';
import {
  ChannelFieldDefinition,
  FieldType,
  FIELD_TYPE_LABELS,
  AVAILABLE_LEAD_FIELDS,
  normalizeField,
} from '@/features/channels/constants';
import { updateChannel } from '@/features/channels/api';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Sliders,
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  Info,
  Tag,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Type,
  Hash,
  DollarSign,
  Calendar,
  ToggleLeft,
  List,
  FileText,
} from 'lucide-react';

const FIELD_TYPE_ICONS: Record<FieldType, React.ElementType> = {
  text: Type,
  number: Hash,
  currency: DollarSign,
  date: Calendar,
  boolean: ToggleLeft,
  select: List,
  textarea: FileText,
};

interface ChannelFieldsEditorModalProps {
  channel: Channel | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChannelFieldsEditorModal: React.FC<ChannelFieldsEditorModalProps> = ({
  channel,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [fields, setFields] = useState<ChannelFieldDefinition[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state for creating/editing a field
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldReadOnly, setFieldReadOnly] = useState(false);
  const [fieldShowInTable, setFieldShowInTable] = useState(true);
  const [fieldOptions, setFieldOptions] = useState(''); // Comma-separated for select

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load existing channel fields when channel changes
  useEffect(() => {
    if (channel) {
      const raw = channel.allowed_fields || [];
      const normalized = raw.map(normalizeField);
      setFields(normalized);
      resetForm();
    }
  }, [channel]);

  if (!isOpen || !channel) return null;

  const resetForm = () => {
    setEditingIndex(null);
    setFieldLabel('');
    setFieldKey('');
    setFieldType('text');
    setFieldPlaceholder('');
    setFieldRequired(false);
    setFieldReadOnly(false);
    setFieldShowInTable(true);
    setFieldOptions('');
    setErrorMsg('');
  };

  const generateKeyFromLabel = (label: string) => {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const handleLabelChange = (val: string) => {
    setFieldLabel(val);
    if (editingIndex === null) {
      setFieldKey(generateKeyFromLabel(val));
    }
  };

  const handleStartEdit = (index: number) => {
    const f = fields[index];
    setEditingIndex(index);
    setFieldLabel(f.label);
    setFieldKey(f.key);
    setFieldType(f.type || 'text');
    setFieldPlaceholder(f.placeholder || '');
    setFieldRequired(!!f.required);
    setFieldReadOnly(!!f.isReadOnly);
    setFieldShowInTable(f.showInTable !== undefined ? !!f.showInTable : true);
    setFieldOptions(f.options ? f.options.join(', ') : '');
    setErrorMsg('');
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleAddOrUpdateField = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = fieldLabel.trim();
    const cleanKey = fieldKey.trim().toLowerCase();

    if (!cleanLabel) {
      setErrorMsg('Informe o rótulo do campo');
      return;
    }
    if (!cleanKey) {
      setErrorMsg('Informe a chave do campo');
      return;
    }

    // Check for duplicate key (excluding current editing index)
    const duplicate = fields.some(
      (f, idx) => f.key.toLowerCase() === cleanKey && idx !== editingIndex
    );
    if (duplicate) {
      setErrorMsg(`A chave "${cleanKey}" já existe neste canal`);
      return;
    }

    const optionsList =
      fieldType === 'select'
        ? fieldOptions
          .split(',')
          .map((opt) => opt.trim())
          .filter(Boolean)
        : undefined;

    const newField: ChannelFieldDefinition = {
      key: cleanKey,
      label: cleanLabel,
      type: fieldType,
      required: !fieldReadOnly && fieldRequired,
      placeholder: fieldPlaceholder.trim() || undefined,
      options: optionsList && optionsList.length > 0 ? optionsList : undefined,
      isReadOnly: fieldReadOnly,
      showInTable: fieldShowInTable,
    };

    if (editingIndex !== null) {
      // Update existing
      setFields((prev) => {
        const copy = [...prev];
        copy[editingIndex] = newField;
        return copy;
      });
    } else {
      // Add new
      setFields((prev) => [...prev, newField]);
    }

    resetForm();
  };

  const handleRemoveField = (index: number) => {
    setFields((prev) => prev.filter((_, idx) => idx !== index));
    if (editingIndex === index) {
      resetForm();
    }
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    setFields((prev) => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleAddPresetField = (preset: ChannelFieldDefinition) => {
    if (fields.some((f) => f.key === preset.key)) {
      return; // Already present
    }
    setFields((prev) => [
      ...prev,
      {
        ...preset,
        isReadOnly: false,
        showInTable: preset.showInTable !== undefined ? preset.showInTable : true,
      },
    ]);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      await updateChannel(channel.id, {
        allowed_fields: fields,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao salvar campos do canal');
    } finally {
      setSaving(false);
    }
  };

  // Preset fields not yet added
  const availablePresets = AVAILABLE_LEAD_FIELDS.filter(
    (preset) => !preset.isDefaultColumn && !fields.some((f) => f.key === preset.key)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Editor de Campos do Canal
                </h3>
                <span className="font-mono text-[11px] font-semibold bg-brand-100 text-brand-800 px-2.5 py-0.5 rounded-full border border-brand-200">
                  {channel.name}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Configure os campos adicionais que este canal exibirá na tabela e na ficha de atendimento.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Two Columns */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form to Add/Edit Field (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                {editingIndex !== null ? (
                  <>
                    <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Editar Campo #{editingIndex + 1}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 text-brand-600" />
                    <span>Novo Campo Personalizado</span>
                  </>
                )}
              </h4>

              {errorMsg && (
                <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleAddOrUpdateField} className="space-y-3">
                {/* Rótulo / Label */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Visível (Rótulo) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Score de Crédito, Chave PIX, CNH..."
                    value={fieldLabel}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                {/* Chave interna / Key */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Identificador Interno (Chave) *
                  </label>
                  <input
                    type="text"
                    placeholder="ex: score_credito"
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Usado para guardar no banco e mapear colunas.
                  </span>
                </div>

                {/* Tipo de Dado */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo do Dado
                  </label>
                  <div className="relative flex items-center">
                    {(() => {
                      const SelectedTypeIcon = FIELD_TYPE_ICONS[fieldType] || FileText;
                      return <SelectedTypeIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />;
                    })()}
                    <select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as FieldType)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
                    >
                      {Object.entries(FIELD_TYPE_LABELS).map(([t, info]) => (
                        <option key={t} value={t}>
                          {info.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Options if Select */}
                {fieldType === 'select' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Opções da Lista (separadas por vírgula)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Baixo, Médio, Alto, Urgente"
                      value={fieldOptions}
                      onChange={(e) => setFieldOptions(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>
                )}

                {/* Placeholder */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Texto de Ajuda / Placeholder (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Dica que aparece no campo..."
                    value={fieldPlaceholder}
                    onChange={(e) => setFieldPlaceholder(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                {/* Opções de Exibição & Permissão */}
                <div className="space-y-2 pt-2 border-t border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Visibilidade & Permissões
                  </span>

                  {/* Exibir na Tabela */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="chk-field-show-table"
                      checked={fieldShowInTable}
                      onChange={(e) => setFieldShowInTable(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        Exibir como coluna na tabela de leads
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        O campo aparecerá na ficha do lead mas não ocupará coluna na tabela.
                      </span>
                    </div>
                  </label>

                  {/* Somente Leitura */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="chk-field-readonly"
                      checked={fieldReadOnly}
                      onChange={(e) => setFieldReadOnly(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        Campo Somente Leitura
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        O atendente poderá visualizar na ficha do lead mas não poderá alterá-lo.
                      </span>
                    </div>
                  </label>

                  {/* Required Checkbox (apenas para editáveis) */}
                  {!fieldReadOnly && (
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="chk-field-required"
                        checked={fieldRequired}
                        onChange={(e) => setFieldRequired(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-800">
                          Preenchimento Obrigatório na Ficha
                        </span>
                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                          Exige preenchimento antes de salvar o lead.
                        </span>
                      </div>
                    </label>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold py-2 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {editingIndex !== null ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Atualizar Campo</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar ao Canal</span>
                      </>
                    )}
                  </button>

                  {editingIndex !== null && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Quick Presets Section */}
            {availablePresets.length > 0 && (
              <div className="bg-slate-50/60 rounded-2xl p-3.5 border border-slate-200/60">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Campos Padrão Disponíveis para Adicionar:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {availablePresets.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleAddPresetField(preset)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-brand-400 hover:bg-brand-50/50 text-[11px] font-medium text-slate-700 transition-all cursor-pointer shadow-2xs"
                      title={`Adicionar ${preset.label} a este canal`}
                    >
                      <Plus className="w-3 h-3 text-brand-600" />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Active Fields List & Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Campos Ativos no Canal ({fields.length})
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Estes campos serão colunas na tabela deste canal
                </span>
              </div>

              {fields.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <Sliders className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">
                    Nenhum campo personalizado cadastrado
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                    Adicione campos padrão ao lado ou crie novos campos personalizados para este canal.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
                  {fields.map((field, idx) => {
                    const typeInfo = FIELD_TYPE_LABELS[field.type] || {
                      label: field.type,
                    };
                    const TypeIcon = FIELD_TYPE_ICONS[field.type] || FileText;
                    const isEditing = editingIndex === idx;

                    return (
                      <div
                        key={`${field.key}-${idx}`}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isEditing
                          ? 'bg-amber-50/80 border-amber-300 shadow-xs ring-2 ring-amber-400/20'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-2xs'
                          }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          {/* Order Badges & Move Controls */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveField(idx, 'up')}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === fields.length - 1}
                              onClick={() => handleMoveField(idx, 'down')}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-800 truncate">
                                {field.label}
                              </span>
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {field.key}
                              </span>
                              {field.required && (
                                <span className="text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200/60 px-1.5 py-0.2 rounded-full">
                                  Obrigatório
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                                <TypeIcon className="w-3 h-3 text-slate-400" />
                                <span>{typeInfo.label}</span>
                              </span>

                              {field.showInTable !== false ? (
                                <span className="text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                  <Eye className="w-2.5 h-2.5" /> Coluna na Tabela
                                </span>
                              ) : (
                                <span className="text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200/60 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                  <EyeOff className="w-2.5 h-2.5" /> Oculto na Tabela
                                </span>
                              )}

                              {field.isReadOnly ? (
                                <span className="text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                  <Lock className="w-2.5 h-2.5" /> Somente Leitura
                                </span>
                              ) : (
                                <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                  <Edit2 className="w-2.5 h-2.5" /> Editável
                                </span>
                              )}

                              {field.options && field.options.length > 0 && (
                                <span className="text-[10px] text-slate-400">
                                  • {field.options.length} opções: {field.options.slice(0, 2).join(', ')}
                                  {field.options.length > 2 && '...'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Editar campo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveField(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Remover campo deste canal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {fields.length} {fields.length === 1 ? 'campo configurado' : 'campos configurados'} para o canal{' '}
            <strong>{channel.name}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-brand-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? 'Salvando Campos...' : 'Salvar Campos do Canal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
