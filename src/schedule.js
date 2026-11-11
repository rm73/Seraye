export const DEFAULT_PHOTOGRAPHERS = [
  { id: "A", name: "Fotografer A", phone: "", notes: "" },
  { id: "B", name: "Fotografer B", phone: "", notes: "" },
  { id: "C", name: "Fotografer C", phone: "", notes: "" },
];

export const PHOTOGRAPHERS = DEFAULT_PHOTOGRAPHERS.map((item) => item.id);
export const CAPACITY = PHOTOGRAPHERS.length;

export function normalizePhotographers(list) {
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_PHOTOGRAPHERS.map((item) => ({ ...item }));
  return list
    .map((item, index) => {
      const id = String(item?.id || "").trim().toUpperCase() || String.fromCharCode(65 + index);
      return {
        id,
        name: String(item?.name || `Fotografer ${id}`).trim().slice(0, 80) || `Fotografer ${id}`,
        phone: String(item?.phone || "").trim().slice(0, 20),
        notes: String(item?.notes || "").trim().slice(0, 240),
      };
    })
    .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
}

export function photographerIds(list) {
  return normalizePhotographers(list).map((item) => item.id);
}

export function photographerCapacity(list) {
  return Math.max(photographerIds(list).length, 1);
}

export function packageMinutes(pkg) {
  const point = pkg?.points?.find((item) => /(\d+)\s*minutes/i.test(item));
  const match = point?.match(/(\d+)/);
  return match ? Number(match[1]) : 60;
}

export function normalizeTime(value) {
  if (!value) return "";
  const [hour, minute] = String(value).split(":");
  if (hour == null || minute == null || hour === "" || minute === "") return "";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function addMinutes(time, minutes) {
  const [hour, minute] = normalizeTime(time).split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const nextHour = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const nextMinute = String(total % 60).padStart(2, "0");
  return `${nextHour}:${nextMinute}`;
}

export function rangesOverlap(start, end, otherStart, otherEnd) {
  return start < otherEnd && otherStart < end;
}

export function photographerLabel(id, list) {
  if (!id) return "Belum ditugaskan";
  const match = normalizePhotographers(list).find((item) => item.id === id);
  return match?.name || `Fotografer ${id}`;
}

export function sessionLabel(start, end) {
  return `${start}–${end}`;
}

function sameDayBlocks(blocks, date) {
  return blocks.filter((block) => date >= block.startDate && date <= block.endDate);
}

export function isAdminBlocked(blocks, date, start, end) {
  return sameDayBlocks(blocks, date).some((block) => {
    if (!block.startTime || !block.endTime) return true;
    const windowStart = date === block.startDate ? block.startTime : "00:00";
    const windowEnd = date === block.endDate ? block.endTime : "24:00";
    if (windowStart >= windowEnd) return false;
    return rangesOverlap(start, end, windowStart, windowEnd);
  });
}

export function overlappingBookings(bookings, date, start, end, ignoreId) {
  return bookings.filter(
    (booking) =>
      booking.id !== ignoreId &&
      booking.date === date &&
      rangesOverlap(start, end, booking.startTime, booking.endTime),
  );
}

export function slotStatus({ bookings, blocks, date, start, end, ignoreId, photographers, capacity }) {
  if (!date || !start || !end) return { ok: false, reason: "incomplete", message: "" };
  if (isAdminBlocked(blocks, date, start, end)) {
    return {
      ok: false,
      reason: "blocked",
      message: "Tanggal atau jam ini ditutup admin. Pilih waktu lain.",
    };
  }
  const limit = Number(capacity) > 0 ? Number(capacity) : photographerCapacity(photographers);
  const overlapping = overlappingBookings(bookings, date, start, end, ignoreId);
  if (overlapping.length >= limit) {
    return {
      ok: false,
      reason: "full",
      message: `Waktu ini sudah penuh (${limit} sesi berjalan bersamaan). Pilih jam lain.`,
    };
  }
  const free = limit - overlapping.length;
  return {
    ok: true,
    reason: "open",
    message: overlapping.length ? `${free} dari ${limit} fotografer masih tersedia di jam ini.` : "",
  };
}

export function fullIntervals(bookings, date, photographers) {
  const capacity = photographerCapacity(photographers);
  const events = [];
  bookings
    .filter((booking) => booking.date === date)
    .forEach((booking) => {
      events.push({ time: booking.startTime, delta: 1 });
      events.push({ time: booking.endTime, delta: -1 });
    });
  events.sort((a, b) => (a.time === b.time ? a.delta - b.delta : a.time < b.time ? -1 : 1));

  const spans = [];
  let count = 0;
  let open = "";
  events.forEach((event) => {
    const next = count + event.delta;
    if (count < capacity && next >= capacity) open = event.time;
    if (count >= capacity && next < capacity && open && open < event.time) {
      spans.push({ start: open, end: event.time });
      open = "";
    }
    if (next < capacity) open = "";
    count = next;
  });
  return spans;
}

export function bookingIsInFullBlock(booking, bookings, photographers) {
  return fullIntervals(bookings, booking.date, photographers).some((span) =>
    rangesOverlap(booking.startTime, booking.endTime, span.start, span.end),
  );
}

export function takenPhotographers(bookings, date, start, end, ignoreId) {
  return new Set(
    overlappingBookings(bookings, date, start, end, ignoreId)
      .map((booking) => booking.photographer)
      .filter(Boolean),
  );
}

export function firstFreePhotographer(bookings, date, start, end, ignoreId, photographers) {
  const taken = takenPhotographers(bookings, date, start, end, ignoreId);
  return photographerIds(photographers).find((id) => !taken.has(id)) || "";
}
