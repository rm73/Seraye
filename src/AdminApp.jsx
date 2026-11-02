import { useEffect, useMemo, useState } from "react";
import {
  adminToken,
  createBlock,
  deleteAdminBooking,
  deleteBlock,
  loadAdminSchedule,
  loginAdmin,
  saveAdminBooking,
  setAdminToken,
} from "./api";
import { packages } from "./data";
import {
  addMinutes,
  bookingIsInFullBlock,
  fullIntervals,
  packageMinutes,
  photographerLabel,
  PHOTOGRAPHERS,
  sessionLabel,
  takenPhotographers,
} from "./schedule";

const emptyBooking = {
  id: "",
  name: "",
  whatsapp: "",
  date: "",
  startTime: "",
  packageId: "sekejap",
  location: "",
  notes: "",
  photographer: "",
};

function formatDate(stamp) {
  const [year, month, day] = stamp.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function blockSpan(block) {
  const start = formatDate(block.startDate);
  const end = formatDate(block.endDate);
  if (!block.startTime || !block.endTime) {
    return block.endDate === block.startDate ? `${start}, seharian` : `${start} – ${end}, seharian`;
  }
  if (block.endDate === block.startDate) return `${start}, ${block.startTime}–${block.endTime}`;
  return `${start} ${block.startTime} – ${end} ${block.endTime}`;
}

function Login({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await loginAdmin({ password });
      setAdminToken(result.token);
      onSuccess();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login">
      <form onSubmit={submit}>
        <p className="eyebrow">Seraye Moments</p>
        <h1>Masuk admin</h1>
        <p>Halaman ini tidak ada di menu situs. Hanya pengelola yang punya kata sandi yang bisa masuk.</p>
        <label>
          Kata sandi
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="admin-error">{error}</p> : null}
        <button className="btn btn-block" type="submit" disabled={busy}>
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(Boolean(adminToken()));
  const [schedule, setSchedule] = useState({ bookings: [], blocks: [], persistent: true });
  const [filterDate, setFilterDate] = useState("");
  const [draft, setDraft] = useState(null);
  const [blockForm, setBlockForm] = useState({ startDate: "", endDate: "", startTime: "", endTime: "", reason: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const data = await loadAdminSchedule();
    setSchedule(data);
    setAuthed(true);
  }

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("key");
    if (!key) return undefined;
    let ignore = false;
    loginAdmin({ key })
      .then((result) => {
        if (ignore) return;
        setAdminToken(result.token);
        window.history.replaceState({}, "", "/admin");
        setAuthed(true);
      })
      .catch((reason) => {
        if (!ignore) setError(reason.message);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!authed) return undefined;
    let ignore = false;
    loadAdminSchedule()
      .then((data) => {
        if (!ignore) setSchedule(data);
      })
      .catch((reason) => {
        if (ignore) return;
        setAuthed(Boolean(adminToken()));
        setError(reason.message);
      });
    return () => {
      ignore = true;
    };
  }, [authed]);

  const dates = useMemo(() => {
    const stamps = new Set(schedule.bookings.map((booking) => booking.date));
    schedule.blocks.forEach((block) => {
      stamps.add(block.startDate);
    });
    return [...stamps].sort();
  }, [schedule]);

  const visibleDates = filterDate ? dates.filter((date) => date === filterDate) : dates;

  async function run(action, success) {
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
      if (success) setNotice(success);
    } catch (reason) {
      setError(reason.message);
      if (!adminToken()) setAuthed(false);
    }
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submitDraft(event) {
    event.preventDefault();
    if (!draft) return;
    const method = draft.id ? "PUT" : "POST";
    await run(async () => {
      await saveAdminBooking(draft, method);
      setDraft(null);
    }, method === "POST" ? "Booking ditambahkan." : "Booking diperbarui.");
  }

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  return (
    <main className="admin-page">
      <header className="admin-bar">
        <div>
          <p className="eyebrow">Seraye Moments</p>
          <h1>Dashboard booking</h1>
        </div>
        <div className="admin-bar-actions">
          <a href="/">Lihat situs</a>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {notice ? <p className="admin-notice">{notice}</p> : null}

      <section className="admin-tools">
        <label>
          Tanggal
          <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
        </label>
        <button type="button" onClick={() => setFilterDate("")}>
          Semua tanggal
        </button>
        <button
          type="button"
          className="btn btn-forest"
          onClick={() => setDraft({ ...emptyBooking, date: filterDate })}
        >
          Tambah booking
        </button>
      </section>

      {draft ? (
        <BookingForm
          draft={draft}
          bookings={schedule.bookings}
          onChange={updateDraft}
          onSubmit={submitDraft}
          onCancel={() => setDraft(null)}
        />
      ) : null}

      <section className="admin-block">
        <h2>Tutup tanggal atau jam</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              await createBlock(blockForm);
              setBlockForm({ startDate: "", endDate: "", startTime: "", endTime: "", reason: "" });
            }, "Blokir tersimpan.");
          }}
        >
          <label>
            Dari tanggal
            <input
              type="date"
              value={blockForm.startDate}
              onChange={(event) => setBlockForm({ ...blockForm, startDate: event.target.value })}
              required
            />
          </label>
          <label>
            Sampai tanggal
            <input
              type="date"
              value={blockForm.endDate}
              onChange={(event) => setBlockForm({ ...blockForm, endDate: event.target.value })}
              required
            />
          </label>
          <label>
            Jam mulai
            <input
              type="time"
              value={blockForm.startTime}
              onChange={(event) => setBlockForm({ ...blockForm, startTime: event.target.value })}
            />
          </label>
          <label>
            Jam selesai
            <input
              type="time"
              value={blockForm.endTime}
              onChange={(event) => setBlockForm({ ...blockForm, endTime: event.target.value })}
            />
          </label>
          <label>
            Deskripsi
            <input
              value={blockForm.reason}
              onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })}
              placeholder="Libur atau sudah dikunci"
            />
          </label>
          <button className="btn btn-forest" type="submit">
            Simpan blokir
          </button>
          <div className="admin-block-note">
            <p className="hint">Kosongkan jam untuk menutup seharian. Isi keduanya untuk menutup rentang jam.</p>
            <button
              className="admin-reset"
              type="button"
              onClick={() => setBlockForm((current) => ({ ...current, startTime: "", endTime: "" }))}
            >
              Reset jam
            </button>
          </div>
        </form>
        <ul>
          {schedule.blocks.map((block) => (
            <li key={block.id}>
              <span>
                {blockSpan(block)}
                {` · ${block.reason}`}
              </span>
              <button type="button" onClick={() => run(() => deleteBlock(block.id), "Blokir dihapus.")}>
                Hapus
              </button>
            </li>
          ))}
        </ul>
      </section>

      {visibleDates.length === 0 ? (
        <p className="admin-empty">
          Belum ada booking. Data masuk otomatis saat klien menekan Lanjutkan Booking via WhatsApp atau Salin pesan.
        </p>
      ) : (
        visibleDates.map((date) => (
          <DayBoard
            key={date}
            date={date}
            bookings={schedule.bookings}
            onEdit={(booking) => setDraft(booking)}
            onDelete={(id) => run(() => deleteAdminBooking(id), "Booking dihapus.")}
            onAssign={(booking, photographer) =>
              run(() => saveAdminBooking({ ...booking, photographer }, "PUT"), "Fotografer diperbarui.")
            }
          />
        ))
      )}
    </main>
  );
}

