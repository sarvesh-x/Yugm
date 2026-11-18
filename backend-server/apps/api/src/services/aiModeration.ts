try {
  // Prefer native TensorFlow backend in Node for performance and to avoid tfjs plain-JS warnings.
  // Use a runtime-only specifier so Cloudflare's bundle does not try to include
  // the native Node binary. The pure JS TensorFlow backend remains the fallback.
  if (process.env.YUGM_RUNTIME !== "cloudflare") {
    const nativeBackend = "@tensorflow/" + "tfjs-node";
    await import(nativeBackend);
  }
} catch {
  // Optional dependency; fall back to default tfjs backend if unavailable.
}

import * as toxicity from "@tensorflow-models/toxicity";

const THRESHOLD = 0.85;
// Keep these names in sync with the output heads exported by
// @tensorflow-models/toxicity. The model calls this head `sexual_explicit`.
const LABELS = ["toxicity", "severe_toxicity", "identity_attack", "insult", "threat", "sexual_explicit"];
let model: toxicity.ToxicityClassifier | null = null;
let modelLoading = false;
let modelLoadPromise: Promise<void> | null = null;
const CLASSIFY_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`operation exceeded ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

/** Warm the toxicity model after the server starts accepting requests. */
export async function preloadToxicityModel(): Promise<void> {
  try {
    await getModel();
    console.log("[aiModeration] Toxicity model ready");
  } catch (error) {
    console.error("[aiModeration] Toxicity model preload failed:", error);
  }
}

async function getModel(): Promise<toxicity.ToxicityClassifier> {
  if (model) return model;
  if (modelLoadPromise) {
    await modelLoadPromise;
    return model!;
  }
  modelLoading = true;
  modelLoadPromise = (async () => {
    try {
      model = await toxicity.load(THRESHOLD, LABELS);
    } catch (err) {
      console.error("[aiModeration] Failed to load toxicity model:", err);
      throw err;
    } finally {
      modelLoading = false;
      // A failed download/model init should be retryable on the next request,
      // rather than caching a permanently rejected promise.
      if (!model) modelLoadPromise = null;
    }
  })();
  await modelLoadPromise;
  return model!;
}

export interface AiModerationResult {
  isClean: boolean;
  toxicityScore: number;
  severeToxicityScore: number;
  identityAttackScore: number;
  insultScore: number;
  threatScore: number;
  sexuallyExplicitScore: number;
  topLabel: string | null;
  flaggedLabels: string[];
}

const EMPTY_RESULT: AiModerationResult = {
  isClean: true,
  toxicityScore: 0,
  severeToxicityScore: 0,
  identityAttackScore: 0,
  insultScore: 0,
  threatScore: 0,
  sexuallyExplicitScore: 0,
  topLabel: null,
  flaggedLabels: [],
};

export async function classifyToxicity(text: string): Promise<AiModerationResult> {
  if (!text || text.trim().length < 2) return EMPTY_RESULT;

  try {
    // The first call after a restart downloads/initializes the model. Never let
    // that (or a slow inference) hold a chat request hostage: fall back to the
    // keyword filter result and let the model warm in the background.
    const clf = await withTimeout(getModel(), CLASSIFY_TIMEOUT_MS);
    const predictions = await withTimeout(clf.classify([text]), CLASSIFY_TIMEOUT_MS);

    const result: AiModerationResult = {
      isClean: true,
      toxicityScore: 0,
      severeToxicityScore: 0,
      identityAttackScore: 0,
      insultScore: 0,
      threatScore: 0,
      sexuallyExplicitScore: 0,
      topLabel: null,
      flaggedLabels: [],
    };

    let maxScore = 0;

    for (const pred of predictions) {
      const label = pred.label;
      if (pred.results[0].match) {
        const score = pred.results[0].probabilities[1];
        result.flaggedLabels.push(label);
        if (score > maxScore) {
          maxScore = score;
          result.topLabel = label;
        }
      }

      const probability = pred.results[0].probabilities[1];
      switch (label) {
        case "toxicity":
          result.toxicityScore = probability;
          break;
        case "severe_toxicity":
          result.severeToxicityScore = probability;
          break;
        case "identity_attack":
          result.identityAttackScore = probability;
          break;
        case "insult":
          result.insultScore = probability;
          break;
        case "threat":
          result.threatScore = probability;
          break;
        case "sexual_explicit":
          result.sexuallyExplicitScore = probability;
          break;
      }
    }

    result.isClean = result.flaggedLabels.length === 0;
    return result;
  } catch (err) {
    console.error("[aiModeration] classifyToxicity error:", err);
    return EMPTY_RESULT;
  }
}

export function toxicitySeverity(aiResult: AiModerationResult): "LOW" | "MEDIUM" | "HIGH" {
  const max = Math.max(
    aiResult.toxicityScore,
    aiResult.severeToxicityScore,
    aiResult.identityAttackScore,
    aiResult.insultScore,
    aiResult.threatScore,
    aiResult.sexuallyExplicitScore,
  );
  if (max >= 0.95) return "HIGH";
  if (max >= 0.85) return "MEDIUM";
  return "LOW";
}

export function isModelReady(): boolean {
  return model !== null;
}

export function isModelLoading(): boolean {
  return modelLoading;
}
