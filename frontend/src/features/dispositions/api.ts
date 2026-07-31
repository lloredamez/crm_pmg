import { Disposition, Lead } from '@/features/leads/types';

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5052`;
  }
  return 'http://localhost:5052';
};

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
