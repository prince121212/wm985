"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TableBlock from "@/components/blocks/table";
import { TableColumn } from "@/types/blocks/table";
import Toolbar from "@/components/blocks/toolbar";
import Header from "@/components/dashboard/header";
import BatchImportCategories from "@/components/admin/batch-import-categories";
import CategoryActions from "@/components/admin/category-actions";
import moment from "moment";
import { Category } from "@/types/resource";
import { toast } from "sonner";
import { Search, X } from "lucide-react";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBatchImport, setShowBatchImport] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20); // 每页显示数量

  // 搜索状态
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // 获取分类数据
  useEffect(() => {
    fetchCategories();
  }, [currentPage, searchTerm]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/admin/categories?${params}`);
      const result = await response.json();

      if (result.code === 0) {
        setCategories(result.data.categories || []);
        setTotalCount(result.data.total || 0);
        setTotalPages(result.data.totalPages || 1);
      } else {
        console.error('获取分类失败:', result.message);
        toast.error('获取分类失败: ' + result.message);
      }
    } catch (error) {
      console.error('获取分类失败:', error);
      toast.error('获取分类失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    setSearchTerm(searchInput);
    setCurrentPage(1); // 搜索时重置到第一页
  };

  const handleSearchClear = () => {
    setSearchInput('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleAction = (action: string) => {
    if (action === "batch-import") {
      setShowBatchImport(true);
    } else if (action === "refresh") {
      fetchCategories();
    }
  };

  const handleBatchImportClose = (imported: boolean) => {
    setShowBatchImport(false);
    if (imported) {
      // 如果有导入操作，刷新分类列表
      fetchCategories();
    }
  };

  // 定义表格列
  const columns: TableColumn[] = [
    {
      name: "name",
      title: "分类名称",
      callback: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.name}</span>
          {row.parent_id && (
            <Badge variant="outline" className="text-xs">子分类</Badge>
          )}
        </div>
      )
    },
    {
      name: "description",
      title: "描述",
      callback: (row) => (
        <span className="text-sm text-muted-foreground max-w-xs truncate">
          {row.description || "无描述"}
        </span>
      )
    },
    {
      name: "parent",
      title: "父分类",
      callback: (row) => (
        <span className="text-sm">
          {row.parent_name || "顶级分类"}
        </span>
      )
    },
    {
      name: "resource_count",
      title: "资源数量",
      callback: (row) => (
        <Badge variant="secondary" className="text-xs">
          {row.resource_count || 0} 个
        </Badge>
      )
    },
    {
      name: "sort_order",
      title: "排序",
      callback: (row) => (
        <span className="text-sm">{row.sort_order || 0}</span>
      )
    },
    {
      name: "created_at",
      title: "创建时间",
      callback: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.created_at ? moment(row.created_at).format("YYYY-MM-DD") : "未知"}
        </span>
      )
    },
    {
      name: "actions",
      title: "操作",
      callback: (row) => (
        <CategoryActions
          categoryId={row.id}
          categoryName={row.name}
        />
      )
    },
  ];

  const toolbarItems = [
    {
      title: "添加分类",
      icon: "RiAddLine",
      url: "/admin/categories/add",
    },
    {
      title: "批量导入",
      icon: "RiUploadLine",
      action: "batch-import",
    },
    {
      title: "刷新",
      icon: "RiRefreshLine",
      action: "refresh",
    },
  ];

  const crumb = {
    items: [
      { title: "管理后台", url: "/admin" },
      { title: "分类管理", is_active: true }
    ]
  };

  if (loading) {
    return (
      <>
        <Header crumb={crumb} />
        <div className="w-full px-4 md:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">加载中...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header crumb={crumb} />
      <div className="w-full px-4 md:px-8 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-medium mb-2">分类管理</h1>
            <p className="text-sm text-muted-foreground mb-8">
              共 {totalCount} 个分类
            </p>
          </div>

          <Toolbar items={toolbarItems} onAction={handleAction} />

          {/* 搜索框 */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="搜索分类名称或描述..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="pl-10 pr-10"
              />
              {searchInput && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSearchClear}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              搜索
            </Button>
          </div>

          <div className="overflow-x-auto">
            <TableBlock columns={columns} data={categories} />
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
              第 {currentPage} 页，共 {totalPages} 页，总计 {totalCount} 个分类
            </div>
          )}
        </div>

        <BatchImportCategories
          open={showBatchImport}
          onOpenChange={handleBatchImportClose}
        />
      </div>
    </>
  );
}
