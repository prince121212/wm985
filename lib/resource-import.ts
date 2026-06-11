import { getSupabaseClient, withRetry } from "@/models/db";
import { createCategory, getAllCategories, updateCategoryResourceCount } from "@/models/category";
import { insertResource } from "@/models/resource";
import { addResourceTags } from "@/models/tag";
import { getUuid } from "@/lib/hash";
import { log } from "@/lib/logger";
import {
  NormalizedImportResource,
  ResourceImportItem,
  ResourceImportRequest,
  ResourceImportSummary,
} from "@/types/resource-import";
import { Category } from "@/types/resource";

export const RESOURCE_IMPORT_SECRET = "wm985";
export const RESOURCE_IMPORT_MAX_ITEMS = 500;
export const DEFAULT_SAFE_THRESHOLD = 80;
export const DEFAULT_IMPORT_CATEGORY = "其他";

export function verifyResourceImportKey(req: Request): boolean {
  const authorization = req.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const headerKey = req.headers.get("x-import-key")?.trim();
  const queryKey = (() => {
    try {
      return new URL(req.url).searchParams.get("key")?.trim();
    } catch {
      return "";
    }
  })();

  return [bearer, headerKey, queryKey].some((key) => key === RESOURCE_IMPORT_SECRET);
}

function clampNumber(value: unknown, fallback: number, min = 0, max = 100): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanLongText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function normalizeUrl(value: unknown): string {
  let url = String(value || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function uniqueStrings(values: unknown[], maxItems = 12, maxLength = 50): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values.flat()) {
    const text = cleanText(value, maxLength);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= maxItems) break;
  }

  return result;
}

function categoryKey(name: string): string {
  return cleanText(name, 100).toLowerCase();
}

function buildCategoryMap(categories: Category[]): Map<string, Category> {
  const map = new Map<string, Category>();
  for (const category of categories) {
    const key = categoryKey(category.name);
    if (!map.has(key)) {
      map.set(key, category);
    }
  }
  return map;
}

function buildImportContent(resource: NormalizedImportResource, request: ResourceImportRequest): string {
  const source = request.source || {};
  const meta = [
    source.name ? `导入来源：${source.name}` : "",
    source.url ? `来源站点：${source.url}` : "",
    resource.source_section ? `来源栏目：${resource.source_section}` : "",
    resource.external_id ? `外部ID：${resource.external_id}` : "",
    resource.quality ? `质量标记：${resource.quality}` : "",
    `安全分值：${resource.safety_score}/100`,
    resource.safety_note ? `安全备注：${resource.safety_note}` : "",
  ].filter(Boolean).join("\n");

  return [resource.content, meta].filter(Boolean).join("\n\n---\n");
}

function buildReviewNote(resource: NormalizedImportResource, request: ResourceImportRequest): string {
  const source = request.source || {};
  return [
    `通用导入接口备注`,
    `安全分值：${resource.safety_score}/100`,
    `判定结果：${resource.status === "approved" ? "自动过审" : "进入待审核"}`,
    source.name ? `来源：${source.name}` : "",
    source.url ? `来源地址：${source.url}` : "",
    resource.source_section ? `来源栏目：${resource.source_section}` : "",
    resource.safety_note ? `备注：${resource.safety_note}` : "",
  ].filter(Boolean).join("；");
}

export function summarizeImport(resources: NormalizedImportResource[]): ResourceImportSummary {
  const categoriesToCreate = new Set<string>();

  for (const resource of resources) {
    if (resource.category?.will_create) {
      categoriesToCreate.add(resource.category.name);
    }
  }

  const willImportResources = resources.filter((resource) => (
    resource.errors.length === 0 &&
    !resource.duplicate_in_payload &&
    !resource.existing_duplicate
  ));

  return {
    total: resources.length,
    valid: resources.filter((resource) => resource.errors.length === 0).length,
    invalid: resources.filter((resource) => resource.errors.length > 0).length,
    duplicate_in_payload: resources.filter((resource) => resource.duplicate_in_payload).length,
    existing_duplicates: resources.filter((resource) => !!resource.existing_duplicate).length,
    will_import: willImportResources.length,
    will_approve: willImportResources.filter((resource) => resource.status === "approved").length,
    will_pending: willImportResources.filter((resource) => resource.status === "pending").length,
    categories_to_create: Array.from(categoriesToCreate),
  };
}

