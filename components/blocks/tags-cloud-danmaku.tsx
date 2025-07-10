"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tag } from '@/types/resource';

// 弹幕配置
const DANMAKU_CONFIG = {
  containerHeight: 500,
  lanes: 8, // 弹幕轨道数量
  speed: {
    min: 40, // 最小速度 (px/s) - 稍微提高基础速度
    max: 100, // 最大速度 (px/s) - 提高最大速度
  },
  fontSize: {
    min: 14,
    max: 28,
  },
  spacing: 120, // 弹幕间距 - 减少间距让弹幕更密集
  maxFPS: 60, // 最大帧率
  updateInterval: 16, // 更新间隔 (ms) - 约60fps
};

// 标签颜色配置
const TAG_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
];

// 弹幕项数据类型
interface DanmakuItem {
  id: string;
  tag: Tag;
  x: number;
  y: number;
  speed: number;
  fontSize: number;
  color: string;
  lane: number;
  width: number;
  opacity: number;
}

// 计算文字宽度（近似）
function getTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6 + 20; // 近似计算，包含padding
}

// 生成弹幕数据
function generateDanmakuItems(tags: Tag[]): DanmakuItem[] {
  const maxUsage = Math.max(...tags.map(tag => tag.usage_count || 0));
  const laneHeight = DANMAKU_CONFIG.containerHeight / DANMAKU_CONFIG.lanes;

  return tags.map((tag, index) => {
    const usageRatio = (tag.usage_count || 0) / Math.max(maxUsage, 1);

    // 重要的标签字体更大，速度更慢（停留时间更长）
    const fontSize = DANMAKU_CONFIG.fontSize.min +
      (DANMAKU_CONFIG.fontSize.max - DANMAKU_CONFIG.fontSize.min) * usageRatio;

    const speed = DANMAKU_CONFIG.speed.max -
      (DANMAKU_CONFIG.speed.max - DANMAKU_CONFIG.speed.min) * usageRatio;

    const displayText = tag.name.length > 12 ? `${tag.name.substring(0, 12)}...` : tag.name;
    const usageText = tag.usage_count ? ` (${tag.usage_count})` : '';
    const fullText = displayText + usageText;

    const width = getTextWidth(fullText, fontSize);
    const lane = index % DANMAKU_CONFIG.lanes;
    const y = lane * laneHeight + laneHeight / 2;

    // 错开初始位置，避免同时出现
    const initialDelay = (index * DANMAKU_CONFIG.spacing) / speed;
    const x = -width - initialDelay * speed; // 从左侧开始（负位置）

    return {
      id: `danmaku-${tag.id || index}`,
      tag,
      x,
      y,
      speed,
      fontSize,
      color: TAG_COLORS[index % TAG_COLORS.length],
      lane,
      width,
      opacity: Math.max(0.7, usageRatio),
    };
  });
}

// 单个弹幕组件
interface DanmakuItemComponentProps {
  item: DanmakuItem;
  onTagClick: (tag: Tag) => void;
  isPaused: boolean;
  speedRef: React.MutableRefObject<number>;
  containerWidth: number;
}

