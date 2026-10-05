-- Mini-program rewarded-video resource access; website access routes are unchanged.
-- Apply before deploying the API and coordinated mini-program release.
CREATE TABLE IF NOT EXISTS public.mp_resource_ad_sessions (
    id UUID PRIMARY KEY,
    user_uuid VARCHAR(255) NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
    resource_uuid VARCHAR(255) NOT NULL REFERENCES public.resources(uuid) ON DELETE CASCADE,
    ad_unit_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '10 minutes'),
    CHECK (completed_at IS NULL OR completed_at >= created_at)
);
CREATE INDEX IF NOT EXISTS idx_mp_resource_ad_pending
  ON public.mp_resource_ad_sessions (user_uuid, resource_uuid, created_at DESC)
  WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mp_resource_ad_expires ON public.mp_resource_ad_sessions (expires_at);
ALTER TABLE public.mp_resource_ad_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mp_resource_ad_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mp_resource_ad_sessions TO service_role;
-- Completed/expired records may be retained temporarily for troubleshooting, then purged after 7 days.
NOTIFY pgrst, 'reload schema';
