# /macmini Decisions

- Scope is Personal/MeTiger only; no PCL/project data is read or exposed.
- Extend the existing TeleCodex launchd service (`ca.metiger.telecodex`) because it is the running Telegram bot process for this token.
- Keep the existing Telegram token loading from `.env`; do not create, rotate, print, or move the token.
- Enforce whitelist with the existing `TELEGRAM_ALLOWED_USER_IDS`; hard fallback user ID is AM's known Telegram ID `8643705682` only if env parsing is unavailable in a test utility.
- Unauthorized users/chats are silently ignored, including callback queries.
- `/macmini` is case-insensitive by registering `macmini`, `Macmini`, `MACMINI`, and `macMini` command variants.
- Menu buttons are generated from a registry: each action has `id`, `label`, `emoji`, and `handler`.
- Initial actions are camera, voice, speed, linear, and system; future buttons require adding one registry entry and one handler.
- Speed uses macOS `networkQuality`; parser supports both `Download/Upload capacity` and current `Downlink/Uplink capacity` output labels.
- Camera device index is `0` (`HD Pro Webcam C920`) based on current AVFoundation discovery; no-camera errors explain how to list devices.
- Voice uses Razer/default audio device index `0` and returns Opus/Ogg as a Telegram voice note.
- Linear reads `LINEAR_API_KEY` from environment only. If missing, the button returns one short paste instruction and `.env.example` documents the key.
- Use Node built-in `fetch` for Linear GraphQL to avoid adding a dependency.
- Use ffmpeg through `execFile` argument arrays, not shell strings.
- Live-status messages are sent/edited around each callback job.
- Service deployment uses build output in `dist/` because launchd runs `node dist/index.js`.