function DayBoard({ date, bookings, onEdit, onDelete, onAssign }) {
  const dayBookings = bookings
    .filter((booking) => booking.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const spans = fullIntervals(bookings, date);

  return (
    <section className="admin-day">
      <header>
        <h2>{formatDate(date)}</h2>
        <span>{dayBookings.length} booking</span>
      </header>
      {spans.map((span) => (
        <p key={`${span.start}-${span.end}`} className="admin-full">
          Penuh {sessionLabel(span.start, span.end)}. Tiga sesi bertumpuk, jadi klien tidak bisa memilih waktu ini.
        </p>
      ))}
      <div className="admin-table">
        {dayBookings.map((booking) => {
          const full = bookingIsInFullBlock(booking, bookings);
          const taken = takenPhotographers(bookings, booking.date, booking.startTime, booking.endTime, booking.id);
          return (
            <article key={booking.id} className={full ? "is-full" : ""}>
              <div>
                <strong>{booking.id}</strong>
                <span className={`crew crew-${booking.photographer || "none"}`}>{photographerLabel(booking.photographer)}</span>
              </div>
              <p>{booking.name}</p>
              <p>
                <a href={whatsAppLink(booking.whatsapp)} target="_blank" rel="noreferrer">
                  {booking.whatsapp}
                </a>
              </p>
              <p>
                {booking.packageName} · {sessionLabel(booking.startTime, booking.endTime)} ({booking.minutes} menit)
              </p>
              <p>{booking.location}</p>
              <p>{booking.notes.trim() || "—"}</p>
              <label>
                Fotografer
                <select value={booking.photographer || ""} onChange={(event) => onAssign(booking, event.target.value)}>
                  <option value="">Belum ditugaskan</option>
                  {PHOTOGRAPHERS.map((id) => (
                    <option key={id} value={id} disabled={taken.has(id)}>
                      Fotografer {id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-row-actions">
                <button type="button" onClick={() => onEdit(booking)}>
                  Ubah
                </button>
                <button type="button" onClick={() => onDelete(booking.id)}>
                  Hapus
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function whatsAppLink(value) {
  const digits = value.replace(/\D/g, "");
  const international = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

function BookingForm({ draft, bookings, onChange, onSubmit, onCancel }) {
  const selected = packages.find((item) => item.id === draft.packageId) ?? packages[0];
  const end = draft.startTime ? addMinutes(draft.startTime, packageMinutes(selected)) : "";
  const taken = draft.date && draft.startTime && end
    ? takenPhotographers(bookings, draft.date, draft.startTime, end, draft.id)
    : new Set();

  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <h2>{draft.id ? "Ubah booking" : "Booking baru"}</h2>
      <label>
        Nama
        <input value={draft.name} onChange={(event) => onChange("name", event.target.value)} required />
      </label>
      <label>
        WhatsApp
        <input value={draft.whatsapp} onChange={(event) => onChange("whatsapp", event.target.value)} required />
      </label>
      <label>
        Tanggal
        <input type="date" value={draft.date} onChange={(event) => onChange("date", event.target.value)} required />
      </label>
      <label>
        Jam mulai
        <input type="time" value={draft.startTime} onChange={(event) => onChange("startTime", event.target.value)} required />
      </label>
      <label>
        Paket
        <select value={draft.packageId} onChange={(event) => onChange("packageId", event.target.value)}>
          {packages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Lokasi
        <input value={draft.location} onChange={(event) => onChange("location", event.target.value)} required />
      </label>
      <label>
        Pesan
        <textarea value={draft.notes} onChange={(event) => onChange("notes", event.target.value)} rows={3} />
      </label>
      <label>
        Fotografer
        <select value={draft.photographer || ""} onChange={(event) => onChange("photographer", event.target.value)}>
          <option value="">Belum ditugaskan</option>
          {PHOTOGRAPHERS.map((id) => (
            <option key={id} value={id} disabled={taken.has(id)}>
              Fotografer {id}
            </option>
          ))}
        </select>
      </label>
      <div className="admin-row-actions">
        <button className="btn btn-forest" type="submit">
          Simpan
        </button>
        <button type="button" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  );
}
