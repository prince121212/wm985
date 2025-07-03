import { getSupabaseClient, withRetry } from "./db";
import { log } from "@/lib/logger";
import { Category, CategoryWithChildren } from "@/types/resource";

// 获取所有分类（平铺结构）
export async function getAllCategories(includeChildren: boolean = false, includeCount: boolean = false): Promise<Category[]> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    let query = supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    const { data, error } = await query;

    if (error) {
      log.error("获取分类列表失败", error);
      throw error;
    }

    let categories = data || [];

    // 如果需要包含资源数量，批量获取所有分类的资源计数，避免N+1查询
    if (includeCount) {
      try {
        const resourceCounts = await getAllCategoriesResourceCount();
        categories = categories.map(cat => ({
          ...cat,
          resource_count: resourceCounts[cat.id] || 0
        }));
      } catch (countError) {
        log.warn("批量获取分类资源数量失败，使用默认值0", { error: countError });
        categories = categories.map(cat => ({
          ...cat,
          resource_count: 0
        }));
      }
    }

    return categories;
  });
}

// 获取分类树形结构
export async function getCategoriesTree(): Promise<CategoryWithChildren[]> {
  return withRetry(async () => {
    const categories = await getAllCategories();
    return buildCategoryTree(categories);
  });
}

// 构建分类树形结构
export function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  const categoryMap = new Map<number, CategoryWithChildren>();
  const rootCategories: CategoryWithChildren[] = [];

  // 创建分类映射
  categories.forEach(category => {
    categoryMap.set(category.id!, { ...category, children: [] });
  });

  // 构建树形结构
  categories.forEach(category => {
    const categoryNode = categoryMap.get(category.id!)!;
    
    if (category.parent_id) {
      const parent = categoryMap.get(category.parent_id);
      if (parent) {
        parent.children!.push(categoryNode);
      }
    } else {
      rootCategories.push(categoryNode);
    }
  });

  return rootCategories;
}

// 获取单个分类
export async function getCategoryById(id: number): Promise<Category | undefined> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return undefined;
      }
      log.error("获取分类失败", error, { id });
      throw error;
    }

    return data;
  });
}

// 别名函数，用于API兼容性
export const findCategoryById = getCategoryById;

// 根据分类名称查找分类
export async function findCategoryByName(name: string): Promise<Category | undefined> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("name", name.trim())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return undefined;
      }
      log.error("根据名称获取分类失败", error, { name });
      throw error;
    }

    return data;
  });
}

// 根据分类名称查找分类（如果有多个同名分类，返回ID最小的那个）
export async function findCategoryByNameWithMinId(name: string): Promise<Category | undefined> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("name", name.trim())
      .order("id", { ascending: true })
      .limit(1);

    if (error) {
      log.error("根据名称获取分类失败", error, { name });
      throw error;
    }

    return data && data.length > 0 ? data[0] : undefined;
  });
}

// 创建分类
export async function createCategory(category: Omit<Category, 'id' | 'created_at'>): Promise<Category> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .insert(category)
      .select()
      .single();

    if (error) {
      log.error("创建分类失败", error, { category });
      throw error;
    }

    log.info("分类创建成功", { categoryId: data.id, name: category.name });
    return data;
  });
}

// 更新分类
export async function updateCategory(id: number, updates: Partial<Category>): Promise<Category> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      log.error("更新分类失败", error, { id, updates });
      throw error;
    }

    log.info("分类更新成功", { id, updates: Object.keys(updates) });
    return data;
  });
}

// 删除分类
export async function deleteCategory(id: number): Promise<void> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    // 检查是否有子分类
    const { data: children, error: childrenError } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", id);

    if (childrenError) {
      log.error("检查子分类失败", childrenError, { id });
      throw childrenError;
    }

    if (children && children.length > 0) {
      throw new Error("无法删除包含子分类的分类");
    }

    // 检查是否有关联的资源
    const { data: resources, error: resourcesError } = await supabase
      .from("resources")
      .select("id")
      .eq("category_id", id);

    if (resourcesError) {
      log.error("检查关联资源失败", resourcesError, { id });
      throw resourcesError;
    }

    if (resources && resources.length > 0) {
      throw new Error("无法删除包含资源的分类");
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id);

    if (error) {
      log.error("删除分类失败", error, { id });
      throw error;
    }

    log.info("分类删除成功", { id });
  });
}

