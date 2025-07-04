"use client";

import { useState, useEffect, useRef } from "react";
import { Bot, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// 消息类型定义
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AIChatProps {
  onRequireLogin: () => void;
  isLoggedIn: boolean;
}

export default function AIChat({ onRequireLogin, isLoggedIn }: AIChatProps) {
  const t = useTranslations("ai_chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 从localStorage加载聊天历史
  useEffect(() => {
    const saved = localStorage.getItem('ai-chat-history');
    if (saved) {
      try {
        setChatMessages(JSON.parse(saved));
      } catch (error) {
        // 本地存储解析失败，清除无效数据
        localStorage.removeItem('ai-chat-history');
      }
    }
  }, []);

  // 保存聊天历史到localStorage
  const saveChatHistory = (messages: ChatMessage[]) => {
    localStorage.setItem('ai-chat-history', JSON.stringify(messages));
  };

  // 滚动到消息底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // 发送AI聊天消息
  const handleChatSend = async () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    if (!chatInput.trim()) {
      toast.error(t("error_empty"));
      return;
    }

    if (chatInput.trim().length > 500) {
      toast.error(t("error_too_long"));
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    };

    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    saveChatHistory(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const resp = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          context: { previousMessages: chatMessages.slice(-5) } // 只传递最近5条消息作为上下文
        }),
      });

      const result = await resp.json();

      if (!resp.ok) {
        toast.error(result.message || `${t("error_network")} (${resp.status})`);
        return;
      }

      if (result.code !== 0) {
        toast.error(result.message || t("error_network"));
        return;
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.data.response,
        timestamp: result.data.timestamp
      };

      const finalMessages = [...newMessages, assistantMessage];
      setChatMessages(finalMessages);
      saveChatHistory(finalMessages);

    } catch (error) {
      toast.error(t("error_network"));
    } finally {
      setChatLoading(false);
    }
  };

  // 清空聊天历史
  const clearChatHistory = () => {
    setChatMessages([]);
    localStorage.removeItem('ai-chat-history');
    toast.success(t("history_cleared"));
  };

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex-1 overflow-y-auto pr-4">
        <div className="space-y-4">
          {chatMessages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("welcome_message")}</p>
              <p className="text-sm mt-2">{t("welcome_tip")}</p>
            </div>
          ) : (
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          {chatLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <p className="text-sm">{t("thinking")}</p>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2 mt-4">
        <Textarea
          placeholder={t("input_placeholder")}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="flex-1 min-h-[40px] max-h-[100px] resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleChatSend();
            }
          }}
        />
        <Button
          onClick={handleChatSend}
          disabled={chatLoading || !chatInput.trim()}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {chatMessages.length > 0 && (
        <div className="flex justify-center mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChatHistory}
            className="text-xs text-muted-foreground"
          >
            {t("clear_history")}
          </Button>
        </div>
      )}
    </div>
  );
}
