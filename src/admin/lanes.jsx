import { formatLong, Icon } from "./ui";

const COLORS = ["#e7a39a", "#d98980", "#e8b7a2", "#8fbf78", "#d7b07a", "#7f9e72", "#c47b86"];

function toMinutes(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function labelTime(minutes) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function axisFor(bookings, date) {
  let min = 7 * 60;
  let max = 13 * 60;
  bookings
    .filter((booking) => booking.date === date && booking.startTime)
    .forEach((booking) => {
      const start = toMinutes(booking.startTime);
      const end = toMinutes(booking.endTime) || start + 60;
      min = Math.min(min, Math.floor(start / 30) * 30);
      max = Math.max(max, Math.ceil(end / 30) * 30);
    });
  if (max - min < 120) max = min + 120;
  return { min, max };
}

export function DayLanes({ date, photographers, bookings, highlightId = "", onShift, onClose }) {
  const axis = axisFor(bookings, date);
  const span = axis.max - axis.min;
  const ticks = [];
  for (let minute = axis.min; minute <= axis.max; minute += 30) ticks.push(minute);
  const dayBookings = bookings.filter((booking) => booking.date === date);

  return (
    <section className="v2-card v2-lanes">
      <header className="v2-lane-head">
        <div>
          <p className="v2-kicker">Jadwal harian fotografer</p>
          <h3>{formatLong(date)}</h3>
        </div>
        <div className="v2-lane-tools">
          <button type="button" onClick={() => onShift(-1)}>
            <Icon name="left" />
            Geser mundur
          </button>
          <button type="button" onClick={() => onShift(1)}>
            Geser maju
            <Icon name="chevron" />
          </button>
          {onClose ? (
            <button type="button" className="is-exit" onClick={onClose}>
              Keluar
            </button>
          ) : null}
        </div>
      </header>
      <div className="v2-gantt" style={{ "--slots": Math.max(ticks.length - 1, 1) }}>
        <div className="v2-gantt-scale">
          <span className="v2-gantt-corner">Fotografer</span>
          {ticks.slice(0, -1).map((minute) => (
            <span key={minute}>{labelTime(minute)}</span>
          ))}
        </div>
        {photographers.map((person, index) => {
          const bars = dayBookings.filter((booking) => booking.photographer === person.id);
          return (
            <div className="v2-gantt-row" key={person.id}>
              <div className={`v2-gantt-name ${person.id === highlightId ? "is-you" : ""}`}>
                <span style={{ background: COLORS[index % COLORS.length] }}>{person.name}</span>
              </div>
              <div className="v2-gantt-track">
                {bars.map((booking) => {
                  const start = toMinutes(booking.startTime);
                  const end = toMinutes(booking.endTime) || start + 60;
                  const left = ((start - axis.min) / span) * 100;
                  const width = (Math.max(end - start, 30) / span) * 100;
                  return (
                    <div
                      key={booking.id}
                      className="v2-gantt-bar"
                      style={{
                        left: `${Math.max(left, 0)}%`,
                        width: `${Math.min(width, 100 - Math.max(left, 0))}%`,
                        background: COLORS[index % COLORS.length],
                      }}
                      title={`${booking.name} · ${booking.startTime}–${booking.endTime || ""}`}
                    >
                      {booking.name}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {dayBookings.length === 0 ? <p className="v2-empty">Belum ada jadwal pada hari ini. Geser tanggal atau pilih hari lain di kalender.</p> : null}
    </section>
  );
}
