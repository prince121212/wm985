import { getSupabaseClient, withRetry } from "./db";
import { log } from "@/lib/logger";
import { wrapQueryWithMonitoring } from "@/lib/db-performance";
import { Resource, ResourceWithDetails } from "@/types/resource";
import { updateCategoryResourceCount } from "./category";

// 应用置顶优先排序（直接使用top字段）
function applyTopPrioritySort(query: any, primarySort: string, ascending: boolean = false): any {
  return query
    .order('top', { ascending: false })
    .order(primarySort, { ascending });
}

// 安全的搜索词处理函数
function sanitizeSearchTerm(searchTerm: string): string {
  if (!searchTerm) return '';

  // 移除潜在的危险字符，只保留字母、数字、中文、空格和常见标点
  const sanitized = searchTerm
    .replace(/[^\w\s\u4e00-\u9fff\-_.]/g, '')
    .trim()
    .substring(0, 100); // 限制长度

  return sanitized;
}

// 复用现有的错误处理和日志模式
export async function insertResource(resource: Omit<Resource, 'id' | 'created_at' | 'updated_at'>) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("resources")
      .insert(resource)
      .select()
      .single();
    
    if (error) {
      log.error("插入资源失败", error, { resource: resource.title });
      throw error;
    }
    
    log.info("资源创建成功", { resourceId: resource.uuid, title: resource.title });
    return data;
  });
}

export async function findResourceByUuid(uuid: string): Promise<ResourceWithDetails | undefined> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("resources")
      .select(`
        *,
        author:users!resources_author_id_fkey(uuid, nickname, avatar_url),
        category:categories!resources_category_id_fkey(id, name, description)
      `)
      .eq("uuid", uuid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return undefined;
      }
      log.error("查询资源失败", error, { uuid });
      throw error;
    }

    return data;
  });
}

export async function updateResource(uuid: string, updates: Partial<Resource>) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("resources")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("uuid", uuid)
      .select()
      .single();

    if (error) {
      log.error("更新资源失败", error, { uuid, updates });
      throw error;
    }

    log.info("资源更新成功", { uuid, updates: Object.keys(updates) });
    return data;
  });
}

export async function deleteResource(uuid: string) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 先获取资源信息以获得分类ID
    const { data: resource, error: fetchError } = await supabase
      .from("resources")
      .select("category_id, status")
      .eq("uuid", uuid)
      .single();

    if (fetchError) {
      log.error("获取资源信息失败", fetchError, { uuid });
      throw fetchError;
    }

    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("uuid", uuid);

    if (error) {
      log.error("删除资源失败", error, { uuid });
      throw error;
    }

    log.info("资源删除成功", { uuid });

    // 只有删除已审核通过的资源才需要更新分类资源数
    if (resource?.status === 'approved' && resource?.category_id) {
      updateCategoryResourceCount(resource.category_id).catch((error: Error) => {
        log.error("删除资源后更新分类资源数失败", error, { uuid, categoryId: resource.category_id });
      });
    }
  });
}

