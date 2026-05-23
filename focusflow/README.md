# FocusFlow — Personal Productivity Tracker

**By Omar Mohamed**

A full-featured personal productivity web app with Pomodoro timer, sleep tracking, habit builder, and analytics dashboard. Runs entirely in the browser — no server needed.

## Features

- **Pomodoro Timer** — Focus sessions with ring progress, sound alerts (bell + tick), auto-start breaks, adjustable durations, and session dots
- **Sleep Tracker** — Log bedtime/wake-up, track sleep quality with star ratings, view weekly charts, history, and stats
- **Habit Tracker** — Build daily habits with custom emojis, weekly grid view, and streak tracking
- **Analytics Dashboard** — 14-day focus chart, sleep vs focus scatter plot, daily breakdown pie chart, full activity log
- **User Accounts** — Register/login, upload a profile photo, set focus and sleep goals, earn achievement badges
- **Fully Offline** — All data saved in localStorage, works without internet after first load

## Live Demo

Hosted at: `https://<your-username>.github.io/focusflow`

## Deploy to GitHub Pages (free)

1. Create a new GitHub repository named `focusflow`
2. Upload all files maintaining the folder structure:
   ```
   index.html
   css/style.css
   js/app.js
   README.md
   ```
3. Go to **Settings → Pages**
4. Under **Source**, select `main` branch, root folder `/`
5. Click **Save** — your site will be live in ~1 minute at `https://<username>.github.io/focusflow`

## Folder Structure

```
focusflow/
├── index.html         ← Main app
├── css/
│   └── style.css      ← All styles (light + dark mode)
├── js/
│   └── app.js         ← All logic (timer, sleep, habits, analytics)
└── README.md
```

## Tech Stack

- Vanilla HTML/CSS/JavaScript — zero build tools, zero dependencies to install
- [Chart.js](https://www.chartjs.org/) — charts via CDN
- [Tabler Icons](https://tabler.io/icons) — icons via CDN
- `localStorage` — all data persisted in browser

## Data Privacy

All data is stored locally in your browser. Nothing is sent to any server. Clearing browser storage will erase your data — consider exporting important logs.

---

Made with focus ☕ by **Omar Mohamed**
