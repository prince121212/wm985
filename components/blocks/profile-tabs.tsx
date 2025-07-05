"use client";

import { useState, useRef, useEffect } from "react";
import { getTransactionTypeText, isResourceAccessTransaction } from "@/constants/transactionTypes";
import { truncateResourceTitle, getResourceLinkTitle } from "@/utils/creditUtils";
import { useTranslations } from "next-intl";
import Link from "next/link";
import QRCode from 'qrcode';
import { toast } from 'sonner';
import {
  SQB_ORDER_STATUS,
  isFinalOrderStatus,
  isSuccessOrderStatus,
  isFailedOrderStatus,
  getOrderStatusMessage
} from '@/lib/sqb-constants';
import {
  PaymentMethod,
  type PaymentSuccessData,
  type PaymentResult,
  type DEFAULT_POLLING_CONFIG
} from '@/types/payment';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  User,
  Upload,
  Heart,
  ShoppingCart,
  Coins,
  Users,
  Key,
  Plus,
  Copy,
  Trash2,
  CheckCircle,
  Edit,
  BarChart3,
  Info,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

// 类型定义
interface StatsType {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  totalViews: number;
}

// 辅助函数
const getStatusText = (status: string) => {
  switch (status) {
    case 'approved': return '已通过';
    case 'pending': return '待审核';
    case 'rejected': return '已拒绝';
    default: return '未知';
  }
};

// Tab配置
const tabs = [
  { id: 'profile', label: '个人资料', icon: User },
  { id: 'uploads', label: '我的上传', icon: Upload },
  { id: 'favorites', label: '我的收藏', icon: Heart },
  { id: 'orders', label: '我的订单', icon: ShoppingCart },
  { id: 'credits', label: '我的积分', icon: Coins },
  { id: 'invites', label: '我的邀请', icon: Users },
  // { id: 'apikeys', label: 'API密钥', icon: Key }, // 暂时注释掉API密钥功能
];

interface ProfileTabsProps {
  user?: {
    uuid: string;
    nickname?: string;
    email?: string;
    avatar_url?: string;
  };
}

export default function ProfileTabs({ user }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState('profile');
  const t = useTranslations();

  return (
    <div className="container mx-auto px-4 py-4 lg:py-8 pb-20 lg:pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Tab导航 - 参考原型图设计，移动端优化 */}
        <div className="border-b border-border mb-8">
          <nav className="flex space-x-1 sm:space-x-2 lg:space-x-8 overflow-x-auto scrollbar-hide pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={cn(
                    "flex items-center space-x-1 lg:space-x-2 py-3 lg:py-4 px-2 sm:px-3 lg:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors touch-target flex-shrink-0",
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="h-3 w-3 lg:h-4 lg:w-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab内容 */}
        <div className="min-h-[400px]">
          {activeTab === 'profile' && <ProfileInfo user={user} />}
          {activeTab === 'uploads' && <MyUploads />}
          {activeTab === 'favorites' && <MyFavorites />}
          {activeTab === 'orders' && <MyOrders />}
          {activeTab === 'credits' && <MyCredits />}
          {activeTab === 'invites' && <MyInvites user={user} />}
          {/* {activeTab === 'apikeys' && <MyApiKeys />} */}
        </div>
      </div>
    </div>
  );
}

