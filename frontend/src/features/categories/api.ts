import { Category } from '@/features/leads/types';
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

export async function fetchCategories(activeOnly: boolean = false): Promise<Category[]> {
  const API_URL = getApiUrl();
  const query = activeOnly ? '?active_only=true' : '';
  const res = await fetch(`${API_URL}/api/v1/categories${query}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Category[]>(res);
}

export async function createCategory(data: {
  name: string;
  description?: string;
  color?: string;
  is_active?: boolean;
}): Promise<Category> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Category>(res);
}

export async function updateCategory(
  id: string,
  data: {
    name?: string;
    description?: string;
    color?: string;
    is_active?: boolean;
  }
): Promise<Category> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/categories/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Category>(res);
}

export async function toggleCategoryStatus(id: string): Promise<Category> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/categories/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Category>(res);
}

export async function deleteCategory(id: string): Promise<void> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/categories/${id}`, {
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
    throw new Error(errorMsg || 'Erro ao excluir categoria');
  }
}
