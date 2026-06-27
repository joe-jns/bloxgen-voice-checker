# Bloxgen Voice Checker

A Chrome extension (Manifest V3) that tells you, for each account generated on
**bloxgen.net/dashboard/generator**, whether **Roblox voice chat is enabled**.

It reads each account's cookie straight from the Bloxgen API, tests it against
Roblox's voice API, and shows the result inline — **no auto-login, no captcha**.

---

## Table of contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Installation (step by step)](#installation-step-by-step)
- [Usage](#usage)
- [⚠️ Use a dedicated Chrome profile](#️-use-a-dedicated-chrome-profile)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [Limitations](#limitations)
- [Disclaimer](#disclaimer)

---

## What it does

- Injects a real native-looking **`🎙 Voice`** button (it clones the style of Bloxgen's
  own buttons) on every history row **and** on the latest-generated account card.
- Clicking it checks the account. The **mic icon changes color** and the **label updates**:

  | State | Mic | Label | Meaning |
  |-------|-----|-------|---------|
  | Not checked | ⚪ gray | `Voice` | Idle, click to check |
  | Checking | ⚪ gray (pulsing) | `Checking…` | Request in flight |
  | Enabled | 🟢 green | `Voice ON` | Voice chat is enabled |
  | Disabled | 🔴 red | `Voice OFF` | Account alive, voice not enabled |
  | Dead | 🟠 orange | `Dead cookie` | Cookie expired/invalid → regenerate |
  | Error | ⚪ gray | `Error` | API unreachable |

  Hover the button for details (`denialReason`, eligibility, ban status…).

- Popup with a **Check all visible accounts** button (checks every history row at once).

---

## How it works

```
content.js  →  GET api.bloxgen.net/api/accounts/history   (cookie returned in clear text)
background  →  set .ROBLOSECURITY on .roblox.com
            →  GET users.roblox.com/v1/users/authenticated (is the cookie alive?)
            →  GET voice.roblox.com/v1/settings            (isVoiceEnabled)
            →  remove the cookie
```

The decisive field is **`isVoiceEnabled`** from `voice.roblox.com/v1/settings`.

---

## Requirements

- **Google Chrome** (or any Chromium-based browser: Edge, Brave…).
- A **Bloxgen account**, logged in, with generated accounts in your history.

---

## Installation (step by step)

1. **Download the code.**
   - With git: `git clone https://github.com/<your-username>/bloxgen-voice-checker.git`
   - Or click **Code → Download ZIP** on GitHub, then unzip it.

2. Open Chrome and go to `chrome://extensions`.

3. Toggle **Developer mode** ON (top-right corner).

4. Click **Load unpacked**.

5. Select the **`bloxgen-voice-checker`** folder (the one containing `manifest.json`).

6. The extension appears in the list. You're done — no build step, no dependencies.

> Updating later: pull/download the new code, then click the **↻ reload** icon on the
> extension card in `chrome://extensions`.

---

## Usage

1. Go to **https://bloxgen.net/dashboard/generator** and make sure you're logged in.

2. Each account now has a **`🎙 Voice`** button:
   - In the **Generation History** table (one per row).
   - On the **latest-generated account card** at the top.

3. Click a button to check that account — the mic turns 🟢 green (ON) or 🔴 red (OFF).

4. To check everything at once: click the extension icon in the toolbar →
   **Check all visible accounts**.

Checks run one at a time (~instant each), which matches a steady generation pace.

---

## ⚠️ Use a dedicated Chrome profile

The Roblox cookie (`.ROBLOSECURITY`) is **global to the Chrome profile**. During a check
the extension sets it, then removes it. If you are signed in to **your own** Roblox account
in the same profile, this would wipe your session.

➡️ Use a **separate Chrome profile** (or a dedicated browser) for this extension, with no
personal Roblox session signed in.

How to create a profile: Chrome → profile avatar (top-right) → **Add** → **Continue without
an account**. Install the extension in that profile.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Buttons don't appear | Make sure you're on `bloxgen.net/dashboard/generator` and logged in. Reload the page. |
| All accounts show `Dead cookie` | Your Bloxgen session may have expired — reload the dashboard and re-check. |
| Everything shows `Error` | Open the page DevTools console; the Bloxgen API may have changed. See [Limitations](#limitations). |
| Popup says "Open the Generator page first" | The active tab isn't the Bloxgen generator page. |
| The switch for auto-check is missing | Auto-check was removed on purpose; only manual checks remain. |

---

## Project structure

```
bloxgen-voice-checker/
├── manifest.json        # MV3 manifest (permissions, content script, popup)
├── background.js        # service worker: set cookie → query Roblox → clear cookie
├── content.js           # injects the Voice buttons, reads Bloxgen cookies
├── content.css          # button + mic icon styles
├── popup.html / popup.js# "Check all visible accounts"
└── README.md
```

---

## Limitations

- Checks are **sequential** (one Roblox cookie per profile at a time).
- If Bloxgen changes the URL/format of `/api/accounts/history`, update `HISTORY_URL`
  in `content.js`. If Roblox changes the voice endpoint, update `background.js`.

---

## Disclaimer

This tool only **reads** the voice-chat status of accounts you already own via your own
Bloxgen account. It does not log in to Roblox, solve captchas, or modify any account.
Use it in accordance with Bloxgen's and Roblox's terms of service. Provided as-is, for
educational and personal use.
