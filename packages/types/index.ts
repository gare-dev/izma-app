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
    bio: string | null;
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
    /** Per-game round overrides (MANUAL mode). Maps gameId → rounds for that game. */
    roundsPerGame?: Record<string, number>;
}

// ─── Room ──────────────────────────────────────────────────────────────────

export type RoomState = "lobby" | "countdown" | "playing" | "finished";

export interface Room {
    id: string;
    hostId: string;
    players: Player[];
    state: RoomState;
    maxPlayers: number;
    isPrivate: boolean;
    /** @deprecated use games.selectedGameIds — kept for backward compat */
    gameId: string;
    games: RoomGameSettings;
    currentGameIndex: number;
    gameState: AnyGameState | null;
}

/** Lightweight room info exposed in the public room list. */
export interface PublicRoomInfo {
    id: string;
    hostNickname: string;
    playerCount: number;
    maxPlayers: number;
    gameIds: string[];
    state: RoomState;
}

// ─── Base Game State ────────────────────────────────────────────────────────
// Every minigame state MUST extend this base. The `gameId` field lets the
// frontend pick the correct renderer component.

export interface BaseGameState {
    gameId: string;
    phase: string;
    round: number;
    totalRounds: number;
    scores: Record<string, number>;
}

// ─── Per-Game State Types ───────────────────────────────────────────────────
// Each minigame has its own file under games/. Re-exported here for convenience.

export { type ReactionPhase, type ReactionGameState } from "./games/reaction";
export { type ColorMatchPhase, type ColorMatchGameState } from "./games/color-match";

// ─── Game State Union ──────────────────────────────────────────────────────
// Add new game state interfaces to this union as you create them.

import type { ReactionGameState } from "./games/reaction";
import type { ColorMatchGameState } from "./games/color-match";
export type AnyGameState = ReactionGameState | ColorMatchGameState;

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
}

// ─── User DTOs ─────────────────────────────────────────────────────────────

export interface UpdateProfileDTO {
    username?: string;
    avatarUrl?: string;
    bio?: string;
}

// ─── Room DTOs ─────────────────────────────────────────────────────────────

export interface CreateRoomDTO {
    games: {
        totalRounds: number;
        mode: GameSelectionMode;
        selectedGameIds: string[];
        roundsPerGame?: Record<string, number>;
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

// ─── Rankings DTOs ─────────────────────────────────────────────────────────

export type RankingPeriod = "daily" | "weekly" | "monthly" | "all";

export interface RankedUser {
    rank: number;
    userId: string;
    username: string;
    avatarUrl: string | null;
    value: number; // coins or win count
}

export interface RankingsResponse {
    period: RankingPeriod;
    type: "coins" | "victories";
    entries: RankedUser[];
}

// ─── Clan ──────────────────────────────────────────────────────────────────

export type ClanJoinMode = "public" | "private" | "approval";
export type ClanRole = "owner" | "admin" | "member";
export type ClanMemberStatus = "active" | "pending";

export interface Clan {
    id: string;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    joinMode: ClanJoinMode;
    ownerId: string;
    inviteCode: string;
    memberCount: number;
    createdAt: string;
}

export interface ClanMember {
    userId: string;
    username: string;
    avatarUrl: string | null;
    role: ClanRole;
    status: ClanMemberStatus;
    joinedAt: string;
}

export interface ClanDetail extends Clan {
    members: ClanMember[];
}

export interface CreateClanDTO {
    name: string;
    bio?: string;
    joinMode?: ClanJoinMode;
}

export interface UpdateClanDTO {
    name?: string;
    bio?: string;
    joinMode?: ClanJoinMode;
}

export interface ClanChatMessage {
    id: string;
    clanId: string;
    userId: string;
    username: string;
    avatarUrl: string | null;
    message: string;
    timestamp: string;
}

/** Lightweight clan info for listing */
export interface PublicClanInfo {
    id: string;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    joinMode: ClanJoinMode;
    ownerUsername: string;
    memberCount: number;
}

// ─── Match History ─────────────────────────────────────────────────────────

export interface MatchPlayerSummary {
    userId: string;
    nickname: string;
    score: number;
    position: number;
    isMvp: boolean;
}

export interface MatchSummary {
    id: string;
    roomId: string;
    gameIds: string[];
    playerCount: number;
    mvpUserId: string | null;
    playedAt: string; // ISO 8601
    players: MatchPlayerSummary[];
}

// ─── API Error ─────────────────────────────────────────────────────────────

export interface ApiError {
    statusCode: number;
    error: string;
    message: string;
}