// 获取分类的资源数量
export async function getCategoryResourceCount(categoryId: number): Promise<number> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from("resources")
      .select("*", { count: 'exact', head: true })
      .eq("category_id", categoryId)
      .eq("status", "approved");

    if (error) {
      log.error("获取分类资源数量失败", error, { categoryId });
      throw error;
    }

    return count || 0;
  });
}

// 批量获取所有分类的资源数量，优化版本：直接从数据库字段读取
// 父分类的资源数包含其所有子分类的资源数总和
export async function getAllCategoriesResourceCount(): Promise<{ [categoryId: number]: number }> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 直接从categories表的resource_count字段读取
    const { data, error } = await supabase
      .from('categories')
      .select('id, resource_count');

    if (error) {
      log.error("获取分类资源数量失败", error);
      throw error;
    }

    // 构建结果映射
    const countMap: { [categoryId: number]: number } = {};
    (data || []).forEach((category) => {
      countMap[category.id] = category.resource_count || 0;
    });

    log.info("批量获取分类资源数量成功（优化版）", {
      categoriesCount: Object.keys(countMap).length,
      totalResourcesCount: Object.values(countMap).reduce((sum, count) => sum + count, 0)
    });

    return countMap;
  });
}



// 计算层级资源数量：父分类包含所有子分类的资源数
function calculateHierarchicalResourceCount(
  categories: { id: number; parent_id?: number }[],
  directCountMap: { [categoryId: number]: number }
): { [categoryId: number]: number } {
  const totalCountMap: { [categoryId: number]: number } = {};

  // 构建子分类映射
  const childrenMap: { [parentId: number]: number[] } = {};
  categories.forEach(category => {
    if (category.parent_id) {
      if (!childrenMap[category.parent_id]) {
        childrenMap[category.parent_id] = [];
      }
      childrenMap[category.parent_id].push(category.id);
    }
  });

  // 递归计算每个分类的总资源数（包含子分类）
  function calculateTotalCount(categoryId: number): number {
    // 如果已经计算过，直接返回
    if (totalCountMap[categoryId] !== undefined) {
      return totalCountMap[categoryId];
    }

    // 获取直接关联的资源数
    let totalCount = directCountMap[categoryId] || 0;

    // 递归计算所有子分类的资源数
    const children = childrenMap[categoryId] || [];
    children.forEach(childId => {
      totalCount += calculateTotalCount(childId);
    });

    // 缓存结果
    totalCountMap[categoryId] = totalCount;
    return totalCount;
  }

  // 为所有分类计算总资源数
  categories.forEach(category => {
    calculateTotalCount(category.id);
  });

  return totalCountMap;
}

// 更新分类资源数（简化版本：使用应用层逻辑）
export async function updateCategoryResourceCount(): Promise<void> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 1. 获取所有分类信息（用于构建层级关系）
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('id, parent_id');

    if (categoriesError) {
      log.error("获取分类信息失败", categoriesError);
      throw categoriesError;
    }

    // 2. 直接查询资源表，按分类ID分组统计数量（只统计直接关联的资源）
    const { data: resourcesData, error: resourcesError } = await supabase
      .from('resources')
      .select('category_id')
      .eq('status', 'approved');

    if (resourcesError) {
      log.error("获取资源数据失败", resourcesError);
      throw resourcesError;
    }

    // 3. 统计每个分类直接关联的资源数量
    const directCountMap: { [categoryId: number]: number } = {};
    (resourcesData || []).forEach((resource) => {
      const categoryId = resource.category_id;
      if (categoryId) {
        directCountMap[categoryId] = (directCountMap[categoryId] || 0) + 1;
      }
    });

    // 4. 计算包含子分类的总资源数
    const totalCountMap = calculateHierarchicalResourceCount(categoriesData || [], directCountMap);

    // 5. 批量更新数据库中的resource_count字段
    for (const [categoryId, count] of Object.entries(totalCountMap)) {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ resource_count: count })
        .eq('id', parseInt(categoryId));

      if (updateError) {
        log.error("更新分类资源数失败", updateError, { categoryId, count });
        throw updateError;
      }
    }

    log.info("分类资源数更新成功", {
      categoriesCount: Object.keys(totalCountMap).length,
      totalResourcesCount: Object.values(totalCountMap).reduce((sum, count) => sum + count, 0)
    });
  });
}

