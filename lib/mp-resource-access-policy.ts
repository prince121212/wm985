/** Public advertisement identifiers are configuration, never credentials. */
export const DEFAULT_MP_REWARDED_AD_UNIT = 'adunit-6d5a31d80528afc5';
export const MP_AD_POLICY_VERSION = 1;
export const MP_AD_SESSION_MS = 10 * 60 * 1000;
export const MP_RESOURCE_ACCESS_VERSION_HEADER = 'X-MP-Resource-Access-Version';

export function hasResourceAdClaim(body: unknown): boolean {
  return !!body && typeof body === 'object' &&
    (Object.prototype.hasOwnProperty.call(body, 'ad_session_id') || Object.prototype.hasOwnProperty.call(body, 'ad_completed'));
}

/** Temporary protocol compatibility, not client authentication or proof of viewing. */
export function requiresResourceAdPolicy(req: Request, body?: unknown): boolean {
  return process.env.MP_ALLOW_LEGACY_RESOURCE_ACCESS === 'false' ||
    req.headers.has(MP_RESOURCE_ACCESS_VERSION_HEADER) || hasResourceAdClaim(body);
}

export function mpAdConfig() {
  const adUnitId = (process.env.MP_REWARDED_AD_UNIT_ID || DEFAULT_MP_REWARDED_AD_UNIT).trim();
  return {
    enabled: process.env.MP_REWARDED_AD_ENABLED !== 'false' && /^adunit-[a-zA-Z0-9]+$/.test(adUnitId),
    ad_unit_id: adUnitId,
    policy_version: MP_AD_POLICY_VERSION,
  };
}

export function resourceCreditsCost(resource: { is_free?: boolean; credits?: number | null }): number {
  const amount = Number(resource.credits || 0);
  return resource.is_free === false && Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/** New clients browse without URLs; old installed clients need the original protocol during rollout. */
export function publicMpResource<T extends { is_free?: boolean; credits?: number | null; file_url?: string }>(resource: T, req?: Request) {
  if (req && !requiresResourceAdPolicy(req)) return { ...resource, ad_required: false };
  const { file_url: _privateUrl, ...publicFields } = resource;
  return { ...publicFields, ad_required: resourceCreditsCost(resource) === 0 };
}

export interface ResourceAdSession {
  id: string;
  user_uuid: string;
  resource_uuid: string;
  ad_unit_id: string;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
}

export function validResourceAdSession(
  session: ResourceAdSession | null,
  userUuid: string,
  resourceUuid: string,
  adUnitId: string,
  at = Date.now(),
): session is ResourceAdSession {
  if (!session || session.user_uuid !== userUuid || session.resource_uuid !== resourceUuid || session.ad_unit_id !== adUnitId) return false;
  const created = Date.parse(session.created_at), expires = Date.parse(session.expires_at);
  return Number.isFinite(created) && Number.isFinite(expires) && created <= at && expires > at && expires - created <= MP_AD_SESSION_MS;
}