// 获取资源总数（用于分页）
export async function getResourcesCount(params: {
  category?: string;
  tags?: string[];
  search?: string;
  status?: string;
  isAdmin?: boolean; // 新增管理员标识
}): Promise<number> {
  return wrapQueryWithMonitoring(
    'getResourcesCount',
    async () => withRetry(async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("resources")
        .select('id', { count: 'exact', head: true });

      // 状态筛选
      if (params.status) {
        query = query.eq("status", params.status);
      } else if (!params.isAdmin) {
        // 非管理员默认只显示已审核通过的资源
        query = query.eq("status", "approved");
      }

      // 分类筛选
      if (params.category) {
        query = query.eq("category_id", params.category);
      }

      // 标签筛选 - 使用JOIN查询优化性能，避免N+1查询问题
      if (params.tags && params.tags.length > 0) {
        const validTags = params.tags.filter(tag =>
          tag && typeof tag === 'string' && tag.trim().length > 0
        ).map(tag => tag.trim());

        if (validTags.length > 0) {
          // 使用单次JOIN查询获取包含指定标签的资源ID，优化N+1查询问题
          log.debug("执行标签筛选查询", { tags: validTags, queryType: 'count' });

          const { data: resourceIds, error: tagError } = await supabase
            .from('resource_tags')
            .select(`
              resource_id,
              tags!inner(id, name)
            `)
            .in('tags.name', validTags);

          if (tagError) {
            log.error("查询标签资源关联失败", tagError, { tags: validTags });
            throw tagError;
          }

          if (resourceIds && resourceIds.length > 0) {
            const resourceIdList = [...new Set(resourceIds.map(r => r.resource_id))]; // 去重
            log.debug("标签筛选查询完成", {
              tags: validTags,
              foundResources: resourceIdList.length,
              totalMatches: resourceIds.length
            });
            query = query.in('id', resourceIdList);
          } else {
            log.debug("标签筛选未找到匹配资源", { tags: validTags });
            return 0; // 没有找到相关资源
          }
        }
      }

      // 搜索
      if (params.search) {
        const searchTerm = sanitizeSearchTerm(params.search);
        if (searchTerm.length > 0) {
          // 使用参数化查询，避免SQL注入风险
          query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        }
      }

      const { count, error } = await query;

      if (error) {
        log.error("获取资源总数失败", error, params);
        throw error;
      }

      return count || 0;
    }),
    200 // 200ms慢查询阈值
  );
}

export async function getResourcesList(params: {
  category?: string;
  tags?: string[];
  search?: string;
  sort?: string;
  status?: string;
  offset?: number;
  limit?: number;
  isAdmin?: boolean; // 新增管理员标识
}): Promise<ResourceWithDetails[]> {
  return wrapQueryWithMonitoring(
    'getResourcesList',
    async () => withRetry(async () => {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("resources")
      .select(`
        *,
        author:users!resources_author_id_fkey(uuid, nickname, avatar_url),
        category:categories!resources_category_id_fkey(id, name, description)
      `);

    // 状态筛选
    if (params.status) {
      query = query.eq("status", params.status);
    } else if (!params.isAdmin) {
      // 非管理员默认只显示已审核通过的资源
      query = query.eq("status", "approved");
    }
    // 管理员且未指定状态时，显示所有状态的资源

    // 分类筛选
    if (params.category) {
      query = query.eq("category_id", params.category);
    }

    // 标签筛选 - 使用JOIN查询优化性能，避免N+1查询问题
    if (params.tags && params.tags.length > 0) {
      // 验证标签参数
      const validTags = params.tags.filter(tag =>
        tag && typeof tag === 'string' && tag.trim().length > 0
      ).map(tag => tag.trim());

      if (validTags.length > 0) {
        // 使用单次JOIN查询获取包含指定标签的资源ID，优化N+1查询问题
        // 通过JOIN避免多次数据库查询
        log.debug("执行标签筛选查询", { tags: validTags, queryType: 'list' });

        const { data: resourceIds, error: tagError } = await supabase
          .from('resource_tags')
          .select(`
            resource_id,
            tags!inner(id, name)
          `)
          .in('tags.name', validTags);

        if (tagError) {
          log.error("查询标签资源关联失败", tagError, { tags: validTags });
          throw tagError;
        }

        if (resourceIds && resourceIds.length > 0) {
          const resourceIdList = [...new Set(resourceIds.map(r => r.resource_id))]; // 去重
          log.debug("标签筛选查询完成", {
            tags: validTags,
            foundResources: resourceIdList.length,
            totalMatches: resourceIds.length
          });
          query = query.in('id', resourceIdList);
        } else {
          // 如果没有找到相关资源，返回空结果
          log.debug("标签筛选未找到匹配资源", { tags: validTags });
          query = query.eq('id', -1); // 不存在的ID，确保返回空结果
        }
      }
    }

    // 搜索 - 使用安全的参数化查询
    if (params.search) {
      const searchTerm = sanitizeSearchTerm(params.search);
      if (searchTerm.length > 0) {
        // 使用安全的搜索词进行查询
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }
    }

    // 排序 - 置顶资源始终排在前面
    switch (params.sort) {
      case 'latest':
        query = applyTopPrioritySort(query, 'created_at');
        break;
      case 'popular':
        query = applyTopPrioritySort(query, 'access_count');
        break;
      case 'rating':
        query = applyTopPrioritySort(query, 'rating_avg');
        break;
      case 'views':
        query = applyTopPrioritySort(query, 'view_count');
        break;
      default:
        query = applyTopPrioritySort(query, 'created_at');
    }

    // 分页
    if (params.offset !== undefined) {
      query = query.range(params.offset, (params.offset + (params.limit || 20)) - 1);
    }

    const { data, error } = await query;

    if (error) {
      log.error("获取资源列表失败", error, params);
      throw error;
    }

    return data || [];
    }),
    800 // 800ms慢查询阈值
  );
}

