import { Lead, LeadPaginationResponse, User, Message } from './types';

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

export async function fetchLeads(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  attendant_id?: string;
}): Promise<LeadPaginationResponse> {
  const API_URL = getApiUrl();
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page.toString());
  if (params.limit) query.append('limit', params.limit.toString());
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  if (params.attendant_id) query.append('attendant_id', params.attendant_id);

  const res = await fetch(`${API_URL}/api/v1/leads?${query.toString()}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<LeadPaginationResponse>(res);
}

export async function fetchUsers(): Promise<User[]> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/users`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<User[]>(res);
}

export async function updateUserStatus(userId: string, status: string): Promise<User> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/users/${userId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ status })
  });
  return handleResponse<User>(res);
}

export async function updateLeadStatus(leadId: string, status: string): Promise<Lead> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/leads/${leadId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ status })
  });
  return handleResponse<Lead>(res);
}

export async function updateLeadDetails(
  leadId: string,
  details: { notes?: string; verified_cpf?: string; proposal_number?: string }
): Promise<Lead> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/leads/${leadId}/details`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(details)
  });
  return handleResponse<Lead>(res);
}

export async function reassignLead(leadId: string, attendantId: string): Promise<Lead> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/leads/${leadId}/reassign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ attendant_id: attendantId })
  });
  return handleResponse<Lead>(res);
}

export async function bulkReassignLeads(leadIds: string[], attendantId: string): Promise<void> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/leads/bulk-reassign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ lead_ids: leadIds, attendant_id: attendantId })
  });
  await handleResponse<any>(res);
}

export async function fetchMessages(leadId: string): Promise<Message[]> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/messages/lead/${leadId}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Message[]>(res);
}

export async function sendMessage(leadId: string, content: string, direction: 'inbound' | 'outbound' = 'outbound'): Promise<Message> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ lead_id: leadId, content, direction })
  });
  return handleResponse<Message>(res);
}

export async function createMockLead(data: { name: string; phone: string; campaign_name?: string }): Promise<void> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/webhooks/meta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      campaign_name: data.campaign_name || 'Simulação Manual Web'
    })
  });
  await handleResponse<any>(res);
}
