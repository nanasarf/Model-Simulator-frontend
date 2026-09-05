import { ApiProblem, parseProblem } from '../errors/problem';
export interface Credentials {
  getAccessToken(): Promise<string | null>;
  refresh(): Promise<string>;
  invalidate(): void;
}
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'; body?: unknown; serializedBody?: string;
  anonymous?: boolean; signal?: AbortSignal; idempotencyKey?: string;
}
export class ApiClient {
  constructor(readonly origin = '', private credentials?: Credentials, private transport: typeof fetch = (...args) => fetch(...args)) {}
  attach(credentials: Credentials) { this.credentials = credentials; }
  private async response(path: string, options: RequestOptions): Promise<Response> {
    if (!path.startsWith('/api/v1/')) throw new Error('API requests must use a documented /api/v1/ path.');
    const body = options.serializedBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
    let token = options.anonymous ? null : await this.credentials?.getAccessToken();
    const send = () => {
      options.signal?.throwIfAborted();
      const headers = new Headers({ Accept: 'application/json, application/problem+json, text/csv' });
      if (body !== undefined) headers.set('Content-Type', 'application/json');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
      return this.transport(`${this.origin}${path}`, { method: options.method || 'GET', headers, body, signal: options.signal, credentials: 'omit' });
    };
    let response = await send();
    if (response.status === 401 && !options.anonymous && this.credentials) {
      // Only retry after an explicit 401, never after an ambiguous network/mutation failure.
      const latest = await this.credentials.getAccessToken();
      token = latest && latest !== token ? latest : await this.credentials.refresh();
      response = await send();
      if (response.status === 401) this.credentials.invalidate();
    }
    if (!response.ok) throw await parseProblem(response);
    return response;
  }
  async json<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.response(path, options);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
  async download(path: string, signal?: AbortSignal) { return (await this.response(path, { signal })).blob(); }
}
export const sessionExpired = () => new ApiProblem(401, 'about:blank', 'Sign in required', 'Your session expired. Sign in to continue.', 'authentication.invalid_token');
