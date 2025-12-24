const ONBOARDING_KEY = "nearplace:onboarding:v1";

export function isOnboardingComplete(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingComplete(completed: boolean): void {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, completed ? "1" : "0");
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function getNextParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("next");
  } catch {
    return null;
  }
}


