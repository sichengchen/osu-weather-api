export type ThemeMode = "auto" | "light" | "dark";

const THEME_STORAGE_KEY = "weather-theme-mode";

export function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "auto";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return "auto";
}

export function persistThemeMode(themeMode: ThemeMode): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
}

export function applyThemeMode(themeMode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  if (themeMode === "auto") {
    delete document.documentElement.dataset.theme;
    return;
  }

  document.documentElement.dataset.theme = themeMode;
}
