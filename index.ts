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
const DEFAULT_MESSAGE = "What's good?  Let's talk Cloudflare!"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatRequest(request, env);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
} satisfies ExportedHandler<Env>;

async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json();
    const { messages = [], lastResult } = body;

    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    let enhancedPrompt = SYSTEM_PROMPT;
    if (lastResult) {
      enhancedPrompt += `\nFresh analyze data: Domain ${lastResult.domain}, DNS ${lastResult.ns} (${lastResult.class === 'cloudflare' ? 'green' : 'red'}), load ${lastResult.load}, issuer ${lastResult.issuer}. Use this if relevant—explain why Cloudflare DNS/speed wins simply.`;
    }
    messages[0].content = enhancedPrompt;

    const stream = await env.AI.run(MODEL_ID, {
      messages,
      max_tokens: 1024,
      stream: true,
    });

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
      { status: 500, headers: corsHeaders }
    );
  }
}
