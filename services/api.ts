import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import type {
  LoginResponse,
  UserData,
  Place,
  WeatherData,
  HorarioIdeal,
} from '../types';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('authToken');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  requiresAuth = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
  }

  if (response.status === 401) {
    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('userData');
    router.replace('/');
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (response.status === 403) {
    Alert.alert(
      'Funcionalidade Premium',
      'Esta funcionalidade requer assinatura premium.'
    );
    throw new Error('Acesso restrito a usuários premium.');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ${response.status}: ${errorText}`);
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('text/calendar')) {
    return response.blob() as unknown as T;
  }

  return response.json();
}

export const apiService = {
  login: (email: string, senha: string) =>
    request<LoginResponse>('/api/Usuarios/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    }, false),

  register: (payload: Record<string, unknown>) =>
    request<UserData>('/api/Usuarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, false),

  getUser: (email: string) =>
    request<UserData>(`/api/Usuarios/${encodeURIComponent(email)}`),

  updateUser: async (email: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/api/Usuarios/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getToken()}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 204) {
      return; // NoContent - resposta vazia
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }
  },

  deleteUser: (email: string) =>
    request<void>(`/api/Usuarios/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    }),

  searchPlaces: (payload: Record<string, unknown>) =>
    request<Place[]>('/api/Places/search', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  searchAndClassify: (payload: Record<string, unknown>) =>
    request<Place[]>('/api/Places/search-and-classify-environment', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getWeather: (lat: number, lng: number) =>
    request<WeatherData>(
      `/api/Weather/current?latitude=${lat}&longitude=${lng}`
    ),

  askChat: (payload: Record<string, unknown>) =>
    request<unknown>('/api/chat/perguntar', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getHorariosIdeais: (placeId: string) =>
    request<HorarioIdeal[]>(`/api/Places/${placeId}/horarios-ideais`),

  exportCalendar: (payload: Record<string, unknown>) =>
    request<Blob>('/api/Places/exportar-calendario', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updatePlan: async (email: string, plano: string) => {
    const response = await fetch(`${API_BASE_URL}/api/Usuarios/${encodeURIComponent(email)}/plano`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getToken()}`,
      },
      body: JSON.stringify({ plano }),
    });

    if (response.status === 204) {
      return; // NoContent - resposta vazia
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }
  },

  resetPassword: (email: string, novaSenha: string) =>
    request<void>('/api/Usuarios/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, novaSenha }),
    }, false),
};