// 个人资料组件
function ProfileInfo({ user }: { user?: any }) {
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("请选择图片文件（JPG、PNG、GIF）");
      return;
    }

    // 验证文件大小 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("文件大小不能超过2MB");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.code === 0) {
        const newAvatarUrl = result.data.url;
        setAvatarUrl(newAvatarUrl);

        // 立即更新用户头像到数据库
        try {
          const updateResponse = await fetch('/api/update-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              avatar_url: newAvatarUrl,
            }),
          });

          const updateResult = await updateResponse.json();

          if (updateResponse.ok) {
            toast.success("头像上传成功");
          } else {
            toast.error(updateResult.message || "保存头像失败");
          }
        } catch (updateError) {
          console.error('Avatar URL update error:', updateError);
          toast.error("保存头像失败");
        }
      } else {
        const errorMessage = result.message || "头像上传失败";
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error("头像上传失败");
    } finally {
      setIsUploading(false);
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!nickname.trim()) {
      toast.error("用户名不能为空");
      return;
    }

    if (nickname.trim().length > 50) {
      toast.error("用户名不能超过50个字符");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          avatar_url: avatarUrl,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("个人资料保存成功");
        // 刷新页面以更新用户信息
        window.location.reload();
      } else {
        toast.error(result.message || "保存失败");
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error("保存失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">个人资料</h3>
        <p className="text-sm text-muted-foreground">管理您的个人信息和偏好设置</p>
      </div>

      <div className="border-t pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 头像部分 */}
          <div className="space-y-2">
            <Label>头像</Label>
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16 lg:h-20 lg:w-20">
                <AvatarImage src={avatarUrl || "https://pub-7d345f4cf2334fce864509d66ec976f3.r2.dev/avatars/momo.jpg"} />
                <AvatarFallback>{nickname?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? "上传中..." : "上传头像"}
                </Button>
              </div>
            </div>
          </div>

          {/* 用户名 */}
          <div className="space-y-2">
            <Label htmlFor="nickname">用户名</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="请输入用户名"
              maxLength={50}
            />
          </div>

          {/* 邮箱 */}
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              defaultValue={user?.email || ""}
              placeholder="请输入邮箱"
              disabled
            />
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "保存中..." : "保存"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// 我的上传组件
function MyUploads() {
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsType | null>(null);
  const [refreshingTotalAccess, setRefreshingTotalAccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10; // 每页显示10个资源

  useEffect(() => {
    fetchMyUploads();
  }, [currentPage]);

  const fetchMyUploads = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * pageSize;
      const response = await fetch(`/api/my-uploads?limit=${pageSize}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        if (data.code === 0) {
          setUploads(data.data.resources || []);
          setStats(data.data.stats || {});
          // 计算总页数
          const total = data.data.stats?.total || 0;
          setTotalPages(Math.ceil(total / pageSize));
        }
      }
    } catch (error) {
      console.error("获取我的上传失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshTotalAccess = async () => {
    try {
      setRefreshingTotalAccess(true);
      const response = await fetch('/api/users/refresh-total-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.code === 0) {
          // 更新stats中的totalViews
          setStats((prev: StatsType | null) => {
            if (!prev) return prev;
            return {
              ...prev,
              totalViews: data.data.total_access_count
            };
          });
          toast.success("总访问数已刷新");
        } else {
          throw new Error(data.message || '刷新失败');
        }
      } else {
        throw new Error('刷新失败');
      }
    } catch (error) {
      console.error("刷新总访问数失败:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("刷新总访问数失败，请稍后再试");
      }
    } finally {
      setRefreshingTotalAccess(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">我的上传</h3>
          <p className="text-sm text-muted-foreground">管理您上传的资源</p>
        </div>
        <div className="border-t pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">我的上传</h3>
        <p className="text-sm text-muted-foreground">管理您上传的资源</p>
      </div>
      <div className="border-t pt-6">
        {/* 统计概览 */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{stats.total || 0}</div>
                <div className="text-sm text-muted-foreground">总资源</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.approved || 0}</div>
                <div className="text-sm text-muted-foreground">已通过</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
                <div className="text-sm text-muted-foreground">待审核</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalViews || 0}</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRefreshTotalAccess}
                    disabled={refreshingTotalAccess}
                    className="h-6 w-6 p-0"
                    title="刷新总访问数"
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshingTotalAccess ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">总访问</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 资源列表 */}
        {uploads.length === 0 ? (
          <EmptyState
            icon={Upload}
            title="还没有上传任何资源"
            description="开始分享您的知识和资源吧"
            actionText="上传资源"
            actionHref="/upload"
          />
        ) : (
          <div className="space-y-4">
            {uploads.map((resource) => (
              <Card key={resource.uuid}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{resource.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {resource.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>状态: {getStatusText(resource.status)}</span>
                        <span>访问: {resource.access_count || 0}</span>
                        <span>{new Date(resource.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* 拒绝原因 */}
                      {resource.status === 'rejected' && resource.rejection_reason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-xs font-medium text-red-800 mb-1">拒绝原因</div>
                              <div className="text-xs text-red-700">{resource.rejection_reason}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/resources/${resource.uuid}`}>查看</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  上一页
                </Button>
                <span className="text-sm text-muted-foreground">
                  第 {currentPage} 页，共 {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 我的收藏组件
function MyFavorites() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyFavorites();
  }, []);

  const fetchMyFavorites = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/my-favorites');
      if (response.ok) {
        const data = await response.json();
        if (data.code === 0) {
          setFavorites(data.data.favorites || []);
        }
      }
    } catch (error) {
      console.error("获取我的收藏失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (favoriteId: number) => {
    try {
      const response = await fetch(`/api/favorites/${favoriteId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setFavorites(prev => prev.filter(f => f.id !== favoriteId));
        toast.success("已取消收藏");
      } else {
        const result = await response.json();
        throw new Error(result.message || '取消收藏失败');
      }
    } catch (error) {
      console.error("取消收藏失败:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("取消收藏失败，请稍后再试");
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">我的收藏</h3>
          <p className="text-sm text-muted-foreground">管理您收藏的资源</p>
        </div>
        <div className="border-t pt-6">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">我的收藏</h3>
        <p className="text-sm text-muted-foreground">管理您收藏的资源</p>
      </div>
      <div className="border-t pt-6">
        {favorites.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="还没有收藏任何资源"
            description="去发现一些有趣的资源吧"
            actionText="浏览资源"
            actionHref="/resources"
          />
        ) : (
          <div className="space-y-4">
            {favorites.slice(0, 5).map((favorite) => (
              <Card key={favorite.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{favorite.resource?.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {favorite.resource?.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>分类: {favorite.resource?.category?.name || '未分类'}</span>
                        <span>访问: {favorite.resource?.access_count || 0}</span>
                        <span>收藏于: {new Date(favorite.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 ml-4">
                      <Button variant="outline" size="sm" asChild className="px-3">
                        <Link href={`/resources/${favorite.resource?.uuid}`}>查看</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveFavorite(favorite.id)}
                        className="w-8 h-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Heart className="h-4 w-4 fill-current" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {favorites.length > 5 && (
              <div className="text-center">
                <Button variant="outline" asChild>
                  <Link href="/my-favorites">查看全部 ({favorites.length})</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// 我的订单组件
function MyOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    has_more: false
  });

  // 获取订单列表
  const fetchOrders = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/my-orders?page=${page}&limit=${pagination.limit}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '获取订单列表失败');
      }

      setOrders(result.data.orders || []);
      setPagination({
        page: result.data.page,
        limit: result.data.limit,
        total: result.data.total,
        has_more: result.data.has_more
      });
    } catch (error) {
      console.error('获取订单列表失败:', error);
      setError(error instanceof Error ? error.message : '获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchOrders();
  }, []);

  // 加载状态
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">我的订单</h3>
          <p className="text-sm text-muted-foreground">查看您的订单历史</p>
        </div>
        <div className="border-t pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">我的订单</h3>
          <p className="text-sm text-muted-foreground">查看您的订单历史</p>
        </div>
        <div className="border-t pt-6">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => fetchOrders()} variant="outline">
              重试
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 空状态
  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">我的订单</h3>
          <p className="text-sm text-muted-foreground">查看您的订单历史</p>
        </div>
        <div className="border-t pt-6">
          <EmptyState
            icon={ShoppingCart}
            title="暂无订单记录"
            description="您还没有任何订单"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">我的订单</h3>
        <p className="text-sm text-muted-foreground">查看您的订单历史（共 {pagination.total} 条）</p>
      </div>
      <div className="border-t pt-6">
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">订单号: {order.client_sn}</span>
                  <Badge variant={
                    order.status === 'PAID' || order.status === 'SUCCESS' ? 'default' :
                    order.status === 'CANCELLED' || order.status === 'FAILED' ? 'destructive' :
                    'secondary'
                  }>
                    {order.status_text}
                  </Badge>
                </div>
                <span className="text-lg font-semibold">¥{order.amount_yuan}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">商品:</span> {order.subject}
                </div>
                <div>
                  <span className="font-medium">支付方式:</span> {order.payway_display}
                </div>
                <div>
                  <span className="font-medium">积分:</span> {order.credits_amount} 积分
                  {order.credits_processed && <span className="text-green-600 ml-1">✓</span>}
                </div>
                <div>
                  <span className="font-medium">创建时间:</span> {new Date(order.created_at).toLocaleString()}
                </div>
              </div>

              {order.finish_time && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">完成时间:</span> {new Date(order.finish_time).toLocaleString()}
                </div>
              )}

              {order.trade_no && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">交易号:</span> {order.trade_no}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 分页控制 */}
        {pagination.total > pagination.limit && (
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              显示 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchOrders(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchOrders(pagination.page + 1)}
                disabled={!pagination.has_more}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 我的积分组件
function MyCredits() {
  const [credits, setCredits] = useState<any>(null);
  const [creditHistory, setCreditHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchCreditsData();
  }, []);

  const fetchCreditsData = async (page = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // 获取积分余额
      const creditsResponse = await fetch('/api/get-user-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // 获取积分记录
      const historyResponse = await fetch(`/api/my-credits?page=${page}&limit=20`);

      if (creditsResponse.ok) {
        const creditsData = await creditsResponse.json();
        if (creditsData.code === 0) {
          setCredits(creditsData.data);
        }
      }

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        if (historyData.code === 0) {
          const newCredits = historyData.data.credits || [];
          if (append) {
            setCreditHistory(prev => [...prev, ...newCredits]);
          } else {
            setCreditHistory(newCredits);
          }

          // 使用API返回的hasMore字段
          setHasMore(historyData.data.hasMore || false);
        }
      }
    } catch (error) {
      console.error('获取积分数据失败:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;

    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await fetchCreditsData(nextPage, true);
  };

  const handleShowAll = () => {
    setShowAll(!showAll);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">我的积分</h3>
          <p className="text-sm text-muted-foreground">查看您的积分余额和历史</p>
        </div>
        <div className="border-t pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-6 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="text-center animate-pulse">
                <CardContent className="p-3 lg:p-6">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">我的积分</h3>
          <p className="text-sm text-muted-foreground">查看您的积分余额和历史</p>
        </div>
        <RechargeDialog onSuccess={() => fetchCreditsData()} />
      </div>
      <div className="border-t pt-6">
        {/* 积分概览 - 移动端优化 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-6 mb-6">
          <Card className="text-center">
            <CardContent className="p-3 lg:p-6">
              <div className="text-xl lg:text-3xl font-bold text-primary mb-1 lg:mb-2">
                {credits?.left_credits || 0}
              </div>
              <div className="text-xs lg:text-sm text-muted-foreground">当前积分</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 lg:p-6">
              <div className="text-xl lg:text-3xl font-bold text-green-600 mb-1 lg:mb-2">0</div>
              <div className="text-xs lg:text-sm text-muted-foreground">本月获得</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3 lg:p-6">
              <div className="text-xl lg:text-3xl font-bold text-orange-600 mb-1 lg:mb-2">0</div>
              <div className="text-xs lg:text-sm text-muted-foreground">本月消费</div>
            </CardContent>
          </Card>
        </div>

        {/* 积分记录 */}
        <Card>
          <CardHeader>
            <CardTitle>最近积分记录</CardTitle>
          </CardHeader>
          <CardContent>
            {creditHistory.length > 0 ? (
              <div className="space-y-3">
                {(showAll ? creditHistory : creditHistory.slice(0, 5)).map((record, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex-1">
                      <div className="font-medium">
                        {getTransactionTypeText(record.trans_type)}
                        {record.trans_type === 'resource_access' && (
                          <>
                            --
                            {record.resource ? (
                              <a
                                href={record.resource.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                                title={getResourceLinkTitle(record.resource)}
                              >
                                {truncateResourceTitle(record.resource.title)}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">资源已被清理</span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {new Date(record.created_at).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className={`font-bold ${record.credits > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {record.credits > 0 ? '+' : ''}{record.credits}
                    </div>
                  </div>
                ))}

                {/* 显示更多按钮逻辑 */}
                {!showAll && creditHistory.length > 5 && (
                  <div className="text-center pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShowAll}
                    >
                      查看更多记录
                    </Button>
                  </div>
                )}

                {/* 加载更多按钮 */}
                {showAll && hasMore && (
                  <div className="text-center pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? '加载中...' : '加载更多'}
                    </Button>
                  </div>
                )}

                {/* 收起按钮 */}
                {showAll && (
                  <div className="text-center pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShowAll}
                    >
                      收起记录
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>暂无积分记录</p>
                <p className="text-sm mt-2">完成任务或充值后将显示积分变动记录</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



// 我的邀请组件
function MyInvites({ user }: { user?: any }) {
  const [inviteData, setInviteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingInviteCode, setEditingInviteCode] = useState(false);
  const [newInviteCode, setNewInviteCode] = useState('');

  useEffect(() => {
    fetchInviteData();
  }, []);

  const fetchInviteData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/my-invites');
      if (response.ok) {
        const data = await response.json();
        if (data.code === 0) {
          setInviteData(data.data);
          setNewInviteCode(data.data.user.invite_code || '');
        }
      }
    } catch (error) {
      console.error("获取邀请信息失败:", error);
      toast.error("获取邀请信息失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInviteCode = async () => {
    try {
      const response = await fetch('/api/update-invite-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invite_code: newInviteCode.trim()
        }),
      });

      const result = await response.json();
      if (result.code === 0) {
        await fetchInviteData();
        setEditingInviteCode(false);
        toast.success("邀请码更新成功");
      } else {
        throw new Error(result.message || '更新失败');
      }
    } catch (error) {
      console.error("更新邀请码失败:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("更新邀请码失败，请稍后再试");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("已复制到剪贴板");
    }).catch(() => {
      toast.error("复制失败");
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">我的邀请</h3>
          <p className="text-sm text-muted-foreground">邀请好友获得奖励</p>
        </div>
        <div className="border-t pt-6">
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">我的邀请</h3>
        <p className="text-sm text-muted-foreground">邀请好友获得奖励</p>
      </div>
      <div className="border-t pt-6 space-y-6">
        {/* 邀请码管理 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              我的邀请码
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">邀请码</label>
              <div className="flex items-center gap-2 mt-1">
                {editingInviteCode ? (
                  <>
                    <Input
                      value={newInviteCode}
                      onChange={(e) => setNewInviteCode(e.target.value)}
                      placeholder="输入邀请码（2-16位字母数字）"
                      className="flex-1"
                    />
                    <Button size="sm" onClick={handleUpdateInviteCode}>
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingInviteCode(false);
                        setNewInviteCode(inviteData?.user?.invite_code || '');
                      }}
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <Input
                      value={inviteData?.user?.invite_code || '未设置'}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingInviteCode(true)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {inviteData?.inviteLink && (
              <div>
                <label className="text-sm font-medium">邀请链接</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={inviteData.inviteLink}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(inviteData.inviteLink)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 邀请统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              邀请统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {inviteData?.stats?.totalInvites || 0}
                </div>
                <div className="text-sm text-muted-foreground">总邀请数</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {inviteData?.stats?.successfulInvites || 0}
                </div>
                <div className="text-sm text-muted-foreground">成功邀请</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {inviteData?.stats?.totalRewards || 0}
                </div>
                <div className="text-sm text-muted-foreground">累计奖励</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 邀请说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              邀请说明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 设置您的专属邀请码，分享给好友注册</p>
            <p>• 好友通过您的邀请链接注册成功后，您将获得奖励</p>
            <p>• 邀请码只能包含字母和数字，长度为2-16位</p>
            <p>• 邀请码设置后可以修改，但建议保持稳定</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// API密钥组件
function MyApiKeys() {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyTitle, setNewKeyTitle] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/my-api-keys');
      if (response.ok) {
        const data = await response.json();
        if (data.code === 0) {
          setApiKeys(data.data.apiKeys || []);
        }
      }
    } catch (error) {
      console.error("获取API密钥失败:", error);
      toast.error("获取API密钥失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyTitle.trim()) {
      toast.error("请输入API密钥名称");
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/create-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newKeyTitle.trim()
        }),
      });

      const result = await response.json();
      if (result.code === 0) {
        setNewApiKey(result.data.apiKey.api_key);
        setNewKeyTitle('');
        setShowCreateForm(false);
        await fetchApiKeys();
        toast.success("API密钥创建成功");
      } else {
        throw new Error(result.message || '创建失败');
      }
    } catch (error) {
      console.error("创建API密钥失败:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("创建API密钥失败，请稍后再试");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteApiKey = async (apiKeyId: number, title: string) => {
    if (!confirm(`确定要删除API密钥"${title}"吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await fetch('/api/delete-api-key', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key_id: apiKeyId
        }),
      });

      const result = await response.json();
      if (result.code === 0) {
        await fetchApiKeys();
        toast.success("API密钥删除成功");
      } else {
        throw new Error(result.message || '删除失败');
      }
    } catch (error) {
      console.error("删除API密钥失败:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("删除API密钥失败，请稍后再试");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("已复制到剪贴板");
    }).catch(() => {
      toast.error("复制失败");
    });
  };

  const formatApiKey = (key: string) => {
    return key.slice(0, 8) + "..." + key.slice(-8);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">API密钥</h3>
          <p className="text-sm text-muted-foreground">管理您的API访问密钥</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          创建密钥
        </Button>
      </div>

      <div className="border-t pt-6">
        {/* 新创建的API密钥显示 */}
        {newApiKey && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium text-green-800">API密钥创建成功</h4>
              </div>
              <p className="text-sm text-green-700 mb-3">
                请立即复制并保存您的API密钥，出于安全考虑，我们不会再次显示完整密钥。
              </p>
              <div className="flex items-center gap-2 p-3 bg-white rounded border">
                <code className="flex-1 text-sm font-mono break-all">{newApiKey}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(newApiKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setNewApiKey(null)}
                className="mt-2"
              >
                我已保存，关闭提示
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 创建表单 */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <h4 className="font-medium mb-3">创建新的API密钥</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">密钥名称</label>
                  <Input
                    value={newKeyTitle}
                    onChange={(e) => setNewKeyTitle(e.target.value)}
                    placeholder="输入API密钥名称"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateApiKey}
                    disabled={creating || !newKeyTitle.trim()}
                    size="sm"
                  >
                    {creating ? '创建中...' : '创建'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewKeyTitle('');
                    }}
                    size="sm"
                  >
                    取消
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* API密钥列表 */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
          </div>
        ) : apiKeys.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="text-lg font-medium mb-2">暂无API密钥</h4>
              <p className="text-sm text-muted-foreground">
                创建API密钥以便在第三方应用中使用我们的服务
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <Card key={apiKey.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{apiKey.title}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>密钥: {formatApiKey(apiKey.api_key)}</span>
                        <span>创建于: {new Date(apiKey.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(formatApiKey(apiKey.api_key))}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteApiKey(apiKey.id, apiKey.title)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 空状态组件
interface EmptyStateProps {
  icon: any;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onActionClick?: () => void;
}

function EmptyState({ icon: Icon, title, description, actionText, actionHref, onActionClick }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <Icon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      {actionText && (
        onActionClick ? (
          <Button onClick={onActionClick}>
            {actionText}
          </Button>
        ) : (
          <Button asChild>
            <Link href={actionHref || '#'}>{actionText}</Link>
          </Button>
        )
      )}
    </div>
  );
}

// 充值弹窗组件
function RechargeDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'qrcode' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.WECHAT); // 微信支付
  const [orderData, setOrderData] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [statusChecking, setStatusChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(240); // 4分钟倒计时
  const [successData, setSuccessData] = useState<PaymentSuccessData | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false); // 防止重复处理

  const presetAmounts = [1, 5, 10, 20, 50, 100];

  // 用于存储定时器引用，确保组件卸载时能够清理
  const timersRef = useRef<{
    statusCheckTimer?: NodeJS.Timeout;
    countdownTimer?: NodeJS.Timeout;
    countdownCleanupTimer?: NodeJS.Timeout;
    successDelayTimer?: NodeJS.Timeout;
    closeDelayTimer?: NodeJS.Timeout;
  }>({});

  // 存储状态检查清理函数
  const statusCheckCleanupRef = useRef<(() => void) | null>(null);

  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      // 清理状态检查
      if (statusCheckCleanupRef.current) {
        statusCheckCleanupRef.current();
        statusCheckCleanupRef.current = null;
      }
      // 清理所有定时器
      Object.values(timersRef.current).forEach(timer => {
        if (timer) {
          clearTimeout(timer);
          clearInterval(timer);
        }
      });
      timersRef.current = {};
    };
  }, []);

  // 弹窗关闭时清理定时器
  useEffect(() => {
    if (!open) {
      // 清理状态检查
      if (statusCheckCleanupRef.current) {
        statusCheckCleanupRef.current();
        statusCheckCleanupRef.current = null;
      }
      // 弹窗关闭时清理所有定时器
      Object.values(timersRef.current).forEach(timer => {
        if (timer) {
          clearTimeout(timer);
          clearInterval(timer);
        }
      });
      timersRef.current = {};
      setStatusChecking(false);
    }
  }, [open]);

  // 重置状态
  const resetDialog = () => {
    setStep('form');
    setLoading(false);
    setAmount(1);
    setCustomAmount('');
    setPaymentMethod(PaymentMethod.WECHAT);
    setOrderData(null);
    setQrCodeUrl('');
    setStatusChecking(false);
    setTimeLeft(240); // 4分钟倒计时
    setSuccessData(null);
    setIsProcessingPayment(false); // 重置处理状态
  };

  // 处理弹窗关闭
  const handleClose = () => {
    setOpen(false);
    // 使用定时器引用，确保可以被清理
    timersRef.current.closeDelayTimer = setTimeout(resetDialog, 300); // 等待动画完成后重置
  };

  // 创建支付订单
  const createPayment = async () => {
    setLoading(true);
    try {
      const finalAmount = customAmount ? parseFloat(customAmount) : amount;

      if (finalAmount <= 0 || finalAmount > 10000) {
        throw new Error('充值金额必须在0.01-10000元之间');
      }

      // 直接创建支付订单（后端会自动处理终端激活）
      const response = await fetch('/api/sqb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_payment',
          amount: finalAmount,
          subject: '积分充值',
          payway: paymentMethod,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '创建支付订单失败');
      }

      setOrderData(result.data);

      // 生成二维码
      const qrDataUrl = await QRCode.toDataURL(result.data.qr_code, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataUrl);

      setStep('qrcode');
      statusCheckCleanupRef.current = startStatusCheck(result.data.client_sn);
      startCountdown();
    } catch (error) {
      console.error('创建支付订单失败:', error);
      alert(error instanceof Error ? error.message : '创建支付订单失败');
    } finally {
      setLoading(false);
    }
  };

  // 开始状态检查 - 优化版本，使用指数退避策略
  const startStatusCheck = (clientSn: string) => {
    setStatusChecking(true);
    let checkCount = 0;

    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/sqb?action=query_payment&client_sn=${clientSn}`);
        const result = await response.json();

        console.log(`支付状态查询结果 (第${checkCount + 1}次):`, result);

        if (result.success && result.data?.biz_response?.biz_response?.data?.order_status) {
          const orderStatus = result.data.biz_response.biz_response.data.order_status;
          const orderData = result.data.biz_response.biz_response.data;
          console.log(`当前订单状态 (第${checkCount + 1}次):`, orderStatus, '状态描述:', getOrderStatusMessage(orderStatus));
          console.log('订单详细信息:', {
            trade_no: orderData.trade_no,
            finish_time: orderData.finish_time,
            total_amount: orderData.total_amount,
            payment_list: orderData.payment_list
          });

          // 检查是否为最终状态（需要停止轮询）
          if (isFinalOrderStatus(orderStatus)) {
            console.log('订单已达到最终状态，停止轮询');
            setStatusChecking(false);

            // 根据状态类型处理
            if (isSuccessOrderStatus(orderStatus)) {
              console.log('支付成功，直接处理支付结果');
              // 直接使用查询结果处理支付成功，不再调用get_payment_result
              handlePaymentSuccessFromQueryResult(result.data);
            } else if (isFailedOrderStatus(orderStatus)) {
              console.log('支付失败或取消');
              toast.error(`支付失败：${getOrderStatusMessage(orderStatus)}`);
            } else {
              // 其他最终状态（如退款等）
              toast.info(`订单状态：${getOrderStatusMessage(orderStatus)}`);
            }
            return; // 停止轮询
          }
        } else if (!result.success) {
          console.error('查询支付状态失败:', result.message);
        }

        // 继续轮询 - 使用指数退避策略
        checkCount++;
        let nextDelay: number;

        if (checkCount <= 10) {
          // 前10次：每2秒查询一次（前20秒）
          nextDelay = 2000;
        } else if (checkCount <= 20) {
          // 11-20次：每5秒查询一次（接下来50秒）
          nextDelay = 5000;
        } else if (checkCount <= 30) {
          // 21-30次：每10秒查询一次（接下来100秒）
          nextDelay = 10000;
        } else {
          // 30次后：每15秒查询一次（剩余时间）
          nextDelay = 15000;
        }

        // 检查是否超时（8分钟，收钱吧状态同步可能较慢）
        if (checkCount >= 60) { // 大约8分钟（前10次2s + 10次5s + 10次10s + 30次15s = 20+50+100+450 = 620秒）
          console.log('支付轮询超时，已停止。如果您已经支付成功，请稍等几分钟后刷新页面查看积分');
          setStatusChecking(false);
          toast.warning('支付轮询超时。如果您已经支付成功，请稍等几分钟后刷新页面查看积分', {
            duration: 8000
          });
          return;
        }

        // 设置下次查询
        timersRef.current.statusCheckTimer = setTimeout(checkPaymentStatus, nextDelay);

      } catch (error) {
        console.error('查询支付状态异常:', error);
        // 网络异常时继续尝试，使用较长的延迟
        checkCount++;
        if (checkCount < 40) { // 限制重试次数
          timersRef.current.statusCheckTimer = setTimeout(checkPaymentStatus, 5000);
        } else {
          setStatusChecking(false);
          toast.error('网络异常，请稍后重试');
        }
      }
    };

    // 立即开始第一次查询
    checkPaymentStatus();

    // 清理函数
    return () => {
      if (timersRef.current.statusCheckTimer) {
        clearTimeout(timersRef.current.statusCheckTimer);
        timersRef.current.statusCheckTimer = undefined;
      }
      setStatusChecking(false);
    };
  };

  // 开始倒计时
  const startCountdown = () => {
    timersRef.current.countdownTimer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timersRef.current.countdownTimer) {
            clearInterval(timersRef.current.countdownTimer);
            timersRef.current.countdownTimer = undefined;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 30分钟后清除
    timersRef.current.countdownCleanupTimer = setTimeout(() => {
      if (timersRef.current.countdownTimer) {
        clearInterval(timersRef.current.countdownTimer);
        timersRef.current.countdownTimer = undefined;
      }
    }, 1800000);
  };



  // 直接从查询结果处理支付成功 - 新的优化版本
  const handlePaymentSuccessFromQueryResult = async (queryResultData: any) => {
    // 防止重复处理
    if (isProcessingPayment) {
      console.log('支付结果正在处理中，跳过重复调用');
      return;
    }

    setIsProcessingPayment(true);

    try {
      console.log('处理支付成功结果:', queryResultData);

      // 检查是否包含支付成功信息
      if (queryResultData.payment_success_info) {
        const { charged_amount, charged_credits, current_credits, previous_credits } = queryResultData.payment_success_info;

        // 设置成功数据
        setSuccessData({
          chargedAmount: charged_amount,
          chargedCredits: charged_credits,
          previousCredits: previous_credits,
          currentCredits: current_credits
        });

        // 显示成功页面
        setStep('success');

        // 显示toast提示
        toast.success('充值成功！积分已到账', {
          description: `获得 ${charged_credits} 积分，当前余额 ${current_credits} 积分`
        });

        // 刷新积分数据
        onSuccess();

        console.log('支付成功处理完成');
      } else {
        // 如果没有积分信息，说明后端处理可能还在进行中，稍等一下再刷新
        console.log('支付成功但积分信息尚未准备好，1秒后刷新积分');
        timersRef.current.successDelayTimer = setTimeout(async () => {
          onSuccess();
          toast.success('支付成功！积分已到账');
        }, 1000);
      }

    } catch (error) {
      console.error('处理支付成功结果异常:', error);
      toast.error('支付成功，但显示结果时出现异常，请刷新页面查看积分');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // 支付成功处理 - 优化版本，从后端获取准确的支付结果，带幂等性检查
  const handlePaymentSuccess = async () => {
    // 防止重复处理
    if (isProcessingPayment) {
      console.log('支付结果正在处理中，跳过重复调用');
      return;
    }

    setIsProcessingPayment(true);

    try {
      // 调用后端API获取支付成功后的完整信息
      const paymentResultResponse = await fetch('/api/sqb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_payment_result',
          client_sn: orderData?.client_sn
        })
      });

      if (paymentResultResponse.ok) {
        const paymentResult = await paymentResultResponse.json();

        if (paymentResult.success && paymentResult.data) {
          const {
            charged_amount,
            charged_credits,
            previous_credits,
            current_credits
          } = paymentResult.data;

          // 设置成功数据（使用后端返回的准确数据）
          setSuccessData({
            chargedAmount: charged_amount,
            chargedCredits: charged_credits,
            previousCredits: previous_credits,
            currentCredits: current_credits
          });

          // 显示成功页面
          setStep('success');

          // 显示toast提示
          toast.success('充值成功！积分已到账', {
            description: `获得 ${charged_credits} 积分，当前余额 ${current_credits} 积分`
          });

          // 刷新积分数据
          onSuccess();
          return;
        }
      }

      // 如果获取详细信息失败，使用基本的成功处理
      toast.success('充值成功！积分已到账');
      onSuccess();
      handleClose();

    } catch (error) {
      console.error('获取支付结果失败:', error);
      // 如果获取支付结果失败，仍然显示基本的成功提示
      toast.success('充值成功！积分已到账');
      onSuccess();
      handleClose();
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // 格式化倒计时
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          充值
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'form' ? '积分充值' : step === 'qrcode' ? '扫码支付' : '充值成功'}
          </DialogTitle>
          {step === 'qrcode' && (
            <DialogDescription>
              请使用{paymentMethod === PaymentMethod.WECHAT ? '微信' : '支付宝'}扫描下方二维码完成支付
            </DialogDescription>
          )}
          {step === 'success' && (
            <DialogDescription>
              恭喜您！积分充值已完成
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-6">
            {/* 预设金额 */}
            <div>
              <Label className="text-sm font-medium">选择充值金额</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {presetAmounts.map((preset) => (
                  <Button
                    key={preset}
                    variant={amount === preset && !customAmount ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setAmount(preset);
                      setCustomAmount('');
                    }}
                  >
                    ¥{preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* 自定义金额 */}
            <div>
              <Label htmlFor="custom-amount" className="text-sm font-medium">
                或输入自定义金额
              </Label>
              <Input
                id="custom-amount"
                type="number"
                placeholder="0.01 - 10000"
                min="0.01"
                max="10000"
                step="0.01"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  if (e.target.value) {
                    setAmount(0);
                  }
                }}
                className="mt-1"
              />
            </div>

            {/* 积分说明 */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span>充值金额:</span>
                <span>¥{customAmount ? parseFloat(customAmount) || 0 : amount}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>获得积分:</span>
                <span className="text-primary font-medium">
                  {Math.floor((customAmount ? parseFloat(customAmount) || 0 : amount) * 100)}积分
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                1元 = 100积分
              </div>
            </div>

            {/* 支付方式 */}
            <div>
              <Label className="text-sm font-medium">支付方式</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant={paymentMethod === PaymentMethod.WECHAT ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentMethod(PaymentMethod.WECHAT)}
                  className="flex items-center gap-2"
                >
                  <span className="text-green-600">💬</span>
                  微信支付
                </Button>
                <Button
                  variant={paymentMethod === PaymentMethod.ALIPAY ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentMethod(PaymentMethod.ALIPAY)}
                  className="flex items-center gap-2"
                >
                  <span className="text-blue-600">🅰️</span>
                  支付宝
                </Button>
              </div>
            </div>
          </div>
        ) : step === 'qrcode' ? (
          <div className="space-y-4 text-center">
            {/* 二维码 */}
            <div className="flex justify-center">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="支付二维码" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              )}
            </div>

            {/* 订单信息 */}
            {orderData && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span>订单号:</span>
                  <span className="font-mono text-xs">{orderData.client_sn}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>支付金额:</span>
                  <span>¥{(orderData.amount / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>获得积分:</span>
                  <span className="text-primary font-medium">{orderData.credits}积分</span>
                </div>
              </div>
            )}

            {/* 倒计时 */}
            <div className="text-sm text-muted-foreground">
              {timeLeft > 0 ? (
                <>订单将在 <span className="font-mono text-primary">{formatTime(timeLeft)}</span> 后过期</>
              ) : (
                <span className="text-destructive">订单已过期</span>
              )}
            </div>

            {/* 状态提示 */}
            {statusChecking && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  正在等待支付...
                </div>
                <div className="text-xs text-muted-foreground">
                  如果您已经支付成功但状态未更新，请点击下方按钮手动刷新
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('手动刷新支付状态');
                    // 重新开始状态检查
                    if (orderData?.client_sn) {
                      statusCheckCleanupRef.current = startStatusCheck(orderData.client_sn);
                    }
                  }}
                  disabled={!orderData?.client_sn}
                >
                  手动刷新状态
                </Button>
              </div>
            )}
          </div>
        ) : step === 'success' ? (
          /* 充值成功页面 */
          <div className="space-y-6 text-center">
            {/* 成功图标 */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>

            {/* 成功信息 */}
            <div>
              <h3 className="text-lg font-semibold text-green-600 mb-2">充值成功！</h3>
              <p className="text-muted-foreground">您的积分已成功充值到账</p>
            </div>

            {/* 充值详情 */}
            {successData && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">充值金额</span>
                  <span className="font-medium">¥{successData.chargedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">获得积分</span>
                  <span className="font-medium text-green-600">+{successData.chargedCredits}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">原有积分</span>
                    <span className="text-sm">{successData.previousCredits}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="font-medium">当前积分</span>
                    <span className="font-bold text-primary text-lg">{successData.currentCredits}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 温馨提示 */}
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <p>💡 积分可用于访问付费资源，感谢您的支持！</p>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button
                onClick={createPayment}
                disabled={loading || (!customAmount && amount <= 0) || (!!customAmount && (parseFloat(customAmount) <= 0 || parseFloat(customAmount) > 10000))}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    创建订单...
                  </>
                ) : (
                  '立即支付'
                )}
              </Button>
            </>
          ) : step === 'qrcode' ? (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>
                返回
              </Button>
              <Button variant="outline" onClick={handleClose}>
                关闭
              </Button>
            </>
          ) : step === 'success' ? (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>
                继续充值
              </Button>
              <Button onClick={handleClose}>
                完成
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
