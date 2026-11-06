import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const scopeDir = path.join(rootDir, "node_modules", "@divora");

fs.mkdirSync(scopeDir, { recursive: true });

const packagesDir = path.join(rootDir, "packages");
if (fs.existsSync(packagesDir)) {
  for (const pkg of fs.readdirSync(packagesDir)) {
    const pkgPath = path.join(packagesDir, pkg);
    if (!fs.statSync(pkgPath).isDirectory()) continue;
    const linkPath = path.join(scopeDir, pkg);
    try {
      if (fs.existsSync(linkPath) || fs.lstatSync(linkPath)) {
        fs.rmSync(linkPath, { recursive: true, force: true });
      }
    } catch {
      // ignore if link does not exist
    }
    fs.symlinkSync(path.relative(scopeDir, pkgPath), linkPath, "dir");
  }
}
