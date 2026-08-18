#!/usr/bin/env node
/**
 * Export ATS-friendly PDF using print styles from styles.css.
 */

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const htmlPath = join(root, "index.html");
const outDir = join(root, "dist");
const outFile = join(outDir, "Denys_Chebotar_Frontend_Developer.pdf");

if (!existsSync(htmlPath)) {
  console.error("index.html not found");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const fileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;

const browser = await chromium.launch();
const page = await browser.newPage();

await page.emulateMedia({ media: "print" });
await page.goto(fileUrl, { waitUntil: "networkidle" });
await page.pdf({
  path: outFile,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: false,
  margin: {
    top: "12mm",
    right: "12mm",
    bottom: "12mm",
    left: "12mm",
  },
});

await browser.close();

console.log(`ATS PDF exported: ${outFile}`);
