import { useEffect } from "react";

export function Icon({ name }) {
  const common = {
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };
  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
      </svg>
    );
  }
  if (name === "list") {
    return (
      <svg {...common}>
        <path d="M9 7h11M9 12h11M9 17h11" />
        <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
      </svg>
    );
  }
  if (name === "truck") {
    return (
      <svg {...common}>
        <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" />
        <circle cx="7" cy="17.5" r="1.4" />
        <circle cx="17" cy="17.5" r="1.4" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="2.4" />
        <path d="M4.5 17.5c.6-2.4 2.4-3.5 4.5-3.5s3.9 1.1 4.5 3.5" />
        <circle cx="16.5" cy="8.5" r="2" />
        <path d="M16 14c1.8.2 3.2 1.2 3.8 3.5" />
      </svg>
    );
  }
  if (name === "camera") {
    return (
      <svg {...common}>
        <path d="M4 8.5h3l1.4-2h7.2L17 8.5h3v9H4z" />
        <circle cx="12" cy="13" r="2.4" />
      </svg>
    );
  }
  if (name === "image") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.3" />
        <path d="M6 16.5l3.5-3.5 2.4 2.2 2.2-2.2 3.9 3.5" />
      </svg>
    );
  }
  if (name === "help") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8.5 12.2l2.3 2.3 4.7-5" />
      </svg>
    );
  }
  if (name === "news") {
    return (
      <svg {...common}>
        <path d="M5 5.5h11a2 2 0 0 1 2 2V18H7.5A2.5 2.5 0 0 1 5 15.5z" />
        <path d="M5 8H4.2A1.7 1.7 0 0 0 5 11.2" />
        <path d="M9 9.5h6M9 13h6" />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="5.5" />
        <path d="M15.5 15.5L19 19" />
      </svg>
    );
  }
  if (name === "plus") {
    return (
      <svg {...common}>
        <path d="M12 6v12M6 12h12" />
      </svg>
    );
  }
  if (name === "pencil") {
    return (
      <svg {...common}>
        <path d="M4 16.5V20h3.5L18 9.5 14.5 6z" />
        <path d="M13 7.5l3.5 3.5" />
      </svg>
    );
  }
  if (name === "trash") {
    return (
      <svg {...common}>
        <path d="M5 7.5h14" />
        <path d="M9 7.5V5.8h6v1.7" />
        <path d="M7.5 7.5l.7 11h7.6l.7-11" />
      </svg>
    );
  }
  if (name === "x") {
    return (
      <svg {...common}>
        <path d="M7 7l10 10M17 7 7 17" />
      </svg>
    );
  }
  if (name === "chevron") {
    return (
      <svg {...common}>
        <path d="M9 6l6 6-6 6" />
      </svg>
    );
  }
  if (name === "left") {
    return (
      <svg {...common}>
        <path d="M14 6l-6 6 6 6" />
      </svg>
    );
  }
  if (name === "lock") {
    return (
      <svg {...common}>
        <rect x="6" y="10" width="12" height="8.5" rx="1.6" />
        <path d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2" />
      </svg>
    );
  }
  if (name === "star") {
    return (
      <svg {...common} fill="currentColor" stroke="none">
        <path d="M12 3.6l2.1 4.4 4.8.7-3.5 3.4.8 4.8L12 14.6 7.8 16.9l.8-4.8L5.1 8.7l4.8-.7z" />
      </svg>
    );
  }
  return null;
}

export function Modal({ title, lead, aside, onClose, children, footer, tone = "" }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="v2-modal" onMouseDown={onClose}>
      <div
        className={`v2-dialog ${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="v2-dialog-head">
          <div>
            <h2 id="v2-dialog-title">{title}</h2>
            {lead ? <p>{lead}</p> : null}
          </div>
          <div className="v2-dialog-tools">
            {aside}
            <button type="button" className="v2-icon-btn" onClick={onClose} aria-label="Tutup">
              <Icon name="x" />
            </button>
          </div>
        </header>
        <div className="v2-dialog-body">{children}</div>
        {footer ? <footer className="v2-dialog-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, children, confirmLabel = "Ya, Hapus", onClose, onConfirm }) {
  return (
    <Modal
      title={title}
      tone="is-confirm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="v2-btn v2-btn-line" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="v2-btn v2-btn-danger" onClick={onConfirm}>
            <Icon name="trash" />
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="v2-confirm-copy">{children}</p>
    </Modal>
  );
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const items = [];
  for (let index = 1; index <= pages; index += 1) items.push(index);
  return (
    <div className="v2-pager">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Halaman sebelumnya">
        <Icon name="left" />
      </button>
      {items.map((item) => (
        <button key={item} type="button" className={item === page ? "is-on" : ""} onClick={() => onPage(item)}>
          {item}
        </button>
      ))}
      <button type="button" onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Halaman berikutnya">
        <Icon name="chevron" />
      </button>
    </div>
  );
}

export function formatLong(stamp) {
  if (!stamp) return "—";
  const [year, month, day] = stamp.split("-").map(Number);
  if (!year || !month || !day) return stamp;
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShort(stamp) {
  if (!stamp) return "—";
  const [year, month, day] = stamp.split("-").map(Number);
  if (!year || !month || !day) return stamp;
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function shiftDate(stamp, days) {
  const [year, month, day] = stamp.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}

export function todayStamp() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function relativeTime(iso) {
  if (!iso) return "Belum pernah masuk";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Belum pernah masuk";
  const diff = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "Baru saja";
  if (diff < hour) return `${Math.floor(diff / minute)} menit yang lalu`;
  if (diff < day) return `${Math.floor(diff / hour)} jam yang lalu`;
  if (diff < 2 * day) {
    const clock = new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    return `Kemarin, ${clock}`;
  }
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function digitsToNumber(value) {
  return Number(String(value || "").replace(/\D/g, "")) || 0;
}

export function groupDigits(value) {
  const number = digitsToNumber(value);
  return number ? number.toLocaleString("id-ID") : "";
}

export function whatsAppLink(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const international = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}
