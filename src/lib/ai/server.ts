import "server-only";

import { AnthropicProvider } from "./anthropic";
import { DeterministicProvider } from "./deterministic";
import type { AIProvider } from "./provider";

/**
 * Resolve the configured provider.
 *
 * Server-only, and deliberately forgiving: a missing or misconfigured key falls
 * back to the deterministic provider with a warning rather than taking the app
 * down. A student mid-lecture should not lose a session because an env var was
 * mistyped.
 */

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  cached = resolveProvider();
  return cached;
}

function resolveProvider(): AIProvider {
  const requested = (process.env.AI_PROVIDER ?? "deterministic").toLowerCase();

  if (requested !== "anthropic") return new DeterministicProvider();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      "[medrecall] AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is unset; " +
        "falling back to the deterministic provider.",
    );
    return new DeterministicProvider();
  }

  return new AnthropicProvider(apiKey, process.env.ANTHROPIC_MODEL);
}

/** Test seam: drop the memoised provider so env changes take effect. */
export function resetAIProvider(): void {
  cached = null;
}
