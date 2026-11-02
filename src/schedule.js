export const PHOTOGRAPHERS = ["A", "B", "C"];
export const CAPACITY = PHOTOGRAPHERS.length;

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

export function photographerLabel(id) {
  return id ? `Fotografer ${id}` : "Belum ditugaskan";
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

export function slotStatus({ bookings, blocks, date, start, end, ignoreId }) {
  if (!date || !start || !end) return { ok: false, reason: "incomplete", message: "" };
  if (isAdminBlocked(blocks, date, start, end)) {
    return {
      ok: false,
      reason: "blocked",
      message: "Tanggal atau jam ini ditutup admin. Pilih waktu lain.",
    };
  }
  const overlapping = overlappingBookings(bookings, date, start, end, ignoreId);
  if (overlapping.length >= CAPACITY) {
    return {
      ok: false,
      reason: "full",
      message: "Waktu ini sudah penuh (3 sesi berjalan bersamaan). Pilih jam lain.",
    };
  }
  const free = CAPACITY - overlapping.length;
  return {
    ok: true,
    reason: "open",
    message: overlapping.length ? `${free} dari ${CAPACITY} fotografer masih tersedia di jam ini.` : "",
  };
}

export function fullIntervals(bookings, date) {
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
    if (count < CAPACITY && next >= CAPACITY) open = event.time;
    if (count >= CAPACITY && next < CAPACITY && open && open < event.time) {
      spans.push({ start: open, end: event.time });
      open = "";
    }
    if (next < CAPACITY) open = "";
    count = next;
  });
  return spans;
}

export function bookingIsInFullBlock(booking, bookings) {
  return fullIntervals(bookings, booking.date).some((span) =>
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

export function firstFreePhotographer(bookings, date, start, end, ignoreId) {
  const taken = takenPhotographers(bookings, date, start, end, ignoreId);
  return PHOTOGRAPHERS.find((id) => !taken.has(id)) || "";
}
