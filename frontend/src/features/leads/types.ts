export type UserRole = 'admin' | 'manager' | 'supervisor' | 'attendant';
export type UserStatus = 'online' | 'offline' | 'busy';

export interface User {
  id: string;
  name: string;
  email: string;
  cpf?: string | null;
  role: UserRole;
  status: UserStatus;
  is_active?: boolean;
  can_access_simulations?: boolean;
  max_simultaneous_leads: number;
  unit_id?: string | null;
  managed_unit_ids?: string[];
  last_action_at?: string | null;
  created_at: string;
}

export interface SimulationLeadData {
  id: string;
  simulation_lead_id: string;
  data_nascimento?: string | null;
  sexo?: string | null;
  estado_civil?: string | null;
  nome_mae?: string | null;
  numero_referencial_ipc?: number | null;
  valor_renda?: number | null;
  cep?: string | null;
  tipo_logradouro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  ddd_celular?: string | null;
  numero_celular?: string | null;
  email?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  orgao_emissor?: string | null;
  uf_orgao_emissor?: string | null;
  data_emissao?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SimulationOffer {
  id: string;
  simulation_lead_id: string;
  attendant_id?: string | null;
  attendant_name?: string | null;
  valor_bruto?: number | null;
  valor_liberado?: number | null;
  parcela?: number | null;
  quantidade_parcelas?: number | null;
  valor_parcela?: number | null;
  taxa_juros?: number | null;
  status?: string | null;
  custom_fields?: Record<string, any> | null;
  created_at: string;
}

export interface Simulation {
  id: string;
  name: string;
  cpf?: string | null;
  phone?: string | null;
  proposta_prospect_id?: string | null;
  PropostaProspectId?: string | null;
  produto_id?: string | null;
  ProdutoId?: string | null;
  nome_produto?: string | null;
  NomeProduto?: string | null;
  valor_bruto_maximo?: number | null;
  margem?: number | null;
  prazo?: number | null;
  prazo_maximo?: number | null;
  valor_liberado_maximo?: number | null;
  valor_parcela_maximo?: number | null;
  valor_liberado?: number | null;
  quantidade_parcelas?: number | null;
  valor_parcela?: number | null;
  notes?: string | null;
  observacoes?: string | null;
  simulation_status: string;
  status: string;
  current_attendant_id?: string | null;
  attendant_name?: string | null;
  unit_id?: string | null;
  unit_name?: string | null;
  webhook_sent_at?: string | null;
  created_at: string;
  custom_fields?: Record<string, any> | null;
  offers?: SimulationOffer[];
  total_offers?: number;
  cadastral_data?: SimulationLeadData | null;
}

export interface SimulationPaginationResponse {
  items: Simulation[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Unit {
  id: string;
  name: string;
  code: string;
  is_active?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  units?: Unit[];
  dispositions?: Disposition[];
  allowed_fields?: (string | any)[] | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface Disposition {
  id: string;
  name: string;
  category: string;
  has_timeout: boolean;
  timeout_minutes?: number | null;
  is_active: boolean;
  created_at: string;
}

export type LeadStatus = 'new' | 'assigned' | 'in_progress' | 'converted' | 'lost' | 'expired';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  cpf?: string | null;
  verified_cpf?: string | null;
  proposal_number?: string | null;
  notes?: string | null;
  email?: string | null;
  meta_lead_id?: string | null;
  campaign_name?: string | null;
  product_name?: string | null;
  channel_code?: string | null;
  product?: string | null;
  prazo?: number | null;
  margem?: number | null;
  valor_liberado?: number | null;
  banco?: string | null;
  tabela?: string | null;
  custom_fields?: Record<string, any> | null;
  status: LeadStatus;

  is_revealed?: boolean;
  revealed_at?: string | null;
  current_attendant_id?: string | null;
  current_attendant?: User | null;
  unit_id?: string | null;
  unit?: Unit | null;
  unit_name?: string | null;
  disposition_id?: string | null;
  disposition?: Disposition | null;
  current_disposition_name?: string | null;
  dispositioned_at?: string | null;

  disposition_timeout_at?: string | null;
  unassigned_sla_minutes?: number | null;
  assigned_at?: string | null;
  last_interaction_at?: string | null;
  created_at: string;
}

export interface LeadPaginationResponse {
  items: Lead[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Message {
  id: string;
  lead_id: string;
  attendant_id?: string | null;
  direction: 'inbound' | 'outbound';
  content: string;
  status: string;
  external_id?: string | null;
  created_at: string;
}

export interface LeadHistoryItem {
  id: string;
  lead_id: string;
  event_type?: 'assignment' | 'tabulation';
  attendant_id?: string | null;
  attendant_name: string;
  attendant_email: string;
  status: string;
  assigned_at: string;
  unassigned_at?: string | null;
  duration_seconds?: number | null;
  disposition_name?: string | null;
  disposition_notes?: string | null;
}


export interface ChannelDispositionSla {
  id: string;
  channel_id: string;
  disposition_id: string;
  timeout_minutes: number;
  created_at: string;
}



