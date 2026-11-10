import { useEffect, useMemo, useState } from "react";
import {
  adminToken,
  createBlock,
  deleteAdminBooking,
  deleteAdminMock,
  deleteAdminPhotographer,
  deleteBlock,
  loadAdminSchedule,
  loginAdmin,
  saveAdminBooking,
  saveAdminMock,
  saveAdminPhotographer,
  setAdminToken,
} from "./api";
import { isActiveWhatsApp } from "./booking";
import { packages } from "./data";
import { readFeedback } from "./feedback";
import {
  addMinutes,
  bookingIsInFullBlock,
  DEFAULT_PHOTOGRAPHERS,
  fullIntervals,
  normalizePhotographers,
  packageMinutes,
  photographerLabel,
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
  paymentStatus: "dp",
  extraPhotos: 0,
  mockId: "",
};

const emptyMock = {
  id: "",
  name: "",
  whatsapp: "",
  packageId: "sekejap",
  location: "",
  notes: "",
  startTime: "",
  extraPhotos: 0,
};

const emptyPhotographer = {
  id: "",
  name: "",
  phone: "",
  notes: "",
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

function whatsAppLink(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const international = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
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
  const [schedule, setSchedule] = useState({
    bookings: [],
    blocks: [],
    photographers: DEFAULT_PHOTOGRAPHERS,
    mocks: [],
    persistent: true,
  });
  const [page, setPage] = useState("dashboard");
  const [filterDate, setFilterDate] = useState("");
  const [draft, setDraft] = useState(null);
  const [mockDraft, setMockDraft] = useState(null);
  const [blockForm, setBlockForm] = useState({ startDate: "", endDate: "", startTime: "", endTime: "", reason: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragOverDate, setDragOverDate] = useState("");

  async function refresh() {
    const data = await loadAdminSchedule();
    setSchedule({
      bookings: data.bookings || [],
      blocks: data.blocks || [],
      photographers: normalizePhotographers(data.photographers),
      mocks: Array.isArray(data.mocks) ? data.mocks : [],
      feedback: Array.isArray(data.feedback) ? data.feedback : undefined,
      persistent: data.persistent,
    });
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
        if (ignore) return;
        setSchedule({
          bookings: data.bookings || [],
          blocks: data.blocks || [],
          photographers: normalizePhotographers(data.photographers),
          mocks: Array.isArray(data.mocks) ? data.mocks : [],
          feedback: Array.isArray(data.feedback) ? data.feedback : undefined,
          persistent: data.persistent,
        });
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

  const photographers = schedule.photographers;
  const dates = useMemo(() => {
    const stamps = new Set(schedule.bookings.map((booking) => booking.date));
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
      return true;
    } catch (reason) {
      setError(reason.message);
      if (!adminToken()) setAuthed(false);
      return false;
    }
  }

  async function moveBookingUp(booking, dayBookings) {
    const index = dayBookings.findIndex((item) => item.id === booking.id);
    if (index <= 0) return;
    const next = dayBookings.slice();
    const [item] = next.splice(index, 1);
    next.splice(index - 1, 0, item);
    for (let position = 0; position < next.length; position += 1) {
      const sortOrder = (position + 1) * 10;
      if (Number(next[position].sortOrder) !== sortOrder) {
        await saveAdminBooking({ ...next[position], sortOrder }, "PUT");
      }
    }
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submitDraft(event) {
    event.preventDefault();
    if (!draft) return;
    if (!isActiveWhatsApp(draft.whatsapp)) {
      setError("Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit).");
      return;
    }
    const method = draft.id && !draft.mockId ? "PUT" : "POST";
    const payload = {
      ...draft,
      id: draft.mockId ? "" : draft.id,
      source: "admin",
    };
    await run(async () => {
      await saveAdminBooking(payload, method);
      setDraft(null);
    }, method === "POST" ? "Booking ditambahkan." : "Booking diperbarui.");
  }

  function promoteMock(mock, date = filterDate || "") {
    setDraft({
      ...emptyBooking,
      name: mock.name,
      whatsapp: mock.whatsapp,
      packageId: mock.packageId || "sekejap",
      location: mock.location || "",
      notes: mock.notes || "",
      date,
      startTime: mock.startTime || "",
      extraPhotos: Number(mock.extraPhotos) || 0,
      includeMua: Boolean(packages.find((item) => item.id === mock.packageId)?.includesMua),
      mockId: mock.id,
    });
    setPage("bookings");
    setNotice(date ? `Periksa data ${mock.name} sebelum disimpan ke booking ${formatDate(date)}.` : `Lengkapi tanggal untuk naikkan ${mock.name} ke booking.`);
  }

  function onMockDrop(date, event) {
    event.preventDefault();
    setDragOverDate("");
    const raw = event.dataTransfer.getData("application/seraye-mock");
    if (!raw) return;
    try {
      promoteMock(JSON.parse(raw), date);
    } catch {
      setError("Gagal membaca mock customer.");
    }
  }

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  return (
    <main className="admin-page">
      <header className="admin-bar">
        <div>
          <p className="eyebrow">Seraye Moments</p>
          <h1>{page === "dashboard" ? "Dashboard" : "Booking list"}</h1>
        </div>
        <div className="admin-bar-actions">
          <a href="/">Lihat situs</a>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {notice ? <p className="admin-notice">{notice}</p> : null}

      <div className="admin-shell">
        <nav className="admin-nav" aria-label="Menu admin">
          <button type="button" className={page === "dashboard" ? "is-on" : ""} onClick={() => setPage("dashboard")}>
            Dashboard
          </button>
          <button type="button" className={page === "bookings" ? "is-on" : ""} onClick={() => setPage("bookings")}>
            Booking list
          </button>
        </nav>
        <div className="admin-content">
          {page === "dashboard" ? (
            <>
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
                  onClick={() =>
                    setBlockForm({ startDate: "", endDate: "", startTime: "", endTime: "", reason: "" })
                  }
                >
                  Reset
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
          <PhotographerPanel
            photographers={photographers}
            bookings={schedule.bookings}
            onSave={(photographer, method) => run(() => saveAdminPhotographer(photographer, method), "Fotografer disimpan.")}
            onDelete={(id) => run(() => deleteAdminPhotographer(id), "Fotografer dihapus.")}
          />
          <FeedbackBoard items={schedule.feedback} />
            </>
          ) : (
            <>
          <section className="admin-tools">
            <label>
              Tanggal
              <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
            </label>
            <button type="button" onClick={() => setFilterDate("")}>
              Lihat semua
            </button>
            <button type="button" className="btn btn-forest" onClick={() => setMockDraft({ ...emptyMock })}>
              Tambah mock customer
            </button>
          </section>

          {draft ? (
            <BookingForm
              draft={draft}
              bookings={schedule.bookings}
              photographers={photographers}
              onChange={updateDraft}
              onSubmit={submitDraft}
              onCancel={() => setDraft(null)}
            />
          ) : null}

          {mockDraft ? (
            <MockForm
              draft={mockDraft}
              onChange={(field, value) => setMockDraft((current) => ({ ...current, [field]: value }))}
              onCancel={() => setMockDraft(null)}
              onSubmit={(event) => {
                event.preventDefault();
                if (!isActiveWhatsApp(mockDraft.whatsapp)) {
                  setError("Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit).");
                  return;
                }
                run(async () => {
                  await saveAdminMock(mockDraft, mockDraft.id ? "PUT" : "POST");
                  setMockDraft(null);
                }, "Mock customer disimpan.");
              }}
            />
          ) : null}

          <MockBoard
            mocks={schedule.mocks}
            onEdit={(mock) => setMockDraft(mock)}
            onDelete={(id) => run(() => deleteAdminMock(id), "Mock customer dihapus.")}
            onPromote={(mock) => promoteMock(mock, filterDate)}
          />

          {visibleDates.length === 0 ? (
            <p className="admin-empty">
              {filterDate
                ? `Tidak ada booking pada ${formatDate(filterDate)}.`
                : "Belum ada booking. Data masuk otomatis saat klien menekan Lanjutkan Booking via WhatsApp atau Salin pesan."}
            </p>
          ) : (
            visibleDates.map((date) => (
              <DayBoard
                key={date}
                date={date}
                bookings={schedule.bookings}
                photographers={photographers}
                highlightDrop={dragOverDate === date}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverDate(date);
                }}
                onDragLeave={() => setDragOverDate("")}
                onDrop={(event) => onMockDrop(date, event)}
                onEdit={(booking) => setDraft(booking)}
                onDelete={(id) => run(() => deleteAdminBooking(id), "Booking dihapus.")}
                onAssign={(booking, photographer) =>
                  run(() => saveAdminBooking({ ...booking, photographer }, "PUT"), "Fotografer diperbarui.")
                }
                onPayment={(booking, paymentStatus) =>
                  run(() => saveAdminBooking({ ...booking, paymentStatus }, "PUT"), "Status pembayaran diperbarui.")
                }
                onMoveUp={(booking, dayBookings) => run(() => moveBookingUp(booking, dayBookings), "Urutan booking diperbarui.")}
              />
            ))
          )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function FeedbackBoard({ items }) {
  const list = Array.isArray(items) ? items : readFeedback();
  return (
    <section className="admin-block admin-feedback">
      <h2>Penilaian pelanggan</h2>
      <div className="rating-list">
        {list.length === 0 ? <p>Belum ada penilaian. Pelanggan mengisi lewat halaman Penilaian.</p> : null}
        {list.map((item) => (
          <article key={item.id}>
            <span>Seraye Moments {item.service}/5 · Website Seraye {item.website}/5</span>
            <p>{item.message || "—"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MockBoard({ mocks, onEdit, onDelete, onPromote }) {
  return (
    <section className="admin-block admin-mocks">
      <h2>Mock customer</h2>
      <p className="hint">Simpan calon client di sini, lalu drag ke atas ke daftar booking tanggal, atau klik Naikkan.</p>
      {mocks.length === 0 ? <p className="admin-empty">Belum ada mock customer.</p> : null}
      <ul className="admin-mock-list">
        {mocks.map((mock) => (
          <li
            key={mock.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/seraye-mock", JSON.stringify(mock));
              event.dataTransfer.effectAllowed = "move";
            }}
          >
            <div>
              <strong>{mock.name}</strong>
              <p>
                <a href={whatsAppLink(mock.whatsapp)} target="_blank" rel="noreferrer">
                  {mock.whatsapp}
                </a>
                {` · ${mock.packageName || mock.packageId}`}
              </p>
              <p>{mock.startTime ? `Jam mulai ${mock.startTime}` : "Jam mulai belum diisi"}</p>
              <p>Add-on edit foto: {Number(mock.extraPhotos) || 0}</p>
              <p>{mock.location || "Lokasi belum diisi"}</p>
            </div>
            <div className="admin-row-actions">
              <button type="button" onClick={() => onPromote(mock)}>
                Naikkan
              </button>
              <button type="button" onClick={() => onEdit(mock)}>
                Ubah
              </button>
              <button type="button" onClick={() => onDelete(mock.id)}>
                Hapus
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DayBoard({
  date,
  bookings,
  photographers,
  highlightDrop,
  onDragOver,
  onDragLeave,
  onDrop,
  onEdit,
  onDelete,
  onAssign,
  onPayment,
  onMoveUp,
}) {
  const dayBookings = bookings
    .filter((booking) => booking.date === date)
    .sort((a, b) => {
      const order = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      if (order !== 0) return order;
      return a.startTime.localeCompare(b.startTime);
    });
  const spans = fullIntervals(bookings, date, photographers);

  return (
    <section
      className={`admin-day ${highlightDrop ? "is-drop-target" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header>
        <h2>{formatDate(date)}</h2>
        <span>{dayBookings.length} booking</span>
      </header>
      {spans.map((span) => (
        <p key={`${span.start}-${span.end}`} className="admin-full">
          Penuh {sessionLabel(span.start, span.end)}. Semua fotografer terisi, jadi klien tidak bisa memilih waktu ini.
        </p>
      ))}
      <div className="admin-table">
        {dayBookings.map((booking) => {
          const full = bookingIsInFullBlock(booking, bookings, photographers);
          const taken = takenPhotographers(bookings, booking.date, booking.startTime, booking.endTime, booking.id);
          return (
            <article key={booking.id} className={full ? "admin-booking-card is-full" : "admin-booking-card"}>
              <div className="admin-booking-id">
                <strong>ID Booking</strong>
                <span>{booking.id}</span>
                <label>
                  Status bayar
                  <select
                    value={booking.paymentStatus === "pelunasan" ? "pelunasan" : "dp"}
                    onChange={(event) => onPayment(booking, event.target.value)}
                  >
                    <option value="dp">DP</option>
                    <option value="pelunasan">Pelunasan</option>
                  </select>
                </label>
              </div>
              <div className="admin-booking-body">
                <p><strong>{booking.name}</strong></p>
                <p>
                  <span className={`crew crew-${booking.photographer || "none"}`}>
                    {photographerLabel(booking.photographer, photographers)}
                  </span>
                </p>
                <p>
                  <a href={whatsAppLink(booking.whatsapp)} target="_blank" rel="noreferrer">
                    {booking.whatsapp}
                  </a>
                </p>
                <p>
                  {booking.packageName} · {sessionLabel(booking.startTime, booking.endTime)} ({booking.minutes} menit)
                </p>
                <p>{booking.location || "Titik temu belum diisi"}</p>
                <p>Add-on edit foto: {Number(booking.extraPhotos) || 0}</p>
                <p>{booking.notes?.trim() || "—"}</p>
                {booking.includeMua ? <p>Include Paket MUA</p> : null}
                {booking.makeupDate ? <p>Make up {booking.makeupDate} {booking.makeupTime} · {booking.hairStyle}</p> : null}
                {booking.muaAddress ? <p>{booking.muaAddress}</p> : null}
                <label>
                  Fotografer
                  <select value={booking.photographer || ""} onChange={(event) => onAssign(booking, event.target.value)}>
                    <option value="">Belum ditugaskan</option>
                    {photographers.map((item) => (
                      <option key={item.id} value={item.id} disabled={taken.has(item.id)}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-row-actions">
                <button type="button" onClick={() => onMoveUp(booking, dayBookings)} title="Geser ke atas">
                  Naik
                </button>
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

function PhotographerPanel({ photographers, bookings, onSave, onDelete }) {
  const [draft, setDraft] = useState(null);

  return (
    <section className="admin-block admin-photographers">
        <div className="admin-side-head">
          <h2>Info fotografer</h2>
          <button type="button" onClick={() => setDraft({ ...emptyPhotographer })}>
            Tambah
          </button>
        </div>
        <p className="hint">CRUD data fotografer dan pantau jumlah assignment kerja.</p>
        {draft ? (
          <form
            className="admin-photo-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!draft.name.trim()) return;
              const method = draft._editing ? "PUT" : "POST";
              const ok = await onSave(
                {
                  id: draft.id,
                  name: draft.name,
                  phone: draft.phone,
                  notes: draft.notes,
                },
                method,
              );
              if (ok) setDraft(null);
            }}
          >
            <label>
              ID
              <input
                value={draft.id}
                onChange={(event) => setDraft({ ...draft, id: event.target.value.toUpperCase() })}
                placeholder="otomatis jika kosong"
                maxLength={4}
                disabled={Boolean(draft._editing)}
              />
            </label>
            <label>
              Nama
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                required
              />
            </label>
            <label>
              WhatsApp / telepon
              <input
                value={draft.phone}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                placeholder="08…"
              />
            </label>
            <label>
              Catatan
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                rows={3}
              />
            </label>
            <div className="admin-row-actions">
              <button className="btn btn-forest" type="submit">
                Simpan
              </button>
              <button type="button" onClick={() => setDraft(null)}>
                Batal
              </button>
            </div>
          </form>
        ) : null}
        <ul className="admin-photo-list">
          {photographers.map((item) => {
            const assignments = bookings.filter((booking) => booking.photographer === item.id).length;
            return (
              <li key={item.id}>
                <div>
                  <div className="admin-photo-top">
                    <strong>{item.name}</strong>
                    <span className={`crew crew-${item.id || "none"}`}>{item.id}</span>
                  </div>
                  <p>{item.phone || "Kontak belum diisi"}</p>
                  <p>{item.notes || "—"}</p>
                  <p className="admin-assign-count">{assignments} assignment</p>
                </div>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => setDraft({ ...item, _editing: true })}>
                    Ubah
                  </button>
                  <button type="button" onClick={() => onDelete(item.id)}>
                    Hapus
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
    </section>
  );
}

function MockForm({ draft, onChange, onSubmit, onCancel }) {
  const [attempted, setAttempted] = useState(false);
  const waInvalid = attempted && !isActiveWhatsApp(draft.whatsapp);
  const nameInvalid = attempted && draft.name.trim().length < 3;

  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        setAttempted(true);
        onSubmit(event);
      }}
    >
      <h2>{draft.id ? "Ubah mock customer" : "Mock customer baru"}</h2>
      <label className={nameInvalid ? "is-invalid" : ""}>
        Nama
        <input value={draft.name} onChange={(event) => onChange("name", event.target.value)} required />
        {nameInvalid ? <span className="field-error">Nama lengkap minimal 3 karakter.</span> : null}
      </label>
      <label className={waInvalid ? "is-invalid" : ""}>
        WhatsApp
        <input
          value={draft.whatsapp}
          onChange={(event) => onChange("whatsapp", event.target.value)}
          placeholder="08… atau 628…"
          required
        />
        {waInvalid ? <span className="field-error">Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit).</span> : null}
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
        Jam mulai
        <input type="time" value={draft.startTime || ""} onChange={(event) => onChange("startTime", event.target.value)} />
      </label>
      <label>
        Add-on edit foto
        <input
          type="number"
          min="0"
          value={Number(draft.extraPhotos) || 0}
          onChange={(event) => onChange("extraPhotos", Math.max(0, Number(event.target.value) || 0))}
        />
      </label>
      <label>
        Lokasi
        <input value={draft.location} onChange={(event) => onChange("location", event.target.value)} />
      </label>
      <label>
        Catatan
        <textarea value={draft.notes} onChange={(event) => onChange("notes", event.target.value)} rows={3} />
      </label>
      <div className="admin-row-actions">
        <button className="btn btn-forest" type="submit">
          Simpan mock
        </button>
        <button type="button" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  );
}

function BookingForm({ draft, bookings, photographers, onChange, onSubmit, onCancel }) {
  const selected = packages.find((item) => item.id === draft.packageId) ?? packages[0];
  const end = draft.startTime ? addMinutes(draft.startTime, packageMinutes(selected)) : "";
  const taken = draft.date && draft.startTime && end
    ? takenPhotographers(bookings, draft.date, draft.startTime, end, draft.id)
    : new Set();
  const [attempted, setAttempted] = useState(false);
  const waInvalid = attempted && !isActiveWhatsApp(draft.whatsapp);
  const nameInvalid = attempted && draft.name.trim().length < 3;

  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        setAttempted(true);
        if (!isActiveWhatsApp(draft.whatsapp) || draft.name.trim().length < 3) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
    >
      <h2>{draft.mockId ? "Naikkan mock ke booking" : draft.id ? "Ubah booking" : "Booking baru"}</h2>
      <label className={nameInvalid ? "is-invalid" : ""}>
        Nama
        <input value={draft.name} onChange={(event) => onChange("name", event.target.value)} required />
        {nameInvalid ? <span className="field-error">Nama lengkap minimal 3 karakter.</span> : null}
      </label>
      <label className={waInvalid ? "is-invalid" : ""}>
        WhatsApp
        <input
          value={draft.whatsapp}
          onChange={(event) => onChange("whatsapp", event.target.value)}
          placeholder="08… atau 628…"
          required
        />
        {waInvalid ? <span className="field-error">Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit).</span> : null}
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
        Status bayar
        <select value={draft.paymentStatus || "dp"} onChange={(event) => onChange("paymentStatus", event.target.value)}>
          <option value="dp">DP</option>
          <option value="pelunasan">Pelunasan</option>
        </select>
      </label>
      <label>
        Add-on edit foto
        <input
          type="number"
          min="0"
          value={Number(draft.extraPhotos) || 0}
          onChange={(event) => onChange("extraPhotos", Math.max(0, Number(event.target.value) || 0))}
        />
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
          {photographers.map((item) => (
            <option key={item.id} value={item.id} disabled={taken.has(item.id)}>
              {item.name}
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
