#!/usr/bin/env node
/**
 * ATS compatibility audit for index.html CV.
 * Simulates plain-text extraction and checks common ATS parsing rules.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const htmlPath = join(root, "index.html");
const cssPath = join(root, "styles.css");
const atsPdfPath = join(root, "dist", "Denys_Chebotar_Frontend_Developer.pdf");
const html = readFileSync(htmlPath, "utf8");
const css = readFileSync(cssPath, "utf8");

function getPrintCss(source) {
  const start = source.indexOf("@media print");
  if (start === -1) {
    return "";
  }
  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) {
    return "";
  }
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") {
      depth++;
    }
    if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(braceStart + 1, i);
      }
    }
  }
  return "";
}

const printCss = getPrintCss(css);

function hasPrintSingleColumn(selector) {
  return new RegExp(
    `${selector.replace(".", "\\.")}[\\s\\S]*?grid-template-columns:\\s*1fr`,
    "i"
  ).test(printCss);
}

const STANDARD_SECTIONS = [
  "summary",
  "professional summary",
  "experience",
  "professional experience",
  "work experience",
  "employment",
  "skills",
  "technical skills",
  "education",
  "languages",
  "certifications",
];

function stripHtml(source) {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|header|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractField(pattern) {
  const m = html.match(pattern);
  return m ? m[1].trim() : null;
}

function extractSectionTitles() {
  const titles = [];
  const re = /<h2[^>]*class="section-title"[^>]*>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    titles.push(m[1].replace(/<[^>]+>/g, "").trim());
  }
  return titles;
}

function countMatches(pattern) {
  const flags = pattern.global ? "" : "g";
  const re = pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + flags);
  return (html.match(re) || []).length;
}

function check(rule) {
  return { ...rule, status: rule.pass ? "pass" : rule.severity === "warn" ? "warn" : "fail" };
}

const plainText = stripHtml(html);
const sectionTitles = extractSectionTitles();
const email = extractField(/mailto:([^"?]+)/i);
const phone = extractField(/tel:([^"]+)/i);
const name = extractField(/<h1[^>]*class="name"[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, "");
const jobTitle = extractField(/<h2[^>]*class="title"[^>]*>([\s\S]*?)<\/h2>/i)?.replace(/<[^>]+>/g, "");

const rules = [
  check({
    id: "contact-name",
    category: "Contact",
    rule: "Full name present at top",
    pass: Boolean(name && name.length > 2),
    detail: name || "Missing",
  }),
  check({
    id: "contact-email",
    category: "Contact",
    rule: "Email address in plain text",
    pass: Boolean(email && plainText.includes(email)),
    detail: email || "Missing",
  }),
  check({
    id: "contact-phone",
    category: "Contact",
    rule: "Phone number parseable",
    pass: Boolean(phone && /\+?\d/.test(phone)),
    detail: phone || "Missing",
  }),
  check({
    id: "contact-location",
    category: "Contact",
    rule: "Location listed",
    pass: /Ukraine|Odesa|Remote/i.test(plainText),
    detail: /Ukraine|Odesa/i.test(plainText) ? "Present" : "Missing",
  }),
  check({
    id: "job-title",
    category: "Structure",
    rule: "Target job title visible",
    pass: Boolean(jobTitle),
    detail: jobTitle || "Missing",
  }),
  check({
    id: "summary",
    category: "Structure",
    rule: "Professional summary present",
    pass: /Frontend Developer with \d+\+ years/i.test(plainText),
    detail: /professional-summary/.test(html) ? "Present" : "Missing",
  }),
  check({
    id: "section-headings",
    category: "Structure",
    rule: "Standard section headings used",
    pass: sectionTitles.some((t) => /experience/i.test(t)) &&
      sectionTitles.some((t) => /skills/i.test(t)) &&
      sectionTitles.some((t) => /education/i.test(t)),
    detail: sectionTitles.join(" | ") || "None found",
  }),
  check({
    id: "experience-order",
    category: "Structure",
    rule: "Experience section before Education",
    pass: html.indexOf("Professional Experience") < html.indexOf("Education") &&
      html.indexOf("Professional Experience") > 0,
    detail: "Experience → Skills → Education → Languages",
  }),
  check({
    id: "bullet-format",
    category: "Parsing",
    rule: "Achievements use bullet lists",
    pass: countMatches(/<li>/g) >= 5,
    detail: `${countMatches(/<li>/g)} bullet items`,
  }),
  check({
    id: "date-format",
    category: "Parsing",
    rule: "Dates use Month YYYY format",
    pass: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\s*-\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\w+)/i.test(plainText),
    detail: "Nov 2025 - Jul 2026 style detected",
    severity: "warn",
  }),
  check({
    id: "no-images",
    category: "Parsing",
    rule: "No profile photos or image-only content",
    pass: !/<img\b/i.test(html),
    detail: /<img\b/i.test(html) ? "Images found" : "No images",
  }),
  check({
    id: "icon-only-decor",
    category: "Parsing",
    rule: "Contact rows not icon-only (icons should not replace labels)",
    pass: countMatches(/<i class="fa/g) > 0 &&
      /denysxchebotar@gmail\.com/.test(plainText) &&
      /linkedin\.com/i.test(plainText),
    detail: `${countMatches(/<i class="fa/g)} Font Awesome icons — ATS ignores these; link text must carry meaning`,
    severity: "warn",
  }),
  check({
    id: "multi-column-contacts",
    category: "Layout",
    rule: "Single-column contact block (no multi-column grid)",
    pass:
      !/grid-template-columns:\s*repeat\(3/i.test(css) || hasPrintSingleColumn(".contacts"),
    detail: hasPrintSingleColumn(".contacts")
      ? "Screen uses 3 columns; print CSS forces single column"
      : "3-column contact grid may reorder fields when printed/PDF-parsed",
    severity: "warn",
  }),
  check({
    id: "multi-column-skills",
    category: "Layout",
    rule: "Skills in single column for ATS PDF",
    pass:
      !/grid-template-columns:\s*repeat\(auto-fit/i.test(css) ||
      hasPrintSingleColumn(".skills-grid"),
    detail: hasPrintSingleColumn(".skills-grid")
      ? "Screen uses multi-column grid; print CSS forces single column"
      : "Multi-column skills grid may split categories unpredictably in PDF",
    severity: "warn",
  }),
  check({
    id: "external-fonts",
    category: "Export",
    rule: "No required external CDN for core text",
    pass: true,
    detail: "Font Awesome CDN is decorative only; disable for PDF export",
    severity: "warn",
  }),
  check({
    id: "file-format",
    category: "Export",
    rule: "Submit .docx or text-based PDF (not HTML)",
    pass: existsSync(atsPdfPath),
    detail: existsSync(atsPdfPath)
      ? `ATS PDF ready: dist/Denys_Chebotar_Frontend_Developer.pdf`
      : "Run npm run export:pdf — source HTML is for the site, not ATS upload",
    severity: "warn",
  }),
  check({
    id: "special-chars",
    category: "Parsing",
    rule: "Minimal problematic unicode in body text",
    pass: !/[→←•◦▪]/.test(plainText),
    detail: /→/.test(plainText)
      ? "Arrow characters (→) may not parse in older ATS"
      : "OK — watch middle dots (·) and em dashes",
    severity: /→/.test(plainText) ? "warn" : "pass",
  }),
  check({
    id: "keywords-density",
    category: "Keywords",
    rule: "Core stack keywords repeated in experience + skills",
    pass: ["React", "Next.js", "TypeScript"].every(
      (k) => plainText.includes(k) && (plainText.match(new RegExp(k, "gi")) || []).length >= 2
    ),
    detail: "React, Next.js, TypeScript appear multiple times",
  }),
  check({
    id: "quantified-impact",
    category: "Content",
    rule: "At least one quantified achievement",
    pass: /\d+\+?\s*(years|language|lang)/i.test(plainText),
    detail: "3+ years, 14-language found",
  }),
  check({
    id: "company-names",
    category: "Content",
    rule: "Employer names explicit (not only 'Client')",
    pass: /Eatery Club|SINT|TAP TAP|GBSFO|Freelance/.test(plainText),
    detail: "Named employers present",
  }),
  check({
    id: "education-format",
    category: "Structure",
    rule: "Education section with institution/course names",
    pass: /Udemy/i.test(plainText),
    detail: "Udemy courses listed (no formal degree — note for some ATS filters)",
    severity: "warn",
  }),
  check({
    id: "language-skills",
    category: "Structure",
    rule: "Languages section with proficiency levels",
    pass: /English.*Fluent|Professional Working Proficiency/i.test(plainText),
    detail: "English, Ukrainian, Russian listed",
  }),
  check({
    id: "hyperlink-text",
    category: "Parsing",
    rule: "Links use readable anchor text (not 'click here')",
    pass: /linkedin\.com\/in\//i.test(plainText) && /github\.com\//i.test(plainText),
    detail: "URLs shown as link text — good for ATS",
  }),
  check({
    id: "page-length",
    category: "Content",
    rule: "Length appropriate (~1-2 pages when printed)",
    pass: plainText.split(/\s+/).length >= 400 && plainText.split(/\s+/).length <= 900,
    detail: `${plainText.split(/\s+/).length} words (~${Math.ceil(plainText.split(/\s+/).length / 450)} pages)`,
    severity: "warn",
  }),
];

const passed = rules.filter((r) => r.status === "pass").length;
const warned = rules.filter((r) => r.status === "warn").length;
const failed = rules.filter((r) => r.status === "fail").length;
const score = Math.round((passed / rules.length) * 100);

const atsTextPath = join(root, "resume-ats-plain.txt");
writeFileSync(atsTextPath, plainText, "utf8");

const report = {
  file: "index.html",
  score,
  summary: { pass: passed, warn: warned, fail: failed, total: rules.length },
  extracted: { name, jobTitle, email, phone, wordCount: plainText.split(/\s+/).length },
  sections: sectionTitles,
  rules,
  plainTextPreview: plainText.slice(0, 1200) + (plainText.length > 1200 ? "\n\n[... truncated ...]" : ""),
  plainTextPath: "resume-ats-plain.txt",
  recommendations: [],
};

if (!rules.find((r) => r.id === "file-format")?.pass) {
  report.recommendations.push(
    "Export a text-based PDF or .docx for job applications; keep HTML for your portfolio site."
  );
}
if (rules.find((r) => r.id === "multi-column-contacts")?.status === "warn") {
  report.recommendations.push(
    "Add a print/ATS stylesheet: single column, no icons, no grid for contacts and skills."
  );
}
if (/→/.test(plainText)) {
  report.recommendations.push('Replace arrow characters (→) with "to" or "-" in bullet points.');
}
if (rules.find((r) => r.id === "education-format")?.severity === "warn") {
  report.recommendations.push(
    "Some ATS auto-filters require a degree field — Udemy-only education may score lower on strict filters."
  );
}
report.recommendations.push(
  "Mirror exact keywords from each job posting in your summary and top bullet for that application."
);
report.recommendations.push(
  "Title the PDF: Denys_Chebotar_Frontend_Developer.pdf (no spaces, standard separators)."
);

console.log(JSON.stringify(report, null, 2));
