-- ─── Match History Tables ────────────────────────────────────────────────────

-- ─── Matches table ──────────────────────────────────────────────────────────
-- One row per completed match (a full room session from start to final results)

CREATE TABLE IF NOT EXISTS matches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     VARCHAR(20) NOT NULL,
    game_ids    TEXT[] NOT NULL,          -- e.g. {'reaction','color-match'}
    player_count SMALLINT NOT NULL,
    mvp_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    played_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matches_played_at ON matches(played_at DESC);

-- ─── Match Players table ────────────────────────────────────────────────────
-- One row per player per match. Stores final score and position.

CREATE TABLE IF NOT EXISTS match_players (
    match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname    VARCHAR(30) NOT NULL,
    score       INT NOT NULL DEFAULT 0,
    position    SMALLINT NOT NULL,
    is_mvp      BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (match_id, user_id)
);

CREATE INDEX idx_match_players_user ON match_players(user_id, match_id);
