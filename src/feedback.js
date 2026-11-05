const KEY = "seraye-feedback";

export function readFeedback() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFeedback(entry) {
  const next = [{ ...entry, id: `fb${Date.now().toString(36)}`, createdAt: new Date().toISOString() }, ...readFeedback()];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function averageRating(items, key) {
  if (!items.length) return 0;
  const total = items.reduce((sum, item) => sum + Number(item[key] || 0), 0);
  return Math.round((total / items.length) * 10) / 10;
}
