import { reportError } from '../components/ErrorBoundary.tsx';

export const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    reportError(`readJson(${key}) failed`, err);
    return fallback;
  }
};

export const safeSetStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    reportError(`safeSetStorage(${key}) failed`, err);
  }
};

export const safeRemoveStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    reportError(`safeRemoveStorage(${key}) failed`, err);
  }
};
