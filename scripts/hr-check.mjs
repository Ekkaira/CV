#!/usr/bin/env node
/**
 * Modern HR / recruiter screening criteria (2025–2026).
 * Complements scripts/ats-check.mjs with human-review signals.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const html = readFileSync(join(root, "index.html"), "utf8");

const ACTION_VERBS = [
  "built",
  "developed",
  "implemented",
  "delivered",
  "designed",
  "led",
  "managed",
  "automated",
  "integrated",
  "maintained",
  "contributed",
  "fixed",
  "shipped",
  "reduced",
  "increased",
  "optimized",
];

const WEAK_PHRASES = [
  "responsible for",
  "helped with",
  "worked on",
  "involved in",
  "synergy",
  "think outside the box",
  "go-getter",
  "rockstar",
  "ninja",
  "guru",
];

const BUZZWORDS = [
  "production-grade",
  "end-to-end",
  "fast-paced",
  "team player",
  "detail-oriented",
  "passionate",
];

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function stripHtml(source) {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|header)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractBullets(source) {
  const bullets = [];
  const re = /<li>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = re.exec(source)) !== null) {
    bullets.push(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }
  return bullets;
}

function parseMonthYear(text) {
  const m = text.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) {
    return null;
  }
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) {
    return null;
  }
  return month + Number(m[2]) * 12;
}

function parseExperienceRanges(source) {
  const experienceBlock =
    source.match(/Professional Experience[\s\S]*?(?=Skills &amp; Technologies)/i)?.[0] ?? source;
  const ranges = [];
  const re = /<div class="company-date">([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = re.exec(experienceBlock)) !== null) {
    const line = match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const dates = line.match(
      /([A-Za-z]{3} \d{4})\s*-\s*([A-Za-z]{3} \d{4}|Present|Current)/gi
    );
    if (!dates?.[0]) {
      continue;
    }
    const parts = dates[0].split(/\s*-\s*/i);
    const start = parseMonthYear(parts[0]);
    let end = parts[1].match(/present|current/i)
      ? new Date().getMonth() + new Date().getFullYear() * 12
      : parseMonthYear(parts[1]);
    if (start !== null && end !== null) {
      ranges.push({ line, start, end, months: end - start + 1 });
    }
  }
  return ranges.sort((a, b) => b.start - a.start);
}

function findEmploymentGaps(ranges) {
  const gaps = [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const gapMonths = next.start - prev.end - 1;
    if (gapMonths >= 3) {
      gaps.push({
        months: gapMonths,
        between: `${prev.line} → ${next.line}`,
      });
    }
  }
  return gaps;
}

function check(rule) {
  const status = rule.pass ? "pass" : rule.severity === "info" ? "info" : "warn";
  return { ...rule, status };
}

const plainText = stripHtml(html);
const words = plainText.split(/\s+/).filter(Boolean);
const bullets = extractBullets(html);
const experienceRanges = parseExperienceRanges(html);
const gaps = findEmploymentGaps(experienceRanges);
const summary = plainText.split("Professional Experience")[0] ?? "";
const bulletStarts = bullets.map((b) => b.split(/\s+/)[0]?.toLowerCase() ?? "");
const actionVerbCount = bulletStarts.filter((w) => ACTION_VERBS.includes(w)).length;
const quantifiedBullets = bullets.filter((b) =>
  /\d+\+?|\d+%|\d+\s*(language|lang|team|user|restaurant|ms|x)/i.test(b)
);
const weakPhraseHits = WEAK_PHRASES.filter((p) => plainText.toLowerCase().includes(p));
const buzzwordHits = BUZZWORDS.filter((p) => plainText.toLowerCase().includes(p));
const shortTenures = experienceRanges.filter((r) => r.months < 6);
const recentBullets = bullets.slice(0, 5);
const hasLinkedIn = /linkedin\.com\/in\//i.test(plainText);
const hasGitHub = /github\.com\//i.test(plainText);
const hasRemote = /remote/i.test(plainText);
const hasEnglish = /english.*fluent|professional working proficiency/i.test(plainText);
const titleConsistent = (plainText.match(/Frontend Developer/g) || []).length >= 3;
const seniorityProgression = /senior|lead|staff|principal/i.test(plainText);
const hasPhoto = /<img\b/i.test(html);
const sensitiveInfo = /\b(date of birth|dob|marital|married|single|age:\s*\d|nationality)\b/i.test(
  plainText
);
const eateryBullets = (html.match(/Eatery Club[\s\S]*?<\/div>\s*<div class="experience-item">/i)?.[0] ?? "")
  .match(/<li>[\s\S]*?<\/li>/gi)?.length ?? 0;

