import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { buildMockId, isActiveWhatsApp, isGoogleMapsLink } from "../src/booking.js";
import { packages } from "../src/data.js";
import {
  addMinutes,
  firstFreePhotographer,
  normalizePhotographers,
  normalizeTime,
  packageMinutes,
  photographerIds,
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
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === "string") {
    if (!req.body) return Promise.resolve({});
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.reject(Object.assign(new Error("Format data tidak dikenali."), { status: 400 }));
    }
  }
  return new Promise((resolve, reject) => {
    if (req.readableEnded) {
      resolve({});
      return;
    }
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

function paymentStatusValue(value, fallback = "dp") {
  return value === "pelunasan" ? "pelunasan" : value === "dp" ? "dp" : fallback;
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
  if (name.length < 3) {
    throw Object.assign(new Error("Nama lengkap minimal 3 karakter."), { status: 400 });
  }
  if (!isActiveWhatsApp(whatsapp)) {
    throw Object.assign(
      new Error("Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit)."),
      { status: 400 },
    );
  }
  const muaMap = cleanText(input.muaMap, 300);
  const includeMua = Boolean(input.includeMua);
  if (includeMua && !isGoogleMapsLink(muaMap)) {
    throw Object.assign(
      new Error("Tautan Google Maps harus berisi link Google, contoh https://maps.app.goo.gl/"),
      { status: 400 },
    );
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
    extraPhotos: Math.max(0, Number(input.extraPhotos) || 0),
    includeMua,
    makeupDate: cleanText(input.makeupDate, 10),
    makeupTime: normalizeTime(input.makeupTime),
    hairStyle: cleanText(input.hairStyle, 20),
    muaAddress: cleanText(input.muaAddress, 240),
    muaMap,
    totalPrice: Number(input.totalPrice) || selected.price,
    bookingFee: Number(input.bookingFee) || 100000,
    paymentStatus: paymentStatusValue(input.paymentStatus, existing?.paymentStatus || "dp"),
    photographer: existing?.photographer || "",
    sortOrder: Number.isFinite(Number(input.sortOrder))
      ? Number(input.sortOrder)
      : Number(existing?.sortOrder) || Date.now(),
    source: existing?.source || (input.source === "copy" ? "copy" : input.source === "admin" || input.source === "mock" ? "admin" : "whatsapp"),
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
    photographers: state.photographers,
  });
  if (!status.ok) throw Object.assign(new Error(status.message), { status: 409 });
}

function assignPhotographer(state, record, requested, auto) {
  const ids = photographerIds(state.photographers);
  const taken = takenPhotographers(state.bookings, record.date, record.startTime, record.endTime, record.id);
  if (!auto) {
    if (!requested) return "";
    if (!ids.includes(requested)) {
      throw Object.assign(new Error("Fotografer tidak dikenali."), { status: 400 });
    }
    if (taken.has(requested)) {
      throw Object.assign(new Error(`Fotografer ${requested} sudah ada sesi di jam ini.`), { status: 409 });
    }
    return requested;
  }
  if (record.photographer && !taken.has(record.photographer)) return record.photographer;
  return firstFreePhotographer(state.bookings, record.date, record.startTime, record.endTime, record.id, state.photographers);
}

function buildMock(input, existing) {
  const name = cleanText(input.name, 80);
  const whatsapp = cleanText(input.whatsapp, 20);
  if (name.length < 3) {
    throw Object.assign(new Error("Nama lengkap minimal 3 karakter."), { status: 400 });
  }
  if (!isActiveWhatsApp(whatsapp)) {
    throw Object.assign(
      new Error("Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit)."),
      { status: 400 },
    );
  }
  const selected = findPackage(input.packageId) || packages[0];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || "")) ? input.date : "";
  const startTime = normalizeTime(input.startTime);
  const id = buildMockId({ date, startTime, packageName: selected.name });
  if (!id) {
    throw Object.assign(new Error("Tanggal dan jam mulai wajib diisi untuk ID mock."), { status: 400 });
  }
  return {
    id,
    name,
    whatsapp,
    packageId: selected.id,
    packageName: selected.name,
    location: cleanText(input.location, 160),
    notes: cleanText(input.notes, 500),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || "")) ? input.date : "",
    startTime: normalizeTime(input.startTime),
    extraPhotos: Math.max(0, Number(input.extraPhotos) || 0),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
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
      record.photographer = assignPhotographer(state, record, cleanText(body.photographer, 8).toUpperCase(), false);
      record.source = existing?.source || "admin";
      savedId = record.id;
      const withBooking = saveBooking(state, record);
      const mockId = cleanText(body.mockId, 40);
      if (!mockId) return withBooking;
      return {
        ...withBooking,
        mocks: (withBooking.mocks || []).filter((item) => item.id !== mockId),
      };
    });
    const saved = next.bookings.find((item) => item.id === savedId);
    return send(res, 200, {
      booking: saved,
      bookings: next.bookings,
      blocks: next.blocks,
      photographers: next.photographers,
      mocks: next.mocks,
    });
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