function DanmakuItemComponent({ item, onTagClick, isPaused, speedRef, containerWidth }: DanmakuItemComponentProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(item.x);
  const [hovered, setHovered] = useState(false);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const displayText = item.tag.name.length > 12
    ? `${item.tag.name.substring(0, 12)}...`
    : item.tag.name;
  const usageText = item.tag.usage_count ? ` (${item.tag.usage_count})` : '';

  // 使用 useCallback 优化动画函数
  const animate = React.useCallback((currentTime: number) => {
    if (!elementRef.current) return;

    if (lastTimeRef.current === 0) {
      lastTimeRef.current = currentTime;
    }

    const deltaTime = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;

    // 只在非暂停状态下移动，悬停时完全停止
    if (!isPaused && deltaTime < 0.1) { // 防止大的时间跳跃
      if (!hovered) {
        // 使用固定的1.3倍速
        const speed = item.speed * speedRef.current;
        positionRef.current += speed * deltaTime; // 改为向右移动（+）

        // 如果完全移出屏幕，重新开始
        if (positionRef.current > containerWidth) {
          positionRef.current = -item.width - Math.random() * 100;
        }

        // 直接操作DOM，避免React重渲染
        elementRef.current.style.transform = `translateX(${positionRef.current}px) scale(1)`;
      } else {
        // 悬停时保持位置不变，但应用缩放
        elementRef.current.style.transform = `translateX(${positionRef.current}px) scale(1.2)`;
      }
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [item.speed, item.width, hovered, isPaused, containerWidth, speedRef]);

  useEffect(() => {
    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  return (
    <div
      ref={elementRef}
      className="absolute cursor-pointer select-none whitespace-nowrap will-change-transform"
      style={{
        left: 0, // 使用transform代替left定位
        top: item.y - item.fontSize / 2,
        fontSize: `${item.fontSize}px`,
        color: item.color,
        opacity: hovered ? 1 : item.opacity,
        transform: `translateX(${item.x}px) scale(1)`, // 初始状态，动画中会被覆盖
        zIndex: hovered ? 10 : 1,
        textShadow: hovered
          ? '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)'
          : '1px 1px 2px rgba(0,0,0,0.5)',
        fontWeight: hovered ? 'bold' : 'normal',
        transition: 'opacity 0.3s ease, text-shadow 0.3s ease, font-weight 0.3s ease, z-index 0s', // 移除transform的transition
        transformOrigin: 'center center', // 确保缩放从中心开始
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onTagClick(item.tag)}
    >
      <span
        className="inline-block px-2 py-1 rounded-md transition-all duration-300 ease-out"
        style={{
          backgroundColor: hovered ? `${item.color}18` : 'transparent',
          border: hovered ? `1px solid ${item.color}35` : '1px solid transparent',
          backdropFilter: hovered ? 'blur(6px)' : 'none',
          boxShadow: hovered ? `0 4px 12px ${item.color}25` : 'none',
        }}
      >
        <span className="font-medium">{displayText}</span>
        {usageText && (
          <span className="text-xs opacity-80">{usageText}</span>
        )}
      </span>
    </div>
  );
}



// 主要的弹幕标签云组件
interface TagsCloudDanmakuProps {
  tags: Tag[];
  className?: string;
}

export default function TagsCloudDanmaku({ tags, className = "" }: TagsCloudDanmakuProps) {
  const [mounted, setMounted] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1000);
  const containerRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(1.3); // 固定1.3倍速

  const isPlaying = true; // 始终播放

  // 确保组件在客户端正确挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 监听容器宽度变化，动态调整弹幕宽度
  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const updateContainerWidth = () => {
      if (containerRef.current) {
        const parentWidth = containerRef.current.parentElement?.offsetWidth || 1000;
        setContainerWidth(parentWidth);
      }
    };

    // 初始设置
    updateContainerWidth();

    // 监听窗口大小变化
    window.addEventListener('resize', updateContainerWidth);

    // 使用 ResizeObserver 监听父元素大小变化
    const resizeObserver = new ResizeObserver(updateContainerWidth);
    if (containerRef.current.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    return () => {
      window.removeEventListener('resize', updateContainerWidth);
      resizeObserver.disconnect();
    };
  }, [mounted]);

  // 生成弹幕数据 - 使用 useMemo 缓存
  const memoizedItems = useMemo(() => {
    if (!mounted) return [];
    return generateDanmakuItems(tags);
  }, [tags, mounted]);

  const handleTagClick = (tag: Tag) => {
    window.open(`/resources?tags=${encodeURIComponent(tag.name)}`, '_blank');
  };

  if (!mounted) {
    return (
      <div className={`flex items-center justify-center h-96 text-muted-foreground ${className}`}>
        正在加载弹幕标签云...
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 text-muted-foreground ${className}`}>
        暂无标签数据
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        style={{
          height: DANMAKU_CONFIG.containerHeight,
          transform: 'translateZ(0)', // 启用硬件加速
          backfaceVisibility: 'hidden', // 优化渲染
          perspective: '1000px', // 3D渲染上下文
        }}
      >
        {/* 弹幕项 */}
        {memoizedItems.map((item) => (
          <DanmakuItemComponent
            key={item.id}
            item={item}
            onTagClick={handleTagClick}
            isPaused={!isPlaying}
            speedRef={speedRef}
            containerWidth={containerWidth}
          />
        ))}
      </div>
    </div>
  );
}
