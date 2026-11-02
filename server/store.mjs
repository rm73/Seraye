import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const emptyState = () => ({ bookings: [], blocks: [] });

function bookingsFile() {
  return process.env.BOOKINGS_PATH || path.join(process.cwd(), "data", "bookings.json");
}

function redisCredentials() {
  const urlKey = Object.keys(process.env).find(
    (key) => process.env[key] && /(?:^|_)(?:KV_REST_API_URL|UPSTASH_REDIS_REST_URL)$/.test(key),
  );
  if (!urlKey) return null;
  const tokenKey = urlKey.endsWith("KV_REST_API_URL")
    ? urlKey.replace(/KV_REST_API_URL$/, "KV_REST_API_TOKEN")
    : urlKey.replace(/UPSTASH_REDIS_REST_URL$/, "UPSTASH_REDIS_REST_TOKEN");
  const token = process.env[tokenKey];
  if (!token) return null;
  return { url: process.env[urlKey], token };
}

async function kvCommand(command) {
  const redis = redisCredentials();
  const response = await fetch(redis.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error("Penyimpanan Redis gagal diakses.");
  const payload = await response.json();
  if (payload.error) throw new Error("Penyimpanan Redis gagal diakses.");
  return payload.result;
}

async function readKv() {
  const result = await kvCommand(["GET", "seraye-schedule"]);
  if (!result) return emptyState();
  const parsed = JSON.parse(result);
  return {
    bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
    blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
  };
}

async function writeKv(state) {
  await kvCommand(["SET", "seraye-schedule", JSON.stringify(state)]);
}

async function readFileState() {
  try {
    const raw = await readFile(bookingsFile(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
    };
  } catch (error) {
    if (error.code === "ENOENT") return emptyState();
    throw error;
  }
}

async function writeFileState(state) {
  const file = bookingsFile();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(state, null, 2));
}

function storageUnavailable() {
  const failure = new Error("Data belum tersimpan karena penyimpanan server belum terhubung.");
  failure.status = 503;
  return failure;
}

export function storageInfo() {
  if (redisCredentials()) return { storage: "redis", persistent: true };
  if (process.env.VERCEL) return { storage: "file", persistent: false };
  return { storage: "file", persistent: true };
}

export async function readState() {
  if (redisCredentials()) return readKv();
  if (process.env.VERCEL) return emptyState();
  return readFileState();
}

export async function writeState(state) {
  if (redisCredentials()) {
    await writeKv(state);
    return;
  }
  if (process.env.VERCEL) throw storageUnavailable();
  try {
    await writeFileState(state);
  } catch (error) {
    if (error.code === "EROFS" || error.code === "EPERM" || error.code === "EACCES" || error.code === "ENOENT") {
      throw storageUnavailable();
    }
    throw error;
  }
}

let queue = Promise.resolve();

export function updateState(mutator) {
  const run = queue.then(async () => {
    const current = await readState();
    const next = await mutator(current);
    await writeState(next);
    return next;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
