import { buildBookingId, buildMockId, isActiveWhatsApp, isGoogleMapsLink } from "./booking";
import { packages } from "./data";
import {
  addMinutes,
  DEFAULT_PHOTOGRAPHERS,
  firstFreePhotographer,
  normalizePhotographers,
  normalizeTime,
  packageMinutes,
  photographerIds,
  slotStatus,
  takenPhotographers,
} from "./schedule";

const STORAGE_KEY = "seraye-local-schedule";

function shiftDate(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function cleanText(value, max) {
  return String(value || "").trim().slice(0, max);
}

function findPackage(packageId) {
  return packages.find((item) => item.id === packageId);
}

function paymentStatusValue(value, fallback = "dp") {
  return value === "pelunasan" ? "pelunasan" : value === "dp" ? "dp" : fallback;
}

function mockBooking({ name, whatsapp, date, startTime, packageId, location, notes, photographer, source, paymentStatus }) {
  const selected = findPackage(packageId);
  const minutes = packageMinutes(selected);
  return {
    id: buildBookingId({ date, startTime, code: selected.code }),
    name,
    whatsapp,
    date,
    startTime,
    endTime: addMinutes(startTime, minutes),
    packageId: selected.id,
    packageName: selected.name,
    packageCode: selected.code,
    minutes,
    location,
    notes,
    photographer,
    paymentStatus: paymentStatus || "dp",
    sortOrder: Date.now(),
    source,
    createdAt: new Date().toISOString(),
  };
}

function seedState() {
  const busy = shiftDate(5);
  const next = shiftDate(6);
  return {
    bookings: [
      mockBooking({
        name: "Nadia Putri",
        whatsapp: "081234560011",
        date: busy,
        startTime: "09:00",
        packageId: "sekejap",
        location: "Gerbang utama UI Depok",
        notes: "Mau foto dekat danau.",
        photographer: "A",
        source: "whatsapp",
        paymentStatus: "dp",
      }),
      mockBooking({
        name: "Reza Mahendra",
        whatsapp: "081345670022",
        date: busy,
        startTime: "09:15",
        packageId: "sekilas",
        location: "Fakultas Teknik UI",
        notes: "",
        photographer: "B",
        source: "copy",
        paymentStatus: "dp",
      }),
      mockBooking({
        name: "Aulia Rahman",
        whatsapp: "081856780033",
        date: busy,
        startTime: "09:30",
        packageId: "sejenak",
        location: "Balairung UI",
        notes: "Datang bersama orang tua.",
        photographer: "C",
        source: "whatsapp",
        paymentStatus: "pelunasan",
      }),
      mockBooking({
        name: "Salsa Kirana",
        whatsapp: "082167890044",
        date: next,
        startTime: "13:00",
        packageId: "sekawan",
        location: "Kampus ITS Surabaya",
        notes: "Butuh video portrait.",
        photographer: "A",
        source: "whatsapp",
        paymentStatus: "dp",
      }),
    ],
    blocks: [
      {
        id: "blk-mock-sore",
        startDate: busy,
        endDate: busy,
        startTime: "15:00",
        endTime: "17:00",
        reason: "Slot sore sudah dikunci",
      },
      {
        id: "blk-mock-lintas",
        startDate: shiftDate(8),
        endDate: shiftDate(9),
        startTime: "18:00",
        endTime: "10:00",
        reason: "Acara keluarga",
      },
      {
        id: "blk-mock-seharian",
        startDate: shiftDate(12),
        endDate: shiftDate(12),
        startTime: "",
        endTime: "",
        reason: "Libur, ditutup seharian",
      },
    ],
    photographers: DEFAULT_PHOTOGRAPHERS.map((item) => ({ ...item })),
    mocks: [
      {
        id: "mock-seed-1",
        name: "Dimas Pratama",
        whatsapp: "081298765432",
        packageId: "sekejap",
        packageName: "Sekejap",
        location: "ITB Bandung",
        notes: "Calon client follow-up",
        date: shiftDate(6),
        startTime: "09:00",
        extraPhotos: 2,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function normalizeState(parsed) {
  return {
    bookings: Array.isArray(parsed?.bookings) ? parsed.bookings : [],
    blocks: Array.isArray(parsed?.blocks) ? parsed.blocks : [],
    photographers: normalizePhotographers(parsed?.photographers),
    mocks: Array.isArray(parsed?.mocks) ? parsed.mocks : [],
  };
}

export function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return writeState(seedState());
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.bookings) || !Array.isArray(parsed.blocks)) return writeState(seedState());
    return writeState(normalizeState(parsed));
  } catch {
    return writeState(seedState());
  }
}

function writeState(state) {
  const next = normalizeState(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function publicSchedule() {
  const state = readState();
  return {
    bookings: state.bookings.map((booking) => ({
      id: booking.id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      photographer: booking.photographer || "",
    })),
    blocks: state.blocks,
    capacity: photographerIds(state.photographers).length,
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
  if (!status.ok) throw new Error(status.message);
}

function assignPhotographer(state, record, requested, auto) {
  const ids = photographerIds(state.photographers);
  const taken = takenPhotographers(state.bookings, record.date, record.startTime, record.endTime, record.id);
  if (!auto) {
    if (!requested) return "";
    if (!ids.includes(requested)) throw new Error("Fotografer tidak dikenali.");
    if (taken.has(requested)) throw new Error(`Fotografer ${requested} sudah ada sesi di jam ini.`);
    return requested;
  }
  if (record.photographer && !taken.has(record.photographer)) return record.photographer;
  return firstFreePhotographer(state.bookings, record.date, record.startTime, record.endTime, record.id, state.photographers);
}

function buildRecord(input, existing) {
  const selected = findPackage(input.packageId);
  if (!selected) throw new Error("Paket tidak dikenali.");
  const date = cleanText(input.date, 10);
  const startTime = normalizeTime(input.startTime);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !startTime) throw new Error("Tanggal atau jam belum lengkap.");
  const name = cleanText(input.name, 80);
  const whatsapp = cleanText(input.whatsapp, 20);
  const location = cleanText(input.location, 160);
  if (name.length < 3) throw new Error("Nama lengkap minimal 3 karakter.");
  if (!isActiveWhatsApp(whatsapp)) {
    throw new Error("Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit).");
  }
  const muaMap = cleanText(input.muaMap, 300);
  const includeMua = Boolean(input.includeMua);
  if (includeMua && !isGoogleMapsLink(muaMap)) {
    throw new Error("Tautan Google Maps harus berisi link Google, contoh https://maps.app.goo.gl/");
  }
  return {
    id: cleanText(input.id, 40) || existing?.id || buildBookingId({ date, startTime, code: selected.code }),
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

function saveBooking(state, record) {
  const index = state.bookings.findIndex((item) => item.id === record.id);
  const bookings = state.bookings.slice();
  if (index >= 0) bookings[index] = record;
  else bookings.push(record);
  return { ...state, bookings };
}

export function createClientBooking(input) {
  const state = readState();
  const existing = state.bookings.find((item) => item.id === cleanText(input.id, 40));
  const record = buildRecord(input, existing);
  assertSlot(state, record);
  record.photographer = assignPhotographer(state, record, "", true);
  const next = writeState(saveBooking(state, record));
  return { booking: next.bookings.find((item) => item.id === record.id) };
}

export function saveAdminBooking(input, method) {
  const state = readState();
  const existing = state.bookings.find((item) => item.id === cleanText(input.id, 40));
  if (method === "PUT" && !existing) throw new Error("Booking tidak ditemukan.");
  const record = buildRecord({ ...input, source: "admin" }, existing);
  if (!existing && state.bookings.some((item) => item.id === record.id)) {
    record.id = `${record.id}-${Date.now().toString(36).slice(-3)}`;
  }
  assertSlot(state, record);
  record.photographer = assignPhotographer(state, record, cleanText(input.photographer, 8).toUpperCase(), false);
  record.source = existing?.source || "admin";
  let next = writeState(saveBooking(state, record));
  if (input.mockId) {
    next = writeState({
      ...next,
      mocks: next.mocks.filter((item) => item.id !== input.mockId),
    });
  }
  return { booking: next.bookings.find((item) => item.id === record.id), bookings: next.bookings, blocks: next.blocks, photographers: next.photographers, mocks: next.mocks };
}

export function deleteAdminBooking(id) {
  const state = readState();
  const next = writeState({ ...state, bookings: state.bookings.filter((item) => item.id !== id) });
  return { bookings: next.bookings, blocks: next.blocks, photographers: next.photographers, mocks: next.mocks };
}

export function createBlock(input) {
  const startDate = cleanText(input.startDate, 10);
  const endDate = cleanText(input.endDate || input.startDate, 10);
  const startTime = normalizeTime(input.startTime);
  const endTime = normalizeTime(input.endTime);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
    throw new Error("Rentang tanggal blokir belum benar.");
  }
  if ((startTime && !endTime) || (!startTime && endTime)) {
    throw new Error("Isi jam mulai dan jam selesai, atau kosongkan keduanya untuk menutup seharian.");
  }
  if (startTime && endTime && `${startDate}T${startTime}` >= `${endDate}T${endTime}`) {
    throw new Error("Jam selesai harus setelah jam mulai.");
  }
  const block = {
    id: `blk${Date.now().toString(36)}`,
    startDate,
    endDate,
    startTime,
    endTime,
    reason: cleanText(input.reason, 120) || "Ditutup admin",
  };
  const state = readState();
  const next = writeState({ ...state, blocks: state.blocks.concat(block) });
  return { blocks: next.blocks, bookings: next.bookings, photographers: next.photographers, mocks: next.mocks };
}

export function deleteBlock(id) {
  const state = readState();
  const next = writeState({ ...state, blocks: state.blocks.filter((item) => item.id !== id) });
  return { blocks: next.blocks, bookings: next.bookings, photographers: next.photographers, mocks: next.mocks };
}

export function saveAdminPhotographer(input, method) {
  const state = readState();
  const phone = cleanText(input.phone, 20);
  if (!isActiveWhatsApp(phone)) {
    throw new Error("Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit).");
  }
  const current = normalizePhotographers(state.photographers);
  const requestedId = cleanText(input.id, 8).toUpperCase();
  if (method === "PUT") {
    const index = current.findIndex((item) => item.id === requestedId);
    if (index < 0) throw new Error("Fotografer tidak ditemukan.");
    current[index] = {
      id: requestedId,
      name: cleanText(input.name, 80) || current[index].name,
      phone,
      notes: cleanText(input.notes, 240),
    };
  } else {
    let id = requestedId;
    if (!id) {
      const used = new Set(current.map((item) => item.id));
      id = "A";
      while (used.has(id)) id = String.fromCharCode(id.charCodeAt(0) + 1);
    }
    if (current.some((item) => item.id === id)) throw new Error("ID fotografer sudah dipakai.");
    current.push({
      id,
      name: cleanText(input.name, 80) || `Fotografer ${id}`,
      phone,
      notes: cleanText(input.notes, 240),
    });
  }
  const next = writeState({ ...state, photographers: current });
  return { photographers: next.photographers, bookings: next.bookings, blocks: next.blocks, mocks: next.mocks };
}

export function deleteAdminPhotographer(id) {
  const state = readState();
  const current = normalizePhotographers(state.photographers);
  const target = cleanText(id, 8).toUpperCase();
  if (current.length <= 1) throw new Error("Minimal satu fotografer harus tetap ada.");
  if (!current.some((item) => item.id === target)) throw new Error("Fotografer tidak ditemukan.");
  const next = writeState({
    ...state,
    photographers: current.filter((item) => item.id !== target),
    bookings: state.bookings.map((booking) =>
      booking.photographer === target ? { ...booking, photographer: "" } : booking,
    ),
  });
  return { photographers: next.photographers, bookings: next.bookings, blocks: next.blocks, mocks: next.mocks };
}

function buildMock(input, existing) {
  const name = cleanText(input.name, 80);
  const whatsapp = cleanText(input.whatsapp, 20);
  if (name.length < 3) throw new Error("Nama lengkap minimal 3 karakter.");
  if (!isActiveWhatsApp(whatsapp)) {
    throw new Error("Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit).");
  }
  const selected = findPackage(input.packageId) || packages[0];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || "")) ? input.date : "";
  const startTime = normalizeTime(input.startTime);
  const id = buildMockId({ date, startTime, packageName: selected.name });
  if (!id) throw new Error("Tanggal dan jam mulai wajib diisi untuk ID mock.");
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

export function saveAdminMock(input, method) {
  const state = readState();
  const mocks = state.mocks.slice();
  const existing = mocks.find((item) => item.id === cleanText(input.id, 40));
  if (method === "PUT" && !existing) throw new Error("Mock customer tidak ditemukan.");
  const record = buildMock(input, existing);
  const withoutPrevious = existing ? mocks.filter((item) => item.id !== existing.id) : mocks;
  if (withoutPrevious.some((item) => item.id === record.id)) {
    throw new Error("ID mock sudah dipakai untuk tanggal, jam, dan paket ini.");
  }
  const nextMocks = withoutPrevious.concat(record);
  const next = writeState({ ...state, mocks: nextMocks });
  return { mock: record, mocks: next.mocks, bookings: next.bookings, blocks: next.blocks, photographers: next.photographers };
}

export function deleteAdminMock(id) {
  const state = readState();
  const next = writeState({ ...state, mocks: state.mocks.filter((item) => item.id !== id) });
  return { mocks: next.mocks, bookings: next.bookings, blocks: next.blocks, photographers: next.photographers };
}
