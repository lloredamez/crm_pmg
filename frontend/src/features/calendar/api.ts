import { CalendarConfig, CalendarConfigUpdate, Holiday, HolidayCreate, HolidayUpdate, CalendarStatus } from './types';
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

export async function fetchCalendarConfig(): Promise<CalendarConfig> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/calendar/config`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<CalendarConfig>(res);
}

export async function updateCalendarConfig(data: CalendarConfigUpdate): Promise<CalendarConfig> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/calendar/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<CalendarConfig>(res);
}

export async function fetchCalendarStatus(): Promise<CalendarStatus> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/calendar/status`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<CalendarStatus>(res);
}

export async function fetchHolidays(activeOnly: boolean = false): Promise<Holiday[]> {
  const API_URL = getApiUrl();
  const query = activeOnly ? '?active_only=true' : '';
  const res = await fetch(`${API_URL}/api/v1/calendar/holidays${query}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Holiday[]>(res);
}

export async function createHoliday(data: HolidayCreate): Promise<Holiday> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/calendar/holidays`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Holiday>(res);
}

export async function updateHoliday(id: string, data: HolidayUpdate): Promise<Holiday> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/calendar/holidays/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Holiday>(res);
}

export async function toggleHolidayStatus(id: string): Promise<Holiday> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/calendar/holidays/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Holiday>(res);
}

export async function deleteHoliday(id: string): Promise<void> {
  const API_URL = getApiUrl();
  const res = await fetch(`${API_URL}/api/v1/calendar/holidays/${id}`, {
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
    throw new Error(errorMsg || 'Erro ao excluir feriado');
  }
}

