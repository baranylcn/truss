import { API_CONFIG } from '../config/api';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(baseUrl?: string, timeout?: number) {
    this.baseUrl = baseUrl || API_CONFIG.BASE_URL;
    this.timeout = timeout || API_CONFIG.TIMEOUT;
    this.retryAttempts = (API_CONFIG as any).RETRY_ATTEMPTS || 3;
    this.retryDelay = (API_CONFIG as any).RETRY_DELAY || 2000;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
      console.log('[API Request]', options.method, fullUrl, options.body);

      const response = await fetch(fullUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      console.log('[API Response]', response.status, response.statusText);

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
        console.error('[API Error] Request timeout');
        return { error: 'Request timeout' };
      }

      console.error('[API Error]', error.name, error.message);
      return {
        error: `${error.name}: ${error.message}` || 'Network error occurred',
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
    let lastError: string = '';

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      const formData = new FormData();
      formData.append('file', file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        console.log(`[Upload Attempt ${attempt}/${this.retryAttempts}] Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          lastError = errorData.message || `HTTP ${response.status}: ${response.statusText}`;

          if (response.status >= 500 && attempt < this.retryAttempts) {
            console.warn(`[Upload] Server error ${response.status}, retrying in ${this.retryDelay}ms...`);
            await this.delay(this.retryDelay);
            continue;
          }

          return { error: lastError };
        }

        const data = await response.json();
        console.log(`[Upload Success] File uploaded successfully on attempt ${attempt}`);
        return { data };
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          lastError = `Upload timeout after ${this.timeout}ms (attempt ${attempt}/${this.retryAttempts})`;
          console.warn(`[Upload] Timeout on attempt ${attempt}, retrying in ${this.retryDelay}ms...`);

          if (attempt < this.retryAttempts) {
            await this.delay(this.retryDelay);
            continue;
          }
        } else {
          lastError = error.message || `Upload failed on attempt ${attempt}`;
          console.error(`[Upload Error] Attempt ${attempt}: ${lastError}`);

          if (attempt < this.retryAttempts) {
            console.log(`[Upload] Retrying in ${this.retryDelay}ms...`);
            await this.delay(this.retryDelay);
            continue;
          }
        }
      }
    }

    return { error: lastError || 'Upload failed after multiple attempts' };
  }
}

export const apiClient = new ApiClient();
