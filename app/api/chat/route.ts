import { buildDemoResponse } from "@/lib/demo-response";
import { INBOX_DEMO } from "@/lib/inbox";
import { getModel, isKnownModel } from "@/lib/models";
import { getRole, isKnownRole } from "@/lib/roles";
import { getSection, isKnownSection } from "@/lib/school-sections";
import { BRAIN_SEED, brainContext, type Fact } from "@/lib/brain";
import { currentUser } from "@/lib/server/session";
import { getDoc } from "@/lib/server/store";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { isKnownTool, MAX_TOOL_CONTEXT, TOOL_TITLES } from "@/lib/tools";
import type { ChatRequestBody } from "@/lib/types";

const OPENROUTER_BASE_URL = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
const OPENROUTER_URL = `${OPENROUTER_BASE_URL}/chat/completions`;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 20_000;

export const maxDuration = 120;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function parseBody(raw: unknown): ChatRequestBody | string {
  if (!raw || typeof raw !== "object") return "Request body must be a JSON object.";
  const body = raw as Record<string, unknown>;
  if (!isKnownModel(body.model)) return "Unknown or missing model.";
  if (!isKnownRole(body.role)) return "Unknown or missing role.";
  if (!Array.isArray(body.messages) || body.messages.length === 0) return "messages must be a non-empty array.";

  const messages: ChatRequestBody["messages"] = [];
  for (const m of body.messages.slice(-MAX_MESSAGES)) {
    const msg = m as Record<string, unknown>;
    if ((msg.role !== "user" && msg.role !== "assistant") || typeof msg.content !== "string") {
      return "Each message needs a role of user or assistant and string content.";
    }
    messages.push({ role: msg.role, content: msg.content.slice(0, MAX_MESSAGE_CHARS) });
  }
  if (messages[messages.length - 1].role !== "user") return "The last message must be from the user.";

  return {
    messages,
    model: body.model,
    role: body.role,
    customInstructions: typeof body.customInstructions === "string" ? body.customInstructions : undefined,
    sectionId: isKnownSection(body.sectionId) ? body.sectionId : undefined,
    mode: body.mode === "inbox" ? "inbox" : undefined,
    toolId: isKnownTool(body.toolId) ? body.toolId : undefined,
    toolContext: typeof body.toolContext === "string" ? body.toolContext.slice(0, MAX_TOOL_CONTEXT) : undefined,
  };
}

/** Streams a locally built reply word by word so demo mode exercises the same UI path. */
function demoStream(text: string) {
  const encoder = new TextEncoder();
  const tokens = text.match(/\S+\s*/g) ?? [text];
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const token of tokens) {
        controller.enqueue(encoder.encode(token));
        await new Promise((r) => setTimeout(r, 5));
      }
      controller.close();
    },
  });
}

/** Converts OpenRouter's SSE stream into a plain-text stream of content deltas. */
function openRouterTextStream(upstream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const handleLine = (rawLine: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    const line = rawLine.trim();
    // Blank lines separate events; lines starting with ":" are keep-alive comments.
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (data === "[DONE]") return;

    let event: {
      choices?: { delta?: { content?: string | null } }[];
      error?: { message?: string };
    };
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }

    if (event.error) {
      const message = event.error.message ?? "The model provider returned an error.";
      controller.enqueue(encoder.encode(`\n\n> **Error from OpenRouter:** ${message}`));
      return;
    }
    const delta = event.choices?.[0]?.delta?.content;
    if (delta) controller.enqueue(encoder.encode(delta));
  };

  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line, controller);
      },
      flush(controller) {
        buffer += decoder.decode();
        if (buffer) handleLine(buffer, controller);
      },
    }),
  );
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  // Signed-in staff only: the key and the school's data aren't for anyone who can reach the server.
  const user = await currentUser();
  if (!user) return jsonError("Sign in to the workspace first.", 401);

  const parsed = parseBody(raw);
  if (typeof parsed === "string") return jsonError(parsed, 400);

  const model = getModel(parsed.model);
  // The role comes from the account, never from the page, so a chat only sees what its person may see.
  const role = getRole(user.role);
  const textHeaders = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Model": model.id,
  };

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    const question = parsed.messages[parsed.messages.length - 1].content;
    const demoText =
      parsed.toolId === "mac"
        ? "I can't answer yet: no AI provider key is set in this workspace, so replies here are off."
        : parsed.mode === "inbox"
          ? INBOX_DEMO
          : buildDemoResponse(question, model);
    return new Response(demoStream(demoText), {
      headers: { ...textHeaders, "X-MACS-Mode": "demo" },
    });
  }

  const page = parsed.toolId ? { id: parsed.toolId, title: TOOL_TITLES[parsed.toolId], context: parsed.toolContext ?? "" } : undefined;
  const brainDoc = await getDoc("brain");
  const brain = brainContext(brainDoc.version === 0 ? BRAIN_SEED : (brainDoc.value as Fact[]), role.id);
  const systemPrompt = buildSystemPrompt(role, parsed.customInstructions, getSection(parsed.sectionId), parsed.mode, page, brain);

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: request.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": "MACS Admin Workspace",
      },
      body: JSON.stringify({
        model: model.id,
        stream: true,
        temperature: 0.3,
        // Mac and Manny answer in a few sentences, so they ask for less room.
        max_tokens: parsed.toolId === "mac" || parsed.toolId === "calendar" ? 2000 : 4096,
        messages: [{ role: "system", content: systemPrompt }, ...parsed.messages],
      }),
    });
  } catch (err) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    const detail = err instanceof Error ? err.message : "unknown error";
    return jsonError(`Could not reach OpenRouter: ${detail}`, 502);
  }

  if (!upstream.ok || !upstream.body) {
    let detail = `${upstream.status} ${upstream.statusText}`;
    try {
      const body = (await upstream.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      // keep the status line
    }
    const status = upstream.status === 401 ? 401 : upstream.status === 429 ? 429 : 502;
    const hint = upstream.status === 401 ? " Check OPENROUTER_API_KEY in .env.local." : "";
    return jsonError(`OpenRouter request failed: ${detail}.${hint}`, status);
  }

  return new Response(openRouterTextStream(upstream.body), {
    headers: { ...textHeaders, "X-MACS-Mode": "live" },
  });
}
