import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const emptyState = () => ({ bookings: [], blocks: [] });

function bookingsFile() {
  return process.env.BOOKINGS_PATH || path.join(process.cwd(), "data", "bookings.json");
}

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCommand(command) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
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

export function storageInfo() {
  if (kvConfigured()) return { storage: "redis", persistent: true };
  if (process.env.VERCEL) return { storage: "file", persistent: false };
  return { storage: "file", persistent: true };
}

export async function readState() {
  if (kvConfigured()) return readKv();
  return readFileState();
}

export async function writeState(state) {
  if (kvConfigured()) {
    await writeKv(state);
    return;
  }
  try {
    await writeFileState(state);
  } catch (error) {
    if (error.code === "EROFS" || error.code === "EPERM" || error.code === "EACCES") {
      const failure = new Error(
        "Penyimpanan belum terhubung. Di Vercel, tambahkan Upstash Redis. Di Docker, pasang volume untuk /data.",
      );
      failure.status = 503;
      throw failure;
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
