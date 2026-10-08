CREATE TABLE server_invites (
    id UUID PRIMARY KEY,
    server_id UUID NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CHECK (status IN ('pending', 'accepted', 'declined'))
);

CREATE UNIQUE INDEX server_invites_pending_uniq
    ON server_invites (server_id, invitee_id)
    WHERE status = 'pending';