import { useEffect, useState } from "react";
import { submitFeedback } from "./api";
import { buildWhatsAppUrl, rupiah } from "./booking";
import { clientBookings, drivePhotoSrc, editLimit } from "./accountData";
import { clearSession, displayName, readSession, writeSession } from "./session";

const logoSrc = "/assets/logo%20seraye%20moments%20-%20Gold%20(1).png";
const ACTIVE_KEY = "seraye-active-booking";
const PICKS_KEY = "seraye-photo-picks";
const DP_KEY = "seraye-dp-request";
const REVIEW_KEY = "seraye-account-review";
const STEPS = ["Pemesanan", "DP", "Sesi", "Foto diunggah", "Pilihan edit", "Selesai"];

const nav = [
  ["/akun", "Dashboard"],
  ["/akun/foto", "Review Foto"],
  ["/akun/ulasan", "Ulasan"],
  ["/akun/kelola", "Kelola Akun"],
];

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readActiveId() {
  const stored = sessionStorage.getItem(ACTIVE_KEY);
  return clientBookings.some((item) => item.id === stored) ? stored : clientBookings[0].id;
}

function completedSteps(booking) {
  if (booking.phase === "done") return STEPS.length;
  if (booking.phase === "photos") return 4;
  return 1;
}

function warningFor(booking, dpAsked) {
  if (booking.phase === "dp" && dpAsked) {
    return {
      tone: "wait",
      text: "Permintaan pembayaran DP sudah dikirim. Admin akan mengonfirmasi sebelum jadwal terkunci.",
    };
  }
  if (booking.phase === "dp") {
    return {
      tone: "alert",
      text: `DP ${rupiah(booking.dp)} belum dibayar. Jadwal belum terkunci sampai pembayaran dikonfirmasi admin.`,
    };
  }
  if (booking.phase === "photos") {
    return {
      tone: "ready",
      text: "Hasil foto sudah diunggah. Pilih foto yang ingin diedit, lalu tambahkan catatan untuk fotografer.",
    };
  }
  return {
    tone: "done",
    text: "Booking ini sudah selesai. Terima kasih sudah merayakan momen ini bersama Seraye Moments.",
  };
}

