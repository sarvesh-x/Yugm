export const coffeeDateQuestions = [
  "What's your favorite way to spend a Sunday morning?",
  "If you could travel anywhere right now, where would you go?",
  "What's a food you could eat every day?",
  "What's the best piece of advice you've ever received?",
  "What's your go-to karaoke song?",
  "What's a hobby you've always wanted to try?",
  "What's your favorite season and why?",
  "If you wrote a book, what would it be about?",
  "What's the most spontaneous thing you've ever done?",
  "What does your ideal Friday night look like?",
];

export const blindDateRevealRounds = 3;

export const neverHaveIEverPrompts = [
  "Faked a laugh at a joke I didn't get",
  "Googled myself",
  "Fallen asleep in a movie theater",
  "Eaten food off the floor",
  "Forgot someone's name right after meeting them",
  "Pretended to like a song to impress someone",
  "Cried during a commercial",
  "Taken a picture with a celebrity",
  "Stalked an ex's new partner online",
  "Gone a whole day without brushing my teeth",
  "Been on a blind date before",
  "Sent a risky text I regretted",
  "Worn mismatched socks on purpose",
  "Joined a voice room just to listen without talking",
];

export const wouldYouRatherQuestions = [
  ["Have the ability to fly", "Be invisible"],
  ["Always be slightly early", "Always be 5 minutes late"],
  ["Live without music", "Live without movies"],
  ["Have a rewind button for life", "Have a pause button"],
  ["Be famous for something embarrassing", "Be completely unknown"],
  ["Never eat pizza again", "Only eat pizza forever"],
  ["Travel to the past", "Travel to the future"],
  ["Have unlimited money", "Have unlimited time"],
  ["Speak all languages", "Play all instruments"],
  ["Be able to read minds", "Be able to teleport"],
  ["Live in the mountains", "Live on the beach"],
  ["Host a room every day", "Join a room every day"],
  ["Be the funniest person in the room", "Be the smartest person in the room"],
  ["Always lose at games", "Always win at games no one cares about"],
];

export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