export async function normalizeImportRequest(request: ResourceImportRequest): Promise<NormalizedImportResource[]> {
  if (!request || typeof request !== "object") {
    throw new Error("请求体必须是JSON对象");
  }
  if (!Array.isArray(request.resources)) {
    throw new Error("resources必须是数组");
  }
  if (request.resources.length === 0) {
    throw new Error("resources不能为空");
  }
  if (request.resources.length > RESOURCE_IMPORT_MAX_ITEMS) {
    throw new Error(`单次最多导入${RESOURCE_IMPORT_MAX_ITEMS}条资源，请分批提交`);
  }

  const safeThreshold = clampNumber(request.options?.safe_threshold, DEFAULT_SAFE_THRESHOLD);
  const defaultCategoryName = cleanText(request.defaults?.category_name || DEFAULT_IMPORT_CATEGORY, 100) || DEFAULT_IMPORT_CATEGORY;
  const defaultTags = uniqueStrings([
    ...(request.defaults?.tags || []),
    request.source?.name || "",
  ]);
  const createMissingCategories = request.options?.create_missing_categories !== false;

  const categories = await getAllCategories();
  const categoryMap = buildCategoryMap(categories);
  const categoryById = new Map<number, Category>();
  categories.forEach((category) => {
    if (category.id) categoryById.set(category.id, category);
  });

  const seenUrls = new Set<string>();
  const normalized = request.resources.map((item: ResourceImportItem, index): NormalizedImportResource => {
    const title = cleanText(item.title || item.name, 500);
    const url = normalizeUrl(item.url || item.link);
    const rawCategoryName = cleanText(item.category_name || defaultCategoryName, 100) || DEFAULT_IMPORT_CATEGORY;
    const categoryId = Number.isInteger(Number(item.category_id)) ? Number(item.category_id) : request.defaults?.category_id;
    const categoryByInputId = categoryId ? categoryById.get(categoryId) : undefined;
    const categoryName = categoryByInputId?.name || rawCategoryName;
    const safetyScore = clampNumber(item.safety_score ?? request.defaults?.safety_score, 0);
    const status = safetyScore >= safeThreshold ? "approved" : "pending";
    const tags = uniqueStrings([
      ...defaultTags,
      ...(item.tags || []),
      item.source_section || "",
      item.quality || "",
    ]);

    const errors: string[] = [];
    if (!title) errors.push("标题不能为空");
    if (!url) errors.push("URL格式不正确");
    if (categoryId && !categoryByInputId) errors.push(`分类ID不存在：${categoryId}`);

    const duplicateInPayload = !!url && seenUrls.has(url);
    if (url) seenUrls.add(url);

    const categoryFromName = categoryMap.get(categoryKey(categoryName));
    const category = categoryByInputId || categoryFromName;
    if (!category && !createMissingCategories) errors.push(`分类不存在：${categoryName}`);

    return {
      index,
      external_id: cleanText(item.external_id, 120) || undefined,
      title,
      url,
      description: cleanLongText(item.description, 1200) || `来自${request.source?.name || "外部来源"}的资源：${title}`,
      content: cleanLongText(item.content, 6000),
      category_id: category?.id,
      category_name: category?.name || categoryName,
      tags,
      source_section: cleanText(item.source_section, 150) || undefined,
      quality: cleanText(item.quality, 80) || undefined,
      safety_score: safetyScore,
      safety_note: cleanLongText(item.safety_note, 500) || undefined,
      is_free: item.is_free ?? request.defaults?.is_free ?? true,
      credits: Math.max(0, Math.round(Number(item.credits ?? request.defaults?.credits ?? 0) || 0)),
      status,
      ai_risk_score: 100 - safetyScore,
      auto_approved: status === "approved",
      errors,
      duplicate_in_payload: duplicateInPayload,
      category: {
        id: category?.id,
        name: category?.name || categoryName,
        exists: !!category,
        will_create: !category && createMissingCategories,
      },
    };
  });

  await attachExistingDuplicates(normalized);

  return normalized;
}

