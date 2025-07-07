"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Loader2, Trash2, Search, Pin, PinOff } from "lucide-react";
import Header from "@/components/dashboard/header";
import TableBlock from "@/components/blocks/table";
import { TableColumn } from "@/types/blocks/table";
import { ResourceWithDetails } from "@/types/resource";
import moment from "moment";
import { toast } from "sonner";
import PendingResourceActions from "@/components/admin/pending-resource-actions";
import { log } from "@/lib/logger";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminResourcesPage() {
  const router = useRouter();
  const [resources, setResources] = useState<ResourceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending"); // 默认选中待审核
  const [searchQuery, setSearchQuery] = useState<string>(""); // 搜索关键词
  const [refreshing, setRefreshing] = useState(false);
  const [deletingResource, setDeletingResource] = useState<string | null>(null);
  const [togglingTop, setTogglingTop] = useState<string | null>(null); // 正在切换置顶状态的资源

  // 获取资源列表
  const fetchResources = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      } else {
        // 对于管理员，全部状态应该包含所有状态的资源
        params.set("status", "all");
      }
      // 添加搜索参数
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      params.set("limit", "50");
      params.set("offset", "0");
      params.set("sort", "latest");

      const response = await fetch(`/api/admin/resources?${params.toString()}`);
      const data = await response.json();

      if (data.code === 0) {
        setResources(data.data.resources || []);
      } else {
        throw new Error(data.message || '获取资源列表失败');
      }
    } catch (error) {
      console.error('获取资源列表失败:', error);
      toast.error(`获取资源列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchResources();
    setRefreshing(false);
    toast.success("数据已刷新");
  };

  // 删除资源
  const handleDeleteResource = async (resourceUuid: string, resourceTitle: string) => {
    try {
      setDeletingResource(resourceUuid);

      const response = await fetch(`/api/admin/resources/${resourceUuid}/delete`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.code === 0) {
        toast.success(`资源"${resourceTitle}"已删除`);
        // 重新获取资源列表
        await fetchResources();
      } else {
        throw new Error(data.message || '删除失败');
      }
    } catch (error) {
      log.error('删除资源失败', error as Error, {
        component: 'AdminResourcesPage',
        action: 'deleteResource',
        resourceId: resourceUuid,
        resourceTitle
      });
      toast.error(`删除资源失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setDeletingResource(null);
    }
  };

  // 切换置顶状态
  const handleToggleTop = async (resourceUuid: string, resourceTitle: string, currentTopStatus: boolean) => {
    try {
      setTogglingTop(resourceUuid);

      const response = await fetch(`/api/admin/resources/${resourceUuid}/toggle-top`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.code === 0) {
        const actionText = currentTopStatus ? '取消置顶' : '置顶';
        log.audit(`资源${actionText}成功`, {
          component: 'AdminResourcesPage',
          action: 'toggleTop',
          resourceId: resourceUuid,
          resourceTitle,
          newTopStatus: !currentTopStatus
        });
        toast.success(`资源"${resourceTitle}"已${actionText}`);
        // 重新获取资源列表
        await fetchResources();
      } else {
        throw new Error(data.message || '操作失败');
      }
    } catch (error) {
      log.error('切换置顶状态失败', error as Error, {
        component: 'AdminResourcesPage',
        action: 'toggleTop',
        resourceId: resourceUuid,
        resourceTitle,
        currentTopStatus
      });
      toast.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setTogglingTop(null);
    }
  };

  // 状态筛选和搜索变化时重新获取数据
  useEffect(() => {
    fetchResources();
  }, [statusFilter, searchQuery]);

  // 处理搜索输入
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // 清空搜索
  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const crumb = {
    items: [
      { title: "管理后台", url: "/admin" },
      { title: "资源管理", url: "/admin/resources" },
      { title: "资源列表", is_active: true }
    ]
  };

  const columns: TableColumn[] = [
    {
      name: "title",
      title: "资源标题",
      callback: (row) => (
        <div className="max-w-xs">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{row.title}</p>
            {row.top && (
              <Pin className="h-4 w-4 text-orange-500 flex-shrink-0" title="置顶资源" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{row.description}</p>
        </div>
      )
    },
    {
      name: "author",
      title: "作者",
      callback: (row) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={row.author?.avatar_url} />
            <AvatarFallback className="text-xs">
              {row.author?.nickname?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm">{row.author?.nickname || "匿名用户"}</span>
        </div>
      )
    },
    {
      name: "category",
      title: "分类",
      callback: (row) => (
        <Badge variant="outline" className="text-xs">
          {row.category?.name || "未分类"}
        </Badge>
      )
    },

    {
      name: "status",
      title: "状态",
      callback: (row) => {
        const statusConfig = {
          pending: { label: "待审核", variant: "secondary" as const },
          approved: { label: "已通过", variant: "default" as const },
          rejected: { label: "已拒绝", variant: "destructive" as const }
        };
        const config = statusConfig[row.status as keyof typeof statusConfig] || statusConfig.pending;
        return (
          <Badge variant={config.variant} className="text-xs">
            {config.label}
          </Badge>
        );
      }
    },
    {
      name: "is_free",
      title: "积分",
      callback: (row) => (
        <span className="text-sm">
          {row.is_free ? "免费" : `${row.credits || 0} 积分`}
        </span>
      )
    },
    {
      name: "stats",
      title: "统计",
      callback: (row) => (
        <div className="text-xs text-muted-foreground">
          <div>访问: {row.access_count}</div>
          <div>浏览: {row.view_count}</div>
          <div>评分: {row.rating_avg?.toFixed(1)} ({row.rating_count})</div>
        </div>
      )
    },
    {
      name: "created_at",
      title: "创建时间",
      callback: (row) => (
        <span className="text-xs text-muted-foreground">
          {moment(row.created_at).format("YYYY-MM-DD HH:mm")}
        </span>
      )
    },
    {
      name: "actions",
      title: "操作",
      callback: (row) => {
        return (
          <div className="flex items-center gap-2">
            {/* 审核操作 - 只有待审核状态的资源才显示 */}
            {row.status === 'pending' && (
              <PendingResourceActions
                resourceUuid={row.uuid}
                resourceTitle={row.title}
                onActionComplete={fetchResources} // 操作完成后重新获取数据
              />
            )}

            {/* 置顶按钮 - 只有已通过审核的资源才能置顶 */}
            {row.status === 'approved' && (
              <Button
                variant={row.top ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleTop(row.uuid, row.title, row.top || false)}
                disabled={togglingTop === row.uuid}
                title={row.top ? "取消置顶" : "置顶资源"}
              >
                {togglingTop === row.uuid ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : row.top ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* 删除按钮 - 所有状态的资源都可以删除 */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletingResource === row.uuid}
                >
                  {deletingResource === row.uuid ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除资源</AlertDialogTitle>
                  <AlertDialogDescription>
                    您确定要删除资源 <strong>"{row.title}"</strong> 吗？
                    <br />
                    <span className="text-red-600">此操作不可撤销，将永久删除该资源及其所有相关数据（评论、收藏、评分等）。</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteResource(row.uuid, row.title)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    确认删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      }
    },
  ];

  // 获取状态筛选的描述文本
  const getStatusDescription = () => {
    const statusMap = {
      all: "所有资源",
      pending: "待审核资源",
      approved: "已通过资源",
      rejected: "已拒绝资源"
    };
    const statusText = statusMap[statusFilter as keyof typeof statusMap] || "所有资源";
    const searchText = searchQuery.trim() ? `（搜索："${searchQuery.trim()}"）` : "";
    return `共 ${resources.length} 个${statusText}${searchText}`;
  };

  return (
    <>
      <Header crumb={crumb} />
      <div className="w-full px-4 md:px-8 py-8">
        <div className="space-y-6">
          {/* 页面标题和描述 */}
          <div>
            <h1 className="text-2xl font-medium mb-2">资源管理</h1>
            <p className="text-sm text-muted-foreground">
              {getStatusDescription()}
            </p>
          </div>

          {/* 筛选和操作栏 */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* 搜索框 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">搜索:</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索资源标题或描述..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="pl-10 w-64"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      onClick={handleClearSearch}
                    >
                      ×
                    </Button>
                  )}
                </div>
              </div>

              {/* 状态筛选 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">状态筛选:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">待审核</SelectItem>
                    <SelectItem value="approved">已通过</SelectItem>
                    <SelectItem value="rejected">已拒绝</SelectItem>
                    <SelectItem value="all">全部状态</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 刷新按钮 */}
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              刷新
            </Button>
          </div>

          {/* 资源表格 */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>加载中...</span>
              </div>
            ) : (
              <TableBlock
                columns={columns}
                data={resources}
                empty_message="暂无资源"
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
