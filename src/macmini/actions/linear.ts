import type { MacminiAction } from "../types.js";

export interface LinearIssue {
  identifier: string;
  title: string;
  url: string;
  state: { name: string };
}

const LINEAR_QUERY = `
query MacminiOpenIssues {
  issues(filter: { assignee: { isMe: { eq: true } }, completedAt: { null: true } }, first: 50, orderBy: updatedAt) {
    nodes {
      identifier
      title
      url
      state { name }
    }
  }
}`;

export const linearAction: MacminiAction = {
  id: "linear",
  emoji: "📋",
  label: "Linear",
  runningText: "📋 Querying Linear…",
  doneText: "✅ Linear summary sent.",
  async handler(ctx) {
    const apiKey = ctx.env.LINEAR_API_KEY?.trim();
    if (!apiKey) {
      await ctx.replyText("PASTE THIS in /Users/metigerinc/telecodex/.env: LINEAR_API_KEY=your_linear_key");
      return;
    }

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: LINEAR_QUERY }),
    });

    if (!response.ok) {
      await ctx.replyText(`❌ Linear failed: HTTP ${response.status}`);
      throw new Error(`Linear GraphQL failed with HTTP ${response.status}`);
    }

    const json = (await response.json()) as { data?: { issues?: { nodes?: LinearIssue[] } }; errors?: Array<{ message: string }> };
    if (json.errors?.length) {
      const message = json.errors.map((error) => error.message).join("; ");
      await ctx.replyText(`❌ Linear failed: ${message}`);
      throw new Error(message);
    }

    await ctx.replyText(groupLinearIssuesByState(json.data?.issues?.nodes ?? []));
  },
};

export function groupLinearIssuesByState(issues: LinearIssue[]): string {
  if (issues.length === 0) {
    return "📋 Linear: no open assigned issues.";
  }

  const groups = new Map<string, LinearIssue[]>();
  for (const issue of issues) {
    const state = issue.state?.name || "No state";
    const list = groups.get(state) ?? [];
    list.push(issue);
    groups.set(state, list);
  }

  const lines = ["📋 Linear — open assigned issues"];
  for (const [state, stateIssues] of groups.entries()) {
    lines.push("", `${state}`);
    for (const issue of stateIssues) {
      lines.push(`• ${issue.identifier} — ${issue.title}`);
    }
  }
  return lines.join("\n");
}
