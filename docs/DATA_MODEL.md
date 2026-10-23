# Data model

Everything is stored in IndexedDB database `coach-desk`, object store `kv`, one key per collection (localStorage `cd.data.<key>` if IndexedDB is unavailable). Settings are in localStorage `cd.settings`; the rest timer in `cd.timer`; `cd.seeded` marks that the sample templates were added once.

Every record has `id` (string), `created` and `updated` (ISO timestamps, set by `stamp()`). Changes are additive: new fields are optional and read with fallbacks. Weights are stored in **kg** and distances in **km**, whatever unit is shown.

| Key | Default | Shape |
|---|---|---|
| `clients` | `[]` | `{ id, name, status: 'active'|'lead'|'paused'|'past', where: 'in-person'|'online'|'both', phone, email, birthday, goals, history, limits, emergency: { name, phone }, parq: { date, yes: [1–7], note, cleared }, waiver, consent, notes: [{ id, date, text }] }` |
| `packages` | `[]` | `{ id, clientId, name, sessions, start, expires, usedBefore, note }`. Sessions used = `usedBefore` + sessions with this `packageId`. |
| `appointments` | `[]` | `{ id, clientId, date, time: 'HH:MM'|'' , mins, note, sessionId }`. `sessionId` is set when a session logs the booking. |
| `exercises` | seeded | `{ id, name, type, primary, equipment, cues, video, swaps: [names] }`. `type` is a key of `EX_TYPES`. |
| `templates` | 3 samples | `{ id, name, goal, weeks, deload, progression: 'double'|'linear'|'none', inc (kg), days: [{ id, name, notes, items: [{ id, exId, name, sets, reps, rest, rpe, notes }] }] }` |
| `programs` | `[]` | A client's own copy of a template: the template fields plus `{ clientId, templateId, start, status: 'active'|'ended', ended }`. One active program per client. |
| `sessions` | `[]` | `{ id, clientId, programId, dayId, dayName, date, start, end, week, deload, packageId, notes, items: [{ id, exId, name, type, target: { sets, reps, rest, rpe, notes }, sets: [{ id, w, r, d, dist }] }] }`. Only sets ticked done are saved. |
| `activeSession` | `null` | The session in progress: like a session, with `apptId`, `progression`, `inc`, and per item `hint`, `last` and `sets[].done`. |

## Backup file

`{ app: 'coach-desk', version: 1, exportedAt, settings, data: { <every key above> } }`. Checked by `validateBackup()` before anything is changed.

## Client export

**Download their records** on a client's page saves `{ app: 'coach-desk', kind: 'client-records', exportedAt, client, packages, appointments, programs, sessions, exerciseNames }` for a client who asks for a copy.
