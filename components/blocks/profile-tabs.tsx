"use client";

import { useState, useRef, useEffect } from "react";
import { getTransactionTypeText, isResourceAccessTransaction } from "@/constants/transactionTypes";
import { truncateResourceTitle, getResourceLinkTitle } from "@/utils/creditUtils";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { toast } from 'sonner';
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
import RechargeDialog from "@/components/recharge-dialog";

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
        <RechargeDialogTrigger onSuccess={() => fetchCreditsData()} />
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

// 充值弹窗触发器组件
function RechargeDialogTrigger({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)}>
        充值
      </Button>
      <RechargeDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}


