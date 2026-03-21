const AUTH_KEYS = ['aurora_user', 'aurora_token', 'aurora_refresh_token'] as const;

type AuthKey = (typeof AUTH_KEYS)[number];

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

function migrateAuthKeyFromLocalStorage(key: AuthKey): void {
  if (!canUseStorage()) return;
  const sessionValue = window.sessionStorage.getItem(key);
  if (sessionValue) return;

  const localValue = window.localStorage.getItem(key);
  if (!localValue) return;

  window.sessionStorage.setItem(key, localValue);
  window.localStorage.removeItem(key);
}

export function getAuthItem(key: AuthKey): string | null {
  if (!canUseStorage()) return null;
  migrateAuthKeyFromLocalStorage(key);
  return window.sessionStorage.getItem(key);
}

export function setAuthItem(key: AuthKey, value: string): void {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(key, value);
}

export function removeAuthItem(key: AuthKey): void {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

export function clearAuthSession(): void {
  if (!canUseStorage()) return;
  AUTH_KEYS.forEach((key) => {
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  });
}
