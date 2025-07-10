"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw, Loader2, Trash2, Search, Pin, PinOff, Info, Upload, RotateCcw } from "lucide-react";
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

// 类型定义
interface BatchLog {
  uuid: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial_completed';
  total_count: number;
  success_count: number;
  failed_count: number;
  created_at: string;
  details?: {
    redis_managed?: boolean;
    total_batches?: number;
    completed_batches?: number;
    [key: string]: any;
  };
  source?: 'redis' | 'database';
  is_active?: boolean;
}



export default function AdminResourcesPage() {
  const [resources, setResources] = useState<ResourceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending"); // 默认选中待审核
  const [searchQuery, setSearchQuery] = useState<string>(""); // 搜索关键词
  const [refreshing, setRefreshing] = useState(false);
  const [deletingResource, setDeletingResource] = useState<string | null>(null);
  const [togglingTop, setTogglingTop] = useState<string | null>(null); // 正在切换置顶状态的资源

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20); // 每页显示数量

  // 批量上传相关状态
  const [batchUploadOpen, setBatchUploadOpen] = useState(false);
  const [batchUploadData, setBatchUploadData] = useState("");
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchLogs, setBatchLogs] = useState<BatchLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  // AI转JSON相关状态
  const [rawText, setRawText] = useState("");
  const [converting, setConverting] = useState(false);

  // 一键过审相关状态
  const [batchApproving, setBatchApproving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // 获取资源列表
  const fetchResources = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

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

      params.set("sort", "latest");

      const response = await fetch(`/api/admin/resources?${params.toString()}`);
      const data = await response.json();

      if (data.code === 0) {
        setResources(data.data.resources || []);
        setTotalCount(data.data.total || 0);
        setTotalPages(data.data.totalPages || 1);
      } else {
        throw new Error(data.message || '获取资源列表失败');
      }
    } catch (error) {
      log.error('获取资源列表失败', error as Error, {
        component: 'AdminResourcesPage',
        action: 'fetchResources',
        statusFilter,
        searchQuery,
        currentPage
      });
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
    await fetchPendingCount(); // 同时刷新待审核数量
    setRefreshing(false);
    toast.success("数据已刷新");
  };

  // 获取待审核资源数量
  const fetchPendingCount = async () => {
    try {
      const response = await fetch('/api/admin/resources?status=pending&pageSize=1');
      const data = await response.json();
      if (data.code === 0) {
        setPendingCount(data.data.total || 0);
      }
    } catch (error) {
      log.error('获取待审核资源数量失败', error as Error, {
        component: 'AdminResourcesPage',
        action: 'fetchPendingCount'
      });
    }
  };

  // 一键过审处理函数
  const handleBatchApprove = async () => {
    try {
      setBatchApproving(true);

      const response = await fetch('/api/admin/resources/batch-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.code === 0) {
        toast.success(result.data.message);
        // 刷新资源列表和待审核数量
        await fetchResources();
        await fetchPendingCount();
      } else {
        throw new Error(result.message || '批量审核失败');
      }

    } catch (error) {
      log.error("批量审核失败", error as Error, {
        component: 'AdminResourcesPage',
        action: 'handleBatchApprove'
      });
      toast.error(`批量审核失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBatchApproving(false);
    }
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
    }
  };

  // 处理状态筛选变化
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理搜索变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // 清空搜索
  const handleClearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1); // 重置到第一页
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

  // 状态筛选、搜索和分页变化时重新获取数据
  useEffect(() => {
    fetchResources();
  }, [statusFilter, searchQuery, currentPage]);

  // 初始化时获取待审核数量
  useEffect(() => {
    fetchPendingCount();
  }, []);



  // AI转JSON处理
  const handleAIConvert = async () => {
    if (!rawText.trim()) {
      toast.error("请输入原始资源文本");
      return;
    }

    try {
      setConverting(true);

      const response = await fetch('/api/admin/batch-upload/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText })
      });

      const result = await response.json();

      if (result.code === 0) {
        const { resources, errors, stats } = result.data;

        // 生成JSON输出
        const jsonOutput = {
          total_resources: resources.length,
          resources: resources
        };

        setBatchUploadData(JSON.stringify(jsonOutput, null, 2));

        // 显示转换结果统计
        let message = `转换完成！成功解析 ${stats.success} 个资源`;
        if (stats.failed > 0) {
          message += `，失败 ${stats.failed} 个`;
        }
        message += `（使用${stats.method === 'regex' ? '正则表达式' : 'AI智能'}解析）`;

        toast.success(message);

        // 如果有错误，显示详细信息
        if (errors.length > 0) {
          log.warn("AI解析部分失败", {
            component: 'AdminResourcesPage',
            action: 'handleAIConvert',
            errors,
            errorCount: errors.length
          });
          toast.warning(`部分内容解析失败，共${errors.length}个错误`);
        }

      } else {
        log.error('AI转换失败', new Error(result.message || 'AI转换失败'), {
          component: 'AdminResourcesPage',
          action: 'handleAIConvert'
        });
        toast.error(result.message || 'AI转换失败');
      }
    } catch (error) {
      log.error("AI转换失败", error as Error, {
        component: 'AdminResourcesPage',
        action: 'handleAIConvert'
      });
      toast.error("AI转换失败，请稍后再试");
    } finally {
      setConverting(false);
    }
  };

  // 本地批量上传处理（极简版）
  const handleLocalBatchUpload = async () => {
    if (!batchUploadData.trim()) {
      toast.error("请输入JSON数据");
      return;
    }

    try {
      setBatchUploading(true);

      // 验证JSON格式
      const jsonData = JSON.parse(batchUploadData);

      if (!jsonData.resources || !Array.isArray(jsonData.resources)) {
        toast.error("JSON格式错误：缺少resources数组");
        return;
      }

      if (jsonData.resources.length === 0) {
        toast.error("资源数组不能为空");
        return;
      }

      toast.info(`开始处理 ${jsonData.resources.length} 个资源，请耐心等待...`);

      // 提交本地批量上传任务
      const response = await fetch('/api/admin/batch-upload/local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      });

      const result = await response.json();

      if (result.code === 0) {
        const { success_count, failed_count, total_count } = result.data;
        toast.success(`批量上传完成！总计：${total_count}个，成功：${success_count}个，失败：${failed_count}个`);
        setBatchUploadData("");
        setRawText(""); // 清空原始文本
        // 刷新批量处理日志
        await fetchBatchLogs();
        // 刷新资源列表
        await fetchResources();
      } else {
        log.error('本地批量上传失败', new Error(result.message || '本地批量上传失败'), {
          component: 'AdminResourcesPage',
          action: 'handleLocalBatchUpload'
        });
        toast.error(result.message || '本地批量上传失败');
      }

    } catch (error) {
      log.error("本地批量上传失败", error as Error, {
        component: 'AdminResourcesPage',
        action: 'handleLocalBatchUpload',
        errorType: error instanceof SyntaxError ? 'JSON_PARSE_ERROR' : 'UNKNOWN_ERROR'
      });
      if (error instanceof SyntaxError) {
        toast.error("JSON格式错误，请检查数据格式");
      } else {
        toast.error("本地批量上传失败，请稍后再试");
      }
    } finally {
      setBatchUploading(false);
    }
  };

  // 原有的批量上传处理（保留作为备用）
  const handleBatchUpload = async () => {
    if (!batchUploadData.trim()) {
      toast.error("请输入JSON数据");
      return;
    }

    try {
      setBatchUploading(true);

      // 验证JSON格式
      const jsonData = JSON.parse(batchUploadData);

      if (!jsonData.resources || !Array.isArray(jsonData.resources)) {
        toast.error("JSON格式错误：缺少resources数组");
        return;
      }

      if (jsonData.resources.length === 0) {
        toast.error("资源数组不能为空");
        return;
      }

      // 提交批量上传任务
      const response = await fetch('/api/admin/batch-upload/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      });

      const result = await response.json();

      if (result.code === 0) {
        toast.success(result.data.message);
        setBatchUploadData("");
        setRawText(""); // 清空原始文本
        // 刷新批量处理日志
        await fetchBatchLogs();
      } else {
        log.error('批量上传提交失败', new Error(result.message || '批量上传提交失败'), {
          component: 'AdminResourcesPage',
          action: 'handleBatchUpload'
        });
        toast.error(result.message || '批量上传提交失败');
      }

    } catch (error) {
      log.error("批量上传失败", error as Error, {
        component: 'AdminResourcesPage',
        action: 'handleBatchUpload',
        errorType: error instanceof SyntaxError ? 'JSON_PARSE_ERROR' : 'UNKNOWN_ERROR'
      });
      if (error instanceof SyntaxError) {
        toast.error("JSON格式错误，请检查数据格式");
      } else {
        toast.error("批量上传失败，请稍后再试");
      }
    } finally {
      setBatchUploading(false);
    }
  };

  // 获取批量处理日志
  const fetchBatchLogs = async (silent = false) => {
    try {
      if (!silent) setLoadingLogs(true);
      const response = await fetch('/api/admin/batch-upload/logs?limit=10');
      const result = await response.json();

      if (result.code === 0) {
        setBatchLogs(result.data.logs || []);
        // 移除自动刷新逻辑，只保留手动刷新
      } else {
        log.error("获取批量日志失败", new Error(result.message || '获取批量日志失败'), {
          component: 'AdminResourcesPage',
          action: 'fetchBatchLogs'
        });
      }
    } catch (error) {
      log.error("获取批量日志失败", error as Error, {
        component: 'AdminResourcesPage',
        action: 'fetchBatchLogs'
      });
    } finally {
      if (!silent) setLoadingLogs(false);
    }
  };

  // 清空批量处理记录
  const clearBatchLogs = async () => {
    try {
      setClearingLogs(true);
      const response = await fetch('/api/admin/batch-upload/logs/clear', {
        method: 'DELETE'
      });
      const result = await response.json();

      if (result.code === 0) {
        setBatchLogs([]);
        toast.success("批量处理记录已清空");
      } else {
        toast.error(result.message || "清空记录失败");
        log.error("清空批量记录失败", new Error(result.message || '清空批量记录失败'), {
          component: 'AdminResourcesPage',
          action: 'clearBatchLogs'
        });
      }
    } catch (error) {
      toast.error("清空记录失败");
      log.error("清空批量记录失败", error as Error, {
        component: 'AdminResourcesPage',
        action: 'clearBatchLogs'
      });
    } finally {
      setClearingLogs(false);
    }
  };

  // 恢复中断的批量上传任务
  const handleRecoverTasks = async () => {
    try {
      setLoadingLogs(true);
      const response = await fetch('/api/admin/batch-upload/recover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });
      const result = await response.json();

      if (result.code === 0) {
        toast.success(result.data.message);
        // 刷新日志列表
        await fetchBatchLogs();
      } else {
        toast.error(result.message || "恢复任务失败");
        log.error("恢复批量任务失败", new Error(result.message || '恢复批量任务失败'), {
          component: 'AdminResourcesPage',
          action: 'handleRecoverTasks'
        });
      }
    } catch (error) {
      toast.error("恢复任务失败");
      log.error("恢复批量任务失败", error as Error, {
        component: 'AdminResourcesPage',
        action: 'handleRecoverTasks'
      });
    } finally {
      setLoadingLogs(false);
    }
  };

  // 打开批量上传弹窗时获取日志
  const handleOpenBatchUpload = () => {
    setBatchUploadOpen(true);
    fetchBatchLogs();
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
              <div title="置顶资源">
                <Pin className="h-4 w-4 text-orange-500 flex-shrink-0" />
              </div>
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
      name: "ai_score",
      title: "AI评分",
      callback: (row) => {
        if (row.ai_risk_score === null || row.ai_risk_score === undefined) {
          return (
            <span className="text-xs text-muted-foreground">未评分</span>
          );
        }

        const score = row.ai_risk_score;
        const getScoreColor = (score: number) => {
          if (score < 60) return "text-green-600";
          if (score < 80) return "text-yellow-600";
          return "text-red-600";
        };

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`font-medium text-sm ${getScoreColor(score)}`}>
                {score}分
              </span>
              {row.auto_approved && (
                <Badge variant="outline" className="text-xs">
                  自动通过
                </Badge>
              )}
              {row.ai_review_result && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="查看AI评分详情"
                  onClick={() => {
                    toast.info("AI评分详情", {
                      description: row.ai_review_result,
                      duration: 8000,
                    });
                  }}
                >
                  <Info className="h-3 w-3" />
                </Button>
              )}
            </div>
            {row.ai_reviewed_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(row.ai_reviewed_at).toLocaleDateString()}
              </span>
            )}
          </div>
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
    return `共 ${totalCount} 个${statusText}${searchText}`;
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
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
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

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              {/* 一键过审按钮 - 只在有待审核资源时显示 */}
              {pendingCount > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={batchApproving}
                    >
                      {batchApproving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          审核中...
                        </>
                      ) : (
                        <>
                          ✓ 一键过审 ({pendingCount})
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认批量审核</AlertDialogTitle>
                      <AlertDialogDescription>
                        您确定要一键审核通过当前所有 <strong>{pendingCount}</strong> 个待审核资源吗？
                        <br />
                        此操作将批量将所有待审核资源状态改为"已通过"，操作不可撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBatchApprove}>
                        确认审核通过
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* 批量上传按钮 */}
              <Dialog open={batchUploadOpen} onOpenChange={setBatchUploadOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={handleOpenBatchUpload}
                    variant="default"
                    size="sm"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    批量上传
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>批量上传资源</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* 新增：文本输入区域 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">原始资源文本</label>
                        <Button
                          onClick={handleAIConvert}
                          disabled={converting || !rawText.trim()}
                          size="sm"
                          variant="outline"
                        >
                          {converting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              AI转换中...
                            </>
                          ) : (
                            <>
                              🤖 AI转JSON
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        粘贴资源列表文本，支持多种格式：标题+链接、标题 链接：URL等，点击AI转JSON自动转换为标准格式
                      </p>
                      <Textarea
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder={`空腹力 健康 养生 科学空腹，远离疾病，高效抗老
链接：https://pan.quark.cn/s/81b357be6db5

炳祥《问真八字》中级班
https://pan.quark.cn/s/d0f0992c010d

宇宙之思-了解更多宇宙知识  https://pan.quark.cn/s/324db89cc9df`}
                        rows={8}
                        className="text-sm"
                      />
                    </div>

                    {/* 分隔线 */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">或直接输入JSON</span>
                      </div>
                    </div>

                    {/* JSON数据输入 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">JSON数据</label>
                      <p className="text-xs text-muted-foreground">
                        标准JSON格式：{`{"total_resources": 2, "resources": [{"name": "资源名称", "link": "资源链接"}]}`}
                      </p>
                      <Textarea
                        value={batchUploadData}
                        onChange={(e) => setBatchUploadData(e.target.value)}
                        placeholder={`{
  "total_resources": 2,
  "resources": [
    {
      "name": "资源名称1",
      "link": "https://example.com/resource1"
    },
    {
      "name": "资源名称2",
      "link": "https://example.com/resource2"
    }
  ]
}`}
                        rows={12}
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* 提交按钮 */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleLocalBatchUpload}
                        disabled={batchUploading || !batchUploadData.trim()}
                        className="flex-1"
                      >
                        {batchUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            处理中...
                          </>
                        ) : (
                          "本地批量上传"
                        )}
                      </Button>
                      <Button
                        onClick={handleBatchUpload}
                        disabled={batchUploading || !batchUploadData.trim()}
                        variant="outline"
                        className="flex-1"
                      >
                        {batchUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            提交中...
                          </>
                        ) : (
                          "Redis批量上传"
                        )}
                      </Button>
                    </div>

                    {/* 批量处理日志 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">批量处理记录</h3>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => fetchBatchLogs()}
                            disabled={loadingLogs}
                            variant="outline"
                            size="sm"
                          >
                            {loadingLogs ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            onClick={handleRecoverTasks}
                            disabled={loadingLogs}
                            variant="outline"
                            size="sm"
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={clearBatchLogs}
                            disabled={loadingLogs || clearingLogs}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {clearingLogs ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto border rounded-md p-3">
                        {loadingLogs ? (
                          <div className="text-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            <p className="text-sm text-muted-foreground mt-2">加载中...</p>
                          </div>
                        ) : batchLogs.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            暂无批量处理记录
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {batchLogs.map((log) => (
                              <div key={log.uuid} className="border rounded p-2 text-sm">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{log.title}</span>
                                    {log.is_active && (
                                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                                        实时
                                      </span>
                                    )}
                                  </div>
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    log.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    log.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                    log.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    log.status === 'partial_completed' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {log.status === 'completed' ? '已完成' :
                                     log.status === 'processing' ? '处理中' :
                                     log.status === 'failed' ? '失败' :
                                     log.status === 'partial_completed' ? '部分完成' : '待处理'}
                                  </span>
                                </div>

                                {/* 进度条（仅对Redis管理的任务显示） */}
                                {log.details?.redis_managed && log.details?.total_batches && (
                                  <div className="mb-2">
                                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                      <span>批次进度</span>
                                      <span>{log.details.completed_batches || 0}/{log.details.total_batches}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                      <div
                                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                        style={{
                                          width: `${Math.round(((log.details.completed_batches || 0) / log.details.total_batches) * 100)}%`
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                )}

                                <div className="text-muted-foreground">
                                  总数: {log.total_count} | 成功: {log.success_count} | 失败: {log.failed_count}
                                  {log.details?.redis_managed && (
                                    <span className="ml-2 text-xs">
                                      (批次: {log.details.total_batches})
                                    </span>
                                  )}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {new Date(log.created_at).toLocaleString()}
                                  {log.source === 'redis' && (
                                    <span className="ml-2 text-blue-600">• 实时数据</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

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

          {/* 分页组件 */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  className="px-3 py-2"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  上一页
                </Button>

                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      className="px-3 py-2"
                      onClick={() => handlePageChange(page)}
                      disabled={loading}
                    >
                      {page}
                    </Button>
                  );
                })}

                <Button
                  variant="outline"
                  className="px-3 py-2"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}

          {/* 分页信息 */}
          {totalCount > 0 && (
            <div className="text-center text-sm text-muted-foreground">
              第 {currentPage} 页，共 {totalPages} 页，总计 {totalCount} 个资源
            </div>
          )}
        </div>
      </div>
    </>
  );
}