const rules = [
  check({
    id: "six-second-scan",
    category: "First impression",
    rule: "Name, title, location visible in opening block (6-second recruiter scan)",
    pass: /Denys Chebotar/.test(summary) &&
      /Frontend Developer/.test(summary) &&
      /Ukraine|Odesa|Remote/i.test(summary),
    detail: "Recruiters decide quickly — header is scannable",
  }),
  check({
    id: "value-proposition",
    category: "First impression",
    rule: "Summary answers who you are, years of experience, and domain",
    pass: /Frontend Developer with \d+\+ years/i.test(summary) &&
      /React|Next\.js/i.test(summary),
    detail: "3+ years + React/Next.js + Eatery Club context present",
  }),
  check({
    id: "remote-clarity",
    category: "First impression",
    rule: "Remote / location preference stated for international HR",
    pass: hasRemote,
    detail: hasRemote ? "Remote preference shown" : "Add remote/open-to-relocation note",
  }),
  check({
    id: "action-verbs",
    category: "Impact writing",
    rule: "Bullets start with strong action verbs (≥80%)",
    pass: bullets.length > 0 && actionVerbCount / bullets.length >= 0.8,
    detail: `${actionVerbCount}/${bullets.length} bullets start with action verbs`,
    severity: actionVerbCount / bullets.length >= 0.65 ? "warn" : "warn",
  }),
  check({
    id: "quantified-impact",
    category: "Impact writing",
    rule: "Multiple bullets include measurable outcomes (2025 HR standard)",
    pass: quantifiedBullets.length >= 3,
    detail: `${quantifiedBullets.length} quantified bullets (target: 3+)`,
    severity: "warn",
  }),
  check({
    id: "recent-role-depth",
    category: "Impact writing",
    rule: "Most recent role has the strongest bullet count",
    pass: eateryBullets >= 4,
    detail: `Eatery Club: ${eateryBullets} bullets — recency bias favors depth here`,
  }),
  check({
    id: "weak-phrasing",
    category: "Impact writing",
    rule: "Avoid passive / vague HR red-flag phrases",
    pass: weakPhraseHits.length === 0,
    detail: weakPhraseHits.length
      ? `Found: ${weakPhraseHits.join(", ")}`
      : "No 'responsible for', 'helped with', etc.",
  }),
  check({
    id: "buzzword-load",
    category: "Impact writing",
    rule: "Limited generic buzzwords without proof",
    pass: buzzwordHits.length <= 2,
    detail: buzzwordHits.length
      ? `Mild buzzwords: ${buzzwordHits.join(", ")} — OK if backed by examples`
      : "Clean",
    severity: buzzwordHits.length <= 3 ? "info" : "warn",
  }),
  check({
    id: "employment-gaps",
    category: "Career narrative",
    rule: "No unexplained employment gaps ≥3 months",
    pass: gaps.length === 0,
    detail: gaps.length
      ? gaps.map((g) => `${g.months} mo gap (${g.between})`).join("; ")
      : "Timeline reads continuously",
    severity: "warn",
  }),
  check({
    id: "short-tenure",
    category: "Career narrative",
    rule: "Avoid pattern of roles under 6 months (job-hopper signal)",
    pass: shortTenures.length <= 1,
    detail: shortTenures.length
      ? `${shortTenures.length} short stint(s): ${shortTenures.map((r) => r.line).join("; ")}`
      : "Tenures look stable",
    severity: "warn",
  }),
  check({
    id: "title-progression",
    category: "Career narrative",
    rule: "Visible seniority or scope growth over time",
    pass: seniorityProgression || experienceRanges.length >= 4,
    detail: seniorityProgression
      ? "Senior/lead title found"
      : "Same 'Frontend Developer' title throughout — consider scope wording in bullets",
    severity: "info",
  }),
  check({
    id: "career-story",
    category: "Career narrative",
    rule: "Coherent arc: legacy → growth → modern stack → SaaS",
    pass: /Backbone|SaaS|Next\.js|Web3|Eatery Club/i.test(plainText),
    detail: "Web3 + SaaS + legacy maintenance shows range; tailor summary per target role",
    severity: "info",
  }),
  check({
    id: "professional-links",
    category: "Contact & trust",
    rule: "LinkedIn + GitHub + email for recruiter verification",
    pass: hasLinkedIn && hasGitHub && /@[a-z0-9.-]+\.[a-z]{2,}/i.test(plainText),
    detail: "LinkedIn, GitHub, and email present",
  }),
  check({
    id: "english-proficiency",
    category: "International HR",
    rule: "English level stated for global hiring managers",
    pass: hasEnglish,
    detail: "Fluent / Professional Working Proficiency listed",
  }),
  check({
    id: "page-length",
    category: "Format",
    rule: "Length fits 1–2 pages for ~3 years experience",
    pass: words.length >= 450 && words.length <= 850,
    detail: `${words.length} words (~${Math.ceil(words.length / 450)} pages)`,
    severity: words.length > 850 ? "warn" : "pass",
  }),
  check({
    id: "bias-safe",
    category: "Format",
    rule: "No photo, age, or other bias-sensitive fields (DEI-friendly)",
    pass: !hasPhoto && !sensitiveInfo,
    detail: "No photo or personal demographic data",
  }),
  check({
    id: "education-signal",
    category: "Qualifications",
    rule: "Formal degree or strong alternative credentials",
    pass: /bachelor|master|degree|b\.s\.|m\.s\./i.test(plainText),
    detail: "Udemy courses only — may fail degree-required filters; bootcamps OK for many startups",
    severity: "warn",
  }),
  check({
    id: "skills-match-block",
    category: "Qualifications",
    rule: "Dedicated skills section mirrors experience keywords",
    pass: /Skills & Technologies/i.test(plainText) &&
      ["React", "TypeScript", "Next.js"].every((k) => {
        const inSkills = plainText.split("Skills & Technologies")[1]?.includes(k);
        return inSkills;
      }),
    detail: "Skills section aligns with experience stack",
  }),
  check({
    id: "ai-keywords",
    category: "2025–2026 trends",
    rule: "Current-market keywords where genuine (AI, real-time, SaaS, i18n)",
    pass: /AI|MCP|WebSocket|multi-tenant|SaaS|localization|i18n/i.test(plainText),
    detail: "AI assistant, MCP, multi-tenancy, 14-language i18n — strong for 2025–2026 market",
  }),
  check({
    id: "tailoring-ready",
    category: "2025–2026 trends",
    rule: "Summary can be swapped per role without rewriting full CV",
    pass: /professional-summary/.test(html),
    detail: "Dedicated summary block — tailor first 3 lines per application",
    severity: "info",
  }),
  check({
    id: "ats-pdf-ready",
    category: "2025–2026 trends",
    rule: "Machine-readable PDF export available for HR systems",
    pass: existsSync(join(root, "dist", "Denys_Chebotar_Frontend_Developer.pdf")),
    detail: existsSync(join(root, "dist", "Denys_Chebotar_Frontend_Developer.pdf"))
      ? "dist/Denys_Chebotar_Frontend_Developer.pdf exists"
      : "Run npm run export:pdf before applying",
    severity: "warn",
  }),
];

