# Coach Desk — guide for coding agents

This file is the shared brief for **Claude Code** (via `CLAUDE.md`) and **OpenAI Codex** (which reads `AGENTS.md`). Read it before changing anything.

## What this is

An offline-first app for a part-time personal trainer: clients and intake (with PAR-Q+ health screening), an exercise library, a program builder with templates, session mode for logging a client's workout, packages, bookings and a home screen of what needs attention. It started from Life Dashboard's code and patterns and is a separate app, because it holds other people's health information.

There is no framework, build step for the JavaScript, or application server. The app is `index.html` plus classic scripts in `js/` that share one global scope. Compiled Tailwind CSS lives in `assets/app.css` and the pinned Lucide icon bundle in `vendor/`. All records live in the browser (IndexedDB `coach-desk`). Opening `index.html` from disk (`file://`) works and is how the tests run.

## Golden rules

1. **Never break saved records.** A trainer's client history must never need re-entering after an update.
   - Changes to stored data are **additive only**. New fields are optional and read with fallbacks (`c.notes || []`).
   - New collections go in `COLLECTIONS` with a default; `ensureSeeds()` and `Store.init()` fill in anything missing.
   - Never rename or delete a collection key, a localStorage key (`cd.*`), the IndexedDB name (`coach-desk`) or its store (`kv`). Never bump the DB version without an `onupgradeneeded` path that keeps the existing data.
   - Every record has `id`, `created` and `updated`. Call `stamp(record)` on every edit; a later Drive sync merges by `id` and keeps the newer `updated`.
2. **Client data never goes in the repo.** No real names, health details, backups or client exports in code, tests, fixtures or screenshots. `.gitignore` blocks `coach-desk-*.json` and `*backup*.json`. Tests use made-up people.
3. **Keep the app generic.** Others may use the hosted copy. No personal names or business names in headings, placeholders, seed data or exports; those come from Settings (`S.trainer`, `S.business`).
4. **Stay within a trainer's role.** Health screening records which PAR-Q+ questions were answered yes (short summaries in `PARQ`; the client completes the official form at eparmedx.com). Any yes locks sessions until a clearance date is recorded. Nutrition, when it comes, is targets, habits, sample days and food logging, not meal plans that treat medical conditions.
5. **Preserve the design.** Use the existing Tailwind patterns and components (`card`, `btn`, `btn-primary`, `chip`, `chip-on`, `stat`, `label`, `input`, `muted`). Every new UI needs `dark:` variants and must work at 390px wide.
6. **Run the checks before you finish:** `npm test`, or at least `npm run check`.

## Run, check, test

```bash
npm install                 # dev tools only — the app has no npm dependencies
npm run build:css           # rebuild assets/app.css after changing classes or src/app.css
npm start                   # serves http://localhost:8080
npm run check               # static check: syntax, duplicate names, action names, offline file list, icon names
npx playwright install chromium   # once
npm test                    # build:css + check + Playwright tests (fresh, empty profile each run)
```

Storage is per origin: `file://`, `http://localhost:8080` and the hosted address each keep separate records.

## Architecture

`index.html` holds the shell (sidebar `#nav`, header, `#view`, `#modal`, toasts, `#print`) and loads these scripts in order. Later files may use anything defined in earlier ones.

