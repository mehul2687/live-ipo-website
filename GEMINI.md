# Live IPO Website - Project Instructions & Guidelines

## 1. Project Overview
- **Project Directory:** `D:\LiveIPO Website`
- **GitHub Repository:** `https://github.com/mehul2687/live-ipo-website.git` (Branch: `main`)
- **Live Website:** `https://liveipo.in/` (mirrored from GitHub repository)

## 2. Core Operational Workflow (Golden Rule)
Whenever any modification, feature addition, or bug fix is requested:
1. **Local Update:** Modify the corresponding local files directly in `D:\LiveIPO Website` (e.g., `ipo-detail.html`, `script.js`, `style.css`, `admin.html`).
2. **Auto GitHub Sync & Mirror:** Always commit and push changes directly to GitHub `main` branch so both local files, GitHub repository, and `liveipo.in` stay 100% in sync:
   ```powershell
   git -C "D:\LiveIPO Website" add .
   git -C "D:\LiveIPO Website" commit -m "<Clear description of change>"
   git -C "D:\LiveIPO Website" push origin main
   ```
3. Report the result clearly to the user with commit confirmation.

## 3. Auto Diagnostic & Self-Healing
If any git command hangs or shows lock errors:
- Check if `.git\index.lock` exists in `D:\LiveIPO Website`. If it exists, remove it immediately.
- If background `git.exe` tasks are stuck, terminate them.
- Always run commands with explicit path: `git -C "D:\LiveIPO Website" ...`.
