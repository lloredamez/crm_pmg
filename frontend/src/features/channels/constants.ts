export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'select' | 'textarea';

export interface ChannelFieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  isDefaultColumn?: boolean;
  isReadOnly?: boolean; // Se true, o campo na ficha do lead é somente leitura
  showInTable?: boolean; // Se true, aparece como coluna na tabela de leads (padrão: true)
}

export type LeadFieldDefinition = ChannelFieldDefinition;

export const FIELD_TYPE_LABELS: Record<FieldType, { label: string; icon: string }> = {
  text: { label: 'Texto Curto', icon: '📝' },
  number: { label: 'Número', icon: '🔢' },
  currency: { label: 'Moeda (R$)', icon: '💰' },
  date: { label: 'Data', icon: '📅' },
  boolean: { label: 'Sim / Não', icon: '☑️' },
  select: { label: 'Lista de Opções', icon: '🔘' },
  textarea: { label: 'Texto Longo', icon: '📄' },
};

export const AVAILABLE_LEAD_FIELDS: ChannelFieldDefinition[] = [
  { key: 'name', label: 'Nome do Lead / Cliente', type: 'text', showInTable: true, isReadOnly: false },
  { key: 'phone', label: 'Telefone / WhatsApp', type: 'text', showInTable: true, isReadOnly: true },
  { key: 'cpf', label: 'CPF', type: 'text', showInTable: true, isReadOnly: true },
  { key: 'verified_cpf', label: 'CPF Verificado', type: 'text', showInTable: false, isReadOnly: false },
  { key: 'email', label: 'E-mail', type: 'text', showInTable: false, isReadOnly: false },
  { key: 'product_name', label: 'Produto', type: 'text', showInTable: true, isReadOnly: false },
  { key: 'campaign_name', label: 'Campanha / Origem', type: 'text', showInTable: false, isReadOnly: true },
  { key: 'proposal_number', label: 'Número da Proposta', type: 'text', showInTable: true, isReadOnly: false },
  { key: 'banco', label: 'Banco', type: 'text', showInTable: false, isReadOnly: false },
  { key: 'tabela', label: 'Tabela', type: 'text', showInTable: false, isReadOnly: false },
  { key: 'prazo', label: 'Prazo (Parcelas)', type: 'number', showInTable: false, isReadOnly: false },
  { key: 'margem', label: 'Margem (R$)', type: 'currency', showInTable: false, isReadOnly: false },
  { key: 'valor_liberado', label: 'Valor Liberado (R$)', type: 'currency', showInTable: true, isReadOnly: false },
  { key: 'notes', label: 'Observações', type: 'textarea', showInTable: false, isReadOnly: false },
];

export const STANDARD_FIELD_KEYS = AVAILABLE_LEAD_FIELDS.map((f) => f.key);

export const isStandardField = (key: string): boolean => {
  return STANDARD_FIELD_KEYS.includes(key);
};

export const normalizeField = (field: string | ChannelFieldDefinition): ChannelFieldDefinition => {
  if (typeof field === 'string') {
    const found = AVAILABLE_LEAD_FIELDS.find((f) => f.key === field);
    if (found) {
      return {
        ...found,
        isReadOnly: found.isReadOnly !== undefined ? found.isReadOnly : false,
        showInTable: found.showInTable !== undefined ? found.showInTable : true,
      };
    }
    const humanLabel = field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
    return {
      key: field,
      label: humanLabel,
      type: 'text',
      isReadOnly: false,
      showInTable: true,
    };
  }

  const found = AVAILABLE_LEAD_FIELDS.find((f) => f.key === field.key);

  return {
    key: field.key || 'campo_customizado',
    label: field.label || found?.label || field.key || 'Campo',
    type: field.type || found?.type || 'text',
    options: field.options || [],
    required: !!field.required,
    placeholder: field.placeholder || '',
    isDefaultColumn: !!field.isDefaultColumn,
    isReadOnly: field.isReadOnly !== undefined ? !!field.isReadOnly : (found?.isReadOnly ?? false),
    showInTable: field.showInTable !== undefined ? !!field.showInTable : (found?.showInTable ?? true),
  };
};

export const getFieldDefinition = (field: string | ChannelFieldDefinition): ChannelFieldDefinition => {
  return normalizeField(field);
};

export const getEffectiveChannelFields = (
  allowedFields?: (string | ChannelFieldDefinition)[] | null
): ChannelFieldDefinition[] => {
  if (Array.isArray(allowedFields) && allowedFields.length > 0) {
    return allowedFields.map(normalizeField);
  }
  return AVAILABLE_LEAD_FIELDS.map((f) => ({ ...f }));
};
