const TOKEN_KEY = "seraye-admin-token";

export function adminToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setAdminToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (auth) headers.authorization = `Bearer ${adminToken()}`;
  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && auth) setAdminToken("");
  if (!response.ok) throw new Error(data.message || "Permintaan gagal.");
  return data;
}

export function loadAvailability() {
  return request("/api/availability");
}

export function createClientBooking(booking) {
  return request("/api/bookings", { method: "POST", body: booking });
}

export function loginAdmin(body) {
  return request("/api/auth", { method: "POST", body });
}

export function loadAdminSchedule() {
  return request("/api/admin/schedule", { auth: true });
}

export function saveAdminBooking(booking, method) {
  return request("/api/admin/bookings", { method, body: booking, auth: true });
}

export function deleteAdminBooking(id) {
  return request(`/api/admin/bookings?id=${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
}

export function createBlock(block) {
  return request("/api/admin/blocks", { method: "POST", body: block, auth: true });
}

export function deleteBlock(id) {
  return request(`/api/admin/blocks?id=${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
}
