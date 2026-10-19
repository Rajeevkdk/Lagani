CREATE TABLE app.revoked_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app.users,
  expires_at timestamptz NOT NULL
);
REVOKE ALL ON app.revoked_tokens FROM PUBLIC;
