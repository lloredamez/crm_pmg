export type UserRole = 'admin' | 'manager' | 'supervisor' | 'attendant';
export type UserStatus = 'online' | 'offline' | 'busy';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
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
  status: LeadStatus;
  current_attendant_id?: string | null;
  current_attendant?: User | null;
  unit_id?: string | null;
  unit?: Unit | null;
  unit_name?: string | null;
  disposition_id?: string | null;
  disposition?: Disposition | null;
  dispositioned_at?: string | null;
  disposition_timeout_at?: string | null;
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
