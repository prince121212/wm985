"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, MessageCircle, Settings, Database, TestTube } from "lucide-react";
import { toast } from "sonner";
import { FAQ_DATABASE, SYSTEM_KNOWLEDGE } from "@/lib/ai-knowledge";

export default function AIServicePage() {
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  // 使用useMemo优化统计计算
  const stats = useMemo(() => ({
    totalFAQs: FAQ_DATABASE.length,
    totalKnowledge: Object.keys(SYSTEM_KNOWLEDGE).length,
    categories: [...new Set(FAQ_DATABASE.map(faq => faq.category))].length
  }), []);

  // 测试AI客服
  const handleTestAI = async () => {
    if (!testMessage.trim()) {
      toast.error("请输入测试消息");
      return;
    }

    setTestLoading(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: testMessage,
          context: {}
        }),
      });

      const result = await response.json();

      if (result.code === 0) {
        setTestResponse(result.data.response);
        toast.success("测试成功");
      } else {
        toast.error(result.message || "测试失败");
        setTestResponse("测试失败: " + (result.message || "未知错误"));
      }
    } catch (error) {
      console.error("AI测试失败:", error);
      toast.error("测试失败，请检查网络连接");
      setTestResponse("测试失败: 网络错误");
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">AI客服管理</h1>
          <p className="text-muted-foreground">管理AI客服的知识库、配置和测试功能</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="knowledge">知识库</TabsTrigger>
          <TabsTrigger value="test">测试</TabsTrigger>
          <TabsTrigger value="config">配置</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">常见问题</CardTitle>
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalFAQs}</div>
                <p className="text-xs text-muted-foreground">个问题解答</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">系统知识</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalKnowledge}</div>
                <p className="text-xs text-muted-foreground">个知识点</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">问题分类</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.categories}</div>
                <p className="text-xs text-muted-foreground">个分类</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>AI客服功能说明</CardTitle>
              <CardDescription>
                AI客服基于静态知识库和AI模型，为用户提供智能问答服务
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">核心功能</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 智能问答：基于知识库回答用户问题</li>
                    <li>• 上下文理解：记住对话历史</li>
                    <li>• 本地存储：对话记录保存在用户浏览器</li>
                    <li>• 快速响应：静态知识库确保快速匹配</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">技术特点</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 无数据库依赖：知识库为静态配置</li>
                    <li>• AI模型：使用SiliconFlow免费模型</li>
                    <li>• 界面集成：复用现有反馈弹窗</li>
                    <li>• 隐私保护：对话记录仅存储在本地</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>常见问题库</CardTitle>
                <CardDescription>
                  当前共有 {FAQ_DATABASE.length} 个常见问题
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {FAQ_DATABASE.map((faq, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary">{faq.category}</Badge>
                        <div className="flex gap-1">
                          {faq.keywords.slice(0, 3).map((keyword, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <h4 className="font-medium text-sm mb-1">{faq.question}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>系统知识库</CardTitle>
                <CardDescription>
                  当前共有 {Object.keys(SYSTEM_KNOWLEDGE).length} 个知识点
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Object.entries(SYSTEM_KNOWLEDGE).map(([key, knowledge]) => (
                    <div key={key} className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm mb-1">{knowledge.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {knowledge.content}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>知识库管理说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>• 知识库内容存储在 <code className="bg-muted px-1 rounded">lib/ai-knowledge.ts</code> 文件中</p>
                <p>• 修改知识库需要更新代码文件并重新部署</p>
                <p>• 建议定期根据用户反馈更新常见问题</p>
                <p>• 可以通过测试功能验证知识库的匹配效果</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                AI客服测试
              </CardTitle>
              <CardDescription>
                测试AI客服的回答质量和知识库匹配效果
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-message">测试消息</Label>
                <Textarea
                  id="test-message"
                  placeholder="输入要测试的问题，例如：如何获得更多积分？"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              
              <Button 
                onClick={handleTestAI} 
                disabled={testLoading || !testMessage.trim()}
                className="w-full"
              >
                {testLoading ? "测试中..." : "测试AI回答"}
              </Button>

              {testResponse && (
                <div className="space-y-2">
                  <Label>AI回答</Label>
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap">{testResponse}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>测试建议</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>推荐测试问题：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>如何获得更多积分？</li>
                  <li>资源上传失败怎么办？</li>
                  <li>忘记密码如何重置？</li>
                  <li>如何选择合适的分类？</li>
                  <li>邀请用户有什么奖励？</li>
                </ul>
                <p className="mt-4"><strong>测试要点：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>检查回答是否准确和有帮助</li>
                  <li>验证知识库匹配是否正确</li>
                  <li>确认回答语气友好自然</li>
                  <li>测试未知问题的处理</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI模型配置</CardTitle>
              <CardDescription>
                当前使用的AI服务配置信息
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>AI服务提供商</Label>
                  <Input value="SiliconFlow" disabled />
                </div>
                <div>
                  <Label>使用模型</Label>
                  <Input value="Qwen/Qwen2.5-7B-Instruct" disabled />
                </div>
                <div>
                  <Label>温度设置</Label>
                  <Input value="0.3" disabled />
                </div>
                <div>
                  <Label>最大Token数</Label>
                  <Input value="800" disabled />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>• 配置信息存储在环境变量中</p>
                <p>• 修改配置需要更新环境变量并重启服务</p>
                <p>• 当前使用免费模型，如需更高质量可考虑付费模型</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>功能开关</CardTitle>
              <CardDescription>
                AI客服相关功能的启用状态
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>AI客服功能</Label>
                    <p className="text-sm text-muted-foreground">用户可以在反馈弹窗中使用AI客服</p>
                  </div>
                  <Badge variant="default">已启用</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>本地存储</Label>
                    <p className="text-sm text-muted-foreground">对话记录保存在用户浏览器中</p>
                  </div>
                  <Badge variant="default">已启用</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>知识库匹配</Label>
                    <p className="text-sm text-muted-foreground">基于关键词匹配相关知识</p>
                  </div>
                  <Badge variant="default">已启用</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
