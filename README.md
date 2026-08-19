# Personal CV Website

A clean, modern, and responsive CV website built with HTML and CSS, plus ATS export tooling.

## Features

- Responsive design that works on all devices
- Clean and professional layout
- Interactive contact links
- Organized sections for experience, skills, and education
- ATS-friendly print styles and PDF export

## Structure

- `index.html` — main CV content
- `styles.css` — styling, including `@media print` for ATS/PDF
- `scripts/ats-check.mjs` — ATS compatibility audit
- `scripts/hr-check.mjs` — HR / recruiter screening criteria (2025–2026)
- `scripts/export-pdf.mjs` — exports `dist/Denys_Chebotar_Frontend_Developer.pdf`

## Setup

1. Clone the repository
2. Open `index.html` in your browser

## ATS workflow

Install tooling once:

```bash
npm install
npx playwright install chromium
```

Export an ATS-ready PDF and run the audit:

```bash
npm run export:ats
npm run review:cv    # HR + ATS reports together
```

Or run steps separately:

```bash
npm run export:pdf   # writes dist/Denys_Chebotar_Frontend_Developer.pdf
npm run hr:check     # HR recruiter criteria
npm run ats:check    # JSON report + resume-ats-plain.txt
```

Upload **`dist/Denys_Chebotar_Frontend_Developer.pdf`** to job portals. Keep the HTML site for your portfolio.

Manual fallback: open `index.html` in Chrome → Print → Save as PDF.

## Development

1. Edit `index.html` for content changes
2. Edit `styles.css` for styling changes
3. Run `npm run export:ats` before applying to jobs

## Contact

For any questions or suggestions, please contact me at denysxchebotar@gmail.com
