import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const out = path.join(root, "hosting");
const config = path.join(root, "cpanel", "api", "config.php");

if (!existsSync(config)) {
  console.error("File cpanel/api/config.php belum ada. Salin dari config.example.php lalu isi database.");
  process.exit(1);
}

const build = spawnSync(process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"), "build"], {
  cwd: root,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status || 1);

rmSync(out, { recursive: true, force: true });
cpSync(path.join(root, "dist"), out, { recursive: true });
cpSync(path.join(root, "cpanel", "api"), path.join(out, "api"), { recursive: true });
cpSync(path.join(root, "public", ".htaccess"), path.join(out, ".htaccess"));

console.log("Folder hosting siap diunggah ke public_html.");
