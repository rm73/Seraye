import { SERAYE_WHATSAPP } from "./config";

export function rupiah(amount) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function buildBookingId({ date, startTime, code }) {
  const [year, month, day] = date.split("-");
  const start = startTime.slice(0, 5).replace(":", "");
  return `${day}${month}${year}${start}${code}`;
}

export function buildWhatsAppMessage({ name, bookingId, location, notes }) {
  const pesan = notes.trim() || "-";
  return [
    `Halo Min, saya sudah booking atas nama ${name.trim()} dengan detail pemesanan seperti berikut.`,
    "",
    `ID Pemesanan: ${bookingId}`,
    `Titik Lokasi: ${location.trim()}`,
    `Pesan: ${pesan}`,
    "",
    "Ditunggu konfirmasi lebih lanjutnya, Min.",
  ].join("\n");
}

export function buildWhatsAppUrl(message) {
  const digits = SERAYE_WHATSAPP.replace(/\D/g, "");
  const text = encodeURIComponent(message);
  if (!digits) return `https://api.whatsapp.com/send?text=${text}`;
  return `https://wa.me/${digits}?text=${text}`;
}

export function isActiveWhatsApp(value) {
  const digits = value.replace(/\D/g, "");
  return /^(08\d{8,12}|628\d{8,12})$/.test(digits);
}

export function todayStamp() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function shiftStamp(stamp, days) {
  const [year, month, day] = stamp.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}
