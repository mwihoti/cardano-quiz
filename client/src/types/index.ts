export interface Member {
  id: string;
  name: string;
  walletAddress?: string;
  isLeader: boolean;
  vote?: string;
}

export interface Room {
  code: string;
  name: string;
  members: Member[];
  score?: number;
}

export interface Question {
  id: string;
  category: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  points: number;
  timeLimit: number;
}

export interface RoomSummary {
  code: string;
  name: string;
  memberCount: number;
  score: number;
  lockedAnswer?: string;
  voteCounts: Record<string, number>;
  members: Array<{ id: string; name: string; vote?: string; isLeader: boolean }>;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  members: Member[];
  code: string;
}

export type GameStatus = "lobby" | "active" | "question" | "review" | "finished";

// ── Incoming WS message shapes ────────────────────────────────────────────────

export type ServerMsg =
  | { type: "CONNECTED"; socketId: string }
  | { type: "ERROR"; message: string }
  | { type: "GAME_CREATED"; game: { id: string; code: string; status: GameStatus } }
  | { type: "ROOM_CREATED"; room: Room; gameId: string }
  | { type: "JOINED_ROOM"; room: Room; gameStatus: GameStatus; currentQuestionIndex: number; currentQuestion: Question | null; totalQuestions: number }
  | { type: "MEMBER_JOINED"; member: Member; members: Member[] }
  | { type: "MEMBER_LEFT"; memberId: string; members: Member[] }
  | { type: "VOTE_UPDATE"; voteCounts: Record<string, number>; memberId: string; vote: string; totalVotes: number; totalMembers: number }
  | { type: "ANSWER_LOCKED"; answer: string; correct: boolean; correctAnswer: string; explanation: string; points: number; totalScore: number }
  | { type: "GAME_STARTED"; totalQuestions: number }
  | { type: "QUESTION_STARTED"; questionIndex: number; question: Question; timeLimit: number; totalQuestions: number }
  | { type: "GAME_FINISHED"; leaderboard: LeaderboardEntry[] }
  | { type: "ROOMS_UPDATE"; rooms: RoomSummary[] }
  | { type: "STATE_SNAPSHOT"; room: Room; gameStatus: GameStatus; currentQuestionIndex: number; currentQuestion: Question | null; totalQuestions: number }
  | { type: "HOST_STATE"; game: { id: string; code: string; status: GameStatus }; rooms: RoomSummary[]; currentQuestionIndex: number; totalQuestions: number }
  | { type: "GAME_RESET"; message: string }
  | { type: "ROOM_RESET"; message: string }
  | { type: "GAME_DELETED"; message: string }
  | { type: "KICKED"; message: string };
