import { NextResponse } from "next/server";
import { getPrompt } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { logServerEvent } from "@/lib/server-log";

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

  const formData = new FormData();
  formData.append("promptTitle", prompt.title);
  formData.append("data", new Blob([markdown], { type: "text/markdown;charset=utf-8" }), filename);

  for (const attachment of attachments) {
    formData.append("attachments", attachment, attachment.name);
  }

  logServerEvent("api:/api/prompt-runs", "send", {
    attachmentCount: attachments.length,
    filename,
    promptId: prompt.id,
    promptTitle: prompt.title,
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
