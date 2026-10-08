CREATE TABLE calls (
    id UUID PRIMARY KEY,
    type VARCHAR(16) NOT NULL CHECK (type IN ('dm', 'channel')),
    conversation_id UUID NULL REFERENCES conversations (id) ON DELETE CASCADE,
    channel_id UUID NULL REFERENCES channels (id) ON DELETE CASCADE,
    server_id UUID NULL REFERENCES servers (id) ON DELETE CASCADE,
    initiator_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NULL,
    CHECK (
        (
            type = 'dm'
            AND conversation_id IS NOT NULL
            AND channel_id IS NULL
            AND server_id IS NULL
        )
        OR
        (
            type = 'channel'
            AND conversation_id IS NULL
            AND channel_id IS NOT NULL
            AND server_id IS NOT NULL
        )
    )
);

CREATE TABLE call_participants (
    call_id UUID NOT NULL REFERENCES calls (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'presenter')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ NULL,
    PRIMARY KEY (call_id, user_id)
);

CREATE INDEX idx_calls_conversation ON calls (conversation_id);
CREATE INDEX idx_calls_channel ON calls (channel_id);
CREATE INDEX idx_call_participants_user ON call_participants (user_id);
