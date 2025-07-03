"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  X,
  Plus,
  Sparkles,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { ResourceUploadForm as ResourceUploadFormType } from "@/types/resource";



export default function ResourceUploadForm() {
  const t = useTranslations();
  const router = useRouter();

  const [formData, setFormData] = useState<ResourceUploadFormType>({
    title: "",
    description: "",
    content: "",
    category_id: 0,
    tags: [],
    is_free: true,
    credits: undefined,
  });

  const [resourceUrl, setResourceUrl] = useState("");
  const [categories, setCategories] = useState<Array<{id: number; name: string}>>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);

  // AI功能相关状态
  const [aiText, setAiText] = useState("");
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // URL检查相关状态
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [urlCheckResult, setUrlCheckResult] = useState<{
    checked: boolean;
    available: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();

      if (data.code === 0 && data.data?.categories) {
        setCategories(data.data.categories.map((cat: any) => ({
          id: cat.id,
          name: cat.name
        })));
      } else {
        throw new Error(data.message || '获取分类失败');
      }
    } catch (error) {
      console.error("获取分类失败:", error);
      toast.error("获取分类失败");

      // 使用文明知识库分类作为后备
      setCategories([
        { id: 1, name: "文学作品" },
        { id: 2, name: "艺术设计" },
        { id: 3, name: "音乐舞蹈" },
        { id: 4, name: "历史文化" },
        { id: 5, name: "戏曲表演" },
        { id: 6, name: "教育资料" },
      ]);
    }
  };



  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    
    if (formData.tags.includes(tag)) {
      toast.error("标签已存在");
      return;
    }
    
    if (formData.tags.length >= 10) {
      toast.error("最多只能添加10个标签");
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, tag]
    }));
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // AI智能分析函数
  const handleAiAnalyze = async () => {
    if (!aiText.trim()) {
      toast.error("请输入要分析的文本内容");
      return;
    }

    if (aiText.trim().length > 2000) {
      toast.error("文本内容不能超过2000个字符");
      return;
    }

    try {
      setIsAiAnalyzing(true);

      const response = await fetch('/api/ai/analyze-resource', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: aiText.trim() }),
      });

      const result = await response.json();

      if (result.code === 0 && result.data?.analysis) {
        const analysis = result.data.analysis;

        // 自动填充表单
        setFormData(prev => ({
          ...prev,
          title: analysis.title || prev.title,
          description: analysis.description || prev.description,
          // content: 不再填充详细内容，保持为空
          tags: analysis.tags || prev.tags,
          is_free: true, // AI建议默认免费
          credits: 0,
        }));

        // 填充资源链接
        if (analysis.file_url) {
          setResourceUrl(analysis.file_url);
        }

        // 根据分类名称找到对应的category_id
        if (analysis.category && categories.length > 0) {
          const matchedCategory = categories.find(cat =>
            cat.name.includes(analysis.category) ||
            analysis.category.includes(cat.name)
          );
          if (matchedCategory) {
            setFormData(prev => ({
              ...prev,
              category_id: matchedCategory.id
            }));
          }
        }

        toast.success("AI分析完成！已自动填充表单内容");

        // 清空AI输入框
        setAiText("");

      } else {
        throw new Error(result.message || 'AI分析失败');
      }

    } catch (error) {
      console.error("AI分析失败:", error);
      toast.error(error instanceof Error ? error.message : "AI分析失败，请稍后再试");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // 处理回到首页
  const handleGoHome = () => {
    router.push('/');
  };

  // URL标准化函数：自动补全协议
  const normalizeUrl = (url: string): string => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return '';

    // 如果已经有协议，直接返回
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }

    // 自动添加https://协议
    return `https://${trimmedUrl}`;
  };

  // URL验证和标准化函数：统一处理URL验证逻辑
  const validateAndNormalizeUrl = (url: string): { success: boolean; normalizedUrl: string; error?: string } => {
    if (!url.trim()) {
      return { success: false, normalizedUrl: '', error: "请先输入资源链接" };
    }

    // 标准化URL（自动补全协议）
    const normalizedUrl = normalizeUrl(url);

    // 验证URL格式
    try {
      new URL(normalizedUrl);
    } catch {
      return { success: false, normalizedUrl, error: "请输入有效的资源链接格式" };
    }

    return { success: true, normalizedUrl };
  };

  // 检查URL可用性
  const handleCheckUrl = async () => {
    const validation = validateAndNormalizeUrl(resourceUrl);

    if (!validation.success) {
      toast.error(validation.error!);
      return;
    }

    const { normalizedUrl } = validation;

    // 如果URL被标准化了，更新状态
    if (normalizedUrl !== resourceUrl) {
      setResourceUrl(normalizedUrl);
    }

    setIsCheckingUrl(true);
    setUrlCheckResult(null);

    try {
      const response = await fetch('/api/check-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const result = await response.json();

      if (result.code === 0 && result.data) {
        setUrlCheckResult({
          checked: true,
          available: result.data.available,
          message: result.data.message,
        });

        if (result.data.available) {
          toast.success("链接检查通过！");
        } else {
          toast.warning(result.data.message);
        }
      } else {
        throw new Error(result.message || '检查失败');
      }

    } catch (error) {
      console.error("URL检查失败:", error);
      setUrlCheckResult({
        checked: true,
        available: false,
        message: error instanceof Error ? error.message : "检查失败，请稍后再试",
      });
      toast.error("链接检查失败，请稍后再试");
    } finally {
      setIsCheckingUrl(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // 表单验证
    if (!formData.title.trim()) {
      toast.error("请输入资源标题");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("请输入资源描述");
      return;
    }

    if (!formData.category_id) {
      toast.error("请选择资源分类");
      return;
    }

    const validation = validateAndNormalizeUrl(resourceUrl);

    if (!validation.success) {
      toast.error(validation.error!);
      return;
    }

    const { normalizedUrl } = validation;

    // 如果URL被标准化了，更新状态
    if (normalizedUrl !== resourceUrl) {
      setResourceUrl(normalizedUrl);
    }

    // 验证链接是否已检查且通过
    if (!urlCheckResult) {
      toast.error("请先检查资源链接的可用性");
      return;
    }

    if (!urlCheckResult.available) {
      toast.error("资源链接检查未通过，请修改链接后重新检查");
      return;
    }

    try {
      setIsSubmitting(true);

      // 创建提交数据
      const submitData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        content: formData.content?.trim() || '',
        category_id: formData.category_id,
        tags: formData.tags,
        file_url: normalizedUrl,

        is_free: formData.is_free,
        credits: formData.credits || 0,
      };

      // 提交资源信息
      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (result.code === 0) {
        toast.success("资源提交成功！审核通过后将公开显示");

        // 重置表单（保留链接和检查结果，方便用户继续提交）
        setFormData({
          title: "",
          description: "",
          content: "",
          category_id: 0,
          tags: [],
          is_free: true,
          credits: undefined,
        });
        setTagInput("");
        // 不清除 resourceUrl 和 urlCheckResult，方便用户继续使用

        // 设置提交成功状态，不自动跳转
        setIsSubmitSuccess(true);
      } else {
        throw new Error(result.message || '提交失败');
      }

    } catch (error) {
      console.error("上传失败:", error);

      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("提交失败，请稍后再试");
      }
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="space-y-6">
      {/* AI智能填充功能 */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Sparkles className="h-5 w-5" />
            AI智能填充
          </CardTitle>
          <p className="text-sm text-blue-600">
            输入一段描述文字，AI将自动为您生成资源标题、描述、分类和标签
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-text">描述文字</Label>
              <Textarea
                id="ai-text"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="请输入资源的相关描述，例如：这是一个电子书合集，包含了最新最热门的小说，它的链接是..."
                rows={4}
                maxLength={2000}
                disabled={isAiAnalyzing}
              />
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>AI将根据您的描述自动生成资源信息</span>
                <span>{aiText.length}/2000</span>
              </div>
            </div>
            <Button
              type="button"
              onClick={handleAiAnalyze}
              disabled={isAiAnalyzing || !aiText.trim()}
              className="w-full"
              variant="outline"
            >
              {isAiAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  AI分析中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI智能填充
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 资源信息表单 */}
      <Card>
        <CardHeader>
          <CardTitle>资源信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 资源标题 */}
          <div className="space-y-2">
            <Label htmlFor="title">资源标题 *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="请输入资源标题"
              maxLength={100}
              disabled={isSubmitting}
            />
          </div>

          {/* 资源描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">资源描述 *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="请简要描述资源内容和用途"
              rows={3}
              maxLength={500}
              disabled={isSubmitting}
            />
          </div>

          {/* 分类和标签 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">资源分类 *</Label>
              <Select
                value={formData.category_id.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: parseInt(value) }))}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">资源标签</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="输入标签后按回车添加"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddTag}
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 资源链接 */}
          <div className="space-y-2">
            <Label htmlFor="resource-url">资源链接 *</Label>
            <div className="flex gap-2">
              <Input
                id="resource-url"
                type="url"
                value={resourceUrl}
                onChange={(e) => {
                  setResourceUrl(e.target.value);
                  // 清除之前的检查结果
                  setUrlCheckResult(null);
                }}
                placeholder="example.com/resource 或 https://example.com/resource"
                disabled={isSubmitting}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCheckUrl}
                disabled={isSubmitting || isCheckingUrl || !resourceUrl.trim()}
                className="shrink-0"
              >
                {isCheckingUrl ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2" />
                    检查中
                  </>
                ) : (
                  "检查链接"
                )}
              </Button>
            </div>

            {/* 检查结果显示 */}
            {urlCheckResult && (
              <div className={`text-sm p-2 rounded-md ${
                urlCheckResult.available
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {urlCheckResult.available ? (
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                      <X className="w-2 h-2 text-white" />
                    </div>
                  )}
                  {urlCheckResult.message}
                </div>
              </div>
            )}
          </div>

          {/* 详细内容 - 已注释掉，默认为空 */}
          {/*
          <div className="space-y-2">
            <Label htmlFor="content">详细内容</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="可选：详细介绍资源的使用方法、特点等"
              rows={5}
              maxLength={2000}
              disabled={isSubmitting}
            />
          </div>
          */}



          {/* 资源定价 */}
          <div className="space-y-2">
            <Label htmlFor="credits">资源定价</Label>
            <div className="flex items-center space-x-3">
              <Select
                value={formData.credits?.toString() || "0"}
                onValueChange={(value) => {
                  const credits = parseInt(value);
                  setFormData(prev => ({
                    ...prev,
                    credits: credits,
                    is_free: credits === 0
                  }));
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 积分 (免费)</SelectItem>
                  <SelectItem value="1">1 积分</SelectItem>
                  <SelectItem value="2">2 积分</SelectItem>
                  <SelectItem value="3">3 积分</SelectItem>
                  <SelectItem value="5">5 积分</SelectItem>
                  <SelectItem value="10">10 积分</SelectItem>
                  <SelectItem value="30">30 积分</SelectItem>
                  <SelectItem value="50">50 积分</SelectItem>
                  <SelectItem value="100">100 积分</SelectItem>
                  <SelectItem value="500">500 积分</SelectItem>
                </SelectContent>
              </Select>

              {/* 价格预览标签 */}
              <div className={`flex items-center px-3 py-2 rounded-full text-sm font-bold shadow-md ${
                formData.is_free
                  ? "bg-gradient-to-r from-green-500 to-blue-500 text-white"
                  : "bg-gradient-to-r from-orange-500 to-red-500 text-white"
              }`}>
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  {formData.is_free ? (
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  ) : (
                    <path d="M5.5,7A1.5,1.5 0 0,1 4,5.5A1.5,1.5 0 0,1 5.5,4A1.5,1.5 0 0,1 7,5.5A1.5,1.5 0 0,1 5.5,7M21.41,11.58L12.41,2.58C12.05,2.22 11.55,2 11,2H4C2.89,2 2,2.89 2,4V11C2,11.55 2.22,12.05 2.59,12.41L11.58,21.41C11.95,21.77 12.45,22 13,22C13.55,22 14.05,21.77 14.41,21.41L21.41,14.41C21.77,14.05 22,13.55 22,13C22,12.45 21.77,11.95 21.41,11.58Z"/>
                  )}
                </svg>
                {formData.is_free ? "免费" : `${formData.credits}积分`}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              设置用户访问此资源需要消耗的积分数量，0积分表示免费资源
            </p>
          </div>



          {/* 提交按钮 */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? "提交中..." : "提交资源"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    {/* 提交成功提示 */}
    {isSubmitSuccess && (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">资源提交成功！</h3>
              <p className="text-green-700 mb-4">
                您的资源已成功提交，我们会尽快进行审核。审核通过后将在资源库中公开显示。
              </p>
              <Button
                onClick={handleGoHome}
                className="bg-green-600 hover:bg-green-700"
              >
                回到首页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )}
    </div>
  );
}