| File | What's there |
|---|---|
| `js/core.js` | Utilities (`$`, `esc`, `uid`, `ymd`, `addDays`, `fmtDate`, `num`, `download`, `copyText`, `icon()`), settings `S` (`cd.settings`), units (lifts stored in kg, distance in km), `COLLECTIONS`, `Store`, `stamp()`, UI primitives (`toast`, `Modal`, `modalShell`, `ask()` for confirmations, `tabs`, `cardHead`, `emptyState`, `field`), router (`VIEWS`, `render()`, `go()`, `NAV_COUNTS`, bottom bar), rest `Timer`, core actions `A` |
| `js/library.js` | `EX_TYPES`, `DEFAULT_LIB` and `DEFAULT_SWAPS` (starter library), `exFor(item)`, the Exercises screen, exercise modal, and the shared exercise picker (`openPicker`, `PICK_HANDLERS`) |
| `js/programs.js` | `PROGRESSIONS`, program helpers (`repRange`, `programWeek`, `isDeload`, `nextDay`, `activeProgram`), `sampleTemplates()`, the Programs screen, `editorHtml()` (one editor for templates and client copies), `assignProgram()`, the program sheet (`sheetText`, `sheetHtml`, print) |
| `js/clients.js` | `PARQ`, `parqStatus()`, package helpers (`pkgLeft`, `currentPackage`), the Clients list and client page (Overview, Program, Sessions, Packages tabs), intake, screening, package and booking modals, `deleteClient()`, client export |
| `js/sessions.js` | Session mode: `startModal()`, `startSession()`, `lastPerformance()`, `suggestion()` (next weight from the progression rule), set logging, finish (counts against a package) |
| `js/home.js` | `attentionItems()`, the Home screen, the + sheet (`QUICK_ADD`) |
| `js/settings.js` | Settings modal, `buildBackup()`, `validateBackup()`, `planImport()` (merge keeps the newer `updated`; replace matches the file), `commitImport()` (one IndexedDB transaction) |
| `js/app.js` | `Object.assign(A, A_LIB, A_PROG, A_CLIENTS, A_SESS, A_HOME, A_SET)`, `ensureSeeds()`, event wiring, `init()` |
| `sw.js` | Offline shell, registered on https only (`?pwa` on localhost for tests). Update `SHELL` when a file is added or renamed; `npm run check` catches a missing one. |

See `docs/DATA_MODEL.md` for every stored collection.

### Core patterns

- **Rendering:** screens are functions returning HTML strings; `render()` rebuilds `#view`. Escape every user string with `esc()`; use `webUrl()` for links.
- **Events:** never attach listeners to elements. Put `data-action` (click), `data-change`, `data-input` or `data-submit` on the element and add a handler to the module's action table. `npm run check` flags collisions and names with no handler.
- **Saving:** mutate `Store.get(key)`, call `stamp()` on the record, then `Store.save(key)`; or `Store.set(key, value)`. Then `render()`.
- **Text fields in editors save on change without re-rendering** (see `peSet`, `peItemSet`, `ssSet`), so tapping from one field to the next never loses the tap. Re-render only for structural changes.
- **UI state** that shouldn't persist goes on `ui`; preferences go on `S` plus `saveSettings()`.
- **Confirmations:** use `ask(title, body, okLabel, run)`, never `confirm()`.
- **Icons:** `icon('lucide-name')`; the bundle is pinned at `vendor/lucide/lucide-1.55.0.min.js` and `npm run check` confirms names exist.
- **Top-level names are global across all files.** Search before adding `function foo` or `const foo`.

## Roadmap (agreed 2026-10-22/23)

The plan page is the "Trainer App Master Plan" artifact. Decisions: build as option 2 (the trainer's app plus a private link per client), 6–15 clients in the first year, in person and online, clients will see their program, log workouts, send weekly check-ins and log food; full food logging; payments held for later; client records sync to a separate Gmail account the owner chose (not the church Workspace; its address is not kept in this public repo); no rush.

- **Phase 1 (built):** this app — clients and intake with PAR-Q+, exercise library, program builder with templates and progression rules, session mode with last time's numbers and the suggested weight, packages, bookings, program sheet, home screen, backups.
- **Next in Phase 1:** Drive sync to that Gmail account's `appDataFolder`, ported from Life Dashboard (`syncMerge`, safeguards, daily copies). Needs a Google Cloud project with an OAuth client for the hosted address first.
- **Phase 2:** a private link per client served by the Cloudflare Worker (like Life Dashboard's Morning brief): today's session, the week, targets, set logging, weekly check-in, saves without signal, entries land in a Drive drop box (like Claude's inbox) and join the client's records on the next sync; replace or turn off a link.
- **Phase 3:** per-client targets from Life Dashboard's adaptive plan, habit goals, food logging on the link (search via the Worker's existing food search, barcodes), sample days from recipes, progress charts and a four-week report, optional progress photos.
- **Phase 4:** Google Calendar, leads and renewals; packages with payment links are **held for later** by the owner's choice.
