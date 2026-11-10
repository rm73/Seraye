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
import { isActiveWhatsApp, rupiah } from "./booking";
import { packages, PHOTO_ADDON } from "./data";
import { readFeedback } from "./feedback";
import {
  addMinutes,
  bookingIsInFullBlock,
  DEFAULT_PHOTOGRAPHERS,
  fullIntervals,
  normalizePhotographers,
  packageMinutes,
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
  date: "",
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
  const [focusTick, setFocusTick] = useState(0);
  const [focusTarget, setFocusTarget] = useState("");

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
    const stamps = new Set([
      ...schedule.bookings.map((booking) => booking.date),
      ...schedule.mocks.map((mock) => mock.date),
    ].filter(Boolean));
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

  function focusEditor(id) {
    setFocusTarget(id);
    setFocusTick((value) => value + 1);
  }

  useEffect(() => {
    if (!focusTick || !focusTarget) return;
    document.getElementById(focusTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusTick, focusTarget]);

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

          {visibleDates.length === 0 && (filterDate || schedule.mocks.every((mock) => mock.date)) ? (
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
                mocks={schedule.mocks}
                photographers={photographers}
                onEdit={(booking) => {
                  setDraft(booking);
                  focusEditor("booking-editor");
                }}
                onEditMock={(mock) => {
                  setMockDraft(mock);
                  focusEditor("mock-editor");
                }}
                onDelete={(id) => run(() => deleteAdminBooking(id), "Booking dihapus.")}
                onDeleteMock={(id) => run(() => deleteAdminMock(id), "Mock customer dihapus.")}
                onAssign={(booking, photographer) =>
                  run(() => saveAdminBooking({ ...booking, photographer }, "PUT"), "Fotografer diperbarui.")
                }
                onPayment={(booking, paymentStatus) =>
                  run(() => saveAdminBooking({ ...booking, paymentStatus }, "PUT"), "Status pembayaran diperbarui.")
                }
              />
            ))
          )}
          {!filterDate && schedule.mocks.some((mock) => !mock.date) ? (
            <section className="admin-day">
              <header>
                <h2>Tanggal belum diisi</h2>
                <span>{schedule.mocks.filter((mock) => !mock.date).length} mock</span>
              </header>
              <div className="admin-table">
                {schedule.mocks.filter((mock) => !mock.date).map((mock) => (
                  <CustomerCard
                    key={mock.id}
                    mock
                    idLabel="MOCK BOOKING"
                    idValue={mock.id}
                    name={mock.name}
                    addons={Number(mock.extraPhotos) || 0}
                    packageName={mock.packageName || mock.packageId}
                    whatsapp={mock.whatsapp}
                    location={mock.location}
                    notes={mock.notes}
                    dateLabel="—"
                    actions={(
                      <>
                        <label>
                          Status bayar
                          <select value="dp" disabled>
                            <option value="dp">DP</option>
                          </select>
                        </label>
                        <label>
                          Fotografer
                          <select value="" disabled>
                            <option value="">Belum ditugaskan</option>
                          </select>
                        </label>
                        <div className="admin-row-actions">
                          <button type="button" onClick={() => { setMockDraft(mock); focusEditor("mock-editor"); }}>Ubah</button>
                          <button type="button" onClick={() => run(() => deleteAdminMock(mock.id), "Mock customer dihapus.")}>Hapus</button>
                        </div>
                      </>
                    )}
                  />
                ))}
              </div>
            </section>
          ) : null}
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

function FieldCell({ label, children, wide = false }) {
  return (
    <div className={wide ? "admin-field is-wide" : "admin-field"}>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function DayBoard({
  date,
  bookings,
  mocks,
  photographers,
  onEdit,
  onEditMock,
  onDelete,
  onDeleteMock,
  onAssign,
  onPayment,
}) {
  const dayBookings = bookings
    .filter((booking) => booking.date === date)
    .sort((a, b) => {
      const order = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      if (order !== 0) return order;
      return a.startTime.localeCompare(b.startTime);
    });
  const dayMocks = mocks.filter((mock) => mock.date === date);
  const spans = fullIntervals(bookings, date, photographers);

  return (
    <section className="admin-day">
      <header>
        <h2>{formatDate(date)}</h2>
        <span>{dayBookings.length} booking · {dayMocks.length} mock</span>
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
            <CustomerCard
              key={booking.id}
              full={full}
              idLabel="ID Booking"
              idValue={booking.id}
              name={booking.name}
              addons={Number(booking.extraPhotos) || 0}
              packageName={booking.packageName}
              whatsapp={booking.whatsapp}
              location={booking.location}
              notes={booking.notes}
              dateLabel={formatDate(booking.date)}
              actions={(
                <>
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
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => onEdit(booking)}>Ubah</button>
                    <button type="button" onClick={() => onDelete(booking.id)}>Hapus</button>
                  </div>
                </>
              )}
            />
          );
        })}
        {dayMocks.map((mock) => (
          <CustomerCard
            key={mock.id}
            mock
            idLabel="MOCK BOOKING"
            idValue={mock.id}
            name={mock.name}
            addons={Number(mock.extraPhotos) || 0}
            packageName={mock.packageName || mock.packageId}
            whatsapp={mock.whatsapp}
            location={mock.location}
            notes={mock.notes}
            dateLabel={formatDate(mock.date)}
            actions={(
              <>
                <label>
                  Status bayar
                  <select value="dp" disabled>
                    <option value="dp">DP</option>
                  </select>
                </label>
                <label>
                  Fotografer
                  <select value="" disabled>
                    <option value="">Belum ditugaskan</option>
                  </select>
                </label>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => onEditMock(mock)}>Ubah</button>
                  <button type="button" onClick={() => onDeleteMock(mock.id)}>Hapus</button>
                </div>
              </>
            )}
          />
        ))}
      </div>
    </section>
  );
}

