/**
 * LLM Chat Application Template + DNS Analyzer Integration
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT =
  "You are a helpful, friendly Cloudflare expert. Provide concise, accurate responses. If user asks about DNS, speed, or load—use provided data if available. Explain benefits simply—no sales hype.";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for HTML calls (allow any origin for demo—tighten later)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle OPTIONS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Static frontend (your Pages HTML)
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // Chat API
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatRequest(request, env);
    }

    // 404
    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handles chat requests with DNS data awareness
 */
async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json();
    const { messages = [], lastResult } = body;

    // Add system prompt if missing
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    // Enhance prompt with lastResult if sent
    let enhancedPrompt = SYSTEM_PROMPT;
    if (lastResult) {
      enhancedPrompt += `\nFresh analyze data: Domain ${lastResult.domain}, DNS ${lastResult.ns} (${lastResult.class === 'cloudflare' ? 'green' : 'red'}), load ${lastResult.load}, issuer ${lastResult.issuer}. Use this if relevant—explain why Cloudflare DNS/speed wins simply.`;
    }
    messages[0].content = enhancedPrompt;

    // Run AI
    const stream = await env.AI.run(
      MODEL_ID,
      {
        messages,
        max_tokens: 1024,
        stream: true,
      },
      {
        // Uncomment if you add Gateway
      },
    );

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        "connection": "keep-alive",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat" }),
      { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
    );
  }
}
