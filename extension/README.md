# Xposelink Security - Browser Extension

Scan any link for threats directly from your browser, powered by the Xposelink backend.

## Features

- **Popup scan** - paste or auto-fill the current tab's URL and scan it instantly
- **Right-click any link** - "Scan with Xposelink" context menu item opens popup with result
- **Auto-connect** - signs in automatically when you log in on the Xposelink dashboard
- **Verdict display** - shows safe / suspicious / malicious / adult / gambling with risk score

## How to load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `extension/` folder
5. The Xposelink icon appears in your toolbar

## How to load in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `extension/manifest.json`

## Configuration

Open the extension popup and go to Settings to configure:

- **API Base URL** - default is `http://localhost:3000` for local dev
- **VirusTotal API Key** - optional, enables direct VT scans from the extension
- **JWT Token** - auto-filled when logged in on the dashboard, or paste manually

## Requirements

A Pro or higher account is required to use the extension security scanner.
