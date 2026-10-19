ALTER TABLE app.reports ADD COLUMN source_job_id uuid UNIQUE REFERENCES app.jobs(id);
CREATE INDEX IF NOT EXISTS reports_public ON app.reports(business_id,status,version DESC);
CREATE INDEX IF NOT EXISTS memberships_user ON app.memberships(user_id);
CREATE INDEX IF NOT EXISTS commitments_round ON app.commitments(round_id,status);
CREATE INDEX IF NOT EXISTS notifications_user ON app.notifications(user_id,created_at DESC);
