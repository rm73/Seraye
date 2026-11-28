import { useMemo, useState } from "react";
import { averageRating } from "../feedback";
import { isActiveWhatsApp } from "../booking";
import { fullIntervals, photographerLabel } from "../schedule";
import { readPhotoMeta, savePhotoMeta } from "./store";
import { DayLanes } from "./lanes";
import { ConfirmDialog, formatLong, formatShort, Icon, Modal, shiftDate, todayStamp, whatsAppLink } from "./ui";

function monthCells(anchor) {
  const [year, month] = anchor.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const cells = [];
  for (let index = 0; index < pad; index += 1) {
    const date = new Date(year, month - 1, 1 - (pad - index));
    cells.push({ stamp: iso(date), outside: true, day: date.getDate() });
  }
  for (let day = 1; day <= days; day += 1) cells.push({ stamp: iso(new Date(year, month - 1, day)), outside: false, day });
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].stamp;
    const date = new Date(`${shiftDate(last, 1)}T00:00:00`);
    cells.push({ stamp: iso(date), outside: true, day: date.getDate() });
  }
  return cells;
}

function iso(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayTone(stamp, bookings, blocks, photographers, selected) {
  if (stamp === selected) return "is-selected";
  const closed = blocks.some((block) => stamp >= block.startDate && stamp <= block.endDate && !block.startTime && !block.endTime);
  if (closed) return "is-closed";
  if (fullIntervals(bookings, stamp, photographers).length) return "is-full";
  if (bookings.some((booking) => booking.date === stamp)) return "is-active";
  return "";
}

export function DashboardPage({
  schedule,
  reviews,
  onSaveBlock,
  onDeleteBlock,
  onSavePhotographer,
  onDeletePhotographer,
  onEditBooking,
  blockForm,
  setBlockForm,
}) {
  const today = todayStamp();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [lanesOpen, setLanesOpen] = useState(true);
  const [photoDraft, setPhotoDraft] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [photoPending, setPhotoPending] = useState(null);
  const [showReviews, setShowReviews] = useState(false);
  const meta = readPhotoMeta();
  const cells = monthCells(`${month}-01`);
  const [year, monthNumber] = month.split("-").map(Number);
  const monthLabel = new Date(year, monthNumber - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const dayBookings = schedule.bookings
    .filter((booking) => booking.date === selected)
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
  const clientNames = new Set([
    ...schedule.bookings.map((booking) => booking.name),
    ...schedule.mocks.map((mock) => mock.name),
  ].filter(Boolean));
  const monthPrefix = today.slice(0, 7);
  const freshClients = schedule.bookings.filter((booking) => String(booking.createdAt || booking.date || "").startsWith(monthPrefix));
  const finished = schedule.bookings.filter((booking) => booking.date && booking.date < today).length;
  const score = averageRating(reviews, "service");
  const visibleReviews = showReviews ? reviews : reviews.slice(0, 2);

  const assignmentCount = useMemo(() => {
    const counts = {};
    schedule.bookings.forEach((booking) => {
      if (!booking.photographer) return;
      counts[booking.photographer] = (counts[booking.photographer] || 0) + 1;
    });
    return counts;
  }, [schedule.bookings]);

  function pickDate(stamp) {
    setSelected(stamp);
    setLanesOpen(true);
    setMonth(stamp.slice(0, 7));
  }

  return (
    <div className="v2-stack">
      <section className="v2-stats">
        <article>
          <p>Total klien terdaftar</p>
          <strong>{clientNames.size}</strong>
          <span>{freshClients.length} klien pada bulan ini</span>
          <i><Icon name="users" /></i>
        </article>
        <article>
          <p>Sesi wisuda & editorial outdoor</p>
          <strong>{finished}</strong>
          <span>Total pemotretan selesai</span>
          <i><Icon name="camera" /></i>
        </article>
      </section>

      <section className="v2-card v2-calendar">
        <header className="v2-cal-head">
          <div>
            <h2>{monthLabel}</h2>
            <p>Pilih tanggal untuk melihat atau mengatur slot pemotretan</p>
          </div>
          <div className="v2-cal-nav">
            <button type="button" onClick={() => setMonth(shiftDate(`${month}-01`, -1).slice(0, 7))} aria-label="Bulan sebelumnya">
              <Icon name="left" />
            </button>
            <button type="button" onClick={() => pickDate(today)}>Bulan ini</button>
            <button type="button" onClick={() => setMonth(shiftDate(`${month}-01`, 32).slice(0, 7))} aria-label="Bulan berikutnya">
              <Icon name="chevron" />
            </button>
          </div>
        </header>
        <div className="v2-cal-layout">
          <div>
            <div className="v2-cal-week">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="v2-cal-grid">
              {cells.map((cell) => (
                <button
                  key={cell.stamp}
                  type="button"
                  className={`${cell.outside ? "is-out" : ""} ${dayTone(cell.stamp, schedule.bookings, schedule.blocks, schedule.photographers, selected)}`}
                  onClick={() => pickDate(cell.stamp)}
                >
                  {cell.day}
                </button>
              ))}
            </div>
            <ul className="v2-legend">
              <li><i className="is-selected" /> Terpilih</li>
              <li><i className="is-active" /> Sesi aktif</li>
              <li><i className="is-full" /> Full booked</li>
              <li><i className="is-closed" /> Libur / ditutup</li>
            </ul>
          </div>
          <aside className="v2-day-panel">
            <p>{formatLong(selected)}</p>
            {dayBookings.length === 0 ? <strong className="v2-day-empty">Belum ada sesi.</strong> : null}
            {dayBookings.slice(0, 2).map((booking) => (
              <article key={booking.id}>
                <strong>{booking.startTime} – {booking.endTime || "—"} WIB</strong>
                <h3>{booking.name} · Paket {booking.packageName}</h3>
                <p>Lokasi: {booking.location || "—"} · Fotografer: {photographerLabel(booking.photographer, schedule.photographers)}</p>
                {booking.notes ? <blockquote>“{booking.notes}”</blockquote> : null}
                <div>
                  <a className="v2-btn v2-btn-forest" href={whatsAppLink(booking.whatsapp)} target="_blank" rel="noreferrer">Hubungi WA</a>
                  <button type="button" className="v2-btn v2-btn-line" onClick={() => onEditBooking(booking)}>Ubah</button>
                </div>
              </article>
            ))}
          </aside>
        </div>
      </section>

      {lanesOpen ? (
        <DayLanes
          date={selected}
          photographers={schedule.photographers}
          bookings={schedule.bookings}
          onShift={(step) => pickDate(shiftDate(selected, step))}
          onClose={() => setLanesOpen(false)}
        />
      ) : (
        <button type="button" className="v2-reopen" onClick={() => setLanesOpen(true)}>
          Tampilkan jadwal {formatShort(selected)}
        </button>
      )}

      <section className="v2-card">
        <h2>Tutup tanggal atau jam</h2>
        <form
          className="v2-block-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveBlock();
          }}
        >
          <label>
            Dari tanggal
            <input type="date" value={blockForm.startDate} onChange={(event) => setBlockForm({ ...blockForm, startDate: event.target.value })} required />
          </label>
          <label>
            Sampai tanggal
            <input type="date" value={blockForm.endDate} onChange={(event) => setBlockForm({ ...blockForm, endDate: event.target.value })} required />
          </label>
          <label>
            Jam mulai
            <input type="time" value={blockForm.startTime} onChange={(event) => setBlockForm({ ...blockForm, startTime: event.target.value })} />
          </label>
          <label>
            Jam selesai
            <input type="time" value={blockForm.endTime} onChange={(event) => setBlockForm({ ...blockForm, endTime: event.target.value })} />
          </label>
          <label className="is-wide">
            Deskripsi
            <input value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })} placeholder="Libur atau sudah dikunci" />
          </label>
          <button className="v2-btn v2-btn-forest" type="submit">Simpan blokir</button>
          <p className="v2-hint">Kosongkan jam untuk menutup seharian. Isi keduanya untuk menutup rentang jam.</p>
          <button
            className="v2-btn v2-btn-line"
            type="button"
            onClick={() => setBlockForm({ startDate: "", endDate: "", startTime: "", endTime: "", reason: "" })}
          >
            Reset
          </button>
        </form>
        <ul className="v2-block-list">
          {schedule.blocks.map((block) => (
            <li key={block.id}>
              <span>
                {formatShort(block.startDate)}
                {block.endDate !== block.startDate ? ` – ${formatShort(block.endDate)}` : ""}
                {block.startTime ? `, ${block.startTime}–${block.endTime}` : ", seharian"}
                {` · ${block.reason}`}
              </span>
              <button type="button" onClick={() => onDeleteBlock(block.id)}>Hapus</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="v2-card">
        <header className="v2-card-head">
          <h2>Info fotografer</h2>
          <button type="button" className="v2-btn v2-btn-line" onClick={() => { setPhotoError(""); setPhotoDraft({ id: "", name: "", phone: "", specialty: "", quota: "3 sesi/hari" }); }}>
            Tambah
          </button>
        </header>
        <div className="v2-photo-grid">
          {schedule.photographers.map((item) => (
            <article key={item.id}>
              <h3>{item.name}</h3>
              <p>{item.phone || "Kontak belum diisi"}</p>
              <p>{meta[item.id]?.specialty || item.notes || "—"}</p>
              <strong>{assignmentCount[item.id] || 0} assignment</strong>
              <div>
                <button type="button" className="v2-btn v2-btn-line" onClick={() => { setPhotoError(""); setPhotoDraft({ ...item, specialty: meta[item.id]?.specialty || item.notes || "", quota: meta[item.id]?.quota || "3 sesi/hari" }); }}>Ubah</button>
                <button type="button" className="v2-btn v2-btn-line" onClick={() => setPhotoPending(item)}>Hapus</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="v2-card">
        <header className="v2-card-head">
          <h2>
            Penilaian pelanggan
            {reviews.length ? <span className="v2-score"><Icon name="star" /> {score || "—"} · {reviews.length} ulasan</span> : null}
          </h2>
          {reviews.length > 2 ? (
            <button type="button" className="v2-text-btn" onClick={() => setShowReviews((value) => !value)}>
              {showReviews ? "Lihat lebih sedikit" : "Lihat semua"}
            </button>
          ) : null}
        </header>
        <div className="v2-reviews">
          {reviews.length === 0 ? <p className="v2-empty">Belum ada penilaian. Pelanggan mengisi lewat halaman Penilaian.</p> : null}
          {visibleReviews.map((item) => (
            <article key={item.id || item.createdAt}>
              <header>
                <strong>{item.name || "Pelanggan"}</strong>
                <span>{item.packageName || "Ulasan situs"}</span>
                <em>{"★".repeat(Number(item.service) || 0)}{"☆".repeat(Math.max(0, 5 - (Number(item.service) || 0)))}</em>
              </header>
              <p>{item.message || "—"}</p>
            </article>
          ))}
        </div>
      </section>

      {photoPending ? (
        <ConfirmDialog
          title="Hapus Fotografer?"
          onClose={() => setPhotoPending(null)}
          onConfirm={() => {
            const target = photoPending;
            setPhotoPending(null);
            onDeletePhotographer(target.id);
          }}
        >
          Apakah kamu yakin ingin menghapus data fotografer <strong>{photoPending.name}</strong>? Tindakan ini tidak dapat dibatalkan.
        </ConfirmDialog>
      ) : null}
      {photoDraft ? (
        <Modal
          title={photoDraft.id ? "Ubah Data Fotografer" : "Tambah Fotografer"}
          lead="Perbarui informasi kontak dan status penugasan fotografer"
          onClose={() => setPhotoDraft(null)}
          footer={
            <>
              <button type="button" className="v2-btn v2-btn-line" onClick={() => setPhotoDraft(null)}>Batal</button>
              <button type="button" className="v2-btn v2-btn-forest" onClick={async () => {
                if (!photoDraft.name.trim() || !isActiveWhatsApp(photoDraft.phone || "")) {
                  setPhotoError("Nama dan nomor WhatsApp wajib valid. Pakai format 08… atau 628….");
                  return;
                }
                const savedId = await onSavePhotographer(
                  { id: photoDraft.id, name: photoDraft.name.trim(), phone: photoDraft.phone.trim(), notes: photoDraft.specialty.trim() },
                  photoDraft.id ? "PUT" : "POST",
                );
                if (!savedId) return;
                savePhotoMeta(savedId, { specialty: photoDraft.specialty.trim(), quota: photoDraft.quota.trim() });
                setPhotoDraft(null);
              }}
              >
                Simpan Perubahan
              </button>
            </>
          }
        >
          <div className="v2-form-grid">
            <label className="is-wide">
              Nama Fotografer
              <input value={photoDraft.name} onChange={(event) => setPhotoDraft({ ...photoDraft, name: event.target.value })} />
            </label>
            <label>
              Nomor WhatsApp
              <input value={photoDraft.phone} onChange={(event) => setPhotoDraft({ ...photoDraft, phone: event.target.value })} placeholder="08…" />
            </label>
            <label>
              Status Penugasan
              <input value={photoDraft.id ? `${assignmentCount[photoDraft.id] || 0} assignment aktif` : "Belum ada assignment"} readOnly />
            </label>
            <label>
              Spesialisasi Spot / Gaya
              <input value={photoDraft.specialty} onChange={(event) => setPhotoDraft({ ...photoDraft, specialty: event.target.value })} placeholder="Wisuda outdoor & candid" />
            </label>
            <label>
              Kuota Maksimal Harian
              <input value={photoDraft.quota} onChange={(event) => setPhotoDraft({ ...photoDraft, quota: event.target.value })} placeholder="3 sesi/hari" />
            </label>
          </div>
          {photoError ? <p className="v2-error">{photoError}</p> : null}
          {!photoDraft.id ? <p className="v2-hint">Akun login fotografer dibuat dari Kelola Akun Pengguna, bukan dari kartu ini.</p> : null}
        </Modal>
      ) : null}
    </div>
  );
}
