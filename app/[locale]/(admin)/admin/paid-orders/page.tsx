"use client";

import { useState, useEffect } from "react";
import { TableColumn } from "@/types/blocks/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";
import Header from "@/components/dashboard/header";
import dynamic from "next/dynamic";

// 动态导入 TableBlock 以避免服务器端渲染问题
const TableBlock = dynamic(() => import("@/components/blocks/table"), {
  ssr: false,
  loading: () => <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
});

interface SQBPaidOrderForAdmin {
  client_sn: string;
  user_email: string;
  user_nickname?: string;
  subject: string;
  total_amount: number;
  amount_yuan: string;
  payway: string;
  payway_display: string;
  status: string;
  status_display: string;
  credits_amount?: number;
  created_at: string;
  finish_time?: string;
  verification_status?: string;
  verification_status_display?: string;
  verification_time?: string;
  verification_error?: string;
}

interface PaginationData {
  orders: SQBPaidOrderForAdmin[];
  total: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export default function AdminPaidOrdersPage() {
  const [orders, setOrders] = useState<SQBPaidOrderForAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");

  // 核验状态
  const [verifying, setVerifying] = useState(false);

  // 获取订单数据
  useEffect(() => {
    fetchOrders();
  }, [currentPage, statusFilter, verificationFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      // 添加支付状态筛选参数
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      // 添加核验状态筛选参数
      if (verificationFilter && verificationFilter !== "all") {
        params.append("verification_status", verificationFilter);
      }

      const response = await fetch(`/api/admin/paid-orders?${params}`);
      const result = await response.json();

      if (result.code === 0) {
        const data: PaginationData = result.data;
        setOrders(data.orders || []);
        setTotalCount(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        console.error('获取支付订单失败:', result.message);
        toast.error('获取支付订单失败: ' + result.message);
      }
    } catch (error) {
      console.error('获取支付订单失败:', error);
      toast.error('获取支付订单失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
    toast.success('数据已刷新');
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
    }
  };

  // 处理支付状态筛选变化
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理核验状态筛选变化
  const handleVerificationFilterChange = (value: string) => {
    setVerificationFilter(value);
    setCurrentPage(1); // 重置到第一页
  };

  // 核验订单函数
  const handleVerifyOrders = async () => {
    try {
      setVerifying(true);
      toast.info("开始核验订单...");

      const response = await fetch('/api/admin/verify-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.code === 0) {
        const data = result.data;
        toast.success(
          `核验完成！共处理 ${data.total_count} 个订单，` +
          `成功 ${data.success_count} 个，` +
          `错误 ${data.error_count} 个，` +
          `失败 ${data.failed_count} 个`
        );

        // 刷新订单列表
        await fetchOrders();
      } else {
        toast.error(`核验失败：${result.message}`);
      }
    } catch (error) {
      console.error('核验订单失败:', error);
      toast.error('核验订单失败，请稍后重试');
    } finally {
      setVerifying(false);
    }
  };

  const columns: TableColumn[] = [
    {
      name: "client_sn",
      title: "订单号"
    },
    {
      name: "user_email",
      title: "用户邮箱"
    },
    {
      name: "subject",
      title: "订单标题"
    },
    {
      name: "amount_yuan",
      title: "金额"
    },
    {
      name: "payway_display",
      title: "支付方式"
    },
    {
      name: "status_display",
      title: "支付状态"
    },
    {
      name: "verification_status_display",
      title: "核验状态",
      callback: (row) => {
        const status = row.verification_status_display || '未核验';
        const colorClass =
          status === '核验正确' ? 'text-green-600' :
          status === '核验错误' ? 'text-red-600' :
          status === '核验失败' ? 'text-orange-600' :
          'text-gray-500';
        return (
          <span className={colorClass}>
            {status}
          </span>
        );
      },
    },
    {
      name: "verification_error",
      title: "核验错误信息",
      callback: (row) => {
        const error = row.verification_error;
        if (!error) {
          return <span className="text-gray-400">-</span>;
        }

        // 如果错误信息太长，显示前50个字符并添加省略号
        const displayError = error.length > 50 ? `${error.substring(0, 50)}...` : error;

        return (
          <span
            className="text-red-600 text-sm cursor-help"
            title={error}
          >
            {displayError}
          </span>
        );
      },
    },
    {
      name: "credits_amount",
      title: "积分数量",
      callback: (row) => row.credits_amount ? `${row.credits_amount}积分` : '-',
    },
    {
      name: "created_at",
      title: "创建时间",
      callback: (row) => moment(row.created_at).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      name: "finish_time",
      title: "完成时间",
      callback: (row) => row.finish_time ? moment(row.finish_time).format("YYYY-MM-DD HH:mm:ss") : '-',
    },
  ];

  const crumb = {
    items: [
      { title: "管理后台", url: "/admin" },
      { title: "支付订单管理", is_active: true }
    ]
  };

  return (
    <>
      <Header crumb={crumb} />
      <div className="w-full px-4 md:px-8 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">支付订单管理</h1>
            <p className="text-muted-foreground">
              管理所有支付成功的订单记录
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* 支付状态筛选器 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">支付状态:</span>
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="选择支付状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="CREATED">待支付</SelectItem>
                  <SelectItem value="SUCCESS">支付成功</SelectItem>
                  <SelectItem value="FAILED">支付失败</SelectItem>
                  <SelectItem value="CANCELLED">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 核验状态筛选器 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">核验状态:</span>
              <Select value={verificationFilter} onValueChange={handleVerificationFilterChange}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="选择核验状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="UNVERIFIED">未核验</SelectItem>
                  <SelectItem value="VERIFIED_CORRECT">核验正确</SelectItem>
                  <SelectItem value="VERIFIED_ERROR">核验错误</SelectItem>
                  <SelectItem value="VERIFICATION_FAILED">核验失败</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 核验按钮 */}
            <Button
              onClick={handleVerifyOrders}
              disabled={verifying}
              variant="default"
              size="sm"
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {verifying ? '核验中...' : '核验订单'}
            </Button>

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

        {/* 订单表格 */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>加载中...</span>
            </div>
          ) : (
            <TableBlock
              columns={columns}
              data={orders}
              empty_message="暂无支付订单数据"
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

              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="px-2 py-2 text-muted-foreground">...</span>
                  <Button
                    variant={currentPage === totalPages ? "default" : "outline"}
                    className="px-3 py-2"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={loading}
                  >
                    {totalPages}
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                className="px-3 py-2"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
              >
                下一页
              </Button>
            </div>
          </div>
        )}

        {/* 分页信息 */}
        {totalCount > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            第 {currentPage} 页，共 {totalPages} 页，总计 {totalCount} 个订单
          </div>
        )}
        </div>
      </div>
    </>
  );
}
