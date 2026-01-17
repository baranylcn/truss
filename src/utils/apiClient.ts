import { API_CONFIG } from '../config/api';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout?: number) {
    this.baseUrl = baseUrl || API_CONFIG.BASE_URL;
    this.timeout = timeout || API_CONFIG.TIMEOUT;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { data };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return { error: 'Request timeout' };
      }

      return {
        error: error.message || 'Network error occurred',
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async uploadFile<T>(endpoint: string, file: File): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { data };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return { error: 'Upload timeout' };
      }

      return {
        error: error.message || 'Upload failed',
      };
    }
  }
}

export const apiClient = new ApiClient();
