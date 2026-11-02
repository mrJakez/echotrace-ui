import { NextResponse } from "next/server";
import { getPrompt } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { describeError, logServerError, logServerEvent } from "@/lib/server-log";
import { buildTrelloBoardContextMarkdown } from "@/lib/trello";

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/prompt-runs", "unauthorized");
    return auth.response;
  }

  if (!env.n8nLlmRunsWebhookEndpoint) {
    return NextResponse.json({ message: "N8N_LLM_RUNS_WEBHOOK_ENDPOINT is not configured." }, { status: 503 });
  }

  const form = await request.formData();
  const promptId = String(form.get("promptId") ?? "").trim();
  const filename = String(form.get("filename") ?? "").trim();
  const markdown = String(form.get("markdown") ?? "").trim();
  const attachments = form.getAll("attachments").filter((value): value is File => value instanceof File);

  if (!isUuid(promptId) || !filename || !markdown) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const prompt = await getPrompt(promptId);
  if (!prompt) {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 });
  }

  const endpoint = buildPromptRunEndpoint(env.n8nLlmRunsWebhookEndpoint, prompt.id);

  let sourceMarkdown = markdown;
  let trelloCardCount: number | undefined;
  const trelloSource = prompt.contextSources.trello;
  if (trelloSource) {
    try {
      const context = await buildTrelloBoardContextMarkdown(trelloSource.boardId);
      sourceMarkdown = `${markdown.trimEnd()}\n\n---\n\n${context.markdown}\n`;
      trelloCardCount = context.cardCount;
    } catch (error) {
      logServerError("api:/api/prompt-runs", "trello-context-failed", {
        ...describeError(error),
        boardId: trelloSource.boardId,
        promptId: prompt.id
      });
      return NextResponse.json(
        {
          message: "Trello context could not be loaded.",
          response: error instanceof Error ? error.message : "Unknown Trello error"
        },
        { status: 502 }
      );
    }
  }

  const formData = new FormData();
  formData.append("promptTitle", prompt.title);
  formData.append("data", new Blob([sourceMarkdown], { type: "text/markdown" }), filename);
  if (trelloSource) {
    formData.append("trelloBoardId", trelloSource.boardId);
    formData.append("trelloBoardName", trelloSource.boardName);
    formData.append("trelloBoardUrl", trelloSource.boardUrl);
    formData.append("trelloAccess", trelloSource.access);
  }

  for (const attachment of attachments) {
    formData.append(
      "attachments",
      new Blob([await attachment.arrayBuffer()], { type: normalizeMimeType(attachment.type, attachment.name) }),
      attachment.name
    );
  }

  logServerEvent("api:/api/prompt-runs", "send", {
    attachmentCount: attachments.length,
    filename,
    promptId: prompt.id,
    promptTitle: prompt.title,
    trelloBoardId: trelloSource?.boardId,
    trelloCardCount,
    user: auth.session.email
  });

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  const contentType = response.headers.get("content-type") ?? "";
  const rawBody = await response.text();

  if (!response.ok) {
    return NextResponse.json(
      {
        message: "Prompt run failed",
        response: rawBody,
        status: response.status
      },
      { status: 502 }
    );
  }

  let parsedBody: unknown = null;
  if (contentType.includes("application/json")) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
  }

  return NextResponse.json({
    contentType,
    prompt,
    response: parsedBody ?? rawBody
  });
}

function buildPromptRunEndpoint(baseUrl: string, promptId: string) {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(encodeURIComponent(promptId), normalizedBaseUrl);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeMimeType(type: string, filename: string) {
  const normalizedType = type.split(";")[0]?.trim().toLowerCase();
  if (normalizedType) {
    return normalizedType;
  }

  const extension = filename.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "md":
      return "text/markdown";
    case "txt":
      return "text/plain";
    case "json":
      return "application/json";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
