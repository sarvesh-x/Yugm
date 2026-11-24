import { miniGames } from "@yugm/shared";

export type GameCatalogScores = {
  best: Record<string, { score: number; createdAt: Date | string | null }>;
  recent: readonly object[];
};
export type ReadGameCatalogScores = (userId: string) => Promise<GameCatalogScores>;

export function presentGameCatalog({ best, recent }: GameCatalogScores) {
  return { games: miniGames.map(game => ({ ...game, best: best[game.id] ?? null })), recent };
}
