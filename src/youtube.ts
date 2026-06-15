import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const YOUTUBE_SCRIPT = path.join(homedir(), ".claude", "skills", "youtube", "youtube_fetch.py");
const WORK_DIR = path.join(homedir(), "youtube-walkthroughs");
const CLAUDE_BRIDGE_URL = "http://127.0.0.1:8643/v1/chat/completions";
const CLAUDE_MODEL = process.env.YT_CLAUDE_MODEL || "claude-opus-4-7";
const PYTHON_BIN = process.env.YT_PYTHON_BIN || "python3";
const MAX_BRIDGE_CHARS = 60_000;

type ExecResult = {
  stdout: string;
  stderr: string;
};

export type YouTubeWorkflowResult = {
  videoUrl: string;
  rawPath: string;
  articlePath: string;
  summary: string;
  clickableTimestamps: boolean;
  stdout: string;
};

function execFileAsync(command: string, args: string[], cwd: string, timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error([`Command failed: ${command} ${args.join(" ")}`, stderr, stdout].filter(Boolean).join("\n")));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function extractRawRelativePath(stdout: string): string {
  const match = stdout.match(/Raw file:\s*(raw\/youtube\/[^\n\r]+)/);
  if (!match) {
    throw new Error(`Could not find raw output path in youtube_fetch.py output:\n${stdout}`);
  }
  return match[1].trim();
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim().replace(/^"|"$/g, "");
    out[key] = value;
  }
  return out;
}

function slugFromRawPath(rawPath: string): string {
  return path.basename(rawPath).replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
}

function transcriptParagraphs(raw: string): string[] {
  const transcript = raw.split("## Transcript")[1] ?? "";
  return transcript
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.startsWith("["));
}

function buildTimestampedSections(paragraphs: string[], videoId: string): string {
  if (paragraphs.length === 0) {
    return "## Transcript Sections\n\n_No transcript available for this video._\n";
  }

  const sections: string[] = [];
  const chunkSize = 5;
  for (let index = 0; index < paragraphs.length; index += chunkSize) {
    const chunk = paragraphs.slice(index, index + chunkSize);
    const firstTimestamp = chunk[0]?.match(/^\[([^\]]+)\]/)?.[1] ?? "start";
    sections.push([`## Section ${Math.floor(index / chunkSize) + 1} — ${firstTimestamp}`, ...chunk].join("\n\n"));
  }

  return sections.join("\n\n").replaceAll(`https://youtu.be/${videoId}?t=`, `https://youtu.be/${videoId}?t=`);
}

function buildReferenceArticle(raw: string, rawRelativePath: string): { content: string; clickableTimestamps: boolean } {
  const meta = parseFrontmatter(raw);
  const title = meta.title || "YouTube Video";
  const videoId = meta.video_id || "";
  const url = meta.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
  const paragraphs = transcriptParagraphs(raw);
  const clickableTimestamps = /\[[0-9:]+\]\(https:\/\/youtu\.be\/[A-Za-z0-9_-]{11}\?t=\d+\)/.test(raw);
  const sectionText = buildTimestampedSections(paragraphs, videoId);

  const content = [
    "---",
    `title: "${title.replaceAll("\"", "'")}"`,
    "type: youtube-walkthrough",
    `source: ${rawRelativePath}`,
    `video_id: ${videoId}`,
    `url: ${url}`,
    `created: ${new Date().toISOString()}`,
    "---",
    "",
    `# ${title}`,
    "",
    videoId ? `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>` : "",
    "",
    `**Channel:** ${meta.channel || "Unknown"}`,
    `**Published:** ${meta.published || "Unknown"}`,
    `**Duration:** ${meta.duration || "Unknown"}`,
    `**Source:** ${url}`,
    `**Raw transcript:** ${rawRelativePath}`,
    "",
    "## Walkthrough Reference",
    "",
    "This article is generated locally from YouTube captions using youtube-transcript-api and yt-dlp. Timestamp links jump directly to the source video moments.",
    "",
    sectionText,
    "",
    "## Raw Metadata and Transcript Source",
    "",
    `See: ${rawRelativePath}`,
    "",
  ].filter((line) => line !== undefined).join("\n");

  return { content, clickableTimestamps };
}

async function summarizeWithClaude(article: string, articlePath: string): Promise<string> {
  const clipped = article.length > MAX_BRIDGE_CHARS
    ? `${article.slice(0, MAX_BRIDGE_CHARS)}\n\n[TRUNCATED for bridge request; full article is at ${articlePath}]`
    : article;

  const prompt = [
    "You are summarizing a YouTube walkthrough article for an engineering/build workflow.",
    "Return concise Markdown with exactly these headings:",
    "## Summary",
    "## Extracted Build Steps",
    "## Gotchas / Dependencies",
    "Include timestamp links when relevant. Do not invent steps not supported by the transcript.",
    "",
    `Article path: ${articlePath}`,
    "",
    clipped,
  ].join("\n");

  const response = await fetch(CLAUDE_BRIDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Claude bridge HTTP ${response.status}: ${body.slice(0, 1000)}`);
  }

  const data = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`Claude bridge returned no message content: ${body.slice(0, 1000)}`);
  }
  return content;
}

export async function runYouTubeWorkflow(videoUrl: string): Promise<YouTubeWorkflowResult> {
  await mkdir(WORK_DIR, { recursive: true });
  const { stdout } = await execFileAsync(PYTHON_BIN, [YOUTUBE_SCRIPT, videoUrl], WORK_DIR, 180_000);
  const rawRelativePath = extractRawRelativePath(stdout);
  const rawPath = path.join(WORK_DIR, rawRelativePath);
  const raw = await readFile(rawPath, "utf8");
  const article = buildReferenceArticle(raw, rawRelativePath);
  const articleName = `${slugFromRawPath(rawPath)}-reference.md`;
  const articlePath = path.join(WORK_DIR, "notes", articleName);
  await mkdir(path.dirname(articlePath), { recursive: true });
  await writeFile(articlePath, article.content, "utf8");
  const summary = await summarizeWithClaude(article.content, articlePath);
  return { videoUrl, rawPath, articlePath, summary, clickableTimestamps: article.clickableTimestamps, stdout };
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node dist/youtube.js <youtube-url>");
    process.exit(2);
  }
  runYouTubeWorkflow(url)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
