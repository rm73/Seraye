import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { packages } from "../src/data.js";
import {
  addMinutes,
  firstFreePhotographer,
  normalizeTime,
  packageMinutes,
  PHOTOGRAPHERS,
  slotStatus,
  takenPhotographers,
} from "../src/schedule.js";
import { readState, storageInfo, updateState } from "./store.mjs";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") return "";
  return "seraye-admin";
}

function adminLinkKey() {
  if (process.env.ADMIN_LINK_KEY) return process.env.ADMIN_LINK_KEY;
  return "seraye-admin";
}

function tokenSecret() {
  return process.env.ADMIN_SECRET || adminPassword() || "seraye-dev-secret";
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 100_000) {
        reject(Object.assign(new Error("Data terlalu besar."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("Format data tidak dikenali."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function signToken() {
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", exp: Date.now() + TOKEN_TTL_MS, nonce: randomBytes(8).toString("hex") }),
  ).toString("base64url");
  const signature = createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function tokenIsValid(token) {
  if (!token || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  const expected = createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "admin" && data.exp > Date.now();
  } catch {
    return false;
  }
}

function isAdmin(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return tokenIsValid(match?.[1] || "");
}

function cleanText(value, max) {
  return String(value || "").trim().slice(0, max);
}

function makeBookingId(date, startTime, code) {
  const [year, month, day] = date.split("-");
  return `${day}${month}${year}${startTime.replace(":", "")}${code}`;
}

function findPackage(packageId) {
  return packages.find((item) => item.id === packageId);
}

function publicSchedule(state) {
  return {
    bookings: state.bookings.map((booking) => ({
      id: booking.id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      photographer: booking.photographer || "",
    })),
    blocks: state.blocks,
    ...storageInfo(),
  };
}

function buildRecord(input, existing) {
  const selected = findPackage(input.packageId);
  if (!selected) {
    throw Object.assign(new Error("Paket tidak dikenali."), { status: 400 });
  }
  const date = cleanText(input.date, 10);
  const startTime = normalizeTime(input.startTime);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !startTime) {
    throw Object.assign(new Error("Tanggal atau jam belum lengkap."), { status: 400 });
  }
  const name = cleanText(input.name, 80);
  const whatsapp = cleanText(input.whatsapp, 20);
  const location = cleanText(input.location, 160);
  if (name.length < 3 || whatsapp.length < 10 || location.length < 3) {
    throw Object.assign(new Error("Nama, WhatsApp, dan lokasi wajib diisi."), { status: 400 });
  }
  return {
    id: cleanText(input.id, 40) || existing?.id || makeBookingId(date, startTime, selected.code),
    name,
    whatsapp,
    date,
    startTime,
    endTime: addMinutes(startTime, packageMinutes(selected)),
    packageId: selected.id,
    packageName: selected.name,
    packageCode: selected.code,
    minutes: packageMinutes(selected),
    location,
    notes: cleanText(input.notes, 500),
    photographer: existing?.photographer || "",
    source: existing?.source || (input.source === "copy" ? "copy" : "whatsapp"),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
}

function assertSlot(state, record) {
  const status = slotStatus({
    bookings: state.bookings,
    blocks: state.blocks,
    date: record.date,
    start: record.startTime,
    end: record.endTime,
    ignoreId: record.id,
  });
  if (!status.ok) throw Object.assign(new Error(status.message), { status: 409 });
}

function assignPhotographer(state, record, requested, auto) {
  const taken = takenPhotographers(state.bookings, record.date, record.startTime, record.endTime, record.id);
  if (!auto) {
    if (!requested) return "";
    if (!PHOTOGRAPHERS.includes(requested)) {
      throw Object.assign(new Error("Fotografer tidak dikenali."), { status: 400 });
    }
    if (taken.has(requested)) {
      throw Object.assign(new Error(`Fotografer ${requested} sudah ada sesi di jam ini.`), { status: 409 });
    }
    return requested;
  }
  if (record.photographer && !taken.has(record.photographer)) return record.photographer;
  return firstFreePhotographer(state.bookings, record.date, record.startTime, record.endTime, record.id);
}

function saveBooking(state, record) {
  const index = state.bookings.findIndex((item) => item.id === record.id);
  const bookings = state.bookings.slice();
  if (index >= 0) bookings[index] = record;
  else bookings.push(record);
  return { ...state, bookings };
}

async function handleAuth(req, res) {
  if (req.method !== "POST") return send(res, 405, { message: "Metode tidak didukung." });
  const body = await readBody(req);
  const password = adminPassword();
  const linkKey = adminLinkKey();
  const passwordOk = password && cleanText(body.password, 200) === password;
  const linkOk = linkKey && cleanText(body.key, 200) === linkKey;
  if (!password && !linkKey) {
    return send(res, 503, { message: "Kata sandi admin belum diatur di server." });
  }
  if (!passwordOk && !linkOk) return send(res, 401, { message: "Kata sandi admin salah." });
  return send(res, 200, { token: signToken() });
}

async function handleAvailability(req, res) {
  if (req.method !== "GET") return send(res, 405, { message: "Metode tidak didukung." });
  const state = await readState();
  return send(res, 200, publicSchedule(state));
}

async function handleClientBooking(req, res) {
  if (req.method !== "POST") return send(res, 405, { message: "Metode tidak didukung." });
  const body = await readBody(req);
  const next = await updateState((state) => {
    const existing = state.bookings.find((item) => item.id === cleanText(body.id, 40));
    const record = buildRecord(body, existing);
    assertSlot(state, record);
    record.photographer = assignPhotographer(state, record, "", true);
    return saveBooking(state, record);
  });
  const saved = next.bookings.find((item) => item.id === cleanText(body.id, 40));
  return send(res, 200, { booking: saved });
}

async function handleAdminSchedule(req, res) {
  if (!isAdmin(req)) return send(res, 401, { message: "Sesi admin berakhir. Masuk lagi." });
  if (req.method !== "GET") return send(res, 405, { message: "Metode tidak didukung." });
  const state = await readState();
  return send(res, 200, { ...state, ...storageInfo() });
}

async function handleAdminBookings(req, res) {
  if (!isAdmin(req)) return send(res, 401, { message: "Sesi admin berakhir. Masuk lagi." });
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "POST" || req.method === "PUT") {
    const body = await readBody(req);
    let savedId = "";
    const next = await updateState((state) => {
      const existing = state.bookings.find((item) => item.id === cleanText(body.id, 40));
      if (req.method === "PUT" && !existing) {
        throw Object.assign(new Error("Booking tidak ditemukan."), { status: 404 });
      }
      const record = buildRecord({ ...body, source: "admin" }, existing);
      if (!existing && state.bookings.some((item) => item.id === record.id)) {
        record.id = `${record.id}-${Date.now().toString(36).slice(-3)}`;
      }
      assertSlot(state, record);
      record.photographer = assignPhotographer(state, record, cleanText(body.photographer, 1), false);
      record.source = existing?.source || "admin";
      savedId = record.id;
      return saveBooking(state, record);
    });
    const saved = next.bookings.find((item) => item.id === savedId);
    return send(res, 200, { booking: saved, bookings: next.bookings, blocks: next.blocks });
  }
  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const next = await updateState((state) => ({
      ...state,
      bookings: state.bookings.filter((item) => item.id !== id),
    }));
    return send(res, 200, { bookings: next.bookings, blocks: next.blocks });
  }
  return send(res, 405, { message: "Metode tidak didukung." });
}

async function handleAdminBlocks(req, res) {
  if (!isAdmin(req)) return send(res, 401, { message: "Sesi admin berakhir. Masuk lagi." });
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "POST") {
    const body = await readBody(req);
    const startDate = cleanText(body.startDate, 10);
    const endDate = cleanText(body.endDate || body.startDate, 10);
    const startTime = normalizeTime(body.startTime);
    const endTime = normalizeTime(body.endTime);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
      return send(res, 400, { message: "Rentang tanggal blokir belum benar." });
    }
    if ((startTime && !endTime) || (!startTime && endTime)) {
      return send(res, 400, { message: "Isi jam mulai dan jam selesai, atau kosongkan keduanya untuk menutup seharian." });
    }
    if (startTime && endTime && `${startDate}T${startTime}` >= `${endDate}T${endTime}`) {
      return send(res, 400, { message: "Jam selesai harus setelah jam mulai." });
    }
    const block = {
      id: `blk${Date.now().toString(36)}`,
      startDate,
      endDate,
      startTime,
      endTime,
      reason: cleanText(body.reason, 120) || "Ditutup admin",
    };
    const next = await updateState((state) => ({ ...state, blocks: state.blocks.concat(block) }));
    return send(res, 200, { blocks: next.blocks, bookings: next.bookings });
  }
  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const next = await updateState((state) => ({
      ...state,
      blocks: state.blocks.filter((item) => item.id !== id),
    }));
    return send(res, 200, { blocks: next.blocks, bookings: next.bookings });
  }
  return send(res, 405, { message: "Metode tidak didukung." });
}

const routes = {
  "/api/auth": handleAuth,
  "/api/availability": handleAvailability,
  "/api/bookings": handleClientBooking,
  "/api/admin/schedule": handleAdminSchedule,
  "/api/admin/bookings": handleAdminBookings,
  "/api/admin/blocks": handleAdminBlocks,
};

export async function handleApi(req, res, forcedPath) {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const path = (forcedPath || url.pathname).replace(/\/$/, "") || "/";
    const handler = routes[path];
    if (!handler) return send(res, 404, { message: "Tidak ditemukan." });
    await handler(req, res);
  } catch (error) {
    send(res, error.status || 500, { message: error.message || "Server gagal memproses permintaan." });
  }
}
