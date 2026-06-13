export type EmbeddingProvider = (texts: string[]) => Promise<number[][]>;
export type EmbeddingProviderName = "mock" | "openai";

const EMBEDDING_DIMENSIONS = 1536;
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const TIMEOUT_MS = 60_000;

export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = getEmbeddingProviderName();
  if (provider === "openai") return embedWithOpenAIProvider;
  return embedWithMockProvider;
}

export function getEmbeddingProviderName(): EmbeddingProviderName {
  const configured = process.env.CLAUSLY_EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (configured === "openai" || configured === "mock") return configured;

  const aiProvider = process.env.CLAUSLY_AI_PROVIDER?.trim().toLowerCase();
  if (aiProvider === "openai") return "openai";

  return "mock";
}

export function getEmbeddingModel(): string {
  return process.env.CLAUSLY_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
}

export async function embedWithMockProvider(texts: string[]): Promise<number[][]> {
  return texts.map((text) => createMockEmbedding(text));
}

export async function embedWithOpenAIProvider(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI embeddings provider requires OPENAI_API_KEY.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getEmbeddingModel(),
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embeddings request failed with HTTP ${response.status}.`);
    }

    const json = await response.json() as {
      data?: Array<{ index: number; embedding: number[] }>;
    };

    const vectors = [...(json.data ?? [])].sort((a, b) => a.index - b.index).map((item) => item.embedding);
    if (vectors.length !== texts.length) {
      throw new Error("OpenAI embeddings response did not match the requested input count.");
    }

    return vectors;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI embeddings request timed out after 60 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createMockEmbedding(text: string): number[] {
  let seed = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16777619) >>> 0;
  }

  const vector: number[] = [];
  let state = seed || 1;
  for (let index = 0; index < EMBEDDING_DIMENSIONS; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    vector.push(Number(((state / 0xffffffff) * 2 - 1).toFixed(8)));
  }

  return vector;
}
