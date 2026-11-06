import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assets = path.join(root, "public", "assets");
const archive = path.join(root, "photo-originals");

const jobs = [
  {
    dir: "PORTOFOLIO WISUDA SERAYE",
    out: "opt/wisuda",
    thumb: "opt/wisuda/thumbs",
    alt: "Portofolio wisuda Seraye Moments",
    exportName: "wisudaPortfolio",
  },
  {
    dir: "PORTOFOLIO PRE WISUDA",
    out: "opt/prewisuda",
    thumb: "opt/prewisuda/thumbs",
    alt: "Portofolio pre-wisuda Seraye Moments",
    exportName: "prewisudaPortfolio",
  },
];

const cards = [
  "SempurnaCard.jpg",
  "sekejapcard.jpg",
  "SekilasCard.png",
  "Sejenakcard.png",
  "SekisahCard.jpg",
  "SekawanCard.jpg",
  "circle anadevi.jpeg",
  "Anadevi.jpeg",
];

async function toWebp(input, output, width, quality) {
  await mkdir(path.dirname(output), { recursive: true });
  const before = (await stat(input)).size;
  const info = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width, withoutEnlargement: true, fit: "inside" })
    .webp({ quality, effort: 4 })
    .toFile(output);
  return { width: info.width, height: info.height, bytes: info.size, before };
}

function webName(file) {
  return file.replace(/\.(jpe?g|png)$/i, ".webp");
}

function publicUrl(relativePosix) {
  return `/${relativePosix.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

const portfolios = [];

for (const job of jobs) {
  const sourceDir = path.join(assets, job.dir);
  const files = (await readdir(sourceDir))
    .filter((file) => /\.(jpe?g|png)$/i.test(file))
    .sort((a, b) => a.localeCompare(b, "en"));
  const items = [];
  for (const file of files) {
    const input = path.join(sourceDir, file);
    const name = webName(file);
    const fullOut = path.join(assets, job.out, name);
    const thumbOut = path.join(assets, job.thumb, name);
    const full = await toWebp(input, fullOut, 1600, 74);
    const thumb = await toWebp(input, thumbOut, 720, 66);
    const saved = full.before ? Math.round((1 - (thumb.bytes + full.bytes) / full.before) * 100) : 0;
    console.log(`${file}  thumb ${Math.round(thumb.bytes / 1024)}KB  view ${Math.round(full.bytes / 1024)}KB  (${saved}% smaller)`);
    items.push({
      src: publicUrl(path.posix.join("assets", job.thumb.replaceAll("\\", "/"), name)),
      full: publicUrl(path.posix.join("assets", job.out.replaceAll("\\", "/"), name)),
      alt: job.alt,
      width: thumb.width,
      height: thumb.height,
    });
  }
  portfolios.push({ exportName: job.exportName, items, sourceDir });
}

await mkdir(path.join(assets, "opt", "cards"), { recursive: true });
for (const file of cards) {
  const input = path.join(assets, file);
  const output = path.join(assets, "opt", "cards", webName(file));
  try {
    const info = await toWebp(input, output, 960, 74);
    console.log(`${file} -> ${Math.round(info.bytes / 1024)}KB`);
  } catch (error) {
    console.warn(`skip ${file}: ${error.message}`);
  }
}

const portfolioJs = portfolios
  .map(({ exportName, items }) => {
    const body = items
      .map(
        (item) =>
          `  {\n    src: ${JSON.stringify(item.src)},\n    full: ${JSON.stringify(item.full)},\n    alt: ${JSON.stringify(item.alt)},\n    width: ${item.width},\n    height: ${item.height},\n  }`,
      )
      .join(",\n");
    return `export const ${exportName} = [\n${body},\n];`;
  })
  .join("\n\n");

await writeFile(path.join(root, "src", "portfolio.js"), `${portfolioJs}\n`, "utf8");

let data = await readFile(path.join(root, "src", "data.js"), "utf8");
for (const file of cards) {
  const from = `/assets/${file}`;
  const to = `/assets/opt/cards/${webName(file)}`;
  data = data.split(from).join(to);
}
await writeFile(path.join(root, "src", "data.js"), data, "utf8");

await mkdir(archive, { recursive: true });
for (const job of portfolios) {
  const dest = path.join(archive, path.basename(job.sourceDir));
  await rename(job.sourceDir, dest);
  console.log(`archived ${path.basename(job.sourceDir)}`);
}
for (const file of cards) {
  const from = path.join(assets, file);
  const dest = path.join(archive, file);
  try {
    await rename(from, dest);
    console.log(`archived ${file}`);
  } catch {
    /* already moved or missing */
  }
}

console.log("done");
