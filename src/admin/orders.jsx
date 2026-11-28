import { useMemo, useState } from "react";
import { photographerLabel } from "../schedule";
import { STAGES, stageFrom } from "./store";
import { formatLong, Pager, shiftDate } from "./ui";

function deadline(booking, stage) {
  if (!booking.date || stage >= 5) return null;
  if (stage === 4) return { label: "Deadline revisi", stamp: shiftDate(booking.date, 2) };
  if (stage === 3) return { label: "Deadline kurasi", stamp: shiftDate(booking.date, 5) };
  return { label: "Deadline selesai", stamp: shiftDate(booking.date, 7) };
}

function remain(stamp) {
  if (!stamp) return "";
  const [year, month, day] = stamp.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "Lewat tenggat";
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Besok";
  return `Sisa ${diff} hari lagi`;
}

export function OrderCard({ booking, photographers, progress, onStage }) {
  const stage = stageFrom(progress, booking.id);
  const due = deadline(booking, stage);
  return (
    <article className="v2-order">
      <h3>{formatLong(booking.date)} – {booking.name}</h3>
      <div className="v2-order-facts">
        <p><span>Paket sesi</span><strong>{booking.packageName} ({(Number(booking.extraPhotos) || 0) + (booking.editedPhotos || 25)} foto)</strong></p>
        <p><span>WhatsApp</span><strong>{booking.whatsapp}</strong></p>
        <p><span>Waktu & lokasi</span><strong>{booking.startTime} · {booking.location || "—"}</strong></p>
        <p><span>Fotografer</span><strong>{photographerLabel(booking.photographer, photographers)}</strong></p>
        {due ? (
          <p className="is-due">
            <span>{due.label}</span>
            <strong>{formatLong(due.stamp)}</strong>
            <em>{remain(due.stamp)}</em>
          </p>
        ) : <p><span>Status</span><strong>Final G-Drive terkirim</strong></p>}
      </div>
      <ol className="v2-stages">
        {STAGES.map((item) => (
          <li key={item.id}>
            <button type="button" className={item.id <= stage ? "is-on" : ""} onClick={() => onStage(booking.id, item.id)}>
              {item.id}. {item.label}
            </button>
          </li>
        ))}
      </ol>
      <div className="v2-order-actions">
        <button type="button" className="v2-btn v2-btn-forest" onClick={() => onStage(booking.id, Math.min(5, stage + 1))} disabled={stage >= 5}>
          Update Progress
        </button>
      </div>
    </article>
  );
}

export function OrdersPage({ schedule, onStage }) {
  const [filter, setFilter] = useState(0);
  const [page, setPage] = useState(1);
  const progress = schedule.progress || {};

  const orders = useMemo(
    () => [...schedule.bookings].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [schedule.bookings],
  );
  const filtered = orders.filter((booking) => !filter || stageFrom(progress, booking.id) === filter);
  const pages = Math.max(1, Math.ceil(filtered.length / 3));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * 3, safePage * 3);

  const groups = new Map();
  filtered.forEach((booking) => {
    const name = photographerLabel(booking.photographer, schedule.photographers);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(booking);
  });

  return (
    <div className="v2-stack">
      <div className="v2-chips">
        <button type="button" className={filter === 0 ? "is-on" : ""} onClick={() => { setFilter(0); setPage(1); }}>Semua ({orders.length})</button>
        {STAGES.map((item) => (
          <button key={item.id} type="button" className={filter === item.id ? "is-on" : ""} onClick={() => { setFilter(item.id); setPage(1); }}>
            {item.label} ({orders.filter((booking) => stageFrom(progress, booking.id) === item.id).length})
          </button>
        ))}
      </div>
      <p className="v2-hint">Sesi foto ditandai fotografer. Raw diunggah berarti foto mentah sudah naik. Kurasi klien berarti klien sudah memilih foto. Retouching adalah hasil edit. Final G-Drive berarti tautan sudah dikirim dan bisa dilihat klien.</p>
      {visible.map((booking) => (
        <OrderCard key={booking.id} booking={booking} photographers={schedule.photographers} progress={progress} onStage={onStage} />
      ))}
      {filtered.length === 0 ? <p className="v2-empty">Belum ada pesanan pada tahap ini.</p> : null}
      <div className="v2-list-foot">
        <span>Menampilkan {visible.length} dari {filtered.length} pesanan aktif</span>
        <Pager page={safePage} pages={pages} onPage={setPage} />
      </div>

      <section className="v2-split">
        <p className="v2-kicker">Pembagian menurut fotografer</p>
        {[...groups.entries()].map(([name, items]) => (
          <div key={name} className="v2-card">
            <h2>{name}</h2>
            <ul className="v2-mini-orders">
              {items.map((booking) => (
                <li key={`${name}-${booking.id}`}>
                  <strong>{formatLong(booking.date)} – {booking.name}</strong>
                  <span>{booking.packageName}</span>
                  <em>{STAGES[stageFrom(progress, booking.id) - 1]?.label}</em>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
