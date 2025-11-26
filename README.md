Support App

Super‑MVP: local Electron overlay for interview notes. Overlay is always on top, click‑through, and excluded from screen sharing. Control page at http://localhost:4317 updates notes live.

Quick start

- Install Node.js 18+
- From this folder:
  - npm install
  - npm start

Usage

- A transparent overlay window appears; it is excluded from screen share.
- Open the control UI in your browser: http://localhost:4317
- Type notes; they update in the overlay instantly.
- Toggle overlay visibility: Cmd/Ctrl+Shift+Space.
- Drag the window: use the small rounded handle at the top-left corner.

Notes

- The app hides from the Dock on macOS.
- Overlay uses system content protection to avoid being captured in screenshots and screen sharing.
- This is a local, single‑machine MVP. No accounts, no persistence beyond localStorage in the control page.

Build DMG (macOS)
- npm install
- npm run build:mac
- The unsigned DMG will be generated in dist/. On first run, right‑click → Open to bypass Gatekeeper.
