/**
 * 分类数据缓存管理器
 * 减少重复的数据库查询，提高批量处理性能
 */

import { getAllCategories } from "@/models/category";
import { log } from "@/lib/logger";

interface CategoryCacheData {
  categoryMap: Map<string, number>;
  categoryList: Array<{ id: number; name: string; parent_id?: number }>;
  lastUpdate: number;
}

export class CategoryCache {
  private static cache: CategoryCacheData | null = null;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存时间
  private static readonly CACHE_KEY = 'category_cache';
  private static updating = false; // 防止并发更新

  /**
   * 获取分类映射表（名称 -> ID）
   */
  static async getCategoryMap(): Promise<Map<string, number>> {
    const cacheData = await this.getCacheData();
    return cacheData.categoryMap;
  }

  /**
   * 获取分类列表
   */
  static async getCategoryList(): Promise<Array<{ id: number; name: string; parent_id?: number }>> {
    const cacheData = await this.getCacheData();
    return cacheData.categoryList;
  }

  /**
   * 根据分类名称获取ID
   */
  static async getCategoryId(categoryName: string): Promise<number | undefined> {
    const categoryMap = await this.getCategoryMap();
    return categoryMap.get(categoryName);
  }

  /**
   * 获取缓存数据，如果过期则刷新
   */
  private static async getCacheData(): Promise<CategoryCacheData> {
    const now = Date.now();
    
    // 检查缓存是否有效
    if (this.cache && (now - this.cache.lastUpdate) < this.CACHE_TTL) {
      return this.cache;
    }

    // 如果正在更新，等待更新完成
    if (this.updating) {
      return this.waitForUpdate();
    }

    // 刷新缓存
    return this.refreshCache();
  }

  /**
   * 刷新缓存数据
   */
  private static async refreshCache(): Promise<CategoryCacheData> {
    try {
      this.updating = true;
      
      log.info("开始刷新分类缓存");
      const startTime = Date.now();
      
      // 从数据库获取最新分类数据
      const categories = await getAllCategories();
      
      // 构建分类映射表
      const categoryMap = new Map<string, number>();
      const categoryList: Array<{ id: number; name: string; parent_id?: number }> = [];
      
      for (const category of categories) {
        if (category.id !== undefined) {
          categoryMap.set(category.name, category.id);
          categoryList.push({
            id: category.id,
            name: category.name,
            parent_id: category.parent_id
          });
        }
      }

      // 更新缓存
      this.cache = {
        categoryMap,
        categoryList,
        lastUpdate: Date.now()
      };

      const duration = Date.now() - startTime;
      log.info("分类缓存刷新完成", {
        categoryCount: categories.length,
        duration: `${duration}ms`,
        cacheSize: categoryMap.size
      });

      return this.cache;
      
    } catch (error) {
      log.error("刷新分类缓存失败", error as Error);
      
      // 如果刷新失败且有旧缓存，返回旧缓存
      if (this.cache) {
        log.warn("使用过期的分类缓存数据");
        return this.cache;
      }
      
      // 如果没有缓存，返回空数据
      return {
        categoryMap: new Map(),
        categoryList: [],
        lastUpdate: Date.now()
      };
    } finally {
      this.updating = false;
    }
  }

  /**
   * 等待缓存更新完成
   */
  private static async waitForUpdate(): Promise<CategoryCacheData> {
    const maxWaitTime = 5000; // 最多等待5秒
    const checkInterval = 100; // 每100ms检查一次
    let waitTime = 0;

    while (this.updating && waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
    }

    // 如果等待超时，直接返回当前缓存（可能为空）
    if (this.updating) {
      log.warn("等待分类缓存更新超时");
      return this.cache || {
        categoryMap: new Map(),
        categoryList: [],
        lastUpdate: Date.now()
      };
    }

    return this.cache!;
  }

  /**
   * 手动清除缓存
   */
  static clearCache(): void {
    this.cache = null;
    log.info("分类缓存已清除");
  }

  /**
   * 手动刷新缓存
   */
  static async forceRefresh(): Promise<void> {
    this.cache = null;
    await this.refreshCache();
  }

  /**
   * 获取缓存状态信息
   */
  static getCacheStatus(): {
    cached: boolean;
    lastUpdate: number | null;
    age: number | null;
    size: number;
    expired: boolean;
  } {
    if (!this.cache) {
      return {
        cached: false,
        lastUpdate: null,
        age: null,
        size: 0,
        expired: true
      };
    }

    const now = Date.now();
    const age = now - this.cache.lastUpdate;
    const expired = age > this.CACHE_TTL;

    return {
      cached: true,
      lastUpdate: this.cache.lastUpdate,
      age,
      size: this.cache.categoryMap.size,
      expired
    };
  }

  /**
   * 预热缓存（在应用启动时调用）
   */
  static async warmup(): Promise<void> {
    try {
      log.info("开始预热分类缓存");
      await this.refreshCache();
      log.info("分类缓存预热完成");
    } catch (error) {
      log.error("分类缓存预热失败", error as Error);
    }
  }
}

// 导出单例实例方法
export const categoryCache = CategoryCache;
