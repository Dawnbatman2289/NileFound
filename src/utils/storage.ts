export const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const safeSetStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or restricted environments
  }
};

export const safeRemoveStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
};
