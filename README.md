# Pryvix — GoHighLevel Landing Page Studio

**Pryvix** is a professional local desktop application designed for surgical, source-preserving GoHighLevel (GHL) landing page content replacement, responsive visual asset management, background video/static template configuration, GHL form management, and 100% fidelity production HTML export.

The application eliminates the need to manually search through hundreds or thousands of lines of HTML, CSS, and JavaScript whenever an image URL, form embed, campaign graphic, or responsive component needs to be changed.

---

## Key Features

1. **Automatic HTML Code Scanning & Analysis**
   - Automatically detects standard `<img>` tags, `<picture>` elements, responsive `<source media="...">` tags, CSS `background-image` declarations (including inside responsive `@media` queries), inline styles, SVG assets, and video poster elements.
   - Automatically assigns understandable, descriptive labels based on structural context, container classes, and comments (e.g. *Hero Background – Desktop*, *Hero Branding – Tablet/Mobile*, *Popup Banner – Mobile*, *Prize Banner – Desktop*, *Campaign Details Graphic – Desktop*, *Read More Button*, *Scroll to Top Icon*, *Form Background Image*).

2. **Visual Image & Asset Manager**
   - Every detected graphic is displayed as an individual editable asset card.
   - Independent desktop, tablet, and mobile configurations so responsive images can be edited without overwriting their desktop/mobile counterparts.
   - Live URL validation with real-time indicators for Valid URLs, Invalid URLs, and Unhosted Local Computer Paths.
   - Actions to replace URLs, upload replacements, select from the reusable library, preview images, jump directly to code, or restore original imported values.

3. **Built-in Reusable Image Library**
   - Maintain a local catalog of reusable campaign banners, hero images, logos, icons, backgrounds, popups, and buttons.
   - Upload local images or register publicly accessible CDN URLs.
   - Categorize, filter, search, preview, and copy image links.
   - Built-in GoHighLevel CDN notice ensuring local computer paths are not exported directly to production.

4. **Live Responsive Visual Editor**
   - Side-by-side split view or full-preview canvas.
   - Viewport modes: Desktop (1440px), Tablet (768px), Mobile (390px), and Custom dimensions.
   - Sandboxed preview context protecting the application from arbitrary script execution.

5. **Dedicated GoHighLevel Form Manager**
   - Manages separate Desktop and Mobile form instances (e.g. desktop form with `login_token` and `event_id` tracking cookies vs mobile form with `login_token`).
   - Updating Form ID automatically updates all iframe attributes, URLs, and related initialization scripts synchronously.
   - Preserves custom campaign closing logic (`{{custom_values.gtagaming_gift_cards_form_closing}}`).
   - 100% offline functionality without requiring private GoHighLevel API keys.

6. **Direct Monaco Code Editor**
   - Integrated Monaco Editor for HTML, CSS, JavaScript, and Full Document editing.
   - Syntax highlighting, error checking, bracket colorization, auto-formatting, find & replace.
   - Deep source navigation: clicking line references in asset cards or form settings scrolls the editor directly to that exact line.
   - Surgical source-preserving synchronization that maintains code comments, indentation, and structure.

7. **Code Quality Assurance & Validation Engine**
   - Scans HTML structure, duplicate element IDs, unclosed tags, and image URL accessibility.
   - Flags missing responsive assets and unhosted local file paths.
   - Validates GoHighLevel form IDs, embed scripts, and tracking tokens.
   - Clickable diagnostic reports jumping directly to problem lines.

8. **Export & Backup Management**
   - "Export Complete HTML" generates clean, fully functional code ready for GoHighLevel Custom HTML sections.
   - One-click copy to clipboard, file download, asset manifest generation, and portable JSON project backups.

---

## Technology Stack

- **Desktop Framework:** Electron
- **Frontend Framework:** React 18 with TypeScript
- **Styling:** Tailwind CSS (Studio Pro Dark Theme)
- **Icons:** Lucide React
- **Code Editor:** Monaco Editor (`@monaco-editor/react`)
- **Build System:** Vite & esbuild
- **Persistence:** Local Storage / Offline SQLite & JSON backup

---

## Getting Started

### Prerequisites

- Node.js 18+ (tested on Node v24)
- npm 9+

### Installation

```bash
npm install --ignore-scripts
```

### Running in Development

To start the Vite live dev server:

```bash
npm run dev
```

To run the complete Electron desktop application:

```bash
npm run build
npm start
```

### Automated Verification Test Suite

Run the full end-to-end automated QA suite:

```bash
npm test
```

---

## Security Architecture

- **Context Isolation:** Enabled.
- **Node Integration in Renderer:** Disabled.
- **Sandbox:** Enabled.
- **Content Security Policy (CSP):** Strictly enforced.
- **Untrusted Code Execution:** Previews run in restricted iframe sandboxes (`sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`).
- **Credentials:** No private tokens or secrets are ever bundled into exported HTML.
