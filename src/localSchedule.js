import { buildBookingId } from "./booking";
import { packages } from "./data";
import {
  addMinutes,
  firstFreePhotographer,
  normalizeTime,
  packageMinutes,
  PHOTOGRAPHERS,
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

function mockBooking({ name, whatsapp, date, startTime, packageId, location, notes, photographer, source }) {
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
      }),
      mockBooking({
        name: "Salsa Kirana",
        whatsapp: "082167890044",
        date: next,
        startTime: "13:00",
        packageId: "selaras",
        location: "Kampus ITS Surabaya",
        notes: "Butuh video portrait.",
        photographer: "A",
        source: "whatsapp",
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
  };
}

export function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return writeState(seedState());
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.bookings) || !Array.isArray(parsed.blocks)) return writeState(seedState());
    return parsed;
  } catch {
    return writeState(seedState());
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
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
  if (!status.ok) throw new Error(status.message);
}

function assignPhotographer(state, record, requested, auto) {
  const taken = takenPhotographers(state.bookings, record.date, record.startTime, record.endTime, record.id);
  if (!auto) {
    if (!requested) return "";
    if (!PHOTOGRAPHERS.includes(requested)) throw new Error("Fotografer tidak dikenali.");
    if (taken.has(requested)) throw new Error(`Fotografer ${requested} sudah ada sesi di jam ini.`);
    return requested;
  }
  if (record.photographer && !taken.has(record.photographer)) return record.photographer;
  return firstFreePhotographer(state.bookings, record.date, record.startTime, record.endTime, record.id);
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
  if (name.length < 3 || whatsapp.length < 10 || location.length < 3) {
    throw new Error("Nama, WhatsApp, dan lokasi wajib diisi.");
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
    photographer: existing?.photographer || "",
    source: existing?.source || (input.source === "copy" ? "copy" : input.source === "admin" ? "admin" : "whatsapp"),
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
  record.photographer = assignPhotographer(state, record, cleanText(input.photographer, 1), false);
  record.source = existing?.source || "admin";
  const next = writeState(saveBooking(state, record));
  return { booking: next.bookings.find((item) => item.id === record.id), bookings: next.bookings, blocks: next.blocks };
}

export function deleteAdminBooking(id) {
  const state = readState();
  const next = writeState({ ...state, bookings: state.bookings.filter((item) => item.id !== id) });
  return { bookings: next.bookings, blocks: next.blocks };
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
  return { blocks: next.blocks, bookings: next.bookings };
}

export function deleteBlock(id) {
  const state = readState();
  const next = writeState({ ...state, blocks: state.blocks.filter((item) => item.id !== id) });
  return { blocks: next.blocks, bookings: next.bookings };
}
