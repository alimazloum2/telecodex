import { describe, expect, it } from "vitest";

import { alexaAction, buildAlexaSayArgs, formatAlexaSayError } from "../src/macmini/actions/alexa.js";
import { cameraAction, buildCameraFfmpegArgs, formatCameraCaptureError } from "../src/macmini/actions/camera.js";
import { groupLinearIssuesByState } from "../src/macmini/actions/linear.js";
import {
  buildNetworkSpeedText,
  formatNetworkSpeedError,
  parseNetworkSpeedOutput,
  speedAction,
} from "../src/macmini/actions/speed.js";
import { buildSystemStatusText } from "../src/macmini/actions/system.js";
import {
  buildTigerCoinStatusText,
  formatUnits,
  formatUsd,
  tigercoinAction,
} from "../src/macmini/actions/tigercoin.js";
import { voiceAction, buildVoiceRecorderArgs, parseRecorderOutputPath } from "../src/macmini/actions/voice.js";
import {
  MACMINI_ACTIONS,
  buildMacminiKeyboard,
  getMacminiAction,
  macminiCallbackData,
} from "../src/macmini/registry.js";

const keyboardJson = (keyboard: unknown): string => JSON.stringify(keyboard);

describe("macmini registry", () => {
  it("defines the initial buttons in registry order", () => {
    expect(MACMINI_ACTIONS.map((action) => action.id)).toEqual([
      "camera",
      "voice",
      "alexa",
      "speed",
      "linear",
      "system",
      "tigercoin",
    ]);
    expect(MACMINI_ACTIONS.map((action) => `${action.emoji} ${action.label}`)).toEqual([
      "📸 Camera",
      "🎙 Voice",
      "🔊 Alexa",
      "🌐 Speed",
      "📋 Linear",
      "🖥 System",
      "🐯 TigerCoin",
    ]);
  });

  it("builds a two-column inline keyboard from the registry", () => {
    const json = keyboardJson(buildMacminiKeyboard(MACMINI_ACTIONS));
    expect(json).toContain(macminiCallbackData("camera"));
    expect(json).toContain(macminiCallbackData("voice"));
    expect(json).toContain(macminiCallbackData("alexa"));
    expect(json).toContain(macminiCallbackData("speed"));
    expect(json).toContain(macminiCallbackData("linear"));
    expect(json).toContain(macminiCallbackData("system"));
    expect(json).toContain(macminiCallbackData("tigercoin"));
    expect(json).toContain("📸 Camera");
    expect(json).toContain("🔊 Alexa");
    expect(json).toContain("🌐 Speed");
    expect(json).toContain("🖥 System");
    expect(json).toContain("🐯 TigerCoin");
  });

  it("routes callback ids to actions", () => {
    expect(getMacminiAction("camera")).toBe(cameraAction);
    expect(getMacminiAction("voice")).toBe(voiceAction);
    expect(getMacminiAction("alexa")).toBe(alexaAction);
    expect(getMacminiAction("speed")).toBe(speedAction);
    expect(getMacminiAction("tigercoin")).toBe(tigercoinAction);
    expect(getMacminiAction("missing")).toBeUndefined();
  });
});

describe("macmini alexa", () => {
  it("uses macOS say to speak the Alexa wake word", () => {
    expect(buildAlexaSayArgs()).toEqual(["-r", "165", "Alexa"]);
    expect(buildAlexaSayArgs("Alexa, turn on the lights")).toEqual(["-r", "165", "Alexa, turn on the lights"]);
  });

  it("explains missing macOS say failures", () => {
    expect(formatAlexaSayError(new Error("spawn say ENOENT"))).toContain("say command");
  });
});

describe("macmini camera", () => {
  it("records a 15s avfoundation camera clip with ffmpeg", () => {
    expect(buildCameraFfmpegArgs("/tmp/out.mp4", 0, 15)).toEqual([
      "-y",
      "-f",
      "avfoundation",
      "-framerate",
      "30",
      "-i",
      "0:none",
      "-t",
      "15",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-movflags",
      "+faststart",
      "/tmp/out.mp4",
    ]);
  });

  it("explains how to list devices when there is no camera", () => {
    expect(formatCameraCaptureError(new Error("Selected framerate is not supported or device not found"))).toContain(
      'ffmpeg -f avfoundation -list_devices true -i ""',
    );
  });
});