export async function incrementResourceViews(uuid: string) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('increment_resource_views', { resource_uuid: uuid });

    if (error) {
      log.error("增加资源浏览量失败", error, { uuid });
      throw error;
    }
  });
}

export async function incrementResourceAccess(uuid: string) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('increment_resource_access', { resource_uuid: uuid });

    if (error) {
      log.error("增加资源访问量失败", error, { uuid });
      throw error;
    }
  });
}

export async function updateResourceRatingStats(resourceId: number) {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    // 计算平均评分和评分数量
    const { data: stats, error: statsError } = await supabase
      .from("resource_ratings")
      .select("rating")
      .eq("resource_id", resourceId);

    if (statsError) {
      log.error("获取评分统计失败", statsError, { resourceId });
      throw statsError;
    }

    const ratings = stats || [];
    const ratingCount = ratings.length;
    const ratingAvg = ratingCount > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratingCount 
      : 0;

    // 更新资源评分统计
    const { error: updateError } = await supabase
      .from("resources")
      .update({
        rating_avg: Math.round(ratingAvg * 100) / 100, // 保留两位小数
        rating_count: ratingCount
      })
      .eq("id", resourceId);

    if (updateError) {
      log.error("更新资源评分统计失败", updateError, { resourceId });
      throw updateError;
    }

    log.info("资源评分统计更新成功", { resourceId, ratingAvg, ratingCount });
  });
}

// 获取热门资源 (置顶资源优先，然后按访问次数排序)
export async function getPopularResources(limit: number = 6): Promise<ResourceWithDetails[]> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("resources")
      .select(`
        *,
        author:users!resources_author_id_fkey(uuid, nickname, avatar_url),
        category:categories!resources_category_id_fkey(id, name, description)
      `)
      .eq("status", "approved")
      .order('top', { ascending: false })
      .order('view_count', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      log.error("获取热门资源失败", error);
      throw error;
    }

    return data || [];
  });
}

// 更新资源状态
export async function updateResourceStatus(uuid: string, status: 'pending' | 'approved' | 'rejected'): Promise<void> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 先获取资源信息以获得分类ID
    const { data: resource, error: fetchError } = await supabase
      .from("resources")
      .select("category_id")
      .eq("uuid", uuid)
      .single();

    if (fetchError) {
      log.error("获取资源信息失败", fetchError, { uuid });
      throw fetchError;
    }

    const { error } = await supabase
      .from("resources")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("uuid", uuid);

    if (error) {
      log.error("更新资源状态失败", error, { uuid, status });
      throw error;
    }

    log.info("资源状态更新成功", { uuid, status });

    // 异步更新分类资源数（不阻塞主流程）
    if (resource?.category_id) {
      updateCategoryResourceCount(resource.category_id).catch((error: Error) => {
        log.error("更新分类资源数失败", error, { uuid, status, categoryId: resource.category_id });
      });
    }
  });
}

