export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

export type AuthPersistence = "local" | "session";

export interface StoredAuthSession {
  jwt: string;
  user: AuthUser | null;
  persistence: AuthPersistence;
}

export const AUTH_LOGOUT_EVENT = "app:auth:logout";

const JWT_KEY = "jwt";
const USER_KEY = "user";
const PERSISTENCE_KEY = "auth_persistence";

const isBrowser = typeof window !== "undefined";

const getStorage = (persistence: AuthPersistence): Storage | null => {
  if (!isBrowser) return null;
  return persistence === "local" ? window.localStorage : window.sessionStorage;
};

const parseStoredUser = (rawUser: string | null): AuthUser | null => {
  if (!rawUser) return null;

  try {
    const parsed = JSON.parse(rawUser) as Partial<AuthUser>;

    if (typeof parsed.id !== "number" || typeof parsed.email !== "string") {
      return null;
    }

    return {
      id: parsed.id,
      email: parsed.email,
      username:
        typeof parsed.username === "string" && parsed.username.length > 0
          ? parsed.username
          : parsed.email,
    };
  } catch {
    return null;
  }
};

const clearStorage = (storage: Storage | null) => {
  if (!storage) return;
  storage.removeItem(JWT_KEY);
  storage.removeItem(USER_KEY);
};

const readFromStorage = (
  storage: Storage | null,
  persistence: AuthPersistence,
): StoredAuthSession | null => {
  if (!storage) return null;

  const jwt = storage.getItem(JWT_KEY);
  if (!jwt) return null;

  return {
    jwt,
    user: parseStoredUser(storage.getItem(USER_KEY)),
    persistence,
  };
};

export const persistAuthSession = (
  jwt: string,
  user: AuthUser,
  persistence: AuthPersistence,
) => {
  const currentStorage = getStorage(persistence);
  const alternateStorage = getStorage(persistence === "local" ? "session" : "local");
  if (!currentStorage) return;

  currentStorage.setItem(JWT_KEY, jwt);
  currentStorage.setItem(USER_KEY, JSON.stringify(user));
  if (isBrowser) {
    window.localStorage.setItem(PERSISTENCE_KEY, persistence);
  }

  clearStorage(alternateStorage);
};

export const clearAuthSession = () => {
  if (!isBrowser) return;

  clearStorage(window.localStorage);
  clearStorage(window.sessionStorage);
  window.localStorage.removeItem(PERSISTENCE_KEY);
};

export const getStoredAuthSession = (): StoredAuthSession | null => {
  if (!isBrowser) return null;

  const preferredPersistence = window.localStorage.getItem(PERSISTENCE_KEY);

  const priority: AuthPersistence[] =
    preferredPersistence === "local"
      ? ["local", "session"]
      : preferredPersistence === "session"
        ? ["session", "local"]
        : ["session", "local"];

  for (const persistence of priority) {
    const session = readFromStorage(getStorage(persistence), persistence);
    if (session) return session;
  }

  return null;
};

export const getAuthToken = (): string | null => {
  return getStoredAuthSession()?.jwt ?? null;
};
