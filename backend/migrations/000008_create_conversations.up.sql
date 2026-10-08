CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    user_a_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_a_id, user_b_id),
    CHECK (user_a_id < user_b_id)
);