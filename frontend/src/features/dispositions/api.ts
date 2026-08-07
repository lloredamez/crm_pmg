import { Disposition, Lead, ChannelDispositionSla } from '@/features/leads/types';
import { getApiUrl } from '@/lib/config';

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
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
    } catch (_) {
      errorMsg = await res.text();
    }
    throw new Error(errorMsg || 'Erro na requisição');
  }
  return res.json();
}

export async function fetchDispositions(activeOnly: boolean = false): Promise<Disposition[]> {
  const API_URL = getApiUrl();
  const query = activeOnly ? '?active_only=true' : '';
  const res = await fetch(`${API_URL}/api/v1/dispositions${query}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Disposition[]>(res);
}

export async function createDisposition(data: {
  name: string;
  category: string;
  has_timeout: boolean;
  timeout_minutes?: number | null;
  is_active?: boolean;
}): Promise<Disposition> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/dispositions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Disposition>(res);
}

export async function updateDisposition(
  id: string,
  data: {
    name?: string;
    category?: string;
    has_timeout?: boolean;
    timeout_minutes?: number | null;
    is_active?: boolean;
  }
): Promise<Disposition> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/dispositions/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Disposition>(res);
}

export async function toggleDispositionStatus(id: string): Promise<Disposition> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/dispositions/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Disposition>(res);
}

export async function deleteDisposition(id: string): Promise<void> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/dispositions/${id}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    let errorMsg = `Erro ${res.status}`;
    try {
      const errData = await res.json();
      errorMsg = errData.detail || errorMsg;
    } catch (_) {
      errorMsg = await res.text();
    }
    throw new Error(errorMsg || 'Erro ao excluir tabulação');
  }
}

export async function tabulateLead(
  leadId: string,
  data: { disposition_id: string; notes?: string }
): Promise<Lead> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/dispositions/tabulate/${leadId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Lead>(res);
}

export async function fetchChannelSlas(channelId?: string): Promise<ChannelDispositionSla[]> {
  const API_URL = getApiUrl();
  const query = channelId ? `?channel_id=${channelId}` : '';
  const res = await fetch(`${API_URL}/api/v1/dispositions/channel-slas${query}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<ChannelDispositionSla[]>(res);
}

export async function upsertChannelSla(data: {
  channel_id: string;
  disposition_id: string;
  timeout_minutes: number;
}): Promise<ChannelDispositionSla> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/dispositions/channel-slas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<ChannelDispositionSla>(res);
}

export async function deleteChannelSla(slaId: string): Promise<void> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/dispositions/channel-slas/${slaId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    throw new Error('Erro ao excluir regra de SLA por canal');
  }
}

