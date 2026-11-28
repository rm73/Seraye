import { useEffect, useState } from "react";
import { submitFeedback } from "./api";
import { buildWhatsAppUrl, rupiah } from "./booking";
import { clientBookings, downloadWindow, drivePhotoSrc, editLimit, historyOpen } from "./accountData";
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

const MILESTONES = ["1. Sesi Foto", "2. RAW Diunggah", "3. Kurasi Klien", "4. Retouching", "5. Final G-Drive"];

function milestoneIndex(booking, pickCount) {
  if (booking.phase === "done") return MILESTONES.length;
  if (booking.phase === "photos") return pickCount > 0 ? 3 : 2;
  return -1;
}

function deadlineCopy(booking) {
  const start = new Date(`${booking.dateISO}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - today.getTime()) / 86400000);
  const when = end.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  let remain = "Sudah selesai";
  if (booking.phase !== "done") {
    if (diff > 1) remain = `Sisa ${diff} Hari Lagi`;
    else if (diff === 1) remain = "Sisa 1 Hari Lagi";
    else if (diff === 0) remain = "Hari ini";
    else remain = `Lewat ${Math.abs(diff)} Hari`;
  }
  return { when: `${when} (H+7)`, remain };
}

function Dashboard({ session, booking, bookings, pickCount, dpAsked, onPay, onChoose }) {
  const warning = warningFor(booking, dpAsked);
  const current = milestoneIndex(booking, pickCount);
  const deadline = deadlineCopy(booking);
  const download = downloadWindow(booking);
  const discuss = buildWhatsAppUrl(
    `Halo, saya ${session.name} ingin berdiskusi dengan fotografer ${booking.photographer} untuk booking ${booking.id} paket ${booking.packageName}.`,
  );
  const sessionDate = new Date(`${booking.dateISO}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  function updateProgress() {
    if (booking.phase === "dp") onPay();
    else if (booking.phase === "photos") window.location.assign("/akun/foto");
    else window.location.assign("/akun/ulasan");
  }

  return (
    <>
      <header className="account-intro">
        <h1>Dashboard</h1>
      </header>
      <BookingSwitch bookings={bookings} activeId={booking.id} onChange={onChoose} />
      {booking.phase === "dp" ? <p className={`account-alert is-${warning.tone}`} role="status">{warning.text}</p> : null}
      {download ? <p className="account-alert is-wait" role="status">{download.text}</p> : null}
      <article className="session-card">
        <h2>{sessionDate} - {session.name}</h2>
        <div className="session-facts">
          <div>
            <p>Paket sesi</p>
            <strong>Paket {booking.packageName} ({editLimit(booking)} Foto)</strong>
          </div>
          <div>
            <p>WhatsApp</p>
            <strong>{session.identity}</strong>
          </div>
          <div>
            <p>Waktu & lokasi</p>
            <span>{booking.timeLabel} • {booking.location}</span>
          </div>
          <div>
            <p>Fotografer</p>
            <a href={discuss} target="_blank" rel="noreferrer">{booking.photographer}</a>
          </div>
          <div className="is-deadline">
            <p>
              <img src="/assets/account/deadline.svg" alt="" width="10.8333" height="10.8333" />
              Deadline selesai
            </p>
            <strong>{deadline.when}</strong>
            <em>{deadline.remain}</em>
          </div>
        </div>
        <ol className="session-steps" aria-label="Milestone booking">
          {MILESTONES.map((label, index) => {
            const state = index < current ? "is-done" : index === current ? "is-current" : "";
            return <li key={label} className={state}>{label}</li>;
          })}
        </ol>
        <div className="session-actions">
          <button className="session-update" type="button" onClick={updateProgress}>Update Progress</button>
        </div>
      </article>
      <section className="account-card purchase-history">
        <h2>Riwayat pembelian</h2>
        <p className="account-muted">Riwayat yang sudah sampai Final G-Drive tetap bisa dibuka selama 3 minggu untuk mengunduh hasilnya.</p>
        <ul>
          {bookings.map((item) => {
            const windowInfo = downloadWindow(item);
            return (
              <li key={item.id}>
                <button type="button" className={item.id === booking.id ? "is-active" : ""} onClick={() => onChoose(item.id)}>
                  <strong>{item.packageName}</strong>
                  <span>{item.dateLabel}</span>
                </button>
                {windowInfo ? <p>{windowInfo.text}{item.driveUrl ? <> <a href={item.driveUrl} target="_blank" rel="noreferrer">Unduh dari Drive</a></> : null}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function PhotoReview({ booking, picks, onToggle, onNote }) {
  const [drafts, setDrafts] = useState({});
  const [noteId, setNoteId] = useState("");
  const [showTop, setShowTop] = useState(false);
  const limit = editLimit(booking);
  const pickCount = Object.keys(picks).length;
  const download = downloadWindow(booking);

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 480);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function noteFor(photoId) {
    return picks[photoId] ?? drafts[photoId] ?? "";
  }

  function changeNote(photoId, value) {
    if (picks[photoId] !== undefined) onNote(booking.id, photoId, value);
    else setDrafts((current) => ({ ...current, [photoId]: value }));
  }

  return (
    <>
      <header className="account-intro">
        <h1>Review Foto</h1>
        <p>Centang foto yang ingin diproses. Catatan untuk fotografer boleh dikosongkan.</p>
      </header>
      {download ? <p className="account-alert is-wait" role="status">{download.text}</p> : null}
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
                const picked = picks[photo.id] !== undefined;
                const atLimit = pickCount >= limit && !picked;
                return (
                  <article key={photo.id} className={picked ? "photo-tile is-picked" : "photo-tile"}>
                    <div className="photo-frame">
                      <img src={drivePhotoSrc(photo.id, 800)} alt={photo.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                      <span className="photo-shade" />
                      {picked ? (
                        <button
                          className="photo-x"
                          type="button"
                          aria-label={`Hapus pilihan ${photo.name}`}
                          onClick={() => onToggle(booking.id, photo.id, noteFor(photo.id))}
                        >
                          ×
                        </button>
                      ) : (
                        <button
                          className="photo-check"
                          type="button"
                          aria-label={`Pilih ${photo.name} untuk diedit`}
                          disabled={atLimit}
                          onClick={() => onToggle(booking.id, photo.id, noteFor(photo.id))}
                        />
                      )}
                    </div>
                    <button className="photo-note" type="button" onClick={() => setNoteId((current) => current === photo.id ? "" : photo.id)}>
                      <img src="/assets/account/chat.svg" alt="" width="16" height="16" />
                      Catatan
                    </button>
                    {noteId === photo.id ? (
                      <label>
                        Catatan untuk fotografer, opsional
                        <textarea
                          value={noteFor(photo.id)}
                          onChange={(event) => changeNote(photo.id, event.target.value)}
                          rows={3}
                          placeholder="Kosongkan jika tidak ada pesan"
                        />
                      </label>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <p className="account-muted">Fotografer belum mengunggah hasil foto untuk booking ini.</p>
        )}
      </section>
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
      <form className="account-settings" onSubmit={submit}>
        <label>
          Nama
          <input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} />
        </label>
        <label>
          Nomor WhatsApp
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
    else if (session.role === "photographer") window.location.replace("/fotografer");
  }, [session]);

  if (!session) return null;

  const bookings = clientBookings.filter((item) => historyOpen(item));
  const booking = bookings.find((item) => item.id === activeId) || bookings[0];
  const bookingPicks = booking ? picks[booking.id] || {} : {};
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
    <div className="account-shell">
      <aside className="account-side">
        <a className="brand" href="/" aria-label="Seraye Moments">
          <img src={logoSrc} alt="Seraye Moments" />
        </a>
        <nav aria-label="Menu akun">
          {nav.map(([href, label]) => (
            <a key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</a>
          ))}
        </nav>
        <a className="account-home" href="/">Balik ke Halaman</a>
      </aside>
      <main className="account-main">
        {path === "/akun" || path === "/akun/kelola" || !booking ? null : (
          <BookingSwitch bookings={bookings} activeId={booking.id} onChange={chooseBooking} />
        )}
        {!booking ? (
          <p className="account-alert is-alert" role="status">Riwayat pembelian sudah lewat 3 minggu setelah Final G-Drive, jadi tidak bisa diakses lagi.</p>
        ) : path === "/akun/foto" ? (
          <PhotoReview booking={booking} picks={bookingPicks} onToggle={togglePick} onNote={updateNote} />
        ) : path === "/akun/ulasan" ? (
          <ReviewPage booking={booking} />
        ) : path === "/akun/kelola" ? (
          <AccountSettings session={session} onSession={setSession} />
        ) : (
          <Dashboard
            session={session}
            booking={booking}
            bookings={bookings}
            pickCount={pickCount}
            dpAsked={Boolean(dpAsked[booking.id])}
            onPay={payDp}
            onChoose={chooseBooking}
          />
        )}
      </main>
      {booking ? <ChatBubbles session={session} booking={booking} /> : null}
    </div>
  );
}

function ChatBubbles({ session, booking }) {
  const adminHref = buildWhatsAppUrl(
    `Halo admin Seraye Moments, saya ${session.name} (${session.identity}) ingin bertanya tentang booking ${booking.id} paket ${booking.packageName}.`,
  );
  const photographerHref = buildWhatsAppUrl(
    `Halo, saya ${session.name} (${session.identity}) ingin berdiskusi dengan fotografer ${booking.photographer} untuk booking ${booking.id} paket ${booking.packageName}.`,
  );
  return (
    <div className="wa-bubbles">
      <a className="is-photo" href={photographerHref} target="_blank" rel="noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3zm4.8 12.6c-.2.6-1.2 1.1-1.7 1.1-.4 0-.9.2-3.1-.7-2.6-1-4.2-3.6-4.3-3.8-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.6.8 2 .8 2.1.1.1 0 .3-.1.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.6-.7c.2-.2.3-.2.6-.1.2.1 1.6.8 1.9.9.3.1.4.2.5.3.1.3 0 .8-.2 1.2z" />
        </svg>
        Fotografer
      </a>
      <a className="is-admin" href={adminHref} target="_blank" rel="noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3zm4.8 12.6c-.2.6-1.2 1.1-1.7 1.1-.4 0-.9.2-3.1-.7-2.6-1-4.2-3.6-4.3-3.8-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.6.8 2 .8 2.1.1.1 0 .3-.1.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.6-.7c.2-.2.3-.2.6-.1.2.1 1.6.8 1.9.9.3.1.4.2.5.3.1.3 0 .8-.2 1.2z" />
        </svg>
        Admin
      </a>
    </div>
  );
}
