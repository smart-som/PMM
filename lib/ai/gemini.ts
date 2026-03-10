export function resolveGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI configuration missing. Please check .env file.");
  }
  return apiKey;
}

export function resolveGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export function parseGeminiMarkdownResponse(data: GeminiResponse): string {
  const text =
    data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";

  if (!text) {
    throw new Error("No AI markdown response generated.");
  }

  return text;
}

type GeminiErrorResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function getGeminiErrorReason(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const error = (data as GeminiErrorResponse).error;
  if (!error) return null;
  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error.status === "string" && error.status.trim()) {
    return error.status.trim();
  }
  return null;
}

export async function requestGeminiText({
  prompt,
  temperature = 0.2,
  model = resolveGeminiModel()
}: {
  prompt: string;
  temperature?: number;
  model?: string;
}): Promise<string> {
  const apiKey = resolveGeminiApiKey();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature }
      }),
      cache: "no-store"
    }
  );

  const rawBody = await response.text();
  let parsedBody: unknown = null;
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    const reason = getGeminiErrorReason(parsedBody);
    if (response.status === 404) {
      throw new Error(
        `Gemini model "${model}" was not found (404). Set GEMINI_MODEL to a valid model (e.g. gemini-2.5-flash).`
      );
    }

    if (reason) {
      throw new Error(`Gemini request failed (${response.status}): ${reason}`);
    }
    throw new Error(`Gemini request failed (${response.status}).`);
  }

  if (!parsedBody || typeof parsedBody !== "object") {
    throw new Error("Gemini returned an unreadable response.");
  }

  return parseGeminiMarkdownResponse(parsedBody as GeminiResponse);
}
