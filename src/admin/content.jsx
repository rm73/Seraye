import { useState } from "react";
import { rupiah } from "../booking";
import { isPhone, phoneDigits } from "../session";
import {
  readAccounts,
  readCatalog,
  readFaq,
  readImageFile,
  readNews,
  readNotes,
  readPortfolio,
  ROLES,
  saveAccounts,
  saveCatalog,
  saveFaq,
  saveNews,
  saveNote,
  savePortfolio,
  stageFrom,
  STAGES,
  uid,
} from "./store";
import { ConfirmDialog, formatLong, groupDigits, Icon, Modal, Pager, relativeTime } from "./ui";

function useList(read, save) {
  const [items, setItems] = useState(read);
  function commit(next) {
    save(next);
    setItems(next);
  }
  return [items, commit];
}

export function UsersPage({ onCreatePhotographer, onSync }) {
  const [accounts, setAccounts] = useList(readAccounts, saveAccounts);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const pages = Math.max(1, Math.ceil(accounts.length / 5));
  const visible = accounts.slice((Math.min(page, pages) - 1) * 5, Math.min(page, pages) * 5);

  async function submit() {
    if (!draft.name.trim() || !isPhone(draft.phone) || draft.password.length < 8) {
      setError("Nama, nomor WhatsApp aktif, dan kata sandi minimal 8 karakter wajib diisi.");
      return;
    }
    const duplicate = accounts.find((item) => item.id !== draft.id && phoneDigits(item.phone) === phoneDigits(draft.phone));
    if (duplicate) {
      setError("Nomor ini sudah dipakai akun lain.");
      return;
    }
    let photographerId = draft.photographerId || "";
    if (draft.role === "photographer") {
      const created = await onCreatePhotographer({
        id: photographerId,
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        notes: "",
      }, photographerId ? "PUT" : "POST");
      if (!created) return;
      photographerId = created;
    }
    const next = draft.id
      ? accounts.map((item) => (item.id === draft.id ? { ...item, ...draft, name: draft.name.trim(), photographerId } : item))
      : accounts.concat({ ...draft, id: uid("acc"), name: draft.name.trim(), photographerId, lastLoginAt: "", online: false, locked: false });
    setAccounts(next);
    if (onSync) await onSync(next);
    setDraft(null);
  }

  return (
    <div className="v2-stack">
      <header className="v2-page-intro">
        <p>Manajemen akun terdaftar, hak akses pengguna, dan kata sandi. Akun fotografer hanya bisa dibuat dari sini, lalu masuk lewat form yang sama dengan klien.</p>
        <button type="button" className="v2-btn v2-btn-forest" onClick={() => { setError(""); setDraft({ id: "", name: "", role: "photographer", phone: "", password: "", photographerId: "" }); }}>
          <Icon name="plus" /> Tambah Akun Baru
        </button>
      </header>
      <div className="v2-table-wrap">
        <table className="v2-table">
          <thead>
            <tr>
              <th>Nama pengguna</th>
              <th>Role / peran</th>
              <th>Nomor WhatsApp</th>
              <th>Password</th>
              <th>Login terakhir</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td><span className={`v2-role is-${account.role}`}>{ROLES.find((item) => item.id === account.role)?.label || account.role}</span></td>
                <td>{account.phone}</td>
                <td>{account.password}</td>
                <td>{account.online ? <em className="v2-online">Sedang online</em> : relativeTime(account.lastLoginAt)}</td>
                <td className="v2-actions">
                  <button type="button" aria-label={`Ubah ${account.name}`} onClick={() => { setError(""); setDraft({ ...account }); }}><Icon name="pencil" /></button>
                  {account.locked ? (
                    <button type="button" disabled aria-label="Akun terkunci"><Icon name="lock" /></button>
                  ) : (
                    <button type="button" aria-label={`Hapus ${account.name}`} onClick={() => setPending(account)}><Icon name="trash" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="v2-list-foot">
        <span>Menampilkan {visible.length} dari {accounts.length} pengguna terdaftar</span>
        <Pager page={Math.min(page, pages)} pages={pages} onPage={setPage} />
      </div>
      {draft ? (
        <Modal
          title={draft.id ? "Edit Akun" : "Tambah Akun"}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" className="v2-btn v2-btn-line" onClick={() => setDraft(null)}>Batal</button>
              <button type="button" className="v2-btn v2-btn-forest" onClick={submit}>Simpan</button>
            </>
          }
        >
          <div className="v2-form-grid is-one">
            <label>Nama *<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>
              Role / Peran *
              <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} disabled={draft.locked}>
                {ROLES.filter((item) => !draft.locked || item.id === "admin").map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>No. Telp *<input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="08…" /></label>
            <label>Password *<input value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} /></label>
          </div>
          {draft.role === "photographer" ? <p className="v2-hint">Akun ini bisa masuk di halaman Masuk klien. Setelah berhasil, fotografer diarahkan ke jadwal dan progres pesanan.</p> : null}
          {error ? <p className="v2-error">{error}</p> : null}
        </Modal>
      ) : null}
      {pending ? (
        <ConfirmDialog title="Hapus akun?" onClose={() => setPending(null)} onConfirm={async () => {
            const next = accounts.filter((item) => item.id !== pending.id);
            setAccounts(next);
            if (onSync) await onSync(next);
            setPending(null);
          }}>
          Apakah kamu yakin ingin menghapus akun <strong>{pending.name}</strong>? Tindakan ini tidak dapat dibatalkan.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

const emptyPackage = (categoryId) => ({
  id: "",
  categoryId,
  name: "",
  price: "",
  compareAt: "",
  points: "",
  image: "",
  imageName: "",
  active: true,
});

export function CatalogPage() {
  const [catalog, setCatalog] = useList(readCatalog, saveCatalog);
  const [draft, setDraft] = useState(null);
  const [categoryDraft, setCategoryDraft] = useState(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");

  function updateCategory(id, recipe) {
    setCatalog(catalog.map((category) => (category.id === id ? recipe(category) : category)));
  }

  async function savePackage() {
    if (!draft.name.trim() || !digits(draft.price) || !draft.points.trim()) {
      setError("Nama, harga promo, dan deskripsi wajib diisi.");
      return;
    }
    const record = {
      id: draft.id || uid("paket"),
      name: draft.name.trim(),
      price: digits(draft.price),
      compareAt: digits(draft.compareAt) || digits(draft.price),
      points: draft.points.split("\n").map((line) => line.trim()).filter(Boolean),
      image: draft.image,
      imageName: draft.imageName,
      active: draft.active !== false,
      includesMua: /mua/i.test(draft.points),
    };
    updateCategory(draft.categoryId, (category) => ({
      ...category,
      packages: draft.id
        ? category.packages.map((item) => (item.id === draft.id ? { ...item, ...record } : item))
        : category.packages.concat(record),
    }));
    setDraft(null);
  }

  return (
    <div className="v2-stack">
      <div className="v2-catalog-add">
        <button type="button" className="v2-btn v2-btn-forest" onClick={() => { setError(""); setCategoryDraft({ id: "", name: "", kind: "photography" }); }}>
          <Icon name="plus" /> Tambah Kategori Katalog
        </button>
      </div>
      {catalog.map((category) => (
        <section className="v2-card" key={category.id}>
          <header className="v2-card-head">
            <h2>
              {category.name}
              <button type="button" className="v2-icon-btn" aria-label={`Ubah ${category.name}`} onClick={() => setCategoryDraft({ ...category })}><Icon name="pencil" /></button>
            </h2>
            <button type="button" className="v2-icon-btn" aria-label={`Hapus ${category.name}`} onClick={() => setPending({ kind: "category", category })}><Icon name="trash" /></button>
          </header>
          <div className="v2-pack-grid">
            {category.packages.map((item) => (
              <article key={item.id} className={item.active === false ? "is-off" : ""}>
                <img src={item.image || "/assets/logo.png"} alt="" />
                <div className="v2-pack-copy">
                  <strong>{item.name}</strong>
                  <button
                    type="button"
                    className={item.active === false ? "v2-switch" : "v2-switch is-on"}
                    aria-pressed={item.active !== false}
                    onClick={() => updateCategory(category.id, (current) => ({
                      ...current,
                      packages: current.packages.map((pack) => (pack.id === item.id ? { ...pack, active: pack.active === false } : pack)),
                    }))}
                  />
                  <b>{rupiah(item.price)} <s>{item.compareAt ? rupiah(item.compareAt) : ""}</s></b>
                  <ul>{(item.points || []).slice(0, 4).map((point) => <li key={point}>{point}</li>)}</ul>
                  <div>
                    <button type="button" className="v2-btn v2-btn-line" onClick={() => { setError(""); setDraft({ ...item, categoryId: category.id, price: groupDigits(item.price), compareAt: groupDigits(item.compareAt), points: (item.points || []).join("\n") }); }}>Edit Paket</button>
                    <button type="button" className="v2-icon-btn" aria-label={`Hapus ${item.name}`} onClick={() => setPending({ kind: "package", category, item })}><Icon name="trash" /></button>
                  </div>
                </div>
              </article>
            ))}
            <button type="button" className="v2-add-tile" onClick={() => { setError(""); setDraft(emptyPackage(category.id)); }}>
              <Icon name="plus" />
              Tambah Paket {category.name.replace("Katalog ", "")}
            </button>
          </div>
        </section>
      ))}
      {draft ? (
        <Modal
          title={draft.id ? "Edit Paket" : "Tambah Paket"}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" className="v2-btn v2-btn-line" onClick={() => setDraft(null)}>Batal</button>
              <button type="button" className="v2-btn v2-btn-forest" onClick={savePackage}>Simpan Perubahan</button>
            </>
          }
        >
          <div className="v2-form-grid is-one">
            <label>
              Kategori Katalog
              <input value={catalog.find((item) => item.id === draft.categoryId)?.name || ""} readOnly />
            </label>
            <label>Nama Paket *<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <div className="v2-form-grid">
              <label>Harga Normal (Rp)<input value={draft.compareAt} onChange={(event) => setDraft({ ...draft, compareAt: groupDigits(event.target.value) })} /></label>
              <label>Harga Promo Aktif (Rp) *<input value={draft.price} onChange={(event) => setDraft({ ...draft, price: groupDigits(event.target.value) })} /></label>
            </div>
            <label>Deskripsi Paket (pisahkan dengan baris baru) *<textarea rows={6} value={draft.points} onChange={(event) => setDraft({ ...draft, points: event.target.value })} /></label>
            <label className="v2-file">
              Foto Cover Paket *
              <span>
                {draft.image ? <img src={draft.image} alt="" /> : <Icon name="image" />}
                <em>{draft.imageName || "Pilih foto cover"}<small>Format JPG, PNG, WebP. Maks 3MB.</small></em>
                <b>{draft.image ? "Ganti Foto" : "Pilih"}</b>
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
                try {
                  const file = await readImageFile(event.target.files?.[0]);
                  if (file) setDraft({ ...draft, image: file.src, imageName: file.name });
                  setError("");
                } catch (reason) {
                  setError(reason.message);
                }
              }} />
            </label>
          </div>
          {error ? <p className="v2-error">{error}</p> : null}
        </Modal>
      ) : null}
      {categoryDraft ? (
        <Modal
          title={categoryDraft.id ? "Edit Kategori Katalog" : "Tambah Kategori Katalog"}
          onClose={() => setCategoryDraft(null)}
          footer={
            <>
              <button type="button" className="v2-btn v2-btn-line" onClick={() => setCategoryDraft(null)}>Batal</button>
              <button type="button" className="v2-btn v2-btn-forest" onClick={() => {
                if (!categoryDraft.name.trim()) return;
                if (categoryDraft.id) setCatalog(catalog.map((item) => (item.id === categoryDraft.id ? { ...item, name: categoryDraft.name.trim(), kind: categoryDraft.kind } : item)));
                else setCatalog(catalog.concat({ id: uid("kat"), name: categoryDraft.name.trim(), kind: categoryDraft.kind, packages: [] }));
                setCategoryDraft(null);
              }}
              >
                Simpan
              </button>
            </>
          }
        >
          <div className="v2-form-grid is-one">
            <label>Nama kategori *<input value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} /></label>
            <label>
              Jenis
              <select value={categoryDraft.kind} onChange={(event) => setCategoryDraft({ ...categoryDraft, kind: event.target.value })}>
                <option value="photography">Foto</option>
                <option value="videography">Video</option>
              </select>
            </label>
          </div>
        </Modal>
      ) : null}
      {pending ? (
        <ConfirmDialog
          title={pending.kind === "category" ? "Hapus kategori?" : "Hapus paket?"}
          onClose={() => setPending(null)}
          onConfirm={() => {
            if (pending.kind === "category") setCatalog(catalog.filter((item) => item.id !== pending.category.id));
            else updateCategory(pending.category.id, (category) => ({ ...category, packages: category.packages.filter((item) => item.id !== pending.item.id) }));
            setPending(null);
          }}
        >
          Apakah kamu yakin ingin menghapus <strong>{pending.kind === "category" ? pending.category.name : pending.item.name}</strong>? Tindakan ini tidak dapat dibatalkan.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function digits(value) {
  return Number(String(value || "").replace(/\D/g, "")) || 0;
}

export function FaqPage() {
  const [faq, setFaq] = useList(readFaq, saveFaq);
  const [draft, setDraft] = useState(null);
  const [category, setCategory] = useState(null);
  const [pending, setPending] = useState(null);

  return (
    <div className="v2-stack">
      <div className="v2-page-intro">
        <p>Kelompokkan pertanyaan yang tampil di halaman utama.</p>
        <button type="button" className="v2-btn v2-btn-forest" onClick={() => setCategory("")}><Icon name="plus" /> Tambah Kategori</button>
      </div>
      {faq.map((group) => (
        <section className="v2-card" key={group.id}>
          <header className="v2-card-head">
            <h2>{group.title}</h2>
            <div className="v2-actions">
              <button type="button" aria-label="Tambah pertanyaan" onClick={() => setDraft({ groupId: group.id, id: "", question: "", answer: "" })}><Icon name="plus" /></button>
              <button type="button" aria-label={`Hapus ${group.title}`} onClick={() => setPending({ kind: "group", group })}><Icon name="trash" /></button>
            </div>
          </header>
          <div className="v2-faq-list">
            {group.items.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                </div>
                <div className="v2-actions">
                  <button type="button" aria-label="Ubah pertanyaan" onClick={() => setDraft({ groupId: group.id, ...item })}><Icon name="pencil" /></button>
                  <button type="button" aria-label="Hapus pertanyaan" onClick={() => setPending({ kind: "item", group, item })}><Icon name="trash" /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {category !== null ? (
        <Modal title="Tambah Kategori" onClose={() => setCategory(null)} footer={<><button type="button" className="v2-btn v2-btn-line" onClick={() => setCategory(null)}>Batal</button><button type="button" className="v2-btn v2-btn-forest" onClick={() => { if (!String(category).trim()) return; setFaq(faq.concat({ id: uid("faq"), title: String(category).trim(), items: [] })); setCategory(null); }}>Simpan</button></>}>
          <label className="v2-solo">Nama kategori *<input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
        </Modal>
      ) : null}
      {draft ? (
        <Modal
          title={draft.id ? "Edit Pertanyaan" : "Tambah Pertanyaan"}
          onClose={() => setDraft(null)}
          footer={<><button type="button" className="v2-btn v2-btn-line" onClick={() => setDraft(null)}>Batal</button><button type="button" className="v2-btn v2-btn-forest" onClick={() => {
            if (!draft.question.trim() || !draft.answer.trim()) return;
            setFaq(faq.map((group) => {
              if (group.id !== draft.groupId) return group;
              const items = draft.id
                ? group.items.map((item) => (item.id === draft.id ? { id: item.id, question: draft.question.trim(), answer: draft.answer.trim() } : item))
                : group.items.concat({ id: uid("q"), question: draft.question.trim(), answer: draft.answer.trim() });
              return { ...group, items };
            }));
            setDraft(null);
          }}>Simpan</button></>}
        >
          <div className="v2-form-grid is-one">
            <label>Kategori<input value={faq.find((group) => group.id === draft.groupId)?.title || ""} readOnly /></label>
            <label>Pertanyaan *<input value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} /></label>
            <label>Jawaban *<textarea rows={4} value={draft.answer} onChange={(event) => setDraft({ ...draft, answer: event.target.value })} /></label>
          </div>
        </Modal>
      ) : null}
      {pending ? (
        <ConfirmDialog
          title={pending.kind === "group" ? "Hapus kategori?" : "Hapus pertanyaan?"}
          onClose={() => setPending(null)}
          onConfirm={() => {
            if (pending.kind === "group") setFaq(faq.filter((group) => group.id !== pending.group.id));
            else setFaq(faq.map((group) => group.id === pending.group.id ? { ...group, items: group.items.filter((item) => item.id !== pending.item.id) } : group));
            setPending(null);
          }}
        >
          Apakah kamu yakin ingin menghapus <strong>{pending.kind === "group" ? pending.group.title : pending.item.question}</strong>? Tindakan ini tidak dapat dibatalkan.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

export function NewsPage() {
  const [news, setNews] = useList(readNews, saveNews);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const visible = news.filter((item) => `${item.title} ${item.excerpt}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="v2-stack">
      <header className="v2-page-intro">
        <p>Daftar artikel dan tips fotografi wisuda.</p>
        <label className="v2-search">
          <Icon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari artikel wisuda..." />
        </label>
        <button type="button" className="v2-btn v2-btn-forest" onClick={() => { setError(""); setDraft({ id: "", title: "", description: "", image: "", imageName: "" }); }}>
          <Icon name="plus" /> Tambah Berita
        </button>
      </header>
      <div className="v2-news-grid">
        {visible.map((item) => (
          <article key={item.id}>
            <img src={item.image || "/assets/logo.png"} alt="" />
            <h3>{item.title}</h3>
            <p>{item.excerpt || item.description}</p>
            <div className="v2-actions">
              <button type="button" aria-label="Ubah berita" onClick={() => { setError(""); setDraft(item); }}><Icon name="pencil" /></button>
              <button type="button" aria-label="Hapus berita" onClick={() => setPending(item)}><Icon name="trash" /></button>
            </div>
          </article>
        ))}
      </div>
      {draft ? (
        <Modal
          title={draft.id ? "Edit Berita" : "Tambah Berita"}
          onClose={() => setDraft(null)}
          footer={<><button type="button" className="v2-btn v2-btn-line" onClick={() => setDraft(null)}>Batal</button><button type="button" className="v2-btn v2-btn-forest" onClick={() => {
            if (!draft.title.trim() || !draft.description.trim() || !draft.image) {
              setError("Judul, deskripsi, dan foto cover wajib diisi.");
              return;
            }
            const record = { ...draft, id: draft.id || uid("berita"), title: draft.title.trim(), excerpt: draft.description.trim().slice(0, 140) };
            setNews(draft.id ? news.map((item) => (item.id === draft.id ? record : item)) : news.concat(record));
            setDraft(null);
          }}>Simpan</button></>}
        >
          <div className="v2-form-grid is-one">
            <label>Judul *<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label>Deskripsi *<textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <label className="v2-file">
              Foto Cover *
              <span>
                {draft.image ? <img src={draft.image} alt="" /> : <Icon name="image" />}
                <em>{draft.imageName || "Pilih Foto Cover"}<small>Format JPG, PNG, WebP. Maks 3MB.</small></em>
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
                try {
                  const file = await readImageFile(event.target.files?.[0]);
                  if (file) setDraft({ ...draft, image: file.src, imageName: file.name });
                } catch (reason) {
                  setError(reason.message);
                }
              }} />
            </label>
          </div>
          {error ? <p className="v2-error">{error}</p> : null}
        </Modal>
      ) : null}
      {pending ? (
        <ConfirmDialog title="Hapus berita?" onClose={() => setPending(null)} onConfirm={() => { setNews(news.filter((item) => item.id !== pending.id)); setPending(null); }}>
          Apakah kamu yakin ingin menghapus berita <strong>{pending.title}</strong>? Tindakan ini tidak dapat dibatalkan.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

export function PortfolioPage() {
  const [boards, setBoards] = useList(readPortfolio, savePortfolio);
  const [picked, setPicked] = useState({});
  const [category, setCategory] = useState(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");

  function selectedIn(board) {
    return (picked[board.id] || []).filter((id) => board.photos.some((photo) => photo.id === id));
  }

  return (
    <div className="v2-stack">
      <div className="v2-page-intro">
        <p>Foto yang tampil di bagian portofolio situs.</p>
        <button type="button" className="v2-btn v2-btn-forest" onClick={() => setCategory({ id: "", title: "" })}><Icon name="plus" /> Tambah Kategori</button>
      </div>
      {boards.map((board) => {
        const selected = selectedIn(board);
        return (
          <section className="v2-card" key={board.id}>
            <header className="v2-card-head">
              <h2>
                {board.title}
                <button type="button" className="v2-icon-btn" aria-label="Ubah kategori" onClick={() => setCategory(board)}><Icon name="pencil" /></button>
              </h2>
              <div className="v2-actions">
                {selected.length ? (
                  <button type="button" className="v2-btn v2-btn-line" onClick={() => setPending({ kind: "photos", board, ids: selected })}>Hapus {selected.length} foto</button>
                ) : null}
                <button type="button" className="v2-icon-btn" aria-label="Hapus kategori" onClick={() => setPending({ kind: "board", board })}><Icon name="trash" /></button>
              </div>
            </header>
            <div className="v2-folio-grid">
              {board.photos.map((photo) => {
                const on = selected.includes(photo.id);
                return (
                  <button
                    type="button"
                    key={photo.id}
                    className={on ? "is-on" : ""}
                    onClick={() => setPicked((current) => {
                      const list = current[board.id] || [];
                      return { ...current, [board.id]: on ? list.filter((id) => id !== photo.id) : list.concat(photo.id) };
                    })}
                  >
                    <img src={photo.src} alt={photo.alt || board.title} />
                    <i />
                  </button>
                );
              })}
              <label className="v2-add-tile">
                <Icon name="image" />
                Tambah Foto
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={async (event) => {
                  const files = [...(event.target.files || [])];
                  try {
                    const photos = [];
                    for (const file of files) {
                      const image = await readImageFile(file);
                      if (image) photos.push({ id: uid("foto"), src: image.src, full: image.src, alt: board.title, width: 720, height: 900 });
                    }
                    setBoards(boards.map((item) => item.id === board.id ? { ...item, photos: item.photos.concat(photos) } : item));
                    setError("");
                  } catch (reason) {
                    setError(reason.message);
                  }
                  event.target.value = "";
                }} />
              </label>
            </div>
          </section>
        );
      })}
      {error ? <p className="v2-error">{error}</p> : null}
      {category ? (
        <Modal
          title={category.id ? "Edit Kategori" : "Tambah Kategori"}
          onClose={() => setCategory(null)}
          footer={<><button type="button" className="v2-btn v2-btn-line" onClick={() => setCategory(null)}>Batal</button><button type="button" className="v2-btn v2-btn-forest" onClick={() => {
            if (!category.title.trim()) return;
            if (category.id) setBoards(boards.map((item) => item.id === category.id ? { ...item, title: category.title.trim() } : item));
            else setBoards(boards.concat({ id: uid("folio"), title: category.title.trim(), photos: [] }));
            setCategory(null);
          }}>Simpan</button></>}
        >
          <label className="v2-solo">Nama kategori *<input value={category.title} onChange={(event) => setCategory({ ...category, title: event.target.value })} /></label>
        </Modal>
      ) : null}
      {pending ? (
        <ConfirmDialog
          title={pending.kind === "photos" ? `Hapus ${pending.ids.length} foto?` : "Hapus kategori?"}
          onClose={() => setPending(null)}
          onConfirm={() => {
            if (pending.kind === "photos") {
              setBoards(boards.map((item) => item.id === pending.board.id ? { ...item, photos: item.photos.filter((photo) => !pending.ids.includes(photo.id)) } : item));
              setPicked((current) => ({ ...current, [pending.board.id]: [] }));
            } else setBoards(boards.filter((item) => item.id !== pending.board.id));
            setPending(null);
          }}
        >
          {pending.kind === "photos"
            ? <>Foto yang dipilih akan dihapus dari <strong>{pending.board.title}</strong>.</>
            : <>Apakah kamu yakin ingin menghapus <strong>{pending.board.title}</strong> beserta fotonya?</>}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

export function CurationPage({ schedule }) {
  const [notes, setNotes] = useState(readNotes);
  const progress = schedule.progress || {};
  const rows = schedule.bookings.filter((booking) => stageFrom(progress, booking.id) >= 3);
  return (
    <div className="v2-stack">
      <p className="v2-hint">Kurasi berarti klien sudah memilih foto. Revisi dicatat di sini untuk fotografer saat tahap retouching.</p>
      {rows.length === 0 ? <p className="v2-empty">Belum ada pesanan yang masuk ke kurasi atau revisi.</p> : null}
      {rows.map((booking) => (
        <article className="v2-card v2-curation" key={booking.id}>
          <header>
            <h2>{booking.name}</h2>
            <span>{STAGES[stageFrom(progress, booking.id) - 1]?.label} · {formatLong(booking.date)}</span>
          </header>
          <label>
            Catatan kurasi / revisi
            <textarea
              rows={3}
              value={notes[booking.id] || ""}
              onChange={(event) => {
                const next = { ...notes, [booking.id]: event.target.value };
                setNotes(next);
                saveNote(booking.id, event.target.value);
              }}
              placeholder="Contoh: klien memilih 18 foto, minta tone lebih hangat."
            />
          </label>
        </article>
      ))}
    </div>
  );
}
