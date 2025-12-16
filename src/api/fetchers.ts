/**
 * Generic API fetcher factories.
 *
 * These factories reduce boilerplate for common API patterns:
 * - makeListFetcher: For endpoints returning wrapped arrays
 * - makeItemFetcher: For endpoints returning single items
 * - makeMutationFetcher: For POST/PUT/DELETE mutations
 */

const API_BASE = '/api';

/**
 * Base request function with error handling.
 */
async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Create a fetcher for list endpoints that return { key: T[] }.
 *
 * @example
 * const fetchPrompts = makeListFetcher<Prompt>('/prompts', 'prompts');
 * const prompts = await fetchPrompts(); // Prompt[]
 */
export function makeListFetcher<T>(endpoint: string, key: string) {
  return async (): Promise<T[]> => {
    const response = await request<Record<string, T[]>>(endpoint);
    return response[key] || [];
  };
}

/**
 * Create a fetcher for single item endpoints.
 *
 * @example
 * const fetchPrompt = makeItemFetcher<Prompt>('/prompts');
 * const prompt = await fetchPrompt('123'); // Prompt
 */
export function makeItemFetcher<T>(endpoint: string) {
  return async (id?: string): Promise<T> => {
    const url = id ? `${endpoint}/${id}` : endpoint;
    return request<T>(url);
  };
}

/**
 * Create a fetcher for mutation endpoints (POST/PUT/DELETE).
 *
 * @example
 * const createTemplate = makeMutationFetcher<TemplateData, Template>('/templates', 'POST');
 * const template = await createTemplate({ name: 'Test', ... });
 */
export function makeMutationFetcher<TData, TResponse = void>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE'
) {
  return async (data?: TData, id?: string): Promise<TResponse> => {
    const url = id ? `${endpoint}/${id}` : endpoint;
    return request<TResponse>(url, {
      method,
      body: data ? JSON.stringify(data) : undefined,
    });
  };
}

/**
 * Create a fetcher for endpoints with URL parameters.
 *
 * @example
 * const deletePrompt = makeDeleteFetcher('/prompts');
 * await deletePrompt('123'); // DELETE /prompts/123
 */
export function makeDeleteFetcher(endpoint: string) {
  return async (id: string): Promise<void> => {
    await request(`${endpoint}/${id}`, { method: 'DELETE' });
  };
}

/**
 * Export request for custom use cases.
 */
export { request };
