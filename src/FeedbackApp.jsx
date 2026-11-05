import { useState } from "react";
import { averageRating, readFeedback, saveFeedback } from "./feedback";

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
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const existing = readFeedback();

  function submit(event) {
    event.preventDefault();
    if (!service || !website) {
      setError("Pilih bintang untuk Seraye Moments dan untuk websitenya.");
      return;
    }
    saveFeedback({ name: name.trim(), message: message.trim(), service, website });
    setSaved(true);
    setError("");
  }

  return (
    <main className="feedback-page">
      <a href="/">Kembali ke situs</a>
      <h1>Penilaian pelanggan</h1>
      <p>
        Rata-rata saat ini: Seraye Moments {averageRating(existing, "service") || "-"} / 5 · Website{" "}
        {averageRating(existing, "website") || "-"} / 5 dari {existing.length} penilaian.
      </p>
      {saved ? (
        <section className="feedback-card">
          <h2>Terima kasih</h2>
          <p>Penilaianmu tersimpan dan bisa dilihat di dashboard admin.</p>
          <a className="btn btn-forest" href="/feedback">Kirim penilaian lain</a>
        </section>
      ) : (
        <form className="feedback-card" onSubmit={submit}>
          <label>
            Nama (opsional)
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama kamu" />
          </label>
          <div>
            <strong>Seraye Moments</strong>
            <Stars value={service} onChange={setService} label="Bintang untuk Seraye Moments" />
          </div>
          <div>
            <strong>Website</strong>
            <Stars value={website} onChange={setWebsite} label="Bintang untuk website" />
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
  );
}