describe("macmini voice", () => {
  it("records 15s through the fixed Hermes Razer/CoreAudio recorder as opus ogg", () => {
    expect(buildVoiceRecorderArgs("/tmp", 15)).toEqual([
      "--duration",
      "15",
      "--basename",
      "macmini_voice",
      "--quality",
      "voice",
      "--format",
      "ogg",
      "--outdir",
      "/tmp",
      "--quiet",
    ]);
  });

  it("parses the recorder output path from stdout", () => {
    expect(parseRecorderOutputPath("debug\n/tmp/macmini_voice_15s_20260609_001122.ogg\n")).toBe(
      "/tmp/macmini_voice_15s_20260609_001122.ogg",
    );
  });
});

describe("macmini linear", () => {
  it("groups Linear issues by state", () => {
    const text = groupLinearIssuesByState([
      { identifier: "MET-2", title: "Second", url: "https://linear.app/issue/MET-2", state: { name: "Todo" } },
      { identifier: "MET-1", title: "First", url: "https://linear.app/issue/MET-1", state: { name: "In Progress" } },
      { identifier: "MET-3", title: "Third", url: "https://linear.app/issue/MET-3", state: { name: "Todo" } },
    ]);

    expect(text).toContain("Todo");
    expect(text).toContain("MET-2 — Second");
    expect(text).toContain("MET-3 — Third");
    expect(text).toContain("In Progress");
    expect(text).toContain("MET-1 — First");
  });
});

describe("macmini speed", () => {
  it("parses networkQuality summary output", () => {
    expect(
      parseNetworkSpeedOutput(`==== SUMMARY ====
Uplink capacity: 23.456 Mbps
Downlink capacity: 312.789 Mbps
Responsiveness: Low (57 RPM)
Idle Latency: 18 ms
`),
    ).toEqual({
      downloadCapacity: "312.789 Mbps",
      uploadCapacity: "23.456 Mbps",
      responsiveness: "Low (57 RPM)",
      idleLatency: "18 ms",
    });
  });

  it("renders internet speed text", () => {
    const text = buildNetworkSpeedText({
      downloadCapacity: "312.789 Mbps",
      uploadCapacity: "23.456 Mbps",
      responsiveness: "Low (57 RPM)",
      idleLatency: "18 ms",
    });

    expect(text).toContain("Mac mini internet speed");
    expect(text).toContain("Download: 312.789 Mbps");
    expect(text).toContain("Upload: 23.456 Mbps");
    expect(text).toContain("Responsiveness: Low (57 RPM)");
    expect(text).toContain("Idle latency: 18 ms");
  });

  it("explains DNS failures from networkQuality", () => {
    expect(
      formatNetworkSpeedError(
        new Error('Error Domain=NSURLErrorDomain Code=-1003 "A server with the specified hostname could not be found."'),
      ),
    ).toContain("DNS resolution failed");
  });
});

describe("macmini system", () => {
  it("renders host health with CPU, RAM, disk, and uptime", () => {
    const text = buildSystemStatusText({
      hostname: "mini",
      uptime: "1 day, 2:03",
      cpuPercent: 12.3,
      ramUsedGb: 7.1,
      ramTotalGb: 16,
      diskFree: "128Gi",
      diskMount: "/",
    });

    expect(text).toContain("mini");
    expect(text).toContain("CPU: 12.3%");
    expect(text).toContain("RAM: 7.1/16.0 GB");
    expect(text).toContain("Disk free (/): 128Gi");
    expect(text).toContain("Uptime: 1 day, 2:03");
  });
});

describe("macmini tigercoin", () => {
  it("renders TigerCoin live status text", () => {
    const text = buildTigerCoinStatusText({
      priceUsd: "1.02628690842558",
      liquidityUsd: "18.8001",
      volume24hUsd: "0.0",
      holders: 4,
      deployerTgrBalance: "999991.000000",
      deployerEthBalance: "0.000276",
      latestBlock: 47366180,
    });

    expect(text).toContain("TigerCoin live status");
    expect(text).toContain("Price: $1.0263 / TGR");
    expect(text).toContain("Pool liquidity: $18.8001");
    expect(text).toContain("24h volume: $0.00");
    expect(text).toContain("Holders: 4");
    expect(text).toContain("Deployer TGR: 999991.000000");
    expect(text).toContain("Deployer Base ETH: 0.000276");
  });

  it("formats base units without floating point drift", () => {
    expect(formatUnits(999991000000000000001234n, 18, 6)).toBe("999991.000000");
    expect(formatUnits(276084296486545n, 18, 6)).toBe("0.000276");
  });

  it("formats USD values compactly", () => {
    expect(formatUsd("1.02628690842558")).toBe("$1.0263");
    expect(formatUsd("18.8001")).toBe("$18.8001");
    expect(formatUsd("0.0")).toBe("$0.00");
  });
});