async function handleAdminPhotographers(req, res) {
  if (!isAdmin(req)) return send(res, 401, { message: "Sesi admin berakhir. Masuk lagi." });
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "POST" || req.method === "PUT") {
    const body = await readBody(req);
    const phone = cleanText(body.phone, 20);
    if (!isActiveWhatsApp(phone)) {
      return send(res, 400, { message: "Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit)." });
    }
    const next = await updateState((state) => {
      const current = normalizePhotographers(state.photographers);
      const requestedId = cleanText(body.id, 8).toUpperCase();
      if (req.method === "PUT") {
        const index = current.findIndex((item) => item.id === requestedId);
        if (index < 0) throw Object.assign(new Error("Fotografer tidak ditemukan."), { status: 404 });
        current[index] = {
          id: requestedId,
          name: cleanText(body.name, 80) || current[index].name,
          phone,
          notes: cleanText(body.notes, 240),
        };
        return { ...state, photographers: current };
      }
      let id = requestedId;
      if (!id) {
        const used = new Set(current.map((item) => item.id));
        id = "A";
        while (used.has(id)) id = String.fromCharCode(id.charCodeAt(0) + 1);
      }
      if (current.some((item) => item.id === id)) {
        throw Object.assign(new Error("ID fotografer sudah dipakai."), { status: 409 });
      }
      return {
        ...state,
        photographers: current.concat({
          id,
          name: cleanText(body.name, 80) || `Fotografer ${id}`,
          phone,
          notes: cleanText(body.notes, 240),
        }),
      };
    });
    return send(res, 200, { photographers: next.photographers, bookings: next.bookings, blocks: next.blocks, mocks: next.mocks });
  }
  if (req.method === "DELETE") {
    const id = cleanText(url.searchParams.get("id"), 8).toUpperCase();
    const next = await updateState((state) => {
      const current = normalizePhotographers(state.photographers);
      if (current.length <= 1) {
        throw Object.assign(new Error("Minimal satu fotografer harus tetap ada."), { status: 400 });
      }
      if (!current.some((item) => item.id === id)) {
        throw Object.assign(new Error("Fotografer tidak ditemukan."), { status: 404 });
      }
      return {
        ...state,
        photographers: current.filter((item) => item.id !== id),
        bookings: state.bookings.map((booking) =>
          booking.photographer === id ? { ...booking, photographer: "" } : booking,
        ),
      };
    });
    return send(res, 200, { photographers: next.photographers, bookings: next.bookings, blocks: next.blocks, mocks: next.mocks });
  }
  return send(res, 405, { message: "Metode tidak didukung." });
}

async function handleAdminMocks(req, res) {
  if (!isAdmin(req)) return send(res, 401, { message: "Sesi admin berakhir. Masuk lagi." });
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "POST" || req.method === "PUT") {
    const body = await readBody(req);
    let savedId = "";
    const next = await updateState((state) => {
      const mocks = Array.isArray(state.mocks) ? state.mocks.slice() : [];
      const existing = mocks.find((item) => item.id === cleanText(body.id, 40));
      if (req.method === "PUT" && !existing) {
        throw Object.assign(new Error("Mock customer tidak ditemukan."), { status: 404 });
      }
      const record = buildMock(body, existing);
      savedId = record.id;
      const withoutPrevious = existing ? mocks.filter((item) => item.id !== existing.id) : mocks;
      if (withoutPrevious.some((item) => item.id === record.id)) {
        throw Object.assign(new Error("ID mock sudah dipakai untuk tanggal, jam, dan paket ini."), { status: 409 });
      }
      return { ...state, mocks: withoutPrevious.concat(record) };
    });
    return send(res, 200, {
      mock: next.mocks.find((item) => item.id === savedId),
      mocks: next.mocks,
      bookings: next.bookings,
      blocks: next.blocks,
      photographers: next.photographers,
    });
  }
  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    const next = await updateState((state) => ({
      ...state,
      mocks: (state.mocks || []).filter((item) => item.id !== id),
    }));
    return send(res, 200, {
      mocks: next.mocks,
      bookings: next.bookings,
      blocks: next.blocks,
      photographers: next.photographers,
    });
  }
  return send(res, 405, { message: "Metode tidak didukung." });
}

async function handleFeedback(req, res) {
  if (req.method !== "POST") return send(res, 405, { message: "Metode tidak didukung." });
  const body = await readBody(req);
  const service = Number(body.service);
  const website = Number(body.website);
  if (service < 1 || service > 5 || website < 1 || website > 5) {
    return send(res, 400, { message: "Pilih bintang untuk Seraye Moments dan untuk website seraye." });
  }
  const entry = {
    id: `fb${Date.now().toString(36)}`,
    service,
    website,
    message: cleanText(body.message, 1000),
    createdAt: new Date().toISOString(),
  };
  const next = await updateState((state) => ({
    ...state,
    feedback: [entry, ...(Array.isArray(state.feedback) ? state.feedback : [])],
  }));
  return send(res, 200, { feedback: entry, feedbackList: next.feedback });
}

const routes = {
  "/api/auth": handleAuth,
  "/api/availability": handleAvailability,
  "/api/bookings": handleClientBooking,
  "/api/feedback": handleFeedback,
  "/api/admin/schedule": handleAdminSchedule,
  "/api/admin/bookings": handleAdminBookings,
  "/api/admin/blocks": handleAdminBlocks,
  "/api/admin/photographers": handleAdminPhotographers,
  "/api/admin/mocks": handleAdminMocks,
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
