import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildBookingId,
  isGoogleMapsLink,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  isActiveWhatsApp,
  rupiah,
  shiftStamp,
  todayStamp,
} from "./booking";
import { createClientBooking, loadAvailability } from "./api";
import { faqGroups, MUA_DP, packages, PHOTO_ADDON, STANDARD_DP, terms } from "./data";
import { prewisudaPortfolio, wisudaPortfolio } from "./portfolio";
import { addMinutes, normalizeTime, packageMinutes, slotStatus } from "./schedule";
import { SERAYE_WHATSAPP } from "./config";

const defaultPackageId = "sekejap";
const logoSrc = "/assets/logo%20seraye%20moments%20-%20Gold%20(1).png";
const heroSlides = [
  "/assets/opt/wisuda/DSC01584.webp",
  "/assets/opt/wisuda/DSC01480.webp",
  "/assets/opt/prewisuda/DSC02997.webp",
  "/assets/opt/wisuda/10-DSC00836.webp",
  "/assets/opt/prewisuda/DSC03053.webp",
  "/assets/opt/wisuda/DSC00942.webp",
];

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

function PackageCard({ item, active, onSelect, onBook, quiet = false }) {
  const classes = ["pkg-card", active ? "is-selected" : "", item.highlight ? "is-highlight" : ""].filter(Boolean).join(" ");
  const points = item.cardPoints ?? item.points;
  return (
    <article className={classes} onClick={quiet ? undefined : onSelect}>
      {item.bestSeller ? <p className="ribbon">Best Seller</p> : null}
      {item.specialOffer ? <p className="ribbon is-special">Special Offer</p> : null}
      {item.image ? <img className="pkg-photo" src={item.image} alt="" loading="lazy" decoding="async" /> : null}
      {item.id === "sempurna" ? <img className="anadevi-mark" src="/assets/opt/cards/circle%20anadevi.webp" alt="Anadevi" loading="lazy" decoding="async" /> : null}
      <div className="pkg-body">
        <h3>{item.name}</h3>
        {item.id === "sempurna" ? (
          <p className="price">Hanya dengan {rupiah(item.price)}</p>
        ) : (
          <p className="price">
            {rupiah(item.price)}
            <s>{rupiah(item.compareAt)}</s>
          </p>
        )}
        <ul>
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      {quiet ? null : (
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
      )}
    </article>
  );
}

