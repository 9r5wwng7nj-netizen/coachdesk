# Coach Desk

Clients, programs and sessions for personal trainers. It works offline, installs on a phone's home screen, and keeps every record on your own device.

- **Clients:** goals, training background, injuries and limits, PAR-Q+ health screening with a clearance lock, waiver and consent dates, emergency contact, notes.
- **Programs:** an exercise library with coaching cues, demo links and swaps; templates with days, sets, rep ranges, rest, RPE, a progression rule and lighter weeks. Assigning a template gives the client their own copy to adjust.
- **Session mode:** today's workout for the client in front of you, last time's numbers, the suggested weight, a rest timer, and finishing counts the session against their package.
- **Home:** today's bookings, the week ahead, and what needs attention (screening, waivers, packages running low, programs ending, clients gone quiet, sessions not logged, birthdays, backups).
- **Program sheet:** copy as text for a message, or print and save as a PDF.

## Your records

Records stay in the browser on the device you use. There is no server. Download a backup from **Settings & backup** each week and keep it somewhere private: it holds client health information. Restoring checks the whole file first, so a bad file changes nothing.

On an iPhone, the app added to the home screen keeps its own records, separate from Safari.

## Development

```bash
npm install
npx playwright install chromium   # once
npm test                          # builds CSS, runs the static check and the browser tests
npm start                         # http://localhost:8080
```

See [AGENTS.md](AGENTS.md) for how the code is organized and the rules for changing it, and [docs/DATA_MODEL.md](docs/DATA_MODEL.md) for what is stored.
