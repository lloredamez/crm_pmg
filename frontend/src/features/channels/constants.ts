export interface LeadFieldDefinition {
  key: string;
  label: string;
  type?: 'text' | 'currency' | 'number' | 'date';
  isDefaultColumn?: boolean;
}

export const AVAILABLE_LEAD_FIELDS: LeadFieldDefinition[] = [
  { key: 'name', label: 'Nome do Lead / Cliente', isDefaultColumn: true },
  { key: 'phone', label: 'Telefone / WhatsApp', isDefaultColumn: true },
  { key: 'verified_cpf', label: 'CPF Verificado', type: 'text' },
  { key: 'proposal_number', label: 'Número da Proposta', type: 'text' },
  { key: 'banco', label: 'Banco', type: 'text' },
  { key: 'tabela', label: 'Tabela', type: 'text' },
  { key: 'prazo', label: 'Prazo (Parcelas)', type: 'number' },
  { key: 'margem', label: 'Margem (R$)', type: 'currency' },
  { key: 'valor_liberado', label: 'Valor Liberado (R$)', type: 'currency' },
  { key: 'notes', label: 'Observações', type: 'text' },
];

export const getFieldDefinition = (key: string): LeadFieldDefinition => {
  const found = AVAILABLE_LEAD_FIELDS.find((f) => f.key === key);
  if (found) return found;
  // Fallback for custom dynamic keys
  const humanLabel = key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return {
    key,
    label: humanLabel,
    type: 'text',
  };
};
