import { useState } from "react";

// Halaman akun klien. Backend akun belum ada.
// Konfirmasi admin untuk ganti kata sandi disimpan untuk development berikutnya:
// form ini hanya meminta kata sandi baru, lalu menyuruh klien menghubungi admin.

const logoSrc = "/assets/logo%20seraye%20moments%20-%20Gold%20(1).png";
const PENDING_NOTE =
  "Data sudah sesuai, tetapi layanan akun klien belum aktif. Untuk saat ini kamu tetap bisa booking langsung tanpa akun.";
const RESET_NOTE =
  "Kata sandi baru sudah diisi. Hubungi admin untuk konfirmasi penggantian kata sandi.";

function Asset({ name, width, height }) {
  return <img src={`/assets/auth/${name}.svg`} alt="" width={width} height={height} />;
}

function PasswordField({ id, label, value, onChange, placeholder, invalid, autoComplete, aside, starClass }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <div className="auth-label-row">
        <label htmlFor={id}>
          {label} <span className={starClass} aria-hidden="true">*</span>
        </label>
        {aside}
      </div>
      <div className={invalid ? "auth-input is-invalid" : "auth-input"}>
        <Asset name="lock" width="13.3333" height="17.5" />
        <input
          id={id}
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
          <Asset name="eye" width="18.3333" height="12.5" />
        </button>
      </div>
    </div>
  );
}

function AuthShell({ title, lead, titleClass, children, footer }) {
  return (
    <main className="auth-page">
      <a className="auth-back" href="/">
        <Asset name="back" width="12" height="12" />
        Kembali ke Beranda
      </a>
      <section className="auth-card">
        <div className="auth-head">
          <img className="auth-logo" src={logoSrc} alt="Seraye Moments" />
          <h1 className={titleClass}>{title}</h1>
          {lead ? <p className="auth-lead">{lead}</p> : null}
        </div>
        {children}
        <div className="auth-foot">{footer}</div>
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
      titleClass="is-login"
      lead="Masukkan nomor WhatsApp atau email dan kata sandi Anda untuk mengakses galeri foto."
      footer={
        <>
          Belum punya akun? <a href="/daftar">Daftar di sini <Asset name="arrow-gold" width="9.33333" height="9.33333" /></a>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="auth-identity">
            Nomor WhatsApp atau Email <span className="is-alert" aria-hidden="true">*</span>
          </label>
          <div className={attempted && !identityOk ? "auth-input is-invalid" : "auth-input"}>
            <Asset name="user" width="16.6667" height="16.6667" />
            <input
              id="auth-identity"
              value={identity}
              onChange={(event) => setIdentity(event.target.value)}
              placeholder="Contoh: 081234567890 atau anda@email.com"
              autoComplete="username"
            />
          </div>
          {attempted && !identityOk ? <p className="auth-error">Masukkan nomor WhatsApp aktif atau email yang valid.</p> : null}
        </div>
        <PasswordField
          id="auth-password"
          label="Kata Sandi"
          value={password}
          onChange={setPassword}
          placeholder="Masukkan kata sandi"
          invalid={attempted && !passwordOk}
          autoComplete="current-password"
          starClass="is-alert"
          aside={<a className="auth-forgot" href="/ganti-sandi">Lupa kata sandi?</a>}
        />
        {attempted && !passwordOk ? <p className="auth-error">Kata sandi minimal 8 karakter.</p> : null}
        <label className="auth-check">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          Ingat saya di perangkat ini
        </label>
        <button className="auth-submit" type="submit">
          Masuk ke Akun
          <Asset name="arrow" width="12" height="12" />
        </button>
        {note ? <p className="auth-note" role="status">{note}</p> : null}
      </form>
    </AuthShell>
  );
}

export function RegisterApp() {
  const [note, setNote] = useState("");

  function submit(event) {
    event.preventDefault();
    setNote(PENDING_NOTE);
  }

  return (
    <AuthShell
      title="Daftar Akun"
      footer={
        <>
          Sudah punya akun? <a className="is-dark" href="/masuk">Masuk di sini <Asset name="arrow-dark" width="8" height="8" /></a>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit}>
        <button className="auth-submit is-register" type="submit">
          Daftar Akun
          <Asset name="arrow-light" width="12" height="12" />
        </button>
        {note ? <p className="auth-note" role="status">{note}</p> : null}
      </form>
    </AuthShell>
  );
}

export function ResetPasswordApp() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [note, setNote] = useState("");

  const passwordOk = password.length >= 8;
  const confirmOk = confirm.length > 0 && confirm === password;

  function submit(event) {
    event.preventDefault();
    setAttempted(true);
    setNote(passwordOk && confirmOk ? RESET_NOTE : "");
  }

  return (
    <AuthShell
      title="Ganti Kata Sandi"
      titleClass="is-login"
      footer={
        <>
          Ingat kata sandi? <a href="/masuk">Masuk di sini <Asset name="arrow-gold" width="9.33333" height="9.33333" /></a>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <PasswordField
          id="auth-new-password"
          label="Kata Sandi Baru"
          value={password}
          onChange={setPassword}
          placeholder="Minimal 8 karakter"
          invalid={attempted && !passwordOk}
          autoComplete="new-password"
        />
        {attempted && !passwordOk ? <p className="auth-error">Kata sandi minimal 8 karakter.</p> : null}
        <PasswordField
          id="auth-confirm-password"
          label="Ulangi Kata Sandi"
          value={confirm}
          onChange={setConfirm}
          placeholder="Tulis ulang kata sandi"
          invalid={attempted && !confirmOk}
          autoComplete="new-password"
        />
        {attempted && passwordOk && !confirmOk ? <p className="auth-error">Kata sandi tidak sama.</p> : null}
        <button className="auth-submit" type="submit">
          Simpan kata sandi
          <Asset name="arrow" width="12" height="12" />
        </button>
        {note ? <p className="auth-note" role="status">{note}</p> : null}
      </form>
    </AuthShell>
  );
}