function CustomerCard({
  mock = false,
  full = false,
  idLabel,
  idValue,
  name,
  addons,
  packageName,
  whatsapp,
  location,
  notes,
  dateLabel,
  actions,
}) {
  const tone = mock ? "is-mock" : full ? "is-full" : "";
  return (
    <article className={`admin-booking-card ${tone}`}>
      <div className="admin-sheet">
        <FieldCell label={idLabel}>{idValue}</FieldCell>
        <FieldCell label="Nama">{name}</FieldCell>
        <FieldCell label="Add-on">{addons} foto</FieldCell>
        <FieldCell label="Paket">{packageName}</FieldCell>
        <FieldCell label="Nomor WA">
          <a href={whatsAppLink(whatsapp)} target="_blank" rel="noreferrer">{whatsapp}</a>
        </FieldCell>
        <FieldCell label="Lokasi">{location || "—"}</FieldCell>
        <FieldCell label="Catatan" wide>{notes?.trim() || "—"}</FieldCell>
        <FieldCell label="Tanggal">{dateLabel}</FieldCell>
      </div>
      <div className="admin-card-actions">{actions}</div>
    </article>
  );
}

function PhotographerPanel({ photographers, bookings, onSave, onDelete }) {
  const [draft, setDraft] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const phoneInvalid = attempted && draft && !isActiveWhatsApp(draft.phone || "");

  useEffect(() => {
    if (!focusTick) return;
    document.getElementById("photographer-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusTick]);

  function openDraft(next) {
    setAttempted(false);
    setDraft(next);
    setFocusTick((value) => value + 1);
  }

  return (
    <section className="admin-block admin-photographers">
        <div className="admin-side-head">
          <h2>Info fotografer</h2>
          <button type="button" onClick={() => openDraft({ ...emptyPhotographer })}>
            Tambah
          </button>
        </div>
        {draft ? (
          <form
            id="photographer-editor"
            className="admin-photo-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setAttempted(true);
              if (!draft.name.trim() || !isActiveWhatsApp(draft.phone || "")) return;
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
            <label className={phoneInvalid ? "is-invalid" : ""}>
              WhatsApp
              <input
                value={draft.phone}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                placeholder="08… atau 628…"
                required
              />
              {phoneInvalid ? <span className="field-error">Nomor WhatsApp belum valid. Pakai format 08… atau 628… (10–15 digit).</span> : null}
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
                <div className="admin-photo-copy">
                  <strong>{item.name}</strong>
                  <p>{item.phone || "Kontak belum diisi"}</p>
                  <p>{item.notes || "—"}</p>
                  <p className="admin-assign-count">{assignments} assignment</p>
                </div>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => openDraft({ ...item, _editing: true })}>
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
      id="mock-editor"
      className="admin-form"
      onSubmit={(event) => {
        setAttempted(true);
        onSubmit(event);
      }}
    >
      <h2>{draft.id ? "Ubah mock customer" : "Mock customer baru"}</h2>
      <label>
        Tanggal
        <input type="date" value={draft.date || ""} onChange={(event) => onChange("date", event.target.value)} required />
      </label>
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
      id="booking-editor"
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
      <h2>{draft.id ? "Ubah booking" : "Booking baru"}</h2>
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
      <div className="addon">
        <div>
          <strong>Add-on edit foto</strong>
          <p>{rupiah(PHOTO_ADDON)}/foto. Opsional, bisa ditambah atau dikurangi.</p>
        </div>
        <div className="stepper">
          <button
            type="button"
            onClick={() => onChange("extraPhotos", Math.max(0, (Number(draft.extraPhotos) || 0) - 1))}
            aria-label="Kurangi foto"
          >
            −
          </button>
          <span>{Number(draft.extraPhotos) || 0}</span>
          <button
            type="button"
            onClick={() => onChange("extraPhotos", (Number(draft.extraPhotos) || 0) + 1)}
            aria-label="Tambah foto"
          >
            +
          </button>
        </div>
      </div>
      <label>
        Lokasi
        <input value={draft.location} onChange={(event) => onChange("location", event.target.value)} required />
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
      <label>
        Pesan
        <textarea value={draft.notes} onChange={(event) => onChange("notes", event.target.value)} rows={3} />
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
