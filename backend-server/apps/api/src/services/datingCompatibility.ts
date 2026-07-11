export type DatingProfile = {
  city?: string;
  languages?: string[];
  interests?: string[];
  lookingFor?: string;
  isVerified?: boolean;
};

const normalized = (values: string[] = []) => new Map(values.map((value) => [value.trim().toLowerCase(), value]));

export function calculateCompatibility(user: DatingProfile, candidate: DatingProfile) {
  let score = 45;
  const reasons: Array<{ type: "LOCATION" | "LANGUAGE" | "INTEREST" | "INTENT" | "TRUST"; label: string }> = [];
  const userLanguages = normalized(user.languages);
  const candidateLanguages = normalized(candidate.languages);
  const userInterests = normalized(user.interests);
  const candidateInterests = normalized(candidate.interests);

  if (user.city && candidate.city && user.city.trim().toLowerCase() === candidate.city.trim().toLowerCase()) {
    score += 12;
    reasons.push({ type: "LOCATION", label: `Both in ${candidate.city}` });
  }

  const sharedLanguages = [...userLanguages.keys()].filter((value) => candidateLanguages.has(value));
  if (sharedLanguages.length) {
    score += Math.min(6 + sharedLanguages.length * 3, 12);
    reasons.push({ type: "LANGUAGE", label: `Both speak ${candidateLanguages.get(sharedLanguages[0])}` });
  }

  const sharedInterests = [...userInterests.keys()].filter((value) => candidateInterests.has(value));
  score += Math.min(sharedInterests.length * 6, 24);
  sharedInterests.slice(0, 2).forEach((interest) => reasons.push({ type: "INTEREST", label: `Both enjoy ${candidateInterests.get(interest)}` }));

  if (user.lookingFor && candidate.lookingFor && user.lookingFor.toLowerCase() === candidate.lookingFor.toLowerCase()) {
    score += 7;
    reasons.push({ type: "INTENT", label: `Both looking for ${candidate.lookingFor.toLowerCase()}` });
  }
  if (candidate.isVerified) {
    score += 3;
    reasons.push({ type: "TRUST", label: "Verified profile" });
  }

  return {
    score: Math.min(score, 100),
    reasons,
    sharedInterests: sharedInterests.map((value) => candidateInterests.get(value)!).filter(Boolean),
    sharedLanguages: sharedLanguages.map((value) => candidateLanguages.get(value)!).filter(Boolean)
  };
}
