import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrompt } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { logServerEvent } from "@/lib/server-log";

const runPromptSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  markdown: z.string().trim().min(1),
  promptId: z.string().uuid()
});

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/prompt-runs", "unauthorized");
    return auth.response;
  }

  if (!env.n8nLlmRunsWebhookEndpoint) {
    return NextResponse.json({ message: "N8N_LLM_RUNS_WEBHOOK_ENDPOINT is not configured." }, { status: 503 });
  }

  const parsed = runPromptSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const prompt = await getPrompt(parsed.data.promptId);
  if (!prompt) {
    return NextResponse.json({ message: "Prompt not found" }, { status: 404 });
  }

  const endpoint = buildPromptRunEndpoint(env.n8nLlmRunsWebhookEndpoint, prompt.id);

  const formData = new FormData();
  formData.append("promptTitle", prompt.title);
  formData.append("data", new Blob([parsed.data.markdown], { type: "text/markdown;charset=utf-8" }), parsed.data.filename);

  logServerEvent("api:/api/prompt-runs", "send", {
    filename: parsed.data.filename,
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
