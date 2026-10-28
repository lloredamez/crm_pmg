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
  { key: 'name', label: 'Nome do Lead / Cliente', type: 'text', isDefaultColumn: true, showInTable: true },
  { key: 'phone', label: 'Telefone / WhatsApp', type: 'text', isDefaultColumn: true, showInTable: true },
  { key: 'verified_cpf', label: 'CPF Verificado', type: 'text', showInTable: false },
  { key: 'proposal_number', label: 'Número da Proposta', type: 'text', showInTable: true },
  { key: 'banco', label: 'Banco', type: 'text', showInTable: false },
  { key: 'tabela', label: 'Tabela', type: 'text', showInTable: false },
  { key: 'prazo', label: 'Prazo (Parcelas)', type: 'number', showInTable: false },
  { key: 'margem', label: 'Margem (R$)', type: 'currency', showInTable: false },
  { key: 'valor_liberado', label: 'Valor Liberado (R$)', type: 'currency', showInTable: true },
  { key: 'notes', label: 'Observações', type: 'textarea', showInTable: false },
];

export const normalizeField = (field: string | ChannelFieldDefinition): ChannelFieldDefinition => {
  if (typeof field === 'string') {
    const found = AVAILABLE_LEAD_FIELDS.find((f) => f.key === field);
    if (found) {
      return {
        ...found,
        isReadOnly: false,
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

  return {
    key: field.key || 'campo_customizado',
    label: field.label || field.key || 'Campo',
    type: field.type || 'text',
    options: field.options || [],
    required: !!field.required,
    placeholder: field.placeholder || '',
    isDefaultColumn: !!field.isDefaultColumn,
    isReadOnly: !!field.isReadOnly,
    showInTable: field.showInTable !== undefined ? !!field.showInTable : true,
  };
};

export const getFieldDefinition = (field: string | ChannelFieldDefinition): ChannelFieldDefinition => {
  return normalizeField(field);
};
