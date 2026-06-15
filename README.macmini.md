# /macmini Remote-Control Menu

## Brainstorm

Possible remote-control buttons considered:

- Camera: short room clip, sent as Telegram video.
- Voice: short microphone sample, sent as Telegram voice note.
- Speed: Mac mini internet speed test using macOS `networkQuality`.
- Linear: open issue summary without leaking credentials.
- System: quick Mac mini health check.
- Future: screenshot, restart app, disk cleanup, Open WebUI status, NexCore Field status.

Rejected for initial release:

- Destructive controls such as restart/shutdown/kill process.
- Anything that can expose PCL/employer data.
- A second Telegram bot/process.

## Plan

1. Discover the existing Telegram bot/service and framework.
2. Add tests first for the registry/menu/status formatting and action command specs.
3. Implement a modular `src/macmini/` registry with one file per action.
4. Wire `/macmini` and callback routing into the existing TeleCodex grammY bot.
5. Add README instructions and decision log.
6. Build/test/typecheck.
7. Restart the existing launchd service only, verify one process and KeepAlive.
8. Verify live Telegram delivery and action outputs.

## How to add a button

1. Create a new action file under `src/macmini/actions/`, for example `nexcore.ts`.
2. Export a `MacminiAction`:

```ts
export const nexcoreAction: MacminiAction = {
  id: "nexcore",
  emoji: "🏗️",
  label: "NexCore",
  async handler(ctx) {
    await ctx.replyText("NexCore is running.");
  },
};
```

3. Add it to `MACMINI_ACTIONS` in `src/macmini/registry.ts`.
4. Run:

```bash
npm test
npm run build
launchctl kickstart -k gui/$(id -u)/ca.metiger.telecodex
```

The menu and callback router are generated from the registry automatically.

## Security model

- Existing `TELEGRAM_ALLOWED_USER_IDS` remains the source of truth.
- Unknown users/chats are silently ignored.
- No Telegram token is printed or moved.
- Linear key is read from `LINEAR_API_KEY` only.

## Speed button

The `🌐 Speed` action runs the macOS built-in `networkQuality` command and returns:

- download/downlink capacity
- upload/uplink capacity
- responsiveness
- idle latency

The parser accepts both older `Download/Upload capacity` and current `Downlink/Uplink capacity` labels.
