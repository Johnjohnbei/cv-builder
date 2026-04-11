"use node";

import { getProviders, getClient, getModel, type AIProvider } from "./providers";

export function safeParseJSON(text: string | undefined | null, _fallback: any = {}): any {
  if (!text) throw new Error("L'IA a retourné une réponse vide. Veuillez réessayer.");

  // Sometimes the model wraps JSON in ```json ... ``` markdown blocks
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", text.slice(0, 300));
    throw new Error("L'IA a retourné une réponse invalide. Veuillez réessayer.");
  }
}

export async function withRetry<T>(fn: (provider: AIProvider) => Promise<T>): Promise<T> {
  const providers = getProviders();
  let lastError: any;

  for (const provider of providers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fn(provider);
      } catch (e: any) {
        lastError = e;
        const status = e?.status || e?.message?.match(/(\d{3}) status/)?.[1];
        if ((status == 503 || status == 429) && attempt === 0) {
          console.log(`AI provider ${provider.baseURL} returned ${status}, retrying...`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        console.log(`AI provider ${provider.baseURL} failed (${status}), trying next provider...`);
        break; // try next provider
      }
    }
  }
  throw lastError;
}

export async function chatJSON(prompt: string, model?: string): Promise<any> {
  return withRetry(async (provider) => {
    const client = getClient(provider);
    const m = model || getModel("default", provider);
    try {
      const response = await client.chat.completions.create({
        model: m,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 8192,
        response_format: { type: "json_object" },
      });
      return safeParseJSON(response.choices[0]?.message?.content);
    } catch (e: any) {
      if (e?.status === 400 || e?.message?.includes("400")) {
        const response = await client.chat.completions.create({
          model: m,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 8192,
        });
        return safeParseJSON(response.choices[0]?.message?.content);
      }
      throw e;
    }
  });
}

export async function chatText(prompt: string, model?: string): Promise<string> {
  return withRetry(async (provider) => {
    const client = getClient(provider);
    const response = await client.chat.completions.create({
      model: model || getModel("default", provider),
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 8192,
    });
    return response.choices[0]?.message?.content || "";
  });
}
