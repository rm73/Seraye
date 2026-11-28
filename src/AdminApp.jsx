import { useEffect, useRef, useState } from "react";
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
  saveProgress,
  saveServerAccounts,
  setAdminToken,
} from "./api";
import { readFeedback } from "./feedback";
import { normalizePhotographers } from "./schedule";
import { BookingsPage } from "./admin/bookings";
import { CatalogPage, CurationPage, FaqPage, NewsPage, PortfolioPage, UsersPage } from "./admin/content";
import { DashboardPage } from "./admin/dashboard";
import { OrdersPage } from "./admin/orders";
import { markAdminOnline, readAccounts, saveAccounts } from "./admin/store";
import { Icon } from "./admin/ui";

const NAV = [
  ["dashboard", "Dashboard & Jadwal", "calendar"],
  ["bookings", "Booking List", "list"],
  ["orders", "Track Order", "truck"],
  ["users", "Kelola Akun Pengguna", "users"],
  ["catalog", "Kelola Katalog", "camera"],
  ["portfolio", "Kelola Portofolio", "image"],
  ["faq", "Kelola FAQ", "help"],
  ["curation", "Kurasi & Revisi Klien", "check"],
  ["news", "Kelola Berita / Artikel", "news"],
];

const TITLES = Object.fromEntries(NAV);

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
    <main className="v2-login">
      <form onSubmit={submit}>
        <p className="v2-kicker">Seraye Moments</p>
        <h1>Masuk admin</h1>
        <p>Halaman ini tidak ada di menu situs. Hanya pengelola yang punya kata sandi yang bisa masuk.</p>
        <label>
          Kata sandi
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        {error ? <p className="v2-error">{error}</p> : null}
        <button className="v2-btn v2-btn-forest" type="submit" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</button>
      </form>
    </main>
  );
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(Boolean(adminToken()));
  const [schedule, setSchedule] = useState({
    bookings: [],
    blocks: [],
    photographers: [],
    mocks: [],
    progress: {},
    feedback: [],
  });
  const [page, setPage] = useState("dashboard");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [blockForm, setBlockForm] = useState({ startDate: "", endDate: "", startTime: "", endTime: "", reason: "" });
  const [editRequest, setEditRequest] = useState(null);
  const [accountStamp, setAccountStamp] = useState(0);
  const hydrated = useRef(false);

  async function refresh() {
    const data = await loadAdminSchedule();
    setSchedule({
      bookings: data.bookings || [],
      blocks: data.blocks || [],
      photographers: normalizePhotographers(data.photographers),
      mocks: Array.isArray(data.mocks) ? data.mocks : [],
      progress: data.progress && typeof data.progress === "object" ? data.progress : {},
      feedback: Array.isArray(data.feedback) ? data.feedback : undefined,
    });
    if (!hydrated.current) {
      if (Array.isArray(data.accounts) && data.accounts.length) {
        saveAccounts(data.accounts);
        setAccountStamp((value) => value + 1);
      } else {
        const local = readAccounts();
        if (local.length) await saveServerAccounts(local);
      }
      hydrated.current = true;
    }
    setAuthed(true);
    return data;
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
    refresh().catch((reason) => {
      if (ignore) return;
      setAuthed(Boolean(adminToken()));
      setError(reason.message);
    });
    markAdminOnline(true);
    return () => {
      ignore = true;
      markAdminOnline(false);
    };
  }, [authed]);

  async function run(action, success) {
    setError("");
    setNotice("");
    try {
      const result = await action();
      await refresh();
      if (success) setNotice(success);
      return result ?? true;
    } catch (reason) {
      setError(reason.message);
      if (!adminToken()) setAuthed(false);
      return null;
    }
  }

  async function persistPhotographer(payload, method) {
    let savedId = payload.id || "";
    const result = await run(async () => {
      const saved = await saveAdminPhotographer(payload, method);
      const list = saved?.photographers || [];
      const match = list.find((item) => payload.id && item.id === payload.id)
        || [...list].reverse().find((item) => item.phone === payload.phone && item.name === payload.name);
      savedId = match?.id || payload.id || savedId;
      return savedId;
    }, "Fotografer disimpan.");
    return result ? savedId : "";
  }

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  const reviews = Array.isArray(schedule.feedback) ? schedule.feedback : readFeedback();

  return (
    <div className="v2-app">
      <aside className="v2-side">
        <p className="v2-brand">Seraye Moments</p>
        <small>Admin portal</small>
        <nav aria-label="Menu admin">
          {NAV.map(([id, label, icon]) => (
            <button key={id} type="button" className={page === id ? "is-on" : ""} onClick={() => setPage(id)}>
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="v2-main">
        <header className="v2-top">
          <h1>{TITLES[page]}</h1>
          <a href="/">Lihat situs</a>
        </header>
        {error ? <p className="v2-error">{error}</p> : null}
        {notice ? <p className="v2-notice">{notice}</p> : null}
        {page === "dashboard" ? (
          <DashboardPage
            schedule={schedule}
            reviews={reviews}
            blockForm={blockForm}
            setBlockForm={setBlockForm}
            onSaveBlock={() => run(async () => {
              await createBlock(blockForm);
              setBlockForm({ startDate: "", endDate: "", startTime: "", endTime: "", reason: "" });
            }, "Blokir tersimpan.")}
            onDeleteBlock={(id) => run(() => deleteBlock(id), "Blokir dihapus.")}
            onSavePhotographer={persistPhotographer}
            onDeletePhotographer={(id) => run(() => deleteAdminPhotographer(id), "Fotografer dihapus.")}
            onEditBooking={(booking) => {
              setEditRequest(booking);
              setPage("bookings");
            }}
          />
        ) : null}
        {page === "bookings" ? (
          <BookingsPage
            schedule={schedule}
            editRequest={editRequest}
            onConsumeEdit={() => setEditRequest(null)}
            onSave={(draft) => run(() => saveAdminBooking({ ...draft, source: "admin" }, draft.id ? "PUT" : "POST"), "Booking diperbarui.")}
            onDelete={(id) => run(() => deleteAdminBooking(id), "Booking dihapus.")}
            onSaveMock={(mock) => run(() => saveAdminMock(mock, mock.id ? "PUT" : "POST"), "Mock customer disimpan.")}
            onDeleteMock={(id) => run(() => deleteAdminMock(id), "Mock customer dihapus.")}
            onAssign={(booking, photographer) => run(() => saveAdminBooking({ ...booking, photographer }, "PUT"), "Fotografer diperbarui.")}
            onPayment={(booking, paymentStatus) => run(() => saveAdminBooking({ ...booking, paymentStatus }, "PUT"), "Status pembayaran diperbarui.")}
          />
        ) : null}
        {page === "orders" ? (
          <OrdersPage schedule={schedule} onStage={(id, stage) => run(() => saveProgress(id, stage), "Progres diperbarui.")} />
        ) : null}
        {page === "users" ? (
          <UsersPage
            key={accountStamp}
            onCreatePhotographer={persistPhotographer}
            onSync={(accounts) => run(() => saveServerAccounts(accounts), "Akun tersimpan.")}
          />
        ) : null}
        {page === "catalog" ? <CatalogPage /> : null}
        {page === "portfolio" ? <PortfolioPage /> : null}
        {page === "faq" ? <FaqPage /> : null}
        {page === "curation" ? <CurationPage schedule={schedule} /> : null}
        {page === "news" ? <NewsPage /> : null}
      </main>
    </div>
  );
}