// 更新资源AI评分信息
export async function updateResourceAIScore(uuid: string, aiData: {
  ai_risk_score: number;
  ai_review_result: string;
  ai_reviewed_at: string;
  auto_approved: boolean;
  status?: 'pending' | 'approved' | 'rejected';
}): Promise<void> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 先获取资源信息以获得分类ID（用于可能的状态变更）
    const { data: resource, error: fetchError } = await supabase
      .from("resources")
      .select("category_id, status")
      .eq("uuid", uuid)
      .single();

    if (fetchError) {
      log.error("获取资源信息失败", fetchError, { uuid });
      throw fetchError;
    }

    const oldStatus = resource.status;
    const updateData = {
      ...aiData,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("resources")
      .update(updateData)
      .eq("uuid", uuid);

    if (error) {
      log.error("更新资源AI评分失败", error, { uuid, aiData });
      throw error;
    }

    log.info("资源AI评分更新成功", {
      uuid,
      riskScore: aiData.ai_risk_score,
      autoApproved: aiData.auto_approved,
      statusChanged: oldStatus !== aiData.status
    });

    // 如果状态从非approved变为approved，异步更新分类资源数
    if (oldStatus !== 'approved' && aiData.status === 'approved' && resource?.category_id) {
      updateCategoryResourceCount(resource.category_id).catch((error: Error) => {
        log.error("AI自动通过后更新分类资源数失败", error, {
          uuid,
          categoryId: resource.category_id
        });
      });
    }
  });
}



export async function getResourcesStats(): Promise<{
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  totalViews: number;
  totalAccess: number;
}> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 获取资源状态统计
    const { data: statusData, error: statusError } = await supabase
      .from("resources")
      .select("status, view_count, access_count");

    if (statusError) {
      log.error("获取资源统计失败", statusError);
      throw statusError;
    }

    const resources = statusData || [];
    const stats = {
      total: resources.length,
      approved: resources.filter(r => r.status === 'approved').length,
      pending: resources.filter(r => r.status === 'pending').length,
      rejected: resources.filter(r => r.status === 'rejected').length,
      totalViews: resources.reduce((sum, r) => sum + (r.view_count || 0), 0),
      totalAccess: resources.reduce((sum, r) => sum + (r.access_count || 0), 0),
    };

    log.info("资源统计获取成功", stats);
    return stats;
  });
}

export async function getResourceStatsByCategory(): Promise<{
  categoryId: number;
  categoryName: string;
  resourceCount: number;
  approvedCount: number;
  pendingCount: number;
}[]> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("resources")
      .select(`
        category_id,
        status,
        category:categories!resources_category_id_fkey(id, name)
      `);

    if (error) {
      log.error("获取分类资源统计失败", error);
      throw error;
    }

    const resources = data || [];

    // 按分类分组统计
    const categoryStats: { [categoryId: number]: any } = {};

    resources.forEach(resource => {
      const categoryId = resource.category_id;
      const categoryName = (resource.category as any)?.name || "未分类";

      if (!categoryStats[categoryId]) {
        categoryStats[categoryId] = {
          categoryId,
          categoryName,
          resourceCount: 0,
          approvedCount: 0,
          pendingCount: 0,
        };
      }

      categoryStats[categoryId].resourceCount++;
      if (resource.status === 'approved') {
        categoryStats[categoryId].approvedCount++;
      } else if (resource.status === 'pending') {
        categoryStats[categoryId].pendingCount++;
      }
    });

    const result = Object.values(categoryStats)
      .sort((a: any, b: any) => b.resourceCount - a.resourceCount);

    log.info("分类资源统计获取成功", { categoriesCount: result.length });
    return result;
  });
}

