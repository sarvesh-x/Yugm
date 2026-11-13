import * as toxicity from "@tensorflow-models/toxicity";

const THRESHOLD = 0.85;
// Keep these names in sync with the output heads exported by
// @tensorflow-models/toxicity. The model calls this head `sexual_explicit`.
const LABELS = ["toxicity", "severe_toxicity", "identity_attack", "insult", "threat", "sexual_explicit"];
let model: toxicity.ToxicityClassifier | null = null;
let modelLoading = false;
let modelLoadPromise: Promise<void> | null = null;

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
    const clf = await getModel();
    const predictions = await clf.classify([text]);

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
