const KEY = "seraye-client";

export function displayName(identity) {
  const value = String(identity || "").trim();
  if (value.includes("@")) {
    const local = value.split("@")[0].replace(/[._-]+/g, " ").trim();
    if (!local) return "Klien Seraye";
    return local.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return "Klien Seraye";
}

export function readSession() {
  try {
    const raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.identity) return null;
    return session;
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