function Hero({ onCatalog }) {
  const [index, setIndex] = useState(0);
  const [sliding, setSliding] = useState(true);
  const slides = [...heroSlides, heroSlides[0]];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || heroSlides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setSliding(true);
      setIndex((current) => current + 1);
    }, 4800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (index < heroSlides.length) return undefined;
    const timer = window.setTimeout(() => {
      setSliding(false);
      setIndex(0);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setSliding(true));
      });
    }, 760);
    return () => window.clearTimeout(timer);
  }, [index]);

  function step(direction) {
    setSliding(true);
    setIndex((current) => {
      const count = heroSlides.length;
      const live = current >= count ? 0 : current;
      if (direction > 0) return live + 1;
      return (live - 1 + count) % count;
    });
  }

  const liveIndex = index % heroSlides.length;

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Seraye Moments">
      <div className="hero-frame">
        <div
          className={sliding ? "hero-track is-sliding" : "hero-track"}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((src, slideIndex) => (
            <img
              key={`${src}-${slideIndex}`}
              src={src}
              alt=""
              className="hero-slide"
              loading={slideIndex === 0 ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={slideIndex === 0 ? "high" : "low"}
            />
          ))}
        </div>
        <div className="hero-shade" />
        <button className="hero-nav hero-nav-prev" type="button" aria-label="Foto sebelumnya" onClick={() => step(-1)}>
          <img src="/assets/arrow-down-svgrepo-com.svg" alt="" />
        </button>
        <button className="hero-nav hero-nav-next" type="button" aria-label="Foto berikutnya" onClick={() => step(1)}>
          <img src="/assets/arrow-down-svgrepo-com.svg" alt="" />
        </button>
        <div className="hero-copy">
          <p className="hero-hello">
            Hello,
            <br />
            We Are Seraye Moments
          </p>
          <p className="hero-lead">Abadikan setiap momen terbaikmu dengan cara yang terbaik</p>
          <p className="hero-cta"><strong>Karena setiap momen patut dirayakan</strong></p>
          <div className="hero-actions">
            <button className="btn btn-forest" type="button" onClick={onCatalog}>
              Lihat katalog
            </button>
            <button className="btn btn-pricelist" type="button" onClick={onCatalog}>
              Cek pricelist
            </button>
          </div>
          <div className="hero-dots">
            {heroSlides.map((src, slideIndex) => (
              <button
                key={src}
                type="button"
                className={slideIndex === liveIndex ? "is-active" : ""}
                aria-label={`Foto ${slideIndex + 1}`}
                aria-current={slideIndex === liveIndex ? "true" : undefined}
                onClick={() => {
                  setSliding(true);
                  setIndex(slideIndex);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
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
  const [extraPhotos, setExtraPhotos] = useState(0);
  const [muaPrompt, setMuaPrompt] = useState(false);
  const [makeupDate, setMakeupDate] = useState("");
  const [makeupTime, setMakeupTime] = useState("");
  const [hairStyle, setHairStyle] = useState("");
  const [muaAddress, setMuaAddress] = useState("");
  const [muaMap, setMuaMap] = useState("");
  const [openFaqs, setOpenFaqs] = useState(() => new Set());
  const [showTop, setShowTop] = useState(false);
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
  const sempurna = photoPackages.find((item) => item.id === "sempurna");
  const needsMuaFields = Boolean(selected.includesMua);
  const photoFee = extraPhotos * PHOTO_ADDON;
  const totalPrice = selected.price + photoFee;
  const bookingFee = needsMuaFields ? MUA_DP : STANDARD_DP;
  const balance = Math.max(totalPrice - bookingFee, 0);
  const today = todayStamp();
  const makeupMin = date ? (shiftStamp(date, -3) > today ? shiftStamp(date, -3) : today) : today;

  const missing = useMemo(() => {
    const items = [];
    if (name.trim().length < 3) items.push({ key: "name", label: "Nama lengkap" });
    if (!isActiveWhatsApp(whatsapp)) items.push({ key: "whatsapp", label: "Nomor WhatsApp" });
    if (!date || date < earliestDate) items.push({ key: "date", label: "Tanggal sesi (minimal 3 hari dari hari ini)" });
    if (!startTime) items.push({ key: "start", label: "Jam mulai pemotretan" });
    if (needsMuaFields) {
      const makeupLate = Boolean(date) && makeupDate > date;
      const makeupEarly = makeupDate && makeupDate < makeupMin;
      if (!makeupDate || makeupEarly || makeupLate) {
        items.push({ key: "makeupDate", label: "Tanggal make up" });
      }
      if (!makeupTime) items.push({ key: "makeupTime", label: "Jam make up" });
      if (!hairStyle) items.push({ key: "hairStyle", label: "Hijabdo atau Hairdo" });
      if (muaAddress.trim().length < 8) items.push({ key: "muaAddress", label: "Alamat lengkap untuk MUA" });
      if (!isGoogleMapsLink(muaMap)) items.push({ key: "muaMap", label: "Google Maps (tautan https://maps.app.goo.gl/ atau google.com/maps)" });
    }
    return items;
  }, [date, earliestDate, hairStyle, makeupDate, makeupMin, makeupTime, muaAddress, muaMap, name, needsMuaFields, startTime, whatsapp]);

  const ready = missing.length === 0;
  const invalid = (key) => attempted && missing.some((item) => item.key === key);
  const bookingId = ready
    ? buildBookingId({ date, startTime, code: selected.code })
    : "";
  const message = ready
    ? buildWhatsAppMessage({
        name,
        bookingId,
        location,
        notes,
        packageName: selected.name,
        includeMua: needsMuaFields,
        extraPhotos: photoFee ? extraPhotos : 0,
        extraPhotoFee: photoFee,
        makeupDate: needsMuaFields ? makeupDate : "",
        makeupTime: needsMuaFields ? makeupTime : "",
        hairStyle: needsMuaFields ? hairStyle : "",
        muaAddress: needsMuaFields ? muaAddress : "",
        muaMap: needsMuaFields ? muaMap : "",
        total: totalPrice,
        dp: bookingFee,
      })
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
    if (id === "sekejap") setMuaPrompt(true);
  }

  function toggleFaq(question) {
    setOpenFaqs((current) => {
      const next = new Set(current);
      if (next.has(question)) next.delete(question);
      else next.add(question);
      return next;
    });
  }

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 480);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        extraPhotos: photoFee ? extraPhotos : 0,
        includeMua: needsMuaFields,
        makeupDate: needsMuaFields ? makeupDate : "",
        makeupTime: needsMuaFields ? makeupTime : "",
        hairStyle: needsMuaFields ? hairStyle : "",
        muaAddress: needsMuaFields ? muaAddress : "",
        muaMap: needsMuaFields ? muaMap : "",
        totalPrice,
        bookingFee,
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
            <img src={logoSrc} alt="Seraye Moments" />
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
            <a href="/feedback">Penilaian</a>
            <button className="btn btn-forest" type="button" onClick={() => closeMenuAndGo("booking")}>
              Booking
            </button>
          </nav>
        </div>
      </header>

      <main>
        <Hero onCatalog={() => scrollToId("paket")} />
        <section className="catalog" id="paket">
          <div className="catalog-block">
            <div className="catalog-title">
              <h2>Katalog Semarak</h2>
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
              <h2>Katalog Selangkah</h2>
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
                  <optgroup label="Katalog Semarak">
                    {photoPackages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({rupiah(item.price)})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Katalog Selangkah">
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
                  {needsMuaFields ? " · include Paket MUA" : ""}
                </strong>
                <ul>
                  {selected.points.map((point) => (
                    <li key={`form-${point}`}>{point}</li>
                  ))}
                </ul>
              </div>
              <div className="addon">
                <div>
                  <strong>Add-on edit foto</strong>
                  <p>{rupiah(PHOTO_ADDON)}/foto. Opsional, bisa ditambah atau dikurangi.</p>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => setExtraPhotos((count) => Math.max(0, count - 1))} aria-label="Kurangi foto">
                    −
                  </button>
                  <span>{extraPhotos}</span>
                  <button type="button" onClick={() => setExtraPhotos((count) => count + 1)} aria-label="Tambah foto">
                    +
                  </button>
                </div>
              </div>
              {needsMuaFields ? (
                <fieldset className="mua-fields">
                  <legend>Detail MUA</legend>
                  <div className="field-row">
                    <label>
                      Tanggal make up
                      <input
                        className={invalid("makeupDate") ? "picker invalid" : "picker"}
                        type="date"
                        value={makeupDate}
                        min={makeupMin}
                        max={date || undefined}
                        onChange={(event) => setMakeupDate(event.target.value)}
                        onClick={openPicker}
                      />
                    </label>
                    <label>
                      Jam make up
                      <input
                        className={invalid("makeupTime") ? "picker invalid" : "picker"}
                        type="time"
                        value={makeupTime}
                        onChange={(event) => setMakeupTime(event.target.value)}
                        onClick={openPicker}
                      />
                    </label>
                  </div>
                  <p className="hint">Pilih salah satu.</p>
                  <div className="choice-row">
                    {["Hijabdo", "Hairdo"].map((option) => (
                      <label key={option} className={hairStyle === option ? "choice is-on" : "choice"}>
                        <input
                          type="radio"
                          name="hairStyle"
                          value={option}
                          checked={hairStyle === option}
                          onChange={() => setHairStyle(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  <label>
                    Alamat lengkap
                    <textarea
                      className={invalid("muaAddress") ? "invalid" : ""}
                      value={muaAddress}
                      onChange={(event) => setMuaAddress(event.target.value)}
                      rows={3}
                      placeholder="Alamat lengkap supaya MUA tahu titik penjemputan"
                    />
                  </label>
                  <label>
                    Google Maps
                    <textarea
                      className={invalid("muaMap") ? "invalid" : ""}
                      value={muaMap}
                      onChange={(event) => setMuaMap(event.target.value)}
                      rows={2}
                      placeholder="https://maps.app.goo.gl/…"
                    />
                  </label>
                  <p className="hint">DP minimum {rupiah(MUA_DP)} karena paket langsung mengunci fotografer dan MUA. Jika ada kendala dalam pembokingan bisa menghubungi admin.</p>
                </fieldset>
              ) : null}
              <div className="field-row">
                <label>
                  Tanggal sesi
                  <input
                    className={invalid("date") ? "picker invalid" : "picker"}
                    type="date"
                    value={date}
                    min={earliestDate}
                    onChange={(event) => {
                      const next = event.target.value;
                      setDate(next);
                      setCopied(false);
                      if (makeupDate && next) {
                        const min = shiftStamp(next, -3) > todayStamp() ? shiftStamp(next, -3) : todayStamp();
                        if (makeupDate < min || makeupDate > next) setMakeupDate("");
                      }
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
                  {date && sessionStart && slot.message && !slot.ok ? (
                    <span className="hint hint-alert">{slot.message}</span>
                  ) : null}
                  {date && sessionStart && slot.ok ? (
                    <span className="hint">Sesi {sessionStart}–{sessionEnd}</span>
                  ) : null}
                </label>
              </div>
              <label>
                Lokasi titik temu (opsional)
                <input
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
                  <dt>Harga paket</dt>
                  <dd>{rupiah(selected.price)}</dd>
                </div>
                {photoFee ? (
                  <div>
                    <dt>Add-on edit foto ({extraPhotos})</dt>
                    <dd>{rupiah(photoFee)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Total harga paket</dt>
                  <dd>{rupiah(totalPrice)}</dd>
                </div>
                <div>
                  <dt>{needsMuaFields ? "DP min." : "DP"}</dt>
                  <dd>{rupiah(bookingFee)}</dd>
                </div>
                <div>
                  <dt>Pelunasan H-1</dt>
                  <dd>{rupiah(balance)}</dd>
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
          {[
            { title: "Katalog Wisuda", photos: wisudaPortfolio, open: true },
            { title: "Katalog Pre-wisuda", photos: prewisudaPortfolio, open: false },
          ].map((group) => (
            <details key={group.title} className="folio-drop" defaultOpen={group.open}>
              <summary>
                {group.title}
                <img src="/assets/arrow-down-svgrepo-com.svg" alt="" />
              </summary>
              <div className="folio-masonry">
                {group.photos.map((photo) => (
                  <button type="button" key={photo.src} onClick={() => openLightbox({ ...photo, src: photo.full || photo.src })}>
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      width={photo.width}
                      height={photo.height}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            </details>
          ))}
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
          <div className="faq-groups">
            {faqGroups.map((group) => (
              <section key={group.title}>
                <h3>{group.title}</h3>
                {group.items.map((item) => {
                  const open = openFaqs.has(item.question);
                  return (
                    <article key={item.question} className={open ? "is-open" : ""}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggleFaq(item.question)}
                      >
                        {item.question}
                        <img className="faq-arrow" src="/assets/arrow-down-svgrepo-com.svg" alt="" />
                      </button>
                      <div className="faq-panel">
                        <div>
                          <p>{item.answer}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
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

      {muaPrompt && sempurna ? (
        <div className="popup" role="dialog" aria-modal="true" aria-label="Tambah Paket MUA">
          <div className="popup-card">
            <div className="popup-head">
              <h2>Tambah Paket MUA?</h2>
              <button className="popup-close" type="button" aria-label="Tutup" onClick={() => setMuaPrompt(false)}>
                ×
              </button>
            </div>
            <PackageCard item={sempurna} quiet onSelect={() => {}} onBook={() => {}} />
            <div className="popup-actions">
              <button
                className="btn btn-forest"
                type="button"
                onClick={() => {
                  setPackageId("sempurna");
                  setMuaPrompt(false);
                }}
              >
                Tambahkan
              </button>
              <button className="btn btn-decline" type="button" onClick={() => setMuaPrompt(false)}>
                Tidak sekarang
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="float-stack">
        {showTop ? (
          <button className="float-btn float-top" type="button" aria-label="Ke atas" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img src="/assets/arrow-down-svgrepo-com.svg" alt="" />
          </button>
        ) : null}
        <button className="float-btn float-book" type="button" onClick={() => scrollToId("booking")}>
          <img src="/assets/form-svgrepo-com.svg" alt="" />
          Book now
        </button>
        <a className="float-btn float-wa" href={`https://wa.me/${SERAYE_WHATSAPP}`} target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3zm4.8 12.6c-.2.6-1.2 1.1-1.7 1.1-.4 0-.9.2-3.1-.7-2.6-1-4.2-3.6-4.3-3.8-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.6.8 2 .8 2.1.1.1 0 .3-.1.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.6-.7c.2-.2.3-.2.6-.1.2.1 1.6.8 1.9.9.3.1.4.2.5.3.1.3 0 .8-.2 1.2z" />
          </svg>
          Chat admin
        </a>
      </div>

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
