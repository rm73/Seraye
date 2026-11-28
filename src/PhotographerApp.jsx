import { useEffect, useState } from "react";
import { loadPhotographerSchedule, photoToken, saveProgress, setPhotoToken } from "./api";
import { DayLanes } from "./admin/lanes";
import { STAGES, stageFrom } from "./admin/store";
import { formatLong, shiftDate, todayStamp } from "./admin/ui";
import { photographerLabel } from "./schedule";
import { clearSession, readSession } from "./session";

export default function PhotographerApp() {
  const [session] = useState(() => readSession());
  const [schedule, setSchedule] = useState({ photographers: [], bookings: [], progress: {}, photographerId: "" });
  const [date, setDate] = useState(todayStamp());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!session || session.role !== "photographer" || !photoToken()) {
      window.location.replace("/masuk");
    }
  }, [session]);

  async function refresh() {
    const data = await loadPhotographerSchedule();
    setSchedule({
      photographers: data.photographers || [],
      bookings: data.bookings || [],
      progress: data.progress || {},
      photographerId: data.photographerId || session?.photographerId || "",
    });
  }

  useEffect(() => {
    if (!session || session.role !== "photographer") return undefined;
    let ignore = false;
    loadPhotographerSchedule()
      .then((data) => {
        if (ignore) return;
        setSchedule({
          photographers: data.photographers || [],
          bookings: data.bookings || [],
          progress: data.progress || {},
          photographerId: data.photographerId || session.photographerId || "",
        });
      })
      .catch((reason) => {
        if (!ignore) setError(reason.message);
      });
    return () => {
      ignore = true;
    };
  }, [session]);

  if (!session || session.role !== "photographer") return null;

  const mine = schedule.bookings.filter((booking) => booking.photographer === schedule.photographerId);

  async function mark(booking, stage) {
    setError("");
    setNotice("");
    try {
      await saveProgress(booking.id, stage, true);
      await refresh();
      setNotice("Progres tersimpan.");
    } catch (reason) {
      setError(reason.message);
    }
  }

  return (
    <div className="v2-app is-photo">
      <main className="v2-main">
        <header className="v2-top">
          <div>
            <p className="v2-kicker">Seraye Moments</p>
            <h1>Jadwal {session.name}</h1>
          </div>
          <button
            type="button"
            className="v2-btn v2-btn-line"
            onClick={() => {
              clearSession();
              setPhotoToken("");
              window.location.assign("/masuk");
            }}
          >
            Keluar
          </button>
        </header>
        {error ? <p className="v2-error">{error}</p> : null}
        {notice ? <p className="v2-notice">{notice}</p> : null}
        <DayLanes
          date={date}
          photographers={schedule.photographers}
          bookings={schedule.bookings}
          highlightId={schedule.photographerId}
          onShift={(step) => setDate(shiftDate(date, step))}
        />
        <section className="v2-stack">
          <p className="v2-kicker">Penugasanmu</p>
          {mine.length === 0 ? <p className="v2-empty">Belum ada sesi yang ditugaskan ke akun ini.</p> : null}
          {mine.map((booking) => {
            const stage = stageFrom(schedule.progress, booking.id);
            return (
              <article className="v2-card v2-order" key={booking.id}>
                <h3>{formatLong(booking.date)} – {booking.name}</h3>
                <p>{booking.startTime}–{booking.endTime || "—"} · {booking.packageName} · {booking.location || "—"}</p>
                <p className="v2-hint">Tahap saat ini: {STAGES[stage - 1]?.label}. {STAGES[stage - 1]?.hint}</p>
                <div className="v2-photo-actions">
                  <button type="button" className="v2-btn v2-btn-forest" onClick={() => mark(booking, 1)}>Tandai sesi foto</button>
                  <button type="button" className="v2-btn v2-btn-line" onClick={() => mark(booking, 2)}>Raw sudah diunggah</button>
                  <button type="button" className="v2-btn v2-btn-line" disabled={stage < 3} onClick={() => mark(booking, 4)}>Retouching</button>
                  <button type="button" className="v2-btn v2-btn-line" disabled={stage < 4} onClick={() => mark(booking, 5)}>Final G-Drive</button>
                </div>
                {stage < 3 ? <p className="v2-hint">Kurasi klien menyusul setelah klien memilih foto. Retouching dibuka setelah kurasi.</p> : null}
                <p className="v2-hint">Fotografer: {photographerLabel(booking.photographer, schedule.photographers)}</p>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
