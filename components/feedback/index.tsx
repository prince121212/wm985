"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bot, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import Icon from "@/components/icon";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/app";
import { useState } from "react";
import { SocialItem } from "@/types/blocks/base";
import { useTranslations } from "next-intl";
import AIChat from "@/components/ai-chat";

export default function Feedback({
  socialLinks,
}: {
  socialLinks?: SocialItem[];
}) {
  const t = useTranslations("feedback");
  const tChat = useTranslations("ai_chat");

  const { user, setShowSignModal, showFeedback, setShowFeedback } =
    useAppContext();

  // 模式切换：'feedback' | 'chat' - 默认显示AI客服
  const [mode, setMode] = useState<'feedback' | 'chat'>('chat');

  // 反馈相关状态
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState<number | null>(10);
  const [loading, setLoading] = useState<boolean>(false);

  // 提交反馈
  const handleSubmit = async () => {
    if (!user) {
      setShowSignModal(true);
      return;
    }

    if (!feedback.trim()) {
      toast.error(t("error_empty"));
      return;
    }

    if (feedback.trim().length > 1000) {
      toast.error(t("error_too_long"));
      return;
    }

    try {
      setLoading(true);

      const req = {
        content: feedback,
        rating: rating,
      };

      const resp = await fetch("/api/add-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req),
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

      toast.success(t("success"));

      setFeedback("");
      setRating(10);
      setShowFeedback(false);
    } catch (error) {
      toast.error(t("error_network"));
    } finally {
      setLoading(false);
    }
  };



  const ratings = [
    { emoji: "😞", value: 1 },
    { emoji: "😐", value: 5 },
    { emoji: "😊", value: 10 },
  ];

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogTrigger asChild>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            onClick={() => setShowFeedback(true)}
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] max-h-[600px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold">
                  {mode === 'feedback' ? t("title") : tChat("title")}
                </DialogTitle>
                <DialogDescription className="text-base">
                  {mode === 'feedback' ? t("description") : tChat("description")}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={mode === 'chat' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('chat')}
                  className="flex items-center gap-1"
                >
                  <Bot className="h-4 w-4" />
                  {tChat("mode_chat")}
                </Button>
                <Button
                  variant={mode === 'feedback' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('feedback')}
                  className="flex items-center gap-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t("title")}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {mode === 'feedback' ? (
            // 反馈模式
            <>
              <div className="mt-2">
                <Textarea
                  placeholder={t("placeholder")}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-[150px] text-base resize-none"
                />
              </div>

              <div className="mt-4 flex flex-col items-start gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("rating_tip")}
                </p>
                <div className="flex flex-row gap-2">
                  {ratings.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setRating(item.value)}
                      className={`p-2 text-2xl rounded-lg hover:bg-secondary transition-colors ${
                        rating === item.value ? "bg-secondary" : ""
                      }`}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            // AI聊天模式
            <AIChat
              onRequireLogin={() => setShowSignModal(true)}
              isLoggedIn={!!user}
            />
          )}

          {mode === 'feedback' && (
            <div className="mt-6 flex justify-start items-center gap-4">
              {socialLinks && socialLinks.length > 0 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t("contact_tip")}
                  </p>
                  <div className="flex gap-4">
                    {socialLinks?.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title={link.title}
                      >
                        <Icon name={link.icon || ""} className="text-xl" />
                      </a>
                    ))}
                  </div>
                </>
              )}
              <div className="flex-1"></div>
              <div className="flex gap-3">
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? t("loading") : t("submit")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
