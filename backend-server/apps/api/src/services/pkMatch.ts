export type PkOpponentCandidate = {
  roomId: string;
  hostId: string;
  category?: string;
  language?: string;
  participantCount?: number;
};

export function rankPkOpponents<T extends PkOpponentCandidate>(room: { category?: string; language?: string }, roomId: string, opponents: T[]) {
  return [...opponents]
    .filter((opponent) => opponent.roomId !== roomId)
    .sort((a, b) => {
      const aAffinity = (a.category === room.category ? 2 : 0) + (a.language === room.language ? 2 : 0) + Math.min(a.participantCount ?? 0, 500) / 500;
      const bAffinity = (b.category === room.category ? 2 : 0) + (b.language === room.language ? 2 : 0) + Math.min(b.participantCount ?? 0, 500) / 500;
      return bAffinity - aAffinity;
    });
}
