// AI toxicity scanning disabled: the TensorFlow toxicity model was expensive to
// load/run and added latency to chat/message paths. Keep the API surface so
// callers (auto-moderation, admin checks) continue to work without it.

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

export async function classifyToxicity(_text: string): Promise<AiModerationResult> {
  return EMPTY_RESULT;
}

export function toxicitySeverity(_aiResult: AiModerationResult): "LOW" | "MEDIUM" | "HIGH" {
  return "LOW";
}

export function isModelReady(): boolean {
  return false;
}

export function isModelLoading(): boolean {
  return false;
}

export async function preloadToxicityModel(): Promise<void> {
  // Intentionally disabled.
}
