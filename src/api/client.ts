import axios, { AxiosInstance, isAxiosError } from "axios";
import { config, API_PREFIX } from "../config";
import { logger } from "../logger";

export class ApiHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly method: string,
  ) {
    super(message);
    this.name = "ApiHttpError";
  }
}

/**
 * Тонкая обёртка над REST API sigma_backend.
 * Аналог класса Api из sigma_bot/api.py: собирает URL, прокидывает X-Token,
 * пробрасывает HTTP-ошибки как ApiHttpError с кодом статуса.
 */
export class ApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: `${config.apiBaseUrl}${API_PREFIX}`,
      timeout: 15_000,
    });
  }

  /**
   * @param method   путь метода, например "user/get_by_tg"
   * @param options  params (query), json (body -> POST), token (X-Token)
   */
  async call<T = unknown>(
    method: string,
    options: { params?: Record<string, unknown>; json?: unknown; token?: string | null } = {},
  ): Promise<T> {
    const { params, json, token } = options;
    const headers: Record<string, string> = {};
    if (token) headers["X-Token"] = token;

    try {
      const response = json !== undefined
        ? await this.http.post(`/${method}`, json, { params, headers })
        : await this.http.get(`/${method}`, { params, headers });
      return response.data as T;
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status ?? 0;
        const body = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        throw new ApiHttpError(body, status, method);
      }
      throw err;
    }
  }
}

export const api = new ApiClient();
