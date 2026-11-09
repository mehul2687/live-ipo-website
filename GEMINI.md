# Live IPO Website - Project Instructions & Guidelines

## 1. Project Overview
- **Project Directory:** `D:\LiveIPO Website`
- **GitHub Repository:** `https://github.com/mehul2687/live-ipo-website.git` (Branch: `main`)
- **Live Website:** `https://liveipo.in/` (mirrored from GitHub repository)

## 2. Core Operational Workflow (Golden Rule)
Whenever any modification, feature addition, or bug fix is requested:
1. **Local Update:** Modify the corresponding local files directly in `D:\LiveIPO Website` (e.g., `ipo-detail.html`, `script.js`, `style.css`, `admin.html`).
2. **Auto GitHub Sync & Mirror via Bulletproof Deploy Script:**
   Always use the automated bulletproof deployment script `deploy.ps1` which handles auto-unlock, process cleanup, commit, and push in a single fail-safe atomic execution:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "D:\LiveIPO Website\deploy.ps1" -Message "<Clear description of change>"
   ```
   *(Note: Run with BypassSandbox: true for direct network/auth access to GitHub).*
3. Report the result clearly to the user with commit confirmation.

## 3. Auto Diagnostic & Self-Healing
`deploy.ps1` automatically performs pre-flight checks:
- Terminates lingering `git.exe` tasks before running.
- Removes `.git\index.lock`, `.git\HEAD.lock`, and `.git\refs\heads\main.lock` if present.
- Configures Windows-friendly Git settings (`core.autocrlf true`, `core.filemode false`).
- Handles no-op deployments gracefully if no files were changed.
