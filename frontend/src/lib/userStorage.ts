export type StoredUser = {
  id?: number | string;
  name?: string;
  full_name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  role?: string;
  created_at?: string;
  createdAt?: string;
};

const USER_KEY = "user";
export const PROFILE_UPDATED_EVENT = "profileUpdated";

export function readStoredUser(): StoredUser | null {
  const raw = sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredUser;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    return null;
  }
  return null;
}

export function writeStoredUser(user: StoredUser) {
  const payload = JSON.stringify(user);
  const hasSession = sessionStorage.getItem(USER_KEY) !== null;
  const hasLocal = localStorage.getItem(USER_KEY) !== null;

  if (hasSession || !hasLocal) {
    sessionStorage.setItem(USER_KEY, payload);
  }
  if (hasLocal || !hasSession) {
    localStorage.setItem(USER_KEY, payload);
  }

  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
}

export function clearAuthStorage() {
  const keys = ["access_token", "token", "refresh_token", USER_KEY];
  keys.forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
}

export function getDisplayName(user: StoredUser | null): string {
  return (
    user?.full_name ||
    user?.name ||
    user?.fullName ||
    user?.username ||
    "Farm Manager"
  );
}

export function getDisplayEmail(user: StoredUser | null): string {
  return user?.email || "manager@pinetrack.com";
}

export function getDisplayRole(user: StoredUser | null): string {
  return user?.role || "Farm Manager";
}

export function getDisplayCreatedAt(user: StoredUser | null): string | null {
  const raw = user?.created_at || user?.createdAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getInitials(name: string, email: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length > 0) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }
  return (email[0] ?? "U").toUpperCase();
}