// 获取热门分类（按资源数量排序）
export async function getPopularCategories(limit: number = 10): Promise<Category[]> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select(`
        *,
        resource_count:resources(count)
      `)
      .order("resource_count", { ascending: false })
      .limit(limit);

    if (error) {
      log.error("获取热门分类失败", error);
      throw error;
    }

    return data || [];
  });
}

// 更新分类排序
export async function updateCategoryOrder(categoryOrders: { id: number; sort_order: number }[]): Promise<void> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();
    
    for (const { id, sort_order } of categoryOrders) {
      const { error } = await supabase
        .from("categories")
        .update({ sort_order })
        .eq("id", id);

      if (error) {
        log.error("更新分类排序失败", error, { id, sort_order });
        throw error;
      }
    }

    log.info("分类排序更新成功", { count: categoryOrders.length });
  });
}

// 获取分类路径（面包屑导航用）
export async function getCategoryPath(categoryId: number): Promise<Category[]> {
  return withRetry(async () => {
    const categories = await getAllCategories();
    const categoryMap = new Map<number, Category>();

    categories.forEach(category => {
      categoryMap.set(category.id!, category);
    });

    const path: Category[] = [];
    let currentId: number | undefined = categoryId;

    while (currentId) {
      const category = categoryMap.get(currentId);
      if (!category) break;

      path.unshift(category);
      currentId = category.parent_id;
    }

    return path;
  });
}

// 分页查询分类（管理后台用）
export async function getCategoriesWithPagination(params: {
  page: number;
  pageSize: number;
  search?: string;
  includeResourceCount?: boolean;
  includeParentName?: boolean;
}): Promise<{
  categories: Category[];
  total: number;
}> {
  return withRetry(async () => {
    const supabase = getSupabaseClient();

    // 构建查询
    let query = supabase
      .from("categories")
      .select("*", { count: 'exact' });

    // 搜索功能
    if (params.search && params.search.trim()) {
      const searchTerm = params.search.trim();
      query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    // 排序
    query = query.order("sort_order", { ascending: true })
                 .order("created_at", { ascending: false });

    // 分页
    const offset = (params.page - 1) * params.pageSize;
    query = query.range(offset, offset + params.pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      log.error("分页查询分类失败", error, params);
      throw error;
    }

    let categories = data || [];
    const total = count || 0;

    // 如果需要包含资源数量
    if (params.includeResourceCount && categories.length > 0) {
      try {
        const categoryIds = categories.map(cat => cat.id).filter(Boolean);
        const resourceCounts = await getCategoriesResourceCount(categoryIds);

        categories = categories.map(cat => ({
          ...cat,
          resource_count: resourceCounts[cat.id!] || 0
        }));
      } catch (countError) {
        log.warn("获取分类资源数量失败，使用默认值0", { error: countError });
        categories = categories.map(cat => ({
          ...cat,
          resource_count: 0
        }));
      }
    }

    // 如果需要包含父分类名称
    if (params.includeParentName && categories.length > 0) {
      try {
        const parentIds = categories
          .map(cat => cat.parent_id)
          .filter(Boolean) as number[];

        if (parentIds.length > 0) {
          const { data: parentCategories } = await supabase
            .from("categories")
            .select("id, name")
            .in("id", parentIds);

          const parentMap = new Map<number, string>();
          (parentCategories || []).forEach(parent => {
            parentMap.set(parent.id, parent.name);
          });

          categories = categories.map(cat => ({
            ...cat,
            parent_name: cat.parent_id ? parentMap.get(cat.parent_id) : undefined
          }));
        }
      } catch (parentError) {
        log.warn("获取父分类名称失败", { error: parentError });
      }
    }

    log.info("分页查询分类成功", {
      page: params.page,
      pageSize: params.pageSize,
      total,
      returned: categories.length,
      search: params.search
    });

    return {
      categories,
      total
    };
  });
}

// 获取指定分类的资源数量（批量查询优化版）
// 父分类的资源数包含其所有子分类的资源数总和
export async function getCategoriesResourceCount(categoryIds: number[]): Promise<{ [categoryId: number]: number }> {
  return withRetry(async () => {
    if (categoryIds.length === 0) {
      return {};
    }

    // 获取所有分类的资源数量（使用层级统计）
    const allCategoriesCount = await getAllCategoriesResourceCount();

    // 只返回请求的分类的资源数量
    const result: { [categoryId: number]: number } = {};
    categoryIds.forEach(id => {
      result[id] = allCategoriesCount[id] || 0;
    });

    return result;
  });
}
