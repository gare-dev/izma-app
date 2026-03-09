-- ─── Clan System Tables ──────────────────────────────────────────────────────

-- Join mode enum
CREATE TYPE clan_join_mode AS ENUM ('public', 'private', 'approval');

-- Member role enum
CREATE TYPE clan_role AS ENUM ('owner', 'admin', 'member');

-- Member status enum (for approval mode)
CREATE TYPE clan_member_status AS ENUM ('active', 'pending');

-- ─── Clans table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(30) NOT NULL UNIQUE,
    bio         VARCHAR(500),
    avatar_url  TEXT,
    join_mode   clan_join_mode NOT NULL DEFAULT 'public',
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(12) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clans_owner ON clans(owner_id);
CREATE INDEX idx_clans_name_lower ON clans(LOWER(name));
CREATE INDEX idx_clans_invite_code ON clans(invite_code);

-- ─── Clan Members table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clan_members (
    clan_id    UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       clan_role NOT NULL DEFAULT 'member',
    status     clan_member_status NOT NULL DEFAULT 'active',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (clan_id, user_id)
);

CREATE INDEX idx_clan_members_user ON clan_members(user_id);

-- ─── Clan Chat Messages ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clan_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clan_id    UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message    VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clan_messages_clan ON clan_messages(clan_id, created_at DESC);
