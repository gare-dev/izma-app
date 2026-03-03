// ─── Player ────────────────────────────────────────────────────────────────

export type PlayerStatus = "waiting" | "ready" | "playing" | "finished";

export interface Player {
    id: string;
    nickname: string;
    score: number;
    status: PlayerStatus;
    isHost: boolean;
    /** Authenticated user info (null = guest) */
    userId: string | null;
    avatarUrl: string | null;
}

// ─── User ──────────────────────────────────────────────────────────────────

export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    avatarUrl: string | null;
    bio: string | null;
    coins: number;
    isGuest: false;
    createdAt: string; // ISO 8601
}

/** Public-facing user (never expose passwordHash / email) */
export interface PublicUser {
    id: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    coins: number;
}

export interface GuestUser {
    id: string;
    username: string;
    avatarUrl: null;
    bio: null;
    coins: 0;
    isGuest: true;
}

// ─── Game Catalog ──────────────────────────────────────────────────────────

export interface Game {
    id: string;
    name: string;
    description: string;
    thumbnailUrl: string;
    minPlayers: number;
    maxPlayers: number;
    isActive: boolean;
}

// ─── Room Game Settings ────────────────────────────────────────────────────

export type GameSelectionMode = "RANDOM" | "MANUAL";

export interface RoomGameSettings {
    totalRounds: number;
    mode: GameSelectionMode;
    /** When mode = MANUAL, the host picks gameIds; when RANDOM, backend fills this. */
    selectedGameIds: string[];
}

// ─── Room ──────────────────────────────────────────────────────────────────

export type RoomState = "lobby" | "countdown" | "playing" | "finished";

export interface Room {
    id: string;
    hostId: string;
    players: Player[];
    state: RoomState;
    maxPlayers: number;
    /** @deprecated use games.selectedGameIds — kept for backward compat */
    gameId: string;
    games: RoomGameSettings;
    currentGameIndex: number;
    gameState: ReactionGameState | null;
}

// ─── Reaction Game ──────────────────────────────────────────────────────────

export type ReactionPhase =
    | "idle"
    | "countdown"
    | "waiting"   // before signal – don't click
    | "reacting"  // signal shown – click now!
    | "round_result"
    | "game_over";

export interface ReactionGameState {
    round: number;
    totalRounds: number;
    phase: ReactionPhase;
    countdown: number;         // seconds remaining in pre-game countdown
    winner: string | null;     // playerId who won this round
    falseStarter: string | null; // playerId who clicked too early
    scores: Record<string, number>;
    lastReactionTime: number | null; // ms, winner's reaction time this round
}

// ─── Auth DTOs ─────────────────────────────────────────────────────────────

export interface RegisterDTO {
    username: string;
    email: string;
    password: string;
}

export interface LoginDTO {
    username: string;
    password: string;
}

export interface GuestDTO {
    username: string;
}

export interface AuthResponse {
    user: PublicUser | GuestUser;
    accessToken: string;
}

// ─── User DTOs ─────────────────────────────────────────────────────────────

export interface UpdateProfileDTO {
    avatarUrl?: string;
    bio?: string;
}

// ─── Room DTOs ─────────────────────────────────────────────────────────────

export interface CreateRoomDTO {
    games: {
        totalRounds: number;
        mode: GameSelectionMode;
        selectedGameIds: string[];
    };
}

// ─── Coin DTOs ─────────────────────────────────────────────────────────────

export interface CoinTransaction {
    userId: string;
    amount: number;
    reason: "VICTORY" | "PARTICIPATION";
    roomId: string;
    timestamp: string;
}

// ─── API Error ─────────────────────────────────────────────────────────────

export interface ApiError {
    statusCode: number;
    error: string;
    message: string;
}
