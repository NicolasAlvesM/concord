ALTER TABLE channels
    ADD COLUMN type VARCHAR(16) NOT NULL DEFAULT 'text';

ALTER TABLE channels
    ADD CONSTRAINT channels_type_check CHECK (type IN ('text', 'voice'));
