import { useState } from "react";

// Halaman akun klien (Masuk & Daftar). Baru tampilan + validasi di sisi klien:
// backend akun klien belum ada, jadi form belum mengirim data ke server.

const PENDING_NOTE =
  "Data sudah sesuai, tetapi layanan akun klien belum aktif. Untuk saat ini kamu tetap bisa booking langsung tanpa akun.";

function Icon({ name }) {
  const paths = {
    user: (
      <>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M4.5 20c.9-3.8 3.9-5.6 7.5-5.6s6.6 1.8 7.5 5.6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
        <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      </>
    ),
    chat: <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
    eye: (
      <>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
        <circle cx="12" cy="12" r="2.8" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.1 3.9M6.4 7.4A15.7 15.7 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4-.9" />
        <path d="M9.9 9.9a2.8 2.8 0 0 0 4.2 3.7" />
      </>
    ),
    arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
    back: <path d="M20 12H5M11 6l-6 6 6 6" />,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-icon">
      {paths[name]}
    </svg>
  );
}

function PasswordField({ label, value, onChange, placeholder, invalid, autoComplete, aside }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <div className="auth-label-row">
        <label htmlFor="auth-password">{label} <span aria-hidden="true">*</span></label>
        {aside}
      </div>
      <div className={invalid ? "auth-input is-invalid" : "auth-input"}>
        <Icon name="lock" />
        <input
          id="auth-password"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="auth-eye"
          aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      </div>
    </div>
  );
}

function AuthShell({ title, lead, children, footer }) {
  return (
    <main className="auth-page">
      <a className="auth-back" href="/">
        <Icon name="back" />
        Kembali ke Beranda
      </a>
      <section className="auth-card">
        <p className="auth-eyebrow">Seraye Moments</p>
        <h1>{title}</h1>
        <p className="auth-lead">{lead}</p>
        {children}
        <p className="auth-foot">{footer}</p>
      </section>
    </main>
  );
}

function normalizeWhatsApp(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return `62${digits}`;
}

const validWhatsApp = (value) => /^628\d{8,12}$/.test(normalizeWhatsApp(value));
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function LoginApp() {
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [note, setNote] = useState("");

  const identityOk = validEmail(identity) || validWhatsApp(identity);
  const passwordOk = password.length >= 8;

  function submit(event) {
    event.preventDefault();
    setAttempted(true);
    setNote(identityOk && passwordOk ? PENDING_NOTE : "");
  }

  return (
    <AuthShell
      title="Masuk Klien"
      lead="Masukkan nomor WhatsApp atau email dan kata sandi Anda untuk mengakses galeri foto."
      footer={
        <>
          Belum punya akun? <a href="/daftar">Daftar di sini →</a>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="auth-identity">Nomor WhatsApp atau Email <span aria-hidden="true">*</span></label>
          <div className={attempted && !identityOk ? "auth-input is-invalid" : "auth-input"}>
            <Icon name="user" />
            <input
              id="auth-identity"
              value={identity}
              onChange={(event) => setIdentity(event.target.value)}
              placeholder="Contoh: 081234567890 atau email@anda.com"
              autoComplete="username"
            />
          </div>
          {attempted && !identityOk ? <p className="auth-error">Masukkan nomor WhatsApp aktif atau email yang valid.</p> : null}
        </div>
        <PasswordField
          label="Kata Sandi"
          value={password}
          onChange={setPassword}
          placeholder="Masukkan kata sandi"
          invalid={attempted && !passwordOk}
          autoComplete="current-password"
          aside={
            <button type="button" className="auth-link" onClick={() => setNote("Pemulihan kata sandi belum tersedia. Hubungi admin lewat WhatsApp.")}>
              Lupa kata sandi?
            </button>
          }
        />
        {attempted && !passwordOk ? <p className="auth-error">Kata sandi minimal 8 karakter.</p> : null}
        <label className="auth-check">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          Ingat saya di perangkat ini
        </label>
        <button className="btn btn-forest auth-submit" type="submit">
          Masuk ke Akun
          <Icon name="arrow" />
        </button>
        <div className="auth-divider"><span>Atau masuk dengan</span></div>
        <div className="auth-social">
          <button type="button" onClick={() => setNote("Masuk dengan WhatsApp OTP belum tersedia.")}>
            <Icon name="chat" />
            WhatsApp OTP
          </button>
          <button type="button" onClick={() => setNote("Masuk dengan Google belum tersedia.")}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="auth-icon auth-google">
              <path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z" fill="#4285F4" />
              <path d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
              <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14z" fill="#FBBC05" />
              <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" fill="#EA4335" />
            </svg>
            Google
          </button>
        </div>
        {note ? <p className="auth-note" role="status">{note}</p> : null}
      </form>
    </AuthShell>
  );
}

export function RegisterApp() {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [note, setNote] = useState("");

  const nameOk = name.trim().length >= 3;
  const whatsappOk = validWhatsApp(whatsapp);
  const passwordOk = password.length >= 8;
  const ready = nameOk && whatsappOk && passwordOk && agree;

  function submit(event) {
    event.preventDefault();
    setAttempted(true);
    setNote(ready ? PENDING_NOTE : "");
  }

  return (
    <AuthShell
      title="Daftar Akun Klien"
      lead="Lengkapi data di bawah ini untuk mengakses galeri dan kurasi foto Anda."
      footer={
        <>
          Sudah punya akun? <a href="/masuk">Masuk di sini →</a>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="auth-name">Nama Lengkap <span aria-hidden="true">*</span></label>
          <div className={attempted && !nameOk ? "auth-input is-invalid" : "auth-input"}>
            <Icon name="user" />
            <input
              id="auth-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Annisa Larasati"
              autoComplete="name"
            />
          </div>
          {attempted && !nameOk ? <p className="auth-error">Nama lengkap minimal 3 karakter.</p> : null}
        </div>
        <div className="auth-field">
          <label htmlFor="auth-whatsapp">Nomor WhatsApp <span aria-hidden="true">*</span></label>
          <div className={attempted && !whatsappOk ? "auth-input is-invalid" : "auth-input"}>
            <Icon name="chat" />
            <span className="auth-prefix">+62</span>
            <input
              id="auth-whatsapp"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              placeholder="81234567890"
              inputMode="tel"
              autoComplete="tel-national"
            />
          </div>
          {attempted && !whatsappOk ? <p className="auth-error">Masukkan nomor WhatsApp aktif, contoh 81234567890.</p> : null}
        </div>
        <PasswordField
          label="Kata Sandi"
          value={password}
          onChange={setPassword}
          placeholder="Minimal 8 karakter"
          invalid={attempted && !passwordOk}
          autoComplete="new-password"
        />
        {attempted && !passwordOk ? <p className="auth-error">Kata sandi minimal 8 karakter.</p> : null}
        <label className="auth-check">
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
          <span>
            Saya menyetujui <a href="/#faq">Ketentuan Layanan</a> &amp; <a href="/#faq">Kebijakan Privasi</a>.
          </span>
        </label>
        {attempted && !agree ? <p className="auth-error">Centang persetujuan untuk melanjutkan.</p> : null}
        <button className="btn btn-forest auth-submit" type="submit">
          Daftar Akun
          <Icon name="arrow" />
        </button>
        {note ? <p className="auth-note" role="status">{note}</p> : null}
      </form>
    </AuthShell>
  );
}
