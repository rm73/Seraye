import { useEffect, useMemo, useState } from "react";
import { isActiveWhatsApp, rupiah } from "../booking";
import { PHOTO_ADDON } from "../data";
import { addMinutes, packageMinutes, takenPhotographers } from "../schedule";
import { readCatalogPackages } from "./store";
import { ConfirmDialog, formatLong, Icon, Modal, whatsAppLink } from "./ui";

function packageOptions() {
  const live = readCatalogPackages();
  return live.length ? live : [];
}

export function BookingsPage({ schedule, onSave, onDelete, onSaveMock, onDeleteMock, onAssign, onPayment, editRequest, onConsumeEdit }) {
  const [filterDate, setFilterDate] = useState("");
  const [query, setQuery] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [draft, setDraft] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [mockDraft, setMockDraft] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [error, setError] = useState("");
  const options = packageOptions();
  const names = ["", ...new Set(options.map((item) => item.name))];

  const dates = useMemo(() => {
    const stamps = new Set([
      ...schedule.bookings.map((booking) => booking.date),
      ...schedule.mocks.map((mock) => mock.date),
    ].filter(Boolean));
    return [...stamps].sort();
  }, [schedule]);

  function matches(item) {
    const haystack = `${item.name} ${item.whatsapp}`.toLowerCase();
    if (query && !haystack.includes(query.trim().toLowerCase())) return false;
    if (packageFilter && (item.packageName || item.packageId) !== packageFilter && item.packageId !== packageFilter) return false;
    return true;
  }

  const visibleDates = dates.filter((date) => !filterDate || date === filterDate);

  function openBooking(booking) {
    setError("");
    setOrigin(booking);
    setDraft({ ...booking });
  }

  useEffect(() => {
    if (!editRequest) return;
    openBooking(editRequest);
    onConsumeEdit?.();
  }, [editRequest]);

  return (
    <div className="v2-stack">
      <div className="v2-toolbar">
        <label>
          Tanggal
          <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
        </label>
        <button type="button" className="v2-btn v2-btn-line" onClick={() => setFilterDate("")}>Lihat semua</button>
        <button type="button" className="v2-btn v2-btn-line" onClick={() => { setError(""); setMockDraft({ name: "", whatsapp: "", packageId: options[0]?.id || "sekejap", location: "", notes: "", date: "", startTime: "", extraPhotos: 0 }); }}>
          Tambah mock customer
        </button>
      </div>
      <div className="v2-searchbar">
        <Icon name="search" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari berdasarkan nama, nomor WA..." />
        <div className="v2-chips">
          {names.map((name) => (
            <button key={name || "all"} type="button" className={packageFilter === name ? "is-on" : ""} onClick={() => setPackageFilter(name)}>
              {name || "Semua"}
            </button>
          ))}
        </div>
      </div>

      {visibleDates.length === 0 ? <p className="v2-empty">Tidak ada booking pada filter ini.</p> : null}
      {visibleDates.map((date) => {
        const dayBookings = schedule.bookings.filter((booking) => booking.date === date && matches(booking));
        const dayMocks = schedule.mocks.filter((mock) => mock.date === date && matches(mock));
        if (!dayBookings.length && !dayMocks.length && (query || packageFilter)) return null;
        return (
          <section className="v2-card" key={date}>
            <header className="v2-card-head">
              <h2>{formatLong(date).replace(/(\d+)/, (value) => value.padStart(2, "0"))}</h2>
              <span>{dayBookings.length} booking · {dayMocks.length} mock</span>
            </header>
            {dayBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                photographers={schedule.photographers}
                bookings={schedule.bookings}
                onEdit={() => openBooking(booking)}
                onDelete={() => setPendingDelete({ kind: "booking", item: booking })}
                onAssign={onAssign}
                onPayment={onPayment}
              />
            ))}
            {dayMocks.map((mock) => (
              <article className="v2-booking is-mock" key={mock.id}>
                <div className="v2-sheet">
                  <Field label="Mock booking" value={mock.id} />
                  <Field label="Nama" value={mock.name} />
                  <Field label="Add-on" value={`${Number(mock.extraPhotos) || 0} foto`} />
                  <Field label="Paket" value={mock.packageName || mock.packageId} />
                  <Field label="Nomor WA" value={<a href={whatsAppLink(mock.whatsapp)}>{mock.whatsapp}</a>} />
                  <Field label="Lokasi" value={mock.location || "—"} />
                  <Field label="Catatan" value={mock.notes || "—"} wide />
                  <Field label="Tanggal" value={formatLong(mock.date)} />
                </div>
                <div className="v2-card-actions">
                  <button type="button" className="v2-btn v2-btn-line" onClick={() => { setError(""); setMockDraft(mock); }}>Ubah</button>
                  <button type="button" className="v2-btn v2-btn-line" onClick={() => setPendingDelete({ kind: "mock", item: mock })}>Hapus</button>
                </div>
              </article>
            ))}
          </section>
        );
      })}

      {draft ? (
        <BookingEditor
          draft={draft}
          origin={origin}
          bookings={schedule.bookings}
          photographers={schedule.photographers}
          options={options}
          error={error}
          onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
          onClose={() => setDraft(null)}
          onReset={() => { setDraft({ ...origin }); setError(""); }}
          onSubmit={async () => {
            if (draft.name.trim().length < 3 || !isActiveWhatsApp(draft.whatsapp)) {
              setError("Nama minimal 3 karakter dan nomor WhatsApp harus valid.");
              return;
            }
            const ok = await onSave(draft);
            if (ok) setDraft(null);
          }}
        />
      ) : null}

      {mockDraft ? (
        <Modal
          title={mockDraft.id ? "Ubah mock customer" : "Mock customer baru"}
          onClose={() => setMockDraft(null)}
          footer={
            <>
              <button type="button" className="v2-btn v2-btn-line" onClick={() => setMockDraft(null)}>Batal</button>
              <button type="button" className="v2-btn v2-btn-forest" onClick={async () => {
                if (mockDraft.name.trim().length < 3 || !isActiveWhatsApp(mockDraft.whatsapp)) {
                  setError("Nama minimal 3 karakter dan nomor WhatsApp harus valid.");
                  return;
                }
                const ok = await onSaveMock(mockDraft);
                if (ok) setMockDraft(null);
              }}
              >
                Simpan
              </button>
            </>
          }
        >
          <div className="v2-form-grid">
            <label>Nama<input value={mockDraft.name} onChange={(event) => setMockDraft({ ...mockDraft, name: event.target.value })} /></label>
            <label>WhatsApp<input value={mockDraft.whatsapp} onChange={(event) => setMockDraft({ ...mockDraft, whatsapp: event.target.value })} /></label>
            <label>Tanggal<input type="date" value={mockDraft.date || ""} onChange={(event) => setMockDraft({ ...mockDraft, date: event.target.value })} /></label>
            <label>Jam mulai<input type="time" value={mockDraft.startTime || ""} onChange={(event) => setMockDraft({ ...mockDraft, startTime: event.target.value })} /></label>
            <label>
              Paket
              <select value={mockDraft.packageId} onChange={(event) => setMockDraft({ ...mockDraft, packageId: event.target.value })}>
                {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>Add-on foto<input type="number" min="0" value={Number(mockDraft.extraPhotos) || 0} onChange={(event) => setMockDraft({ ...mockDraft, extraPhotos: Number(event.target.value) || 0 })} /></label>
            <label className="is-wide">Lokasi<input value={mockDraft.location} onChange={(event) => setMockDraft({ ...mockDraft, location: event.target.value })} /></label>
            <label className="is-wide">Catatan<textarea rows={3} value={mockDraft.notes} onChange={(event) => setMockDraft({ ...mockDraft, notes: event.target.value })} /></label>
          </div>
          {error ? <p className="v2-error">{error}</p> : null}
        </Modal>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={pendingDelete.kind === "mock" ? "Hapus mock customer?" : "Hapus Booking?"}
          onClose={() => setPendingDelete(null)}
          onConfirm={async () => {
            const target = pendingDelete;
            setPendingDelete(null);
            if (target.kind === "mock") await onDeleteMock(target.item.id);
            else await onDelete(target.item.id);
          }}
        >
          Apakah kamu yakin ingin menghapus data {pendingDelete.kind === "mock" ? "mock" : "booking"} <strong>{pendingDelete.item.name}</strong>? Tindakan ini tidak dapat dibatalkan.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function Field({ label, value, wide = false }) {
  return (
    <div className={wide ? "v2-field is-wide" : "v2-field"}>
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function BookingCard({ booking, photographers, bookings, onEdit, onDelete, onAssign, onPayment }) {
  const taken = takenPhotographers(bookings, booking.date, booking.startTime, booking.endTime, booking.id);
  const mua = booking.packageId === "sempurna" || booking.includeMua ? booking : null;
  return (
    <article className="v2-booking">
      <div className="v2-sheet">
        <Field label="ID Booking" value={booking.id} />
        <Field label="Nama" value={booking.name} />
        <Field label="Add-on" value={`${Number(booking.extraPhotos) || 0} foto`} />
        <Field label="Paket" value={booking.packageName} />
        <Field label="Nomor WA" value={<a href={whatsAppLink(booking.whatsapp)} target="_blank" rel="noreferrer">{booking.whatsapp}</a>} />
        <Field label="Lokasi" value={booking.location} />
        <Field label="Catatan" value={booking.notes?.trim() || "—"} />
        <Field label="Jam mulai" value={booking.startTime} />
        <Field label="Tanggal" value={formatLong(booking.date)} />
        {mua ? (
          <div className="v2-mua">
            <strong>Detail MUA</strong>
            <p>Tanggal make up: {mua.makeupDate || "—"}</p>
            <p>Jam make up: {mua.makeupTime || "—"}</p>
            <p>Hijabdo/Hairdo: {mua.hairStyle || "—"}</p>
            <p>Alamat lengkap: {mua.muaAddress || "—"}</p>
            <p>Google Maps: {mua.muaMap || "—"}</p>
          </div>
        ) : null}
      </div>
      <div className="v2-card-actions">
        <label>
          Status bayar
          <select value={booking.paymentStatus === "pelunasan" ? "pelunasan" : "dp"} onChange={(event) => onPayment(booking, event.target.value)}>
            <option value="dp">DP</option>
            <option value="pelunasan">Pelunasan</option>
          </select>
        </label>
        <label>
          Fotografer
          <select value={booking.photographer || ""} onChange={(event) => onAssign(booking, event.target.value)}>
            <option value="">Belum ditugaskan</option>
            {photographers.map((item) => (
              <option key={item.id} value={item.id} disabled={taken.has(item.id)}>{item.name}</option>
            ))}
          </select>
        </label>
        <button type="button" className="v2-btn v2-btn-line" onClick={onEdit}>Ubah</button>
        <button type="button" className="v2-btn v2-btn-line" onClick={onDelete}>Hapus</button>
      </div>
    </article>
  );
}

function BookingEditor({ draft, bookings, photographers, options, error, onChange, onClose, onReset, onSubmit }) {
  const selected = options.find((item) => item.id === draft.packageId) || options[0];
  const end = draft.startTime && selected ? addMinutes(draft.startTime, packageMinutes(selected)) : "";
  const taken = draft.date && draft.startTime && end
    ? takenPhotographers(bookings, draft.date, draft.startTime, end, draft.id)
    : new Set();
  return (
    <Modal
      title="Ubah Data Booking"
      lead="Perbarui jadwal, paket, atau fotografer yang ditugaskan"
      aside={<span className="v2-id-pill">#{draft.id}</span>}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="v2-btn v2-btn-ghost" onClick={onReset}>Kembalikan Data Asli</button>
          <span className="v2-foot-gap" />
          <button type="button" className="v2-btn v2-btn-line" onClick={onClose}>Batal</button>
          <button type="button" className="v2-btn v2-btn-forest" onClick={onSubmit}>Simpan Perubahan</button>
        </>
      }
    >
      <div className="v2-form-grid">
        <label>
          Nama Lengkap Klien
          <input value={draft.name} onChange={(event) => onChange("name", event.target.value)} />
        </label>
        <label>
          Nomor WhatsApp
          <input value={draft.whatsapp} onChange={(event) => onChange("whatsapp", event.target.value)} />
        </label>
        <label>
          Pilihan Paket Wisuda
          <select value={draft.packageId} onChange={(event) => onChange("packageId", event.target.value)}>
            {options.map((item) => <option key={item.id} value={item.id}>{item.name} ({rupiah(item.price)})</option>)}
          </select>
        </label>
        <label>
          Lokasi Outdoor
          <input value={draft.location} onChange={(event) => onChange("location", event.target.value)} />
        </label>
        <label>
          Tanggal Sesi
          <input type="date" value={draft.date} onChange={(event) => onChange("date", event.target.value)} />
        </label>
        <label>
          Jam Mulai
          <input type="time" value={draft.startTime} onChange={(event) => onChange("startTime", event.target.value)} />
        </label>
        <label>
          Add-on Edit Foto
          <span className="v2-stepper">
            <button type="button" onClick={() => onChange("extraPhotos", Math.max(0, (Number(draft.extraPhotos) || 0) - 1))} aria-label="Kurangi">−</button>
            <b>{Number(draft.extraPhotos) || 0}</b>
            <button type="button" onClick={() => onChange("extraPhotos", (Number(draft.extraPhotos) || 0) + 1)} aria-label="Tambah">+</button>
          </span>
          <small>{rupiah(PHOTO_ADDON)} / foto</small>
        </label>
        <label>
          Status Pembayaran
          <select value={draft.paymentStatus || "dp"} onChange={(event) => onChange("paymentStatus", event.target.value)}>
            <option value="dp">DP (Uang Muka Diterima)</option>
            <option value="pelunasan">Pelunasan</option>
          </select>
        </label>
        <label>
          Fotografer yang Bertugas
          <select value={draft.photographer || ""} onChange={(event) => onChange("photographer", event.target.value)}>
            <option value="">Belum ditugaskan</option>
            {photographers.map((item) => (
              <option key={item.id} value={item.id} disabled={taken.has(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="is-wide">
          Catatan Khusus Klien
          <textarea rows={3} value={draft.notes || ""} onChange={(event) => onChange("notes", event.target.value)} />
        </label>
      </div>
      {error ? <p className="v2-error">{error}</p> : null}
    </Modal>
  );
}
