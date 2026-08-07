import { Unit } from '@/features/leads/types';
import { getApiUrl } from '@/lib/config';

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
    } catch (_) {
      errorMsg = await res.text();
    }
    throw new Error(errorMsg || 'Erro na requisição');
  }
  return res.json();
}

export async function fetchUnits(activeOnly: boolean = false): Promise<Unit[]> {
  const API_URL = getApiUrl();
  const query = activeOnly ? '?active_only=true' : '';
  const res = await fetch(`${API_URL}/api/v1/units${query}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Unit[]>(res);
}

export async function createUnit(data: {
  name: string;
  code?: string;
  is_active?: boolean;
}): Promise<Unit> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/units`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Unit>(res);
}

export async function updateUnit(
  id: string,
  data: {
    name?: string;
    code?: string;
    is_active?: boolean;
  }
): Promise<Unit> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/units/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Unit>(res);
}

export async function toggleUnitStatus(id: string): Promise<Unit> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/units/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Unit>(res);
}

export async function deleteUnit(id: string): Promise<void> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/units/${id}`, {
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
    throw new Error(errorMsg || 'Erro ao excluir loja');
  }
}
