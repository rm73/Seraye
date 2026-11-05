import { useState } from "react";
import { saveFeedback } from "./feedback";

const logoSrc = "/assets/logo%20seraye%20moments%20-%20Gold%20(1).png";

function Stars({ value, onChange, label }) {
  return (
    <div className="stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          className={score <= value ? "is-on" : ""}
          aria-checked={score === value}
          role="radio"
          onClick={() => onChange(score)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function FeedbackApp() {
  const [service, setService] = useState(0);
  const [website, setWebsite] = useState(0);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!service || !website) {
      setError("Pilih bintang untuk Seraye Moments dan untuk website seraye.");
      return;
    }
    saveFeedback({ name: "", message: message.trim(), service, website });
    setSaved(true);
    setError("");
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="Seraye Moments">
            <img src={logoSrc} alt="Seraye Moments" />
          </a>
          <a className="header-back" href="/">Kembali ke situs</a>
        </div>
      </header>
      <main className="feedback-page">
        <h1>Penilaian pelanggan</h1>
        {saved ? (
          <section className="feedback-card">
            <h2>Terima kasih</h2>
            <p>Penilaianmu tersimpan dan bisa dilihat di dashboard admin.</p>
            <a className="btn btn-forest" href="/feedback">Kirim penilaian lain</a>
          </section>
        ) : (
          <form className="feedback-card" onSubmit={submit}>
            <div>
              <strong>Seraye Moments</strong>
              <Stars value={service} onChange={setService} label="Bintang untuk Seraye Moments" />
            </div>
            <div>
              <strong>Website Seraye</strong>
              <Stars value={website} onChange={setWebsite} label="Bintang untuk website seraye" />
            </div>
            <label>
              Pesan (opsional)
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="Ceritakan pengalamanmu" />
            </label>
            {error ? <p className="admin-error">{error}</p> : null}
            <button className="btn btn-forest" type="submit">Kirim penilaian</button>
          </form>
        )}
      </main>
    </>
  );
}
