"use client";

import React, { useState, useEffect } from 'react';
import { Tag } from '@/types/resource';
import TagsCloudDanmaku from './tags-cloud-danmaku';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // 不再需要
import { log } from '@/lib/logger';

// 加载骨架屏
function TagsCloudDanmakuSkeleton() {
  return (
    <div className="w-full h-96 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-muted-foreground">正在加载弹幕标签云...</p>
      </div>
    </div>
  );
}

// 错误状态组件
function TagsCloudDanmakuError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="w-full h-96 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-4xl">😵</div>
        <p className="text-muted-foreground">弹幕标签云加载失败</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          重试
        </button>
      </div>
    </div>
  );
}

// 主要的弹幕标签云包装器组件
export default function TagsCloudDanmakuWrapper() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 确保组件在客户端正确挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 获取指定页的标签数据
  const fetchTagsPage = async (page: number, isFirstPage: boolean = false) => {
    try {
      if (isFirstPage) {
        setLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      const limit = 30; // 每页30个标签
      const offset = (page - 1) * limit;

      log.info("开始获取标签数据", {
        endpoint: "/api/tags",
        params: { type: "popular", limit, offset, page }
      });

      const response = await fetch(`/api/tags?type=popular&limit=${limit}&offset=${offset}`);

      if (response.ok) {
        const result = await response.json();
        if (result.code === 0 && result.data?.tags) {
          const newTags = result.data.tags;

          log.info("标签数据获取成功", {
            tagsCount: newTags.length,
            page,
            totalTags: isFirstPage ? newTags.length : tags.length + newTags.length,
            endpoint: "/api/tags"
          });

          if (isFirstPage) {
            setTags(newTags);
          } else {
            setTags(prevTags => [...prevTags, ...newTags]);
          }

          // 如果返回的标签数量少于limit，说明没有更多页了
          setHasMorePages(newTags.length === limit);

          return newTags;
        } else {
          const errorMsg = result.message || "未知错误";
          log.error("标签API返回错误", new Error(errorMsg), {
            endpoint: "/api/tags",
            responseCode: result.code,
            message: result.message,
            page
          });
          if (isFirstPage) {
            setError(errorMsg);
          }
          return [];
        }
      } else {
        const errorMsg = `HTTP ${response.status}`;
        log.error("标签API请求失败", new Error(errorMsg), {
          endpoint: "/api/tags",
          status: response.status,
          statusText: response.statusText,
          page
        });
        if (isFirstPage) {
          setError(errorMsg);
        }
        return [];
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "网络错误";
      log.error("获取标签数据失败", error as Error, {
        endpoint: "/api/tags",
        page
      });
      if (isFirstPage) {
        setError(errorMsg);
      }
      return [];
    } finally {
      if (isFirstPage) {
        setLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };

  // 获取标签数据（分页加载）
  const fetchTags = async () => {
    // 获取第一页数据
    const firstPageTags = await fetchTagsPage(1, true);

    // 如果第一页成功获取到数据，立即请求第二页
    if (firstPageTags.length > 0 && hasMorePages) {
      setTimeout(async () => {
        await fetchTagsPage(2);
        setCurrentPage(2);
      }, 100); // 稍微延迟一下，让第一页先渲染
    }
  };

  // 加载更多标签数据
  const loadMoreTags = async () => {
    if (!hasMorePages || isLoadingMore) return;

    const nextPage = currentPage + 1;
    await fetchTagsPage(nextPage);
    setCurrentPage(nextPage);
  };

  useEffect(() => {
    if (mounted) {
      fetchTags();
    }
  }, [mounted]);

  // 自动加载更多数据（在组件挂载后继续加载第3、4页等）
  useEffect(() => {
    if (mounted && tags.length > 0 && hasMorePages && currentPage >= 2) {
      const timer = setTimeout(() => {
        loadMoreTags();
      }, 2000); // 每2秒加载下一页

      return () => clearTimeout(timer);
    }
  }, [mounted, tags.length, hasMorePages, currentPage]);

  // 在服务端渲染时返回加载状态
  if (!mounted) {
    return <TagsCloudDanmakuSkeleton />;
  }

  return (
    <div className="w-full">

      {loading ? (
        <TagsCloudDanmakuSkeleton />
      ) : error ? (
        <TagsCloudDanmakuError
          onRetry={() => {
            setCurrentPage(1);
            setHasMorePages(true);
            setTags([]);
            fetchTags();
          }}
        />
      ) : tags.length === 0 ? (
        <div className="w-full h-96 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-2xl">🏷️</div>
            <p className="text-muted-foreground">暂无标签数据</p>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <TagsCloudDanmaku
            tags={tags}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