async function attachExistingDuplicates(resources: NormalizedImportResource[]): Promise<void> {
  const urls = Array.from(new Set(resources.map((resource) => resource.url).filter(Boolean)));
  if (urls.length === 0) return;

  const supabase = getSupabaseClient();
  const existingByUrl = new Map<string, { uuid: string; title: string; status: string }>();
  const chunkSize = 100;

  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("resources")
      .select("uuid,title,status,file_url")
      .in("file_url", chunk);

    if (error) {
      log.error("查询导入重复资源失败", error, { urlCount: chunk.length });
      throw error;
    }

    for (const item of data || []) {
      if (item.file_url && !existingByUrl.has(item.file_url)) {
        existingByUrl.set(item.file_url, {
          uuid: item.uuid,
          title: item.title,
          status: item.status,
        });
      }
    }
  }

  resources.forEach((resource) => {
    const duplicate = existingByUrl.get(resource.url);
    if (duplicate) resource.existing_duplicate = duplicate;
  });
}

export async function resolveImportAuthor(request: ResourceImportRequest): Promise<string> {
  const supabase = getSupabaseClient();
  const requestedAuthor = cleanText(request.defaults?.author_uuid, 255);

  if (requestedAuthor) {
    const { data, error } = await supabase
      .from("users")
      .select("uuid")
      .eq("uuid", requestedAuthor)
      .single();

    if (error || !data?.uuid) {
      throw new Error(`指定author_uuid不存在：${requestedAuthor}`);
    }

    return data.uuid;
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((email) => email.trim()).filter(Boolean);
  if (adminEmails.length > 0) {
    const { data, error } = await supabase
      .from("users")
      .select("uuid,email")
      .in("email", adminEmails)
      .limit(1);

    if (!error && data && data.length > 0 && data[0].uuid) {
      return data[0].uuid;
    }
  }

  const { data: firstUser, error: firstUserError } = await supabase
    .from("users")
    .select("uuid")
    .order("created_at", { ascending: true })
    .limit(1);

  if (firstUserError) {
    throw firstUserError;
  }

  if (!firstUser || firstUser.length === 0 || !firstUser[0].uuid) {
    throw new Error("系统中没有可用用户，请先注册一个用户，或在defaults.author_uuid中指定作者");
  }

  return firstUser[0].uuid;
}

async function ensureCategory(resource: NormalizedImportResource, categoryMap: Map<string, Category>): Promise<number> {
  if (resource.category_id) return resource.category_id;

  const key = categoryKey(resource.category_name);
  const existing = categoryMap.get(key);
  if (existing?.id) return existing.id;

  const category = await createCategory({
    name: resource.category_name || DEFAULT_IMPORT_CATEGORY,
    description: "通用导入接口自动创建的分类",
    sort_order: 0,
    resource_count: 0,
  });

  categoryMap.set(key, category);
  return category.id!;
}

export async function commitImportRequest(request: ResourceImportRequest) {
  const normalized = await normalizeImportRequest(request);
  const authorUuid = await resolveImportAuthor(request);
  const categories = await getAllCategories();
  const categoryMap = buildCategoryMap(categories);
  const skipExisting = request.options?.skip_existing !== false;

  const results: Array<{
    index: number;
    title: string;
    url: string;
    success: boolean;
    skipped?: boolean;
    reason?: string;
    uuid?: string;
    status?: 'approved' | 'pending';
    safety_score?: number;
    error?: string;
  }> = [];

  const approvedCategoryIds = new Set<number>();
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let approvedCount = 0;
  let pendingCount = 0;

  for (const resource of normalized) {
    if (resource.errors.length > 0) {
      failedCount++;
      results.push({
        index: resource.index,
        title: resource.title,
        url: resource.url,
        success: false,
        error: resource.errors.join("；"),
      });
      continue;
    }

    if (resource.duplicate_in_payload) {
      skippedCount++;
      results.push({
        index: resource.index,
        title: resource.title,
        url: resource.url,
        success: false,
        skipped: true,
        reason: "本次提交中重复",
      });
      continue;
    }

    if (skipExisting && resource.existing_duplicate) {
      skippedCount++;
      results.push({
        index: resource.index,
        title: resource.title,
        url: resource.url,
        success: false,
        skipped: true,
        reason: `数据库已有重复资源：${resource.existing_duplicate.uuid}`,
      });
      continue;
    }

    try {
      const categoryId = await ensureCategory(resource, categoryMap);
      const resourceUuid = getUuid();
      const createdResource = await insertResource({
        uuid: resourceUuid,
        title: resource.title,
        description: resource.description,
        content: buildImportContent(resource, request),
        file_url: resource.url,
        category_id: categoryId,
        author_id: authorUuid,
        status: resource.status,
        rating_avg: 0,
        rating_count: 0,
        view_count: 0,
        access_count: 0,
        is_featured: false,
        is_free: resource.is_free,
        credits: resource.credits,
        top: false,
        ai_risk_score: resource.ai_risk_score,
        ai_review_result: buildReviewNote(resource, request),
        ai_reviewed_at: new Date().toISOString(),
        auto_approved: resource.auto_approved,
      });

      if (resource.tags.length > 0 && createdResource.id) {
        await addResourceTags(createdResource.id, resource.tags);
      }

      if (resource.status === "approved") {
        approvedCount++;
        approvedCategoryIds.add(categoryId);
      } else {
        pendingCount++;
      }

      successCount++;
      results.push({
        index: resource.index,
        title: resource.title,
        url: resource.url,
        success: true,
        uuid: resourceUuid,
        status: resource.status,
        safety_score: resource.safety_score,
      });
    } catch (error) {
      failedCount++;
      const message = error instanceof Error ? error.message : String(error);
      log.error("通用资源导入单条失败", error as Error, {
        title: resource.title,
        url: resource.url,
      });
      results.push({
        index: resource.index,
        title: resource.title,
        url: resource.url,
        success: false,
        error: message,
      });
    }
  }

  for (const categoryId of approvedCategoryIds) {
    updateCategoryResourceCount(categoryId).catch((error: Error) => {
      log.error("通用导入后更新分类资源数失败", error, { categoryId });
    });
  }
  refreshAuthorApprovedCount(authorUuid).catch((error: Error) => {
    log.error("通用导入后更新用户过审资源数失败", error, { authorUuid });
  });

  return {
    author_uuid: authorUuid,
    summary: {
      total: normalized.length,
      success_count: successCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      approved_count: approvedCount,
      pending_count: pendingCount,
    },
    results,
  };
}

async function refreshAuthorApprovedCount(authorUuid: string): Promise<void> {
  await withRetry(async () => {
    const supabase = getSupabaseClient();
    const { count, error: countError } = await supabase
      .from("resources")
      .select("*", { count: "exact", head: true })
      .eq("author_id", authorUuid)
      .eq("status", "approved");

    if (countError) throw countError;

    const { error: updateError } = await supabase
      .from("users")
      .update({ total_approved_resources: count || 0 })
      .eq("uuid", authorUuid);

    if (updateError) throw updateError;
  });
}
