"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { ImportResult } from "@/types/admin";

interface BatchImportCategoriesProps {
  open: boolean;
  onOpenChange: (open: boolean, imported?: boolean) => void;
}

export default function BatchImportCategories({ open, onOpenChange }: BatchImportCategoriesProps) {
  const [jsonData, setJsonData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const exampleData = `[
  {
    "name": "编程开发",
    "description": "编程相关的资源和教程",
    "icon": "code",
    "sort_order": 1
  },
  {
    "name": "设计素材",
    "description": "UI设计、平面设计等素材",
    "icon": "palette",
    "sort_order": 2
  },
  {
    "name": "学术论文",
    "description": "各领域学术研究论文",
    "icon": "file-text",
    "sort_order": 3
  },
  {
    "name": "数据库技术",
    "description": "MySQL、PostgreSQL、MongoDB等数据库技术",
    "icon": "database",
    "sort_order": 4
  },
  {
    "name": "云计算",
    "description": "AWS、Azure、阿里云等云服务技术",
    "icon": "cloud",
    "sort_order": 5
  }
]`;

  const validateJsonData = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      
      if (!Array.isArray(parsed)) {
        throw new Error("数据必须是数组格式");
      }

      if (parsed.length === 0) {
        throw new Error("数组不能为空");
      }

      if (parsed.length > 50) {
        throw new Error("一次最多只能导入50个分类");
      }

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        
        if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
          throw new Error(`第${i + 1}项：分类名称不能为空`);
        }

        if (item.name.trim().length > 50) {
          throw new Error(`第${i + 1}项：分类名称不能超过50个字符`);
        }

        if (item.description && typeof item.description !== 'string') {
          throw new Error(`第${i + 1}项：描述必须是字符串类型`);
        }

        if (item.description && item.description.length > 200) {
          throw new Error(`第${i + 1}项：描述不能超过200个字符`);
        }

        if (item.icon && typeof item.icon !== 'string') {
          throw new Error(`第${i + 1}项：图标必须是字符串类型`);
        }

        if (item.sort_order && typeof item.sort_order !== 'number') {
          throw new Error(`第${i + 1}项：排序必须是数字类型`);
        }

        if (item.parent_id && typeof item.parent_id !== 'number') {
          throw new Error(`第${i + 1}项：父分类ID必须是数字类型`);
        }
      }

      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("JSON格式错误，请检查语法");
      }
      throw error;
    }
  };

  const handleImport = async () => {
    if (!jsonData.trim()) {
      toast.error("请输入要导入的数据");
      return;
    }

    try {
      setIsImporting(true);
      setImportResult(null);

      // 验证JSON数据
      const categories = validateJsonData(jsonData);

      // 调用批量导入API
      const response = await fetch('/api/admin/categories/batch-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categories }),
      });

      const result = await response.json();

      if (result.code === 0) {
        setImportResult(result.data);
        
        if (result.data.failed === 0) {
          toast.success(`成功导入 ${result.data.success} 个分类`);
          // 延迟关闭对话框并通知父组件刷新
          setTimeout(() => {
            onOpenChange(false, true);
          }, 2000);
        } else {
          toast.warning(`导入完成：成功 ${result.data.success} 个，失败 ${result.data.failed} 个`);
          // 即使部分失败也需要刷新数据
          if (result.data.success > 0) {
            setTimeout(() => {
              onOpenChange(false, true);
            }, 3000);
          }
        }
      } else {
        throw new Error(result.message || '导入失败');
      }

    } catch (error) {
      console.error("批量导入失败:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("导入失败，请稍后再试");
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setJsonData('');
    setImportResult(null);
    onOpenChange(false, false);
  };

  const handleUseExample = () => {
    setJsonData(exampleData);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量导入分类</DialogTitle>
          <DialogDescription>
            使用JSON格式批量导入分类数据。请确保数据格式正确。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 格式说明 */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">数据格式说明：</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <code>name</code>: 分类名称（必填，最多50字符）</li>
              <li>• <code>description</code>: 分类描述（可选，最多200字符）</li>
              <li>• <code>icon</code>: 图标名称（可选，使用kebab-case格式，如 "code", "file-text"）</li>
              <li>• <code>sort_order</code>: 排序号（可选，数字类型）</li>
              <li>• <code>parent_id</code>: 父分类ID（可选，数字类型）</li>
            </ul>
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>重名处理：</strong>如果分类名称已存在，将跳过该分类的创建，不会覆盖现有分类。
              </p>
            </div>
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={handleUseExample}>
                使用示例数据
              </Button>
            </div>
          </div>

          {/* JSON输入区域 */}
          <div className="space-y-2">
            <Label htmlFor="json-data">JSON数据</Label>
            <Textarea
              id="json-data"
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              placeholder="请输入JSON格式的分类数据..."
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          {/* 导入结果 */}
          {importResult && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                导入结果
                {importResult.failed === 0 ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
              </h4>
              
              <div className="flex gap-4 mb-3">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  成功: {importResult.success}
                </Badge>
                {importResult.failed > 0 && (
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    失败: {importResult.failed}
                  </Badge>
                )}
              </div>

              {importResult.details.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">详细信息：</h5>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importResult.details.map((detail, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        {detail.status === 'success' ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-500" />
                        )}
                        <span className="font-medium">{detail.name}</span>
                        {detail.message && (
                          <span className="text-muted-foreground">- {detail.message}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={isImporting || !jsonData.trim()}
          >
            {isImporting ? "导入中..." : "开始导入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
