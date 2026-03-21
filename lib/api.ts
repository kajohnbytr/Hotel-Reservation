const DEFAULT_API_PORT = '8787';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function normalizeBaseUrl(url?: string): string {
  return typeof url === 'string' ? url.trim().replace(/\/+$/, '') : '';
}

export function getApiBaseUrl(): string {
  const configured = normalizeBaseUrl(import.meta.env.VITE_API_URL);
  if (configured) return configured;

  if (typeof window === 'undefined') {
    return `http://localhost:${DEFAULT_API_PORT}`;
  }

  const { protocol, hostname } = window.location;
  const resolvedProtocol = protocol === 'https:' ? 'https:' : 'http:';
  const resolvedHost = LOOPBACK_HOSTS.has(hostname) ? 'localhost' : hostname || 'localhost';

  return `${resolvedProtocol}//${resolvedHost}:${DEFAULT_API_PORT}`;
}
