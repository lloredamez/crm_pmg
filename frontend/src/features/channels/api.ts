import { Channel } from '@/features/leads/types';

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

export async function fetchChannels(activeOnly: boolean = false): Promise<Channel[]> {
  const API_URL = getApiUrl();
  const query = activeOnly ? '?active_only=true' : '';
  const res = await fetch(`${API_URL}/api/v1/channels${query}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Channel[]>(res);
}

export async function createChannel(data: {
  name: string;
  code?: string;
  is_active?: boolean;
  unit_ids?: string[];
}): Promise<Channel> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/channels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Channel>(res);
}

export async function updateChannel(
  id: string,
  data: {
    name?: string;
    code?: string;
    is_active?: boolean;
    unit_ids?: string[];
  }
): Promise<Channel> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/channels/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Channel>(res);
}

export async function toggleChannelStatus(id: string): Promise<Channel> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/channels/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Channel>(res);
}

export async function deleteChannel(id: string): Promise<void> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/channels/${id}`, {
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
    throw new Error(errorMsg || 'Erro ao excluir canal');
  }
}
