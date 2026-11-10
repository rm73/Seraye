import { saveFeedback } from "./feedback";
import * as localSchedule from "./localSchedule";

const TOKEN_KEY = "seraye-admin-token";
let localMode;

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

function storageMissing(error) {
  return /penyimpanan server belum terhubung/i.test(error?.message || "");
}

async function usesLocalStore() {
  if (localMode !== undefined) return localMode;
  try {
    const data = await request("/api/availability");
    localMode = data.persistent === false;
  } catch (error) {
    localMode = storageMissing(error);
  }
  return localMode;
}

export async function loadAvailability() {
  if (await usesLocalStore()) return localSchedule.publicSchedule();
  return request("/api/availability");
}

export async function createClientBooking(booking) {
  if (await usesLocalStore()) return localSchedule.createClientBooking(booking);
  try {
    return await request("/api/bookings", { method: "POST", body: booking });
  } catch (error) {
    if (!storageMissing(error)) throw error;
    localMode = true;
    return localSchedule.createClientBooking(booking);
  }
}

export function loginAdmin(body) {
  return request("/api/auth", { method: "POST", body });
}

export async function loadAdminSchedule() {
  const data = await request("/api/admin/schedule", { auth: true });
  if (data.persistent !== false) {
    localMode = false;
    return data;
  }
  localMode = true;
  return { ...localSchedule.readState(), persistent: true };
}

async function localOrServer(localCall, serverCall) {
  if (await usesLocalStore()) return localCall();
  try {
    return await serverCall();
  } catch (error) {
    if (!storageMissing(error)) throw error;
    localMode = true;
    return localCall();
  }
}

export function saveAdminBooking(booking, method) {
  return localOrServer(
    () => localSchedule.saveAdminBooking(booking, method),
    () => request("/api/admin/bookings", { method, body: booking, auth: true }),
  );
}

export function deleteAdminBooking(id) {
  return localOrServer(
    () => localSchedule.deleteAdminBooking(id),
    () => request(`/api/admin/bookings?id=${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),
  );
}

export function createBlock(block) {
  return localOrServer(
    () => localSchedule.createBlock(block),
    () => request("/api/admin/blocks", { method: "POST", body: block, auth: true }),
  );
}

export function deleteBlock(id) {
  return localOrServer(
    () => localSchedule.deleteBlock(id),
    () => request(`/api/admin/blocks?id=${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),
  );
}

export function saveAdminPhotographer(photographer, method) {
  return localOrServer(
    () => localSchedule.saveAdminPhotographer(photographer, method),
    () => request("/api/admin/photographers", { method, body: photographer, auth: true }),
  );
}

export function deleteAdminPhotographer(id) {
  return localOrServer(
    () => localSchedule.deleteAdminPhotographer(id),
    () => request(`/api/admin/photographers?id=${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),
  );
}

export function saveAdminMock(mock, method) {
  return localOrServer(
    () => localSchedule.saveAdminMock(mock, method),
    () => request("/api/admin/mocks", { method, body: mock, auth: true }),
  );
}

export function deleteAdminMock(id) {
  return localOrServer(
    () => localSchedule.deleteAdminMock(id),
    () => request(`/api/admin/mocks?id=${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),
  );
}

export async function submitFeedback(entry) {
  if (await usesLocalStore()) {
    saveFeedback(entry);
    return { local: true };
  }
  try {
    return await request("/api/feedback", { method: "POST", body: entry });
  } catch (error) {
    if (storageMissing(error) || /tidak ditemukan/i.test(error?.message || "")) {
      saveFeedback(entry);
      return { local: true };
    }
    throw error;
  }
}
