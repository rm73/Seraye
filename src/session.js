const KEY = "seraye-client";

export function phoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits ? `62${digits}` : "";
}

export function formatPhone(value) {
  const digits = phoneDigits(value);
  return digits.startsWith("62") ? `0${digits.slice(2)}` : "";
}

export function isPhone(value) {
  return /^628\d{8,12}$/.test(phoneDigits(value));
}

export function displayName() {
  return "Klien Seraye";
}

export function readSession() {
  try {
    const raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!isPhone(session?.identity)) return null;
    return {
      ...session,
      identity: formatPhone(session.identity),
      role: session.role || "client",
      photographerId: session.photographerId || "",
    };
  } catch {
    return null;
  }
}

export function writeSession(session) {
  const raw = JSON.stringify(session);
  if (session.remember) {
    localStorage.setItem(KEY, raw);
    sessionStorage.removeItem(KEY);
    return;
  }
  sessionStorage.setItem(KEY, raw);
  localStorage.removeItem(KEY);
}

export function clearSession() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
