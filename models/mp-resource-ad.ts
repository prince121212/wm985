import { randomUUID } from 'crypto';
import { getSupabaseClient } from './db';
import { MP_AD_SESSION_MS, ResourceAdSession, validResourceAdSession } from '@/lib/mp-resource-access-policy';

const TABLE = 'mp_resource_ad_sessions';
const FIELDS = 'id,user_uuid,resource_uuid,ad_unit_id,created_at,expires_at,completed_at';

export async function createResourceAdSession(userUuid: string, resourceUuid: string, adUnitId: string): Promise<ResourceAdSession> {
  const db = getSupabaseClient(), now = new Date().toISOString();
  // Reuse an uncompleted attempt after a network/ad-load retry. It never authorizes another resource.
  const pending = await db.from(TABLE).select(FIELDS)
    .eq('user_uuid', userUuid).eq('resource_uuid', resourceUuid).eq('ad_unit_id', adUnitId)
    .is('completed_at', null).gt('expires_at', now).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (pending.error) throw new Error('广告访问记录暂不可用');
  if (pending.data) return pending.data as ResourceAdSession;
  const created = Date.now();
  const session: ResourceAdSession = {
    id: randomUUID(), user_uuid: userUuid, resource_uuid: resourceUuid, ad_unit_id: adUnitId,
    created_at: new Date(created).toISOString(), expires_at: new Date(created + MP_AD_SESSION_MS).toISOString(), completed_at: null,
  };
  const { error } = await db.from(TABLE).insert(session);
  if (error) throw new Error('暂时无法开始广告，请稍后重试');
  return session;
}

/** This is account/resource-bound receipt validation, NOT proof signed by the ad provider. */
export async function completeResourceAdSession(sessionId: string, userUuid: string, resourceUuid: string, adUnitId: string): Promise<{ allowed: boolean; firstCompletion: boolean }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) return { allowed: false, firstCompletion: false };
  const db = getSupabaseClient();
  const read = await db.from(TABLE).select(FIELDS).eq('id', sessionId).eq('user_uuid', userUuid).eq('resource_uuid', resourceUuid).maybeSingle();
  if (read.error) throw new Error('暂时无法核对广告记录，请重试');
  const row = read.data as ResourceAdSession | null;
  if (!validResourceAdSession(row, userUuid, resourceUuid, adUnitId)) return { allowed: false, firstCompletion: false };
  if (row.completed_at) return { allowed: true, firstCompletion: false };
  const now = new Date().toISOString();
  // Only the first update wins. A repeated SDK callback/HTTP retry returns the link but is not counted twice.
  const completed = await db.from(TABLE).update({ completed_at: now }).eq('id', sessionId)
    .eq('user_uuid', userUuid).eq('resource_uuid', resourceUuid).eq('ad_unit_id', adUnitId)
    .is('completed_at', null).gt('expires_at', now).select('id');
  if (completed.error) throw new Error('暂时无法解锁资源，请重试');
  if (completed.data?.length) return { allowed: true, firstCompletion: true };
  const retried = await db.from(TABLE).select(FIELDS).eq('id', sessionId).eq('user_uuid', userUuid).eq('resource_uuid', resourceUuid).maybeSingle();
  if (retried.error) throw new Error('暂时无法核对广告记录，请重试');
  const receipt = retried.data as ResourceAdSession | null;
  return { allowed: validResourceAdSession(receipt, userUuid, resourceUuid, adUnitId) && !!receipt.completed_at, firstCompletion: false };
}
