import { faqGroups, newsPosts, packages } from "../data";
import { prewisudaPortfolio, wisudaPortfolio } from "../portfolio";
import { phoneDigits } from "../session";

const KEY = "seraye-v2";

export const STAGES = [
  { id: 1, label: "Sesi Foto", hint: "Ditandai fotografer saat sesi berlangsung." },
  { id: 2, label: "Raw Diunggah", hint: "Foto mentah sudah diunggah fotografer." },
  { id: 3, label: "Kurasi Klien", hint: "Klien sudah memilih dari foto yang diperlihatkan." },
  { id: 4, label: "Retouching", hint: "Hasil edit fotografer sedang atau sudah dikerjakan." },
  { id: 5, label: "Final G-Drive", hint: "Tautan Google Drive sudah dikirim dan bisa dilihat klien." },
];

export const ROLES = [
  { id: "client", label: "Klien" },
  { id: "photographer", label: "Fotografer" },
  { id: "admin", label: "Admin Utama" },
];

function readRaw() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRaw(patch) {
  const next = { ...readRaw(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function seedAdmin() {
  return {
    id: "acc-admin",
    name: "Seraye Admin",
    role: "admin",
    phone: "081234567890",
    password: "adminseraye123#",
    lastLoginAt: "",
    online: false,
    locked: true,
    photographerId: "",
  };
}

export function readAccounts() {
  const data = readRaw();
  if (!Array.isArray(data.accounts)) {
    const accounts = [seedAdmin()];
    writeRaw({ accounts });
    return accounts;
  }
  return data.accounts;
}

export function saveAccounts(accounts) {
  writeRaw({ accounts });
  return accounts;
}

export function findAccount(phone) {
  const key = phoneDigits(phone);
  if (!key) return null;
  return readAccounts().find((item) => phoneDigits(item.phone) === key) || null;
}

export function touchLogin(id) {
  const now = new Date().toISOString();
  const accounts = readAccounts().map((item) => ({
    ...item,
    online: item.id === id,
    lastLoginAt: item.id === id ? now : item.lastLoginAt,
  }));
  saveAccounts(accounts);
}

export function markAdminOnline(online) {
  const accounts = readAccounts().map((item) => (item.locked ? { ...item, online } : item));
  saveAccounts(accounts);
}

function defaultCatalog() {
  const groups = [];
  packages.forEach((item) => {
    let group = groups.find((entry) => entry.name === item.groupLabel);
    if (!group) {
      group = { id: item.group, name: item.groupLabel, kind: item.group, packages: [] };
      groups.push(group);
    }
    group.packages.push({
      id: item.id,
      name: item.name,
      price: item.price,
      compareAt: item.compareAt || item.price,
      points: item.points.slice(),
      image: item.image,
      imageName: String(item.image || "").split("/").pop(),
      active: true,
      includesMua: Boolean(item.includesMua),
      muaAddon: Boolean(item.muaAddon),
      bestSeller: Boolean(item.bestSeller),
      highlight: Boolean(item.highlight),
      specialOffer: Boolean(item.specialOffer),
      code: item.code || "",
    });
  });
  groups.push({ id: "sepuluh", name: "Katalog Sepuluhlangkah", kind: "photography", packages: [] });
  return groups;
}

export function readCatalog() {
  const data = readRaw();
  return Array.isArray(data.catalog) ? data.catalog : defaultCatalog();
}

export function saveCatalog(catalog) {
  writeRaw({ catalog });
  return catalog;
}

export function readCatalogPackages() {
  return readCatalog().flatMap((category) =>
    category.packages
      .filter((item) => item.active !== false)
      .map((item) => ({
        ...item,
        group: category.kind || "photography",
        groupLabel: category.name,
      })),
  );
}

function defaultFaq() {
  return faqGroups.map((group, groupIndex) => ({
    id: `faq-${groupIndex}`,
    title: group.title,
    items: group.items.map((item, itemIndex) => ({
      id: `faq-${groupIndex}-${itemIndex}`,
      question: item.question,
      answer: item.answer,
    })),
  }));
}

export function readFaq() {
  const data = readRaw();
  return Array.isArray(data.faq) ? data.faq : defaultFaq();
}

export function saveFaq(faq) {
  writeRaw({ faq });
  return faq;
}

function defaultNews() {
  return newsPosts.map((post) => ({
    id: post.id,
    title: post.title,
    image: post.image,
    imageName: String(post.image || "").split("/").pop(),
    description: (post.paragraphs || []).join("\n\n"),
    excerpt: post.paragraphs?.[0] || post.caption || "",
  }));
}

export function readNews() {
  const data = readRaw();
  return Array.isArray(data.news) ? data.news : defaultNews();
}

export function saveNews(news) {
  writeRaw({ news });
  return news;
}

function withIds(list, prefix) {
  return list.map((photo, index) => ({ id: `${prefix}-${index}`, ...photo }));
}

function defaultPortfolio() {
  return [
    { id: "wisuda", title: "Katalog Wisuda", photos: withIds(wisudaPortfolio, "wisuda") },
    { id: "prewisuda", title: "Katalog Pre-Wisuda", photos: withIds(prewisudaPortfolio, "pre") },
    { id: "event", title: "Katalog Event", photos: [] },
  ];
}

export function readPortfolio() {
  const data = readRaw();
  return Array.isArray(data.portfolio) ? data.portfolio : defaultPortfolio();
}

export function savePortfolio(portfolio) {
  writeRaw({ portfolio });
  return portfolio;
}

export function readProgress() {
  const data = readRaw();
  return data.progress && typeof data.progress === "object" ? data.progress : {};
}

export function stageFrom(progress, bookingId) {
  const stage = Number(progress?.[bookingId]);
  return stage >= 1 && stage <= 5 ? stage : 1;
}

export function stageOf(bookingId) {
  return stageFrom(readProgress(), bookingId);
}

export function setStage(bookingId, stage) {
  const progress = { ...readProgress(), [bookingId]: Math.min(5, Math.max(1, stage)) };
  writeRaw({ progress });
  return progress;
}

export function readNotes() {
  const data = readRaw();
  return data.notes && typeof data.notes === "object" ? data.notes : {};
}

export function saveNote(bookingId, note) {
  const notes = { ...readNotes(), [bookingId]: note };
  writeRaw({ notes });
  return notes;
}

export function readPhotoMeta() {
  const data = readRaw();
  return data.photoMeta && typeof data.photoMeta === "object" ? data.photoMeta : {};
}

export function savePhotoMeta(id, meta) {
  const photoMeta = { ...readPhotoMeta(), [id]: { ...(readPhotoMeta()[id] || {}), ...meta } };
  writeRaw({ photoMeta });
  return photoMeta;
}

export function readImageFile(file) {
  if (!file) return Promise.resolve(null);
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return Promise.reject(new Error("Gunakan foto JPG, PNG, atau WebP."));
  }
  if (file.size > 3 * 1024 * 1024) {
    return Promise.reject(new Error("Foto maksimal 3MB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ src: String(reader.result), name: file.name });
    reader.onerror = () => reject(new Error("Foto tidak bisa dibaca."));
    reader.readAsDataURL(file);
  });
}
