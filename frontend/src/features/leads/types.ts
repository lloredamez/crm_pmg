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
  max_simultaneous_leads: number;
  unit_id?: string | null;
  managed_unit_ids?: string[];
  created_at: string;
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
  product?: string | null;
  prazo?: number | null;
  margem?: number | null;
  valor_liberado?: number | null;
  banco?: string | null;
  tabela?: string | null;
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