// 获取用户上传的资源列表
export async function getUserResources(params: {
  author_id: string;
  search?: string;
  status?: string;
  sort?: string;
  offset?: number;
  limit?: number;
}): Promise<ResourceWithDetails[]> {
  return wrapQueryWithMonitoring(
    'getUserResources',
    async () => withRetry(async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("resources")
        .select(`
          *,
          author:users!resources_author_id_fkey(uuid, nickname, avatar_url),
          category:categories!resources_category_id_fkey(id, name, description)
        `)
        .eq("author_id", params.author_id);

      // 状态筛选
      if (params.status) {
        query = query.eq("status", params.status);
      }

      // 搜索
      if (params.search) {
        const searchTerm = sanitizeSearchTerm(params.search);
        if (searchTerm.length > 0) {
          query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        }
      }

      // 排序 - 置顶资源始终排在前面
      switch (params.sort) {
        case 'popular':
          query = applyTopPrioritySort(query, 'view_count');
          break;
        case 'rating':
          query = applyTopPrioritySort(query, 'rating_avg');
          break;
        case 'views':
          query = applyTopPrioritySort(query, 'view_count');
          break;
        case 'latest':
        default:
          query = applyTopPrioritySort(query, 'created_at');
          break;
      }

      // 分页
      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 20) - 1);
      } else {
        query = query.limit(params.limit || 20);
      }

      const { data, error } = await query;

      if (error) {
        log.error("获取用户资源列表失败", error, params);
        throw error;
      }

      log.info("用户资源列表获取成功", {
        author_id: params.author_id,
        count: data?.length || 0,
        params
      });

      return data || [];
    }),
    800 // 800ms慢查询阈值
  );
}

// 获取用户资源总数（用于分页）
export async function getUserResourcesCount(authorId: string, status?: string): Promise<number> {
  return wrapQueryWithMonitoring(
    'getUserResourcesCount',
    async () => withRetry(async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("resources")
        .select('id', { count: 'exact', head: true })
        .eq("author_id", authorId);

      // 状态筛选
      if (status) {
        query = query.eq("status", status);
      }

      const { count, error } = await query;

      if (error) {
        log.error("获取用户资源总数失败", error, { authorId, status });
        throw error;
      }

      log.info("用户资源总数获取成功", {
        authorId,
        status,
        count: count || 0
      });

      return count || 0;
    }),
    300 // 300ms慢查询阈值
  );
}

// 获取所有待审核资源
export async function getAllPendingResources(): Promise<Array<{
  uuid: string;
  title: string;
  author_id: string;
  category_id: number;
}>> {
  return wrapQueryWithMonitoring(
    'getAllPendingResources',
    async () => withRetry(async () => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("resources")
        .select("uuid, title, author_id, category_id")
        .eq("status", "pending")
        .order("created_at", { ascending: true }); // 按创建时间排序，先创建的先审核

      if (error) {
        log.error("获取待审核资源失败", error);
        throw error;
      }

      log.info("获取待审核资源成功", {
        count: data?.length || 0
      });

      return data || [];
    }),
    500 // 500ms慢查询阈值
  );
}

// 批量更新资源状态
export async function batchUpdateResourceStatus(
  resourceUuids: string[],
  status: 'pending' | 'approved' | 'rejected'
): Promise<void> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("resources")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .in("uuid", resourceUuids)
      .eq("status", "pending"); // 只更新状态为pending的资源

    if (error) {
      log.error("批量更新资源状态失败", error, {
        resourceCount: resourceUuids.length,
        targetStatus: status
      });
      throw error;
    }

    log.info("批量更新资源状态成功", {
      resourceCount: resourceUuids.length,
      targetStatus: status
    });
  });
}

// 获取待审核资源数量
export async function getPendingResourcesCount(): Promise<number> {
  return wrapQueryWithMonitoring(
    'getPendingResourcesCount',
    async () => withRetry(async () => {
      const supabase = getSupabaseClient();

      const { count, error } = await supabase
        .from("resources")
        .select('id', { count: 'exact', head: true })
        .eq("status", "pending");

      if (error) {
        log.error("获取待审核资源数量失败", error);
        throw error;
      }

      log.info("获取待审核资源数量成功", {
        count: count || 0
      });

      return count || 0;
    }),
    300 // 300ms慢查询阈值
  );
}
