CREATE TABLE messages (
    id UUID PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES users (id),
    channel_id UUID REFERENCES channels (id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations (id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((channel_id IS NOT NULL) <> (conversation_id IS NOT NULL))
);

CREATE INDEX idx_messages_channel ON messages (channel_id, created_at DESC);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at DESC);