export interface CalendarSummary {
  work_start_hour: number;
  work_end_hour: number;
  timezone: string;
  work_days: number[];
}

export interface ConsultantActivitySummary {
  user_id: string;
  user_name: string;
  role: string;
  current_status: string;
  unit_name?: string | null;
  online_work_seconds: number;
  online_total_seconds: number;
  expected_work_seconds: number;
  transitions_count: number;
}

export interface ActivityLogItem {
  id: string;
  user_id: string;
  user_name: string;
  unit_name?: string | null;
  previous_status?: string | null;
  new_status: string;
  source: string;
  changed_at: string;
}

export interface ActivityLogsResponse {
  calendar_summary: CalendarSummary;
  consultants: ConsultantActivitySummary[];
  events: ActivityLogItem[];
  total_events: number;
}

export interface TransferLogItem {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_phone?: string | null;
  channel_code?: string | null;
  unit_name?: string | null;
  event_type: string;
  attendant_id?: string | null;
  attendant_name?: string | null;
  reassigned_by_name?: string | null;
  breach_type?: string | null;
  title: string;
  description?: string | null;
  created_at: string;
}

export interface TransferLogsResponse {
  items: TransferLogItem[];
  total: number;
  total_system_assigned: number;
  total_claimed_from_bucket: number;
  total_manual_reassigned: number;
  total_breaches: number;
}

export interface LeadFieldChange {
  field: string;
  label: string;
  old: unknown;
  new: unknown;
}

export interface LeadChangeLogItem {
  id: string;
  lead_id: string;
  lead_name: string;
  channel_code?: string | null;
  unit_name?: string | null;
  event_type: string;
  attendant_id?: string | null;
  attendant_name?: string | null;
  title: string;
  description?: string | null;
  event_metadata?: {
    changes?: LeadFieldChange[];
    disposition_name?: string;
    old_status?: string;
    new_status?: string;
    [key: string]: unknown;
  } | null;
  created_at: string;
}

export interface LeadChangeLogsResponse {
  items: LeadChangeLogItem[];
  total: number;
}
