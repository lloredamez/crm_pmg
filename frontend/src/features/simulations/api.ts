import { Simulation, SimulationPaginationResponse } from '@/features/leads/types';
import { getApiUrl } from '@/lib/config';

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }
  }
  return { 'Content-Type': 'application/json' };
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

export async function fetchSimulations(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<SimulationPaginationResponse> {
  const API_URL = getApiUrl();
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page.toString());
  if (params.limit) query.append('limit', params.limit.toString());
  if (params.search && params.search.trim()) query.append('search', params.search.trim());
  if (params.status && params.status !== 'all') query.append('status', params.status);

  const res = await fetch(`${API_URL}/api/v1/simulations?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<SimulationPaginationResponse>(res);
}

export async function createSimulation(cpf: string): Promise<Simulation> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/simulations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ cpf }),
  });
  return handleResponse<Simulation>(res);
}

