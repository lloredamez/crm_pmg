import { Simulation, SimulationOfferHistory, SimulationPaginationResponse, Bank } from '@/features/leads/types';
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

export interface CreateSimulationParams {
  cpf: string;
  phone?: string;
  notes?: string;
  observacoes?: string;
}

export async function createSimulation(
  params: string | CreateSimulationParams
): Promise<Simulation> {
  const API_URL = getApiUrl();
  const payload = typeof params === 'string' ? { cpf: params } : params;
  const res = await fetch(`${API_URL}/api/v1/simulations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Simulation>(res);
}

export interface SimulationQuoteParams {
  tipo_simulacao: 'valor_parcela' | 'valor_emprestimo';
  valor_simulado: number;
  produto_id?: string | null;
  notes?: string;
}

export async function requestSimulationQuote(
  leadId: string,
  params: SimulationQuoteParams
): Promise<Simulation> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/simulations/${leadId}/quote`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  return handleResponse<Simulation>(res);
}

export async function reprocessSimulationQuote(
  leadId: string,
  offerId: string
): Promise<Simulation> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/simulations/${leadId}/offers/${offerId}/reprocess`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse<Simulation>(res);
}

export async function typeSimulationOffer(
  leadId: string,
  offerId: string
): Promise<Simulation> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/simulations/${leadId}/offers/${offerId}/type`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse<Simulation>(res);
}

export async function fetchSimulationOfferHistory(
  leadId: string,
  offerId: string
): Promise<SimulationOfferHistory[]> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/simulations/${leadId}/offers/${offerId}/history`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<SimulationOfferHistory[]>(res);
}

export async function updateSimulationCadastralData(
  leadId: string,
  data: Record<string, any>
): Promise<Simulation> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/simulations/${leadId}/cadastral-data`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<Simulation>(res);
}

export async function fetchBanks(): Promise<Bank[]> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/banks`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Bank[]>(res);
}

