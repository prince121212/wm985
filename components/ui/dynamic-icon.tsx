import {
  FileText,
  Code,
  Palette,
  Database,
  Cloud,
  Heart,
  Star,
  Check,
  ChevronDown,
  ArrowRight,
  Music,
  Video,
  Image,
  BookOpen,
  Layout,
  Folder,
  Package,
  Smartphone,
  Server,
  Brain
} from "lucide-react";

// 创建图标映射表
const iconMap = {
  // 基础图标
  'FileText': FileText,
  'Code': Code,
  'Palette': Palette,
  'Database': Database,
  'Cloud': Cloud,
  'Heart': Heart,
  'Star': Star,
  'Check': Check,
  'ChevronDown': ChevronDown,
  'ArrowRight': ArrowRight,
  'Music': Music,
  'Video': Video,
  'Image': Image,
  'BookOpen': BookOpen,
  'Layout': Layout,
  'Folder': Folder,
  'Package': Package,
  'Smartphone': Smartphone,
  'Server': Server,
  'Brain': Brain,
};

interface DynamicIconProps {
  name?: string;
  className?: string;
}

/**
 * 动态图标组件 - 根据图标名称渲染对应的Lucide图标
 * @param name - Lucide图标名称（支持PascalCase如'FileText'或kebab-case如'file-text'）
 * @param className - CSS类名
 */
export function DynamicIcon({
  name,
  className
}: DynamicIconProps) {
  // 如果没有图标名称，使用默认图标
  if (!name) {
    return <FileText className={className} />;
  }

  // 处理图标名称格式
  let iconName: string;

  // 如果包含连字符，说明是kebab-case，需要转换为PascalCase
  if (name.includes('-')) {
    iconName = name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  } else {
    // 如果不包含连字符，假设已经是PascalCase格式
    iconName = name.charAt(0).toUpperCase() + name.slice(1);
  }

  // 获取对应的图标组件
  const IconComponent = iconMap[iconName as keyof typeof iconMap];

  // 如果找不到图标，使用默认图标
  if (!IconComponent) {
    return <FileText className={className} />;
  }

  return <IconComponent className={className} />;
}

/**
 * 验证图标名称是否有效
 */
export function isValidIconName(name: string): boolean {
  if (!name) return false;

  // 处理图标名称格式
  let iconName: string;

  if (name.includes('-')) {
    iconName = name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  } else {
    iconName = name.charAt(0).toUpperCase() + name.slice(1);
  }

  return iconName in iconMap;
}