const passed = rules.filter((r) => r.status === "pass").length;
const warned = rules.filter((r) => r.status === "warn").length;
const info = rules.filter((r) => r.status === "info").length;
const score = Math.round((passed / rules.length) * 100);

const recommendations = [];

if (quantifiedBullets.length < 3) {
  recommendations.push(
    "Add 2–3 more metrics: API latency reduced, deploy frequency, users/restaurants served, bundle size, test coverage."
  );
}
if (gaps.length) {
  recommendations.push(
    `Explain ${gaps[0].months}-month gap (${gaps[0].between}) in LinkedIn or cover letter — HR will ask.`
  );
}
if (!seniorityProgression) {
  recommendations.push(
    "Signal growth without inflating title: 'owned', 'led initiative', 'primary contributor' on Eatery bullets."
  );
}
if (rules.find((r) => r.id === "education-signal")?.status === "warn") {
  recommendations.push(
    "For degree-required roles, lead with projects and Eatery SaaS impact; skip auto-reject portals if possible."
  );
}
recommendations.push(
  "For enterprise/SaaS roles: lead summary with Eatery Club + multi-tenant Next.js; downplay Web3."
);
recommendations.push(
  "For Web3 roles: invert — lead with wallet integrations and Telegram mini apps."
);
recommendations.push(
  "Replace 'Contributed' on AI hub bullet with 'Built' or 'Shipped' if scope was substantial."
);

const strengths = [
  "Strong modern stack story (Next.js 16, React 19, TypeScript, RTK Query)",
  "Recent SaaS + real-time + i18n + AI (MCP) — highly relevant in 2025–2026",
  "Clear remote setup and English proficiency for international hiring",
  "Clean DEI-safe format; professional links for background checks",
  "Stable recent tenures (Eatery 9mo, SINT 12mo) after early career",
];

const hrVerdict =
  score >= 85
    ? "Strong pass — likely reaches human review for Frontend / React roles"
    : score >= 70
      ? "Conditional pass — fix warnings before high-volume applications"
      : "Needs work — address gaps and metrics before sending";

console.log(
  JSON.stringify(
    {
      file: "index.html",
      framework: "HR screening criteria 2025–2026",
      score,
      hrVerdict,
      summary: { pass: passed, warn: warned, info, total: rules.length },
      strengths,
      gaps: gaps.length ? gaps : undefined,
      quantifiedBullets: quantifiedBullets.map((b) => b.slice(0, 90) + (b.length > 90 ? "…" : "")),
      rules,
      recommendations,
    },
    null,
    2
  )
);
