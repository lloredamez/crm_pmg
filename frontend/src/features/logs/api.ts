import { getApiUrl } from '@/lib/config';
import {
  ActivityLogsResponse,
  TransferLogsResponse,
  LeadChangeLogsResponse,
} from './types';

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Erro ${res.status}`;
    try {
      const errData = await res.json();
      errorMsg = errData.detail || errorMsg;
    } catch {
      errorMsg = await res.text();
    }
    throw new Error(errorMsg || 'Erro na requisição');
  }
  return res.json();
}

export interface LogsQueryParams {
  channel_code?: string;
  start_date?: string;
  end_date?: string;
  attendant_id?: string;
  search?: string;
  event_type?: string;
  limit?: number;
  offset?: number;
}

function buildQuery(params: LogsQueryParams): string {
  const qs = new URLSearchParams();
  if (params.channel_code && params.channel_code !== 'all') {
    qs.set('channel_code', params.channel_code);
  }
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);
  if (params.attendant_id && params.attendant_id !== 'all') {
    qs.set('attendant_id', params.attendant_id);
  }
  if (params.search && params.search.trim()) {
    qs.set('search', params.search.trim());
  }
  if (params.event_type && params.event_type !== 'all') {
    qs.set('event_type', params.event_type);
  }
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export async function fetchActivityLogs(params: LogsQueryParams): Promise<ActivityLogsResponse> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/v1/logs/activity${buildQuery(params)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<ActivityLogsResponse>(res);
}

export async function fetchTransferLogs(params: LogsQueryParams): Promise<TransferLogsResponse> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/v1/logs/transfers${buildQuery(params)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<TransferLogsResponse>(res);
}

export async function fetchLeadChangeLogs(params: LogsQueryParams): Promise<LeadChangeLogsResponse> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/v1/logs/lead-changes${buildQuery(params)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<LeadChangeLogsResponse>(res);
}