function BookingSwitch({ bookings, activeId, onChange }) {
  if (bookings.length < 2) return null;
  return (
    <div className="account-switch">
      <p>Kamu punya {bookings.length} booking. Pilih booking yang ingin dilihat.</p>
      <div role="tablist" aria-label="Booking">
        {bookings.map((booking) => (
          <button
            key={booking.id}
            type="button"
            role="tab"
            aria-selected={booking.id === activeId}
            className={booking.id === activeId ? "is-active" : ""}
            onClick={() => onChange(booking.id)}
          >
            <strong>{booking.packageName}</strong>
            <span>{booking.dateLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Progress({ booking, pickCount }) {
  const completed = completedSteps(booking, pickCount);
  const finished = completed >= STEPS.length;
  const currentLabel = finished ? "Selesai" : STEPS[completed];
  return (
    <section className="account-card account-progress" aria-label="Progres booking">
      <div className="account-progress-head">
        <h2>Progres</h2>
        <p>{finished ? "Semua tahap selesai" : `Sekarang: ${currentLabel}`}</p>
      </div>
      <div className="account-progress-track" aria-hidden="true">
        <span style={{ width: `${((completed + (booking.phase === "photos" && pickCount > 0 ? 0.5 : 0)) / STEPS.length) * 100}%` }} />
      </div>
      <ol>
        {STEPS.map((label, index) => {
          const state = index < completed ? "is-done" : index === completed && !finished ? "is-current" : "";
          return (
            <li key={label} className={state}>
              {label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Dashboard({ session, booking, pickCount, dpAsked, onPay }) {
  const warning = warningFor(booking, dpAsked);
  const discuss = buildWhatsAppUrl(
    `Halo, saya ${session.name} ingin berdiskusi dengan fotografer ${booking.photographer} untuk booking ${booking.id} paket ${booking.packageName}.`,
  );
  return (
    <>
      <header className="account-intro">
        <h1>Dashboard</h1>
        <p>Halo, {session.name}. Ini ringkasan pemesanan dan fotografer yang akan menemanimu.</p>
      </header>
      <p className={`account-alert is-${warning.tone}`} role="status">{warning.text}</p>
      <Progress booking={booking} pickCount={pickCount} />
      <div className="account-split">
        <section className="account-card">
          <h2>Data pemesanan</h2>
          <dl className="account-facts">
            <div>
              <dt>Kode booking</dt>
              <dd>{booking.id}</dd>
            </div>
            <div>
              <dt>Paket</dt>
              <dd>{booking.packageName}</dd>
            </div>
            <div>
              <dt>Katalog</dt>
              <dd>{booking.catalog}</dd>
            </div>
            <div>
              <dt>Tanggal</dt>
              <dd>{booking.dateLabel}</dd>
            </div>
            <div>
              <dt>Jam</dt>
              <dd>{booking.timeLabel}</dd>
            </div>
            <div>
              <dt>Lokasi</dt>
              <dd>{booking.location}</dd>
            </div>
            <div>
              <dt>Batas edit</dt>
              <dd>{booking.editedPhotos} edited photo + {booking.addons} add-on</dd>
            </div>
          </dl>
        </section>
        <div className="account-stack">
          <section className="account-card">
            <h2>Pembayaran DP</h2>
            <p className="account-amount">{rupiah(booking.dp)}</p>
            <p className="account-muted">
              {booking.phase === "dp" ? "Belum dibayar" : "DP sudah dikonfirmasi"}
            </p>
            {booking.phase === "dp" ? (
              <button className="btn btn-forest" type="button" onClick={onPay}>
                {dpAsked ? "Kirim ulang permintaan DP" : "Bayar DP"}
              </button>
            ) : null}
          </section>
          <section className="account-card">
            <h2>Fotografer</h2>
            <p className="account-person">{booking.photographer}</p>
            <p className="account-muted">Fotografer yang dijadwalkan untuk sesi ini.</p>
            <a className="btn btn-line" href={discuss} target="_blank" rel="noreferrer">
              Diskusi dengan {booking.photographer.split(" ")[0]}
            </a>
          </section>
        </div>
      </div>
    </>
  );
}

function PhotoDialog({ photo, picked, note, atLimit, onClose, onToggle, onNote }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="account-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="account-dialog" role="dialog" aria-modal="true" aria-label={photo.name}>
        <button className="popup-close" type="button" onClick={onClose} aria-label="Tutup">×</button>
        <img
          className={picked ? "is-picked" : ""}
          src={drivePhotoSrc(photo.id, 1400)}
          alt={photo.name}
          referrerPolicy="no-referrer"
        />
        <label>
          Catatan untuk fotografer
          <textarea
            value={note}
            onChange={(event) => onNote(event.target.value)}
            rows={3}
            placeholder="Tulis catatan tentang foto yang ingin diproses"
          />
        </label>
        {atLimit && !picked ? <p className="auth-error">Batas pilihan sudah penuh.</p> : null}
        <button className={picked ? "btn btn-line" : "btn btn-forest"} type="button" onClick={onToggle} disabled={atLimit && !picked}>
          {picked ? "Hapus pilihan" : "Pilih diedit"}
        </button>
      </div>
    </div>
  );
}

function PhotoReview({ booking, picks, onToggle, onNote }) {
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [showTop, setShowTop] = useState(false);
  const limit = editLimit(booking);
  const pickCount = Object.keys(picks).length;
  const open = booking.photos.find((photo) => photo.id === openId) || null;

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 480);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className="account-intro">
        <h1>Review Foto</h1>
        <p>Lihat hasil dari fotografer, lalu pilih foto yang ingin diproses.</p>
      </header>
      <Progress booking={booking} pickCount={pickCount} />
      <section className="account-card">
        <div className="account-review-head">
          <h2>Image Diunggah</h2>
          <p>
            Dipilih {pickCount} dari {limit}
            <span> ({booking.editedPhotos} edited photo + {booking.addons} add-on)</span>
          </p>
        </div>
        {booking.photos.length ? (
          <>
            <p className="account-muted">
              {booking.photos.length} foto dari folder Drive fotografer.{" "}
              <a href={booking.driveUrl} target="_blank" rel="noreferrer">Buka folder</a>
            </p>
            <div className="account-masonry">
              {booking.photos.map((photo) => {
                const picked = Boolean(picks[photo.id]);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    className={picked ? "is-picked" : ""}
                    onClick={() => setOpenId(photo.id)}
                  >
                    <img src={drivePhotoSrc(photo.id, 800)} alt={photo.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="account-muted">Fotografer belum mengunggah hasil foto untuk booking ini.</p>
        )}
      </section>
      {open ? (
        <PhotoDialog
          photo={open}
          picked={Boolean(picks[open.id])}
          note={picks[open.id] ?? drafts[open.id] ?? ""}
          atLimit={pickCount >= limit}
          onClose={() => setOpenId(null)}
          onNote={(value) => {
            if (picks[open.id] !== undefined) onNote(booking.id, open.id, value);
            else setDrafts((current) => ({ ...current, [open.id]: value }));
          }}
          onToggle={() => {
            const note = picks[open.id] ?? drafts[open.id] ?? "";
            onToggle(booking.id, open.id, note);
          }}
        />
      ) : null}
      {showTop ? (
        <button className="account-top" type="button" aria-label="Kembali ke atas" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <img src="/assets/arrow-down-svgrepo-com.svg" alt="" />
        </button>
      ) : null}
    </>
  );
}

const reviewFields = [
  ["seraye", "Seraye Moments"],
  ["admin", "Admin"],
  ["photographer", "Fotografer"],
  ["website", "Website"],
];

function emptyReview() {
  return Object.fromEntries(reviewFields.map(([key]) => [key, { score: 0, comment: "" }]));
}

function ReviewPage({ booking }) {
  const [review, setReview] = useState(() => ({ ...emptyReview(), ...readJson(REVIEW_KEY, {}) }));
  const [saved, setSaved] = useState(false);
  const ready = reviewFields.some(([key]) => Number(review[key]?.score) > 0 || String(review[key]?.comment || "").trim());

  function setScore(key, score) {
    setSaved(false);
    setReview((current) => ({ ...current, [key]: { score, comment: current[key]?.comment || "" } }));
  }

  function setComment(key, comment) {
    setSaved(false);
    setReview((current) => ({ ...current, [key]: { ...current[key], comment } }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    const next = { ...review, photographerName: booking.photographer, bookingId: booking.id };
    localStorage.setItem(REVIEW_KEY, JSON.stringify(next));
    const lines = reviewFields
      .filter(([key]) => review[key]?.comment?.trim())
      .map(([key, label]) => {
        const name = key === "photographer" ? `${label} (${booking.photographer})` : label;
        return `${name}: ${review[key].comment.trim()}`;
      });
    if (review.seraye?.score && review.website?.score) {
      try {
        await submitFeedback({
          message: lines.join("\n"),
          service: review.seraye.score,
          website: review.website.score,
        });
      } catch {
        // Ulasan akun tetap tersimpan di perangkat ini.
      }
    }
    setSaved(true);
  }

  return (
    <>
      <header className="account-intro">
        <h1>Ulasan</h1>
        <p>Beri nilai untuk Seraye Moments, admin, fotografer, dan website.</p>
      </header>
      <form className="account-card account-review" onSubmit={submit}>
        {reviewFields.map(([key, label]) => {
          const score = Number(review[key]?.score) || 0;
          const title = key === "photographer" ? `${label} — ${booking.photographer}` : label;
          return (
            <fieldset key={key}>
              <legend>{title}</legend>
              <div className="account-stars" role="radiogroup" aria-label={title}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={value <= score ? "is-on" : ""}
                    role="radio"
                    aria-checked={value === score}
                    onClick={() => setScore(key, value)}
                  >
                    ★
                  </button>
                ))}
              </div>
              {score > 0 ? (
                <label>
                  Komentar
                  <textarea
                    value={review[key]?.comment || ""}
                    onChange={(event) => setComment(key, event.target.value)}
                    rows={3}
                    placeholder={`Ceritakan pengalamanmu tentang ${label.toLowerCase()}`}
                  />
                </label>
              ) : null}
            </fieldset>
          );
        })}
        {saved ? <p className="account-alert is-ready" role="status">Ulasan sudah terkirim. Terima kasih.</p> : null}
        <button className="btn btn-forest" type="submit" disabled={!ready}>Kirim ulasan</button>
      </form>
    </>
  );
}

function AccountSettings({ session, onSession }) {
  const [name, setName] = useState(session.name);
  const [saved, setSaved] = useState(false);

  function submit(event) {
    event.preventDefault();
    const next = { ...session, name: name.trim() || displayName(session.identity) };
    writeSession(next);
    onSession(next);
    setName(next.name);
    setSaved(true);
  }

  return (
    <>
      <header className="account-intro">
        <h1>Kelola Akun</h1>
        <p>Perbarui nama yang tampil di halaman akunmu.</p>
      </header>
      <form className="account-card account-settings" onSubmit={submit}>
        <label>
          Nama
          <input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} />
        </label>
        <label>
          WhatsApp atau email
          <input value={session.identity} readOnly />
        </label>
        {saved ? <p className="account-alert is-ready" role="status">Perubahan nama tersimpan.</p> : null}
        <div className="account-actions">
          <button className="btn btn-forest" type="submit">Simpan</button>
          <a className="btn btn-line" href="/ganti-sandi">Ganti kata sandi</a>
          <button
            className="btn btn-line"
            type="button"
            onClick={() => {
              clearSession();
              window.location.assign("/");
            }}
          >
            Keluar
          </button>
        </div>
      </form>
    </>
  );
}

export default function AccountApp() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const [session, setSession] = useState(() => readSession());
  const [activeId, setActiveId] = useState(readActiveId);
  const [picks, setPicks] = useState(() => readJson(PICKS_KEY, {}));
  const [dpAsked, setDpAsked] = useState(() => readJson(DP_KEY, {}));

  useEffect(() => {
    if (!session) window.location.replace("/masuk");
  }, [session]);

  if (!session) return null;

  const booking = clientBookings.find((item) => item.id === activeId) || clientBookings[0];
  const bookingPicks = picks[booking.id] || {};
  const pickCount = Object.keys(bookingPicks).length;

  function chooseBooking(id) {
    sessionStorage.setItem(ACTIVE_KEY, id);
    setActiveId(id);
  }

  function togglePick(bookingId, photoId, note) {
    setPicks((current) => {
      const group = { ...(current[bookingId] || {}) };
      if (group[photoId] !== undefined) delete group[photoId];
      else {
        const bookingItem = clientBookings.find((item) => item.id === bookingId);
        if (Object.keys(group).length >= editLimit(bookingItem)) return current;
        group[photoId] = note;
      }
      const next = { ...current, [bookingId]: group };
      localStorage.setItem(PICKS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function updateNote(bookingId, photoId, note) {
    setPicks((current) => {
      if (current[bookingId]?.[photoId] === undefined) return current;
      const next = { ...current, [bookingId]: { ...current[bookingId], [photoId]: note } };
      localStorage.setItem(PICKS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function payDp() {
    const url = buildWhatsAppUrl(
      `Halo admin Seraye Moments, saya ${session.name} ingin membayar DP ${rupiah(booking.dp)} untuk booking ${booking.id} paket ${booking.packageName}.`,
    );
    const next = { ...dpAsked, [booking.id]: true };
    localStorage.setItem(DP_KEY, JSON.stringify(next));
    setDpAsked(next);
    window.open(url, "_blank", "noopener");
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="Seraye Moments">
            <img src={logoSrc} alt="Seraye Moments" />
          </a>
          <a className="header-back" href="/">Balik ke Halaman</a>
        </div>
      </header>
      <nav className="account-nav" aria-label="Menu akun">
        {nav.map(([href, label]) => (
          <a key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</a>
        ))}
      </nav>
      <main className="account-main">
        {path === "/akun/kelola" ? null : (
          <BookingSwitch bookings={clientBookings} activeId={booking.id} onChange={chooseBooking} />
        )}
        {path === "/akun/foto" ? (
          <PhotoReview booking={booking} picks={bookingPicks} onToggle={togglePick} onNote={updateNote} />
        ) : path === "/akun/ulasan" ? (
          <ReviewPage booking={booking} />
        ) : path === "/akun/kelola" ? (
          <AccountSettings session={session} onSession={setSession} />
        ) : (
          <Dashboard
            session={session}
            booking={booking}
            pickCount={pickCount}
            dpAsked={Boolean(dpAsked[booking.id])}
            onPay={payDp}
          />
        )}
      </main>
    </>
  );
}
