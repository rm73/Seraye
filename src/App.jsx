import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildBookingId,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  isActiveWhatsApp,
  rupiah,
  shiftStamp,
  todayStamp,
} from "./booking";
import { createClientBooking, loadAvailability } from "./api";
import { faqs, packages, portfolio, terms } from "./data";
import { addMinutes, normalizeTime, packageMinutes, slotStatus } from "./schedule";

const defaultPackageId = "sekejap";
const bookingFee = 100000;

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openPicker(event) {
  const input = event.currentTarget;
  if (typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    input.focus();
  }
}

function PackageCard({ item, active, onSelect, onBook }) {
  return (
    <article
      className={active ? "pkg-card is-selected" : "pkg-card"}
      onClick={onSelect}
    >
      {item.bestSeller ? <p className="ribbon">Best Seller</p> : null}
      <div className="pkg-body">
        <h3>{item.name}</h3>
        <p className="price">
          {rupiah(item.price)}
          <s>{rupiah(item.compareAt)}</s>
        </p>
        <ul>
          {item.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      <button
        className="btn btn-select"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onBook();
        }}
      >
        {active ? "Lanjut isi form" : "Pilih paket ini"}
      </button>
    </article>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [packageId, setPackageId] = useState(defaultPackageId);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState({ bookings: [], blocks: [] });
  const [scheduleReady, setScheduleReady] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const lightboxFrameRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  const selected = packages.find((item) => item.id === packageId) ?? packages[1];
  const earliestDate = shiftStamp(todayStamp(), 3);
  const photoPackages = packages.filter((item) => item.group === "photography");
  const videoPackages = packages.filter((item) => item.group === "videography");

  const missing = useMemo(() => {
    const items = [];
    if (name.trim().length < 3) items.push({ key: "name", label: "Nama lengkap" });
    if (!isActiveWhatsApp(whatsapp)) items.push({ key: "whatsapp", label: "Nomor WhatsApp" });
    if (!date || date < earliestDate) items.push({ key: "date", label: "Tanggal sesi (minimal 3 hari dari hari ini)" });
    if (!startTime) items.push({ key: "start", label: "Jam mulai pemotretan" });
    if (location.trim().length < 3) items.push({ key: "location", label: "Lokasi titik temu" });
    return items;
  }, [date, earliestDate, location, name, startTime, whatsapp]);

  const ready = missing.length === 0;
  const invalid = (key) => attempted && missing.some((item) => item.key === key);
  const bookingId = ready
    ? buildBookingId({ date, startTime, code: selected.code })
    : "";
  const message = ready
    ? buildWhatsAppMessage({ name, bookingId, location, notes })
    : "";
  const whatsAppHref = message ? buildWhatsAppUrl(message) : "";
  const sessionStart = normalizeTime(startTime);
  const sessionEnd = sessionStart ? addMinutes(sessionStart, packageMinutes(selected)) : "";
  const slot = date && sessionStart
    ? slotStatus({
        bookings: schedule.bookings,
        blocks: schedule.blocks,
        date,
        start: sessionStart,
        end: sessionEnd,
      })
    : { ok: true, message: "" };
  const canBook = ready && slot.ok && scheduleReady && !saving;
  const consultHref = buildWhatsAppUrl(
    "Halo Min, saya ingin konsultasi ketersediaan slot Seraye Moments.",
  );

  useEffect(() => {
    let ignore = false;
    function load() {
      loadAvailability()
        .then((data) => {
          if (ignore) return;
          setSchedule(data);
          setScheduleReady(true);
          setScheduleError("");
        })
        .catch(() => {
          if (ignore) return;
          setScheduleReady(false);
          setScheduleError("Jadwal belum bisa dicek. Muat ulang halaman.");
        });
    }
    load();
    window.addEventListener("focus", load);
    return () => {
      ignore = true;
      window.removeEventListener("focus", load);
    };
  }, [date, startTime, packageId]);

  useEffect(() => {
    if (!lightbox) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function close() {
      setLightbox(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }

    function onKey(event) {
      if (event.key === "Escape") close();
    }

    function onWheel(event) {
      event.preventDefault();
      const step = event.deltaY < 0 ? 0.18 : -0.18;
      setZoom((current) => {
        const next = Math.min(2.6, Math.max(1, Math.round((current + step) * 100) / 100));
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }

    window.addEventListener("keydown", onKey);
    const frame = lightboxFrameRef.current;
    frame?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      frame?.removeEventListener("wheel", onWheel);
    };
  }, [lightbox]);

  useEffect(() => {
    if (!lightbox) return;
    const frame = lightboxFrameRef.current;
    setPan((current) => {
      if (!frame || zoom <= 1) {
        if (current.x === 0 && current.y === 0) return current;
        return { x: 0, y: 0 };
      }
      const maxX = (frame.clientWidth * (zoom - 1)) / 2;
      const maxY = (frame.clientHeight * (zoom - 1)) / 2;
      const next = {
        x: Math.min(maxX, Math.max(-maxX, current.x)),
        y: Math.min(maxY, Math.max(-maxY, current.y)),
      };
      if (next.x === current.x && next.y === current.y) return current;
      return next;
    });
  }, [lightbox, zoom]);

  function clampPan(x, y, zoomLevel) {
    const frame = lightboxFrameRef.current;
    if (!frame || zoomLevel <= 1) return { x: 0, y: 0 };
    const maxX = (frame.clientWidth * (zoomLevel - 1)) / 2;
    const maxY = (frame.clientHeight * (zoomLevel - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function openLightbox(photo) {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLightbox(photo);
  }

  function closeLightbox() {
    setLightbox(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPanning(false);
  }

  function enlargeLightbox() {
    setZoom((current) => {
      if (current >= 2.4) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return Math.min(2.6, Math.round((current + 0.6) * 100) / 100);
    });
  }

  function onImagePointerDown(event) {
    if (event.button !== 0 || zoom <= 1) return;
    dragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
    setPanning(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Drag still follows the pointer while it stays over the photo.
    }
  }

  function onImagePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 3) drag.moved = true;
    setPan(clampPan(drag.originX + dx, drag.originY + dy, zoom));
  }

  function onImagePointerUp(event) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) suppressClickRef.current = true;
    dragRef.current = null;
    setPanning(false);
  }

  function onImageClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    enlargeLightbox();
  }

  function choosePackage(id) {
    setPackageId(id);
    setCopied(false);
  }

  function closeMenuAndGo(id) {
    setMenuOpen(false);
    scrollToId(id);
  }

  async function recordBooking(source) {
    setAttempted(true);
    if (!canBook) return false;
    setSaving(true);
    setScheduleError("");
    try {
      await createClientBooking({
        id: bookingId,
        name,
        whatsapp,
        date,
        startTime: sessionStart,
        packageId: selected.id,
        location,
        notes,
        source,
      });
      const data = await loadAvailability();
      setSchedule(data);
      return true;
    } catch (reason) {
      setScheduleError(reason.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function continueWhatsApp() {
    const saved = await recordBooking("whatsapp");
    if (!saved) return;
    window.open(whatsAppHref, "_blank", "noopener");
  }

  async function copyMessage() {
    const saved = await recordBooking("copy");
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
      setScheduleError("Booking tersimpan, tetapi pesan gagal disalin.");
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#paket" onClick={() => setMenuOpen(false)}>
            <img src="/assets/logo.png" alt="" />
            <span>Seraye Moments</span>
          </a>
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
          <nav className={menuOpen ? "open" : ""}>
            <button type="button" onClick={() => closeMenuAndGo("portofolio")}>
              Portofolio
            </button>
            <button type="button" onClick={() => closeMenuAndGo("paket")}>
              Katalog
            </button>
            <button className="btn btn-forest" type="button" onClick={() => closeMenuAndGo("booking")}>
              Booking
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section className="catalog" id="paket">
          <div className="catalog-block">
            <div className="catalog-title">
              <h2>Katalog Pricelist Photography</h2>
            </div>
            <div className="catalog-grid photo">
              {photoPackages.map((item) => (
                <PackageCard
                  key={item.id}
                  item={item}
                  active={item.id === selected.id}
                  onSelect={() => choosePackage(item.id)}
                  onBook={() => {
                    choosePackage(item.id);
                    scrollToId("booking");
                  }}
                />
              ))}
            </div>
          </div>

          <div className="catalog-block">
            <div className="catalog-title">
              <h2>Katalog Pricelist Videography</h2>
            </div>
            <div className="catalog-grid video">
              {videoPackages.map((item) => (
                <PackageCard
                  key={item.id}
                  item={item}
                  active={item.id === selected.id}
                  onSelect={() => choosePackage(item.id)}
                  onBook={() => {
                    choosePackage(item.id);
                    scrollToId("booking");
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="booking" id="booking">
          <div className="booking-intro">
            <h2>Form Booking</h2>
            <p>Isi data di bawah ini. Tombol WhatsApp ada di samping dan aktif setelah data lengkap.</p>
          </div>
          <div className="booking-grid">
            <form
              className={attempted && !ready ? "form-card is-invalid" : "form-card"}
              onSubmit={(event) => {
                event.preventDefault();
                if (!ready) setAttempted(true);
              }}
            >
              <div className="field-row">
                <label>
                  Nama Lengkap
                  <input
                    className={invalid("name") ? "invalid" : ""}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setCopied(false);
                    }}
                    autoComplete="name"
                    placeholder="nama client"
                  />
                </label>
                <label>
                  Nomor WhatsApp
                  <input
                    className={invalid("whatsapp") ? "invalid" : ""}
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0812xxxxxxxx"
                  />
                </label>
              </div>
              <label>
                Paket pilihan
                <select
                  value={selected.id}
                  onChange={(event) => choosePackage(event.target.value)}
                >
                  <optgroup label="Photography">
                    {photoPackages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({rupiah(item.price)})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Videography">
                    {videoPackages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({rupiah(item.price)})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <div className="explain">
                <strong>
                  {selected.name} · {selected.groupLabel}
                </strong>
                <ul>
                  {selected.points.map((point) => (
                    <li key={`form-${point}`}>{point}</li>
                  ))}
                </ul>
              </div>
              <div className="field-row">
                <label>
                  Tanggal sesi
                  <input
                    className={invalid("date") ? "picker invalid" : "picker"}
                    type="date"
                    value={date}
                    min={earliestDate}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setCopied(false);
                    }}
                    onClick={openPicker}
                    onMouseEnter={openPicker}
                  />
                  <span className="hint">Tanggal paling dekat adalah 3 hari dari hari ini.</span>
                </label>
                <label>
                  Jam mulai pemotretan
                  <input
                    className={invalid("start") || (date && sessionStart && !slot.ok) ? "picker invalid" : "picker"}
                    type="time"
                    value={startTime}
                    onChange={(event) => {
                      setStartTime(event.target.value);
                      setCopied(false);
                    }}
                    onClick={openPicker}
                    onMouseEnter={openPicker}
                  />
                  {date && sessionStart && slot.message ? (
                    <span className={slot.ok ? "hint" : "hint hint-alert"}>{slot.message}</span>
                  ) : null}
                  {date && sessionStart && slot.ok ? (
                    <span className="hint">Sesi {sessionStart}–{sessionEnd}</span>
                  ) : null}
                </label>
              </div>
              <label>
                Lokasi titik temu
                <input
                  className={invalid("location") ? "invalid" : ""}
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value);
                    setCopied(false);
                  }}
                  placeholder="jl. telekomunikasi no 1 atau Area kampus universitas outdoor"
                  spellCheck={false}
                />
              </label>
              <label>
                Catatan tambahan (opsional)
                <textarea
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setCopied(false);
                  }}
                  rows={4}
                  placeholder="Tuliskan permintaan khusus, jika ada."
                />
              </label>
            </form>

            <aside className={attempted && !ready ? "summary is-invalid" : "summary"}>
              <div className="summary-top">
                <div>
                  <p className="eyebrow">Ringkasan sesi</p>
                  <h3>{selected.name}</h3>
                  <p className="summary-kind">{selected.groupLabel}</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Total harga paket</dt>
                  <dd>{rupiah(selected.price)}</dd>
                </div>
                <div>
                  <dt>DP</dt>
                  <dd>{rupiah(bookingFee)}</dd>
                </div>
                <div>
                  <dt>Pelunasan H-1</dt>
                  <dd>{rupiah(selected.price - bookingFee)}</dd>
                </div>
              </dl>
              <div className="guarantee">
                <p>Pengiriman hasil</p>
                <ul>
                  <li>H+3: 5 Foto Highlight + Raw.</li>
                  <li>H+7: Sisa editan + bonus.</li>
                </ul>
              </div>

              {canBook ? (
                <button id="wa-link" className="btn btn-block" type="button" onClick={continueWhatsApp}>
                  Lanjutkan Booking via WhatsApp
                </button>
              ) : (
                <button
                  className={attempted ? "btn btn-block is-muted is-alert" : "btn btn-block is-muted"}
                  type="button"
                  onClick={() => setAttempted(true)}
                  disabled={ready && !slot.ok}
                >
                  Lanjutkan Booking via WhatsApp
                </button>
              )}

              {scheduleError ? (
                <div className="missing">
                  <p>{scheduleError}</p>
                </div>
              ) : null}

              {ready && !slot.ok ? (
                <div className="missing">
                  <p>{slot.message}</p>
                </div>
              ) : null}

              {attempted && !ready ? (
                <div className="missing">
                  <p>Mohon lengkapi bagian berikut:</p>
                  <ul>
                    {missing.map((item) => (
                      <li key={item.key}>{item.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {canBook ? (
                <div className="wa-box">
                  <p className="booking-id">
                    ID Pemesanan
                    <strong>{bookingId}</strong>
                  </p>
                  <button className="btn btn-block btn-copy" type="button" onClick={copyMessage}>
                    {copied ? "Pesan tersalin" : "Salin pesan"}
                  </button>
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="portfolio" id="portofolio">
          <div className="section-head">
            <h2>Portofolio</h2>
          </div>
          <div className="folio-grid">
            {portfolio.map((photo) => (
              <button type="button" key={photo.src} onClick={() => openLightbox(photo)}>
                <img src={photo.src} alt={photo.alt} />
              </button>
            ))}
          </div>
        </section>

        <section className="faq" id="faq">
          <div className="terms">
            <h2>Terms and Condition</h2>
            <ul>
              {terms.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              Kami percaya setiap momen patut dirayakan. Untuk itu, “Seraye Moments” akan turut
              membagikan keindahan momen Anda (hasil foto/video sesi) sebagai portofolio dan materi
              promosi kami.
            </p>
            <p>Dengan membayar DP, klien dianggap telah membaca dan menyetujui S&K lengkap kami.</p>
          </div>
          <div className="faq-head">
            <h2>Pertanyaan yang Sering Diajukan</h2>
          </div>
          <div className="faq-grid">
            {faqs.map((item) => (
              <article key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
          <div className="consult">
            <div>
              <div>
                <h3>Masih ada yang ingin ditanyakan?</h3>
                <p>Tanya ketersediaan jadwal atau permintaan khusus lewat WhatsApp.</p>
              </div>
            </div>
            <a className="btn btn-white" href={consultHref} target="_blank" rel="noreferrer">
              Konsultasi via WhatsApp
            </a>
          </div>
        </section>
      </main>

      {lightbox ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
          onClick={closeLightbox}
        >
          <div className="lightbox-frame" ref={lightboxFrameRef} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="lightbox-close" onClick={closeLightbox}>
              <span aria-hidden="true">×</span>
              Tutup
            </button>
            <img
              src={lightbox.src}
              alt={lightbox.alt}
              draggable={false}
              className={zoom > 1 ? (panning ? "is-zoomed is-panning" : "is-zoomed") : undefined}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              onPointerDown={onImagePointerDown}
              onPointerMove={onImagePointerMove}
              onPointerUp={onImagePointerUp}
              onPointerCancel={onImagePointerUp}
              onClick={onImageClick}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
