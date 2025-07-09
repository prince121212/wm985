// 文本解析工具库
// 支持多种文本格式的资源信息解析

export interface ParsedResource {
  name: string;
  link: string;
}

export interface ParseResult {
  resources: ParsedResource[];
  errors: string[];
  stats: {
    total: number;
    success: number;
    failed: number;
    method: 'regex' | 'ai';
  };
}

// 清理资源名称
export function cleanResourceName(name: string): string {
  return name
    // 移除开头的emoji
    .replace(/^[🌿🔮🌌🎸💰📚🎯🔥⭐️✨🎨🎵🎬📖💡🚀🎪🎭🎨🎮🎲🎯🎪🎭🎨🎵🎬📖💡🚀🌟⚡️🔥💎🎊🎉🎈🎁🎀🎗️🏆🥇🥈🥉🏅🎖️🏵️🎗️🎫🎟️🎪🎭🎨🎬🎤🎧🎼🎵🎶🎹🥁🎷🎺🎸🎻🪕🎲🎯🎳🎮🕹️🎰🎱🃏🀄️🎴🎨🖌️🖍️🖊️🖋️✏️📝📄📃📑📊📈📉📋📌📍📎🖇️📏📐✂️🗃️🗄️🗑️🔒🔓🔏🔐🔑🗝️🔨⛏️⚒️🛠️🗡️⚔️🔫🏹🛡️🔧🔩⚙️🗜️⚖️🔗⛓️🧰🧲⚗️🧪🧫🧬🔬🔭📡💉💊🩹🩺🚪🛏️🛋️🚽🚿🛁🧴🧷🧹🧺🧻🧼🧽🧯🛒🚬⚰️⚱️🗿🏺🔮📿🧿🪬💎💍💄💋👑🎩🧢👒🎓⛑️📿💼👜👝🛍️🎒👕👔👗👘👙👚👛👜👝🛍️🎒🧳👓🕶️🥽🥼🦺👔👕👖🧣🧤🧥🧦👗👘🥻🩱🩲🩳👙👚👛👜👝🛍️🎒🧳👞👟🥾🥿👠👡🩰👢👑💍💎💄💋🔥⭐️✨🌟💫⚡️💥💢💨💦💧💤💨🗨️💬🗯️💭🕳️👁️‍🗨️🧠🫀🫁🦷🦴👀👁️👄👅👃👂🦻🦶🦵💪🦾🦿👶🧒👦👧🧑👨👩🧓👴👵🙍🙎🙅🙆💁🙋🧏🙇🤦🤷👮🕵️💂🥷👷🤴👸👳👲🧕🤵👰🤰🤱👼🎅🤶🦸🦹🧙🧚🧛🧜🧝🧞🧟🧌👯💃🕺👫👬👭💏💑👪👨‍👩‍👧👨‍👩‍👧‍👦👨‍👩‍👦‍👦👨‍👩‍👧‍👧👨‍👦👨‍👦‍👦👨‍👧👨‍👧‍👦👨‍👧‍👧👩‍👦👩‍👦‍👦👩‍👧👩‍👧‍👦👩‍👧‍👧🗣️👤👥🫂👣🦰🦱🦳🦲]+\s*/, '')
    // 移除所有emoji和特殊符号（更全面的清理）
    .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\uD800-\uDFFF]/gu, '')
    // 移除换行符和制表符
    .replace(/[\r\n\t]/g, ' ')
    // 移除多余空格
    .replace(/\s+/g, ' ')
    // 移除首尾空格
    .trim()
    // 移除可能导致JSON问题的特殊字符
    .replace(/["\\\b\f\n\r\t]/g, '')
    // 限制长度
    .substring(0, 100);
}

// 验证URL格式
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return /^https?:\/\//.test(url);
  } catch {
    return false;
  }
}

// 清理URL
export function cleanUrl(url: string): string {
  // 移除首尾空格
  url = url.trim();
  
  // 如果没有协议，自动添加https://
  if (!/^https?:\/\//.test(url) && url.length > 0) {
    url = 'https://' + url;
  }
  
  return url;
}

// 正则表达式解析模式（按优先级排序）
const parsePatterns = [
  // 格式1: 标题 链接：URL（同一行，最具体）
  {
    pattern: /^(.+?)\s*链接[：:]\s*(https?:\/\/\S+)/gm,
    description: '内联格式：标题 链接：URL'
  },

  // 格式2: 标题\n链接：URL（跨行，具体）
  {
    pattern: /^(.+?)\s*\n\s*链接[：:]\s*(https?:\/\/\S+)/gm,
    description: '标准格式：标题 + 链接：URL'
  },

  // 格式3: 标题 - URL（破折号分隔）
  {
    pattern: /^(.+?)\s*[-–—]\s*(https?:\/\/\S+)/gm,
    description: '破折号格式：标题 - URL'
  },

  // 格式4: 标题 URL（空格分隔，同一行）
  {
    pattern: /^(.+?)\s+(https?:\/\/\S+)$/gm,
    description: '空格分隔格式：标题 URL'
  },

  // 格式5: 标题\nURL（最宽泛，放最后）
  {
    pattern: /^(.+?)\s*\n\s*(https?:\/\/\S+)/gm,
    description: '简化格式：标题 + URL（下一行）'
  }
];

// 使用正则表达式解析文本
export function parseTextWithRegex(text: string): ParseResult {
  const resources: ParsedResource[] = [];
  const errors: string[] = [];
  const processedLines = new Set<string>();

  // 预处理文本：标准化换行符
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 尝试每种解析模式
  for (const { pattern, description } of parsePatterns) {
    const matches = Array.from(text.matchAll(pattern));
    
    for (const match of matches) {
      const fullMatch = match[0];
      
      // 避免重复处理同一行
      if (processedLines.has(fullMatch)) {
        continue;
      }
      
      const rawName = match[1]?.trim();
      const rawUrl = match[2]?.trim();
      
      if (!rawName || !rawUrl) {
        continue;
      }
      
      // 清理数据
      const cleanedName = cleanResourceName(rawName);
      const cleanedUrl = cleanUrl(rawUrl);
      
      // 验证数据
      if (!cleanedName) {
        errors.push(`资源名称为空：${rawName}`);
        continue;
      }
      
      if (!isValidUrl(cleanedUrl)) {
        errors.push(`无效的URL格式：${rawUrl}`);
        continue;
      }
      
      // 检查是否已存在相同的资源
      const isDuplicate = resources.some(r => 
        r.name === cleanedName || r.link === cleanedUrl
      );
      
      if (!isDuplicate) {
        resources.push({
          name: cleanedName,
          link: cleanedUrl
        });
        
        processedLines.add(fullMatch);
      }
    }
  }

  return {
    resources,
    errors,
    stats: {
      total: resources.length + errors.length,
      success: resources.length,
      failed: errors.length,
      method: 'regex'
    }
  };
}

// 从文本中提取所有URL（用于AI解析的辅助功能）
export function extractUrlsFromText(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)]; // 去重
}

// 从文本中移除URL（用于提取纯文本标题）
export function removeUrlsFromText(text: string): string {
  return text.replace(/(https?:\/\/[^\s]+)/g, '').trim();
}

// 分割文本为资源块（用于AI解析的预处理）
export function splitTextIntoResourceBlocks(text: string): string[] {
  // 按空行分割
  const blocks = text.split(/\n\s*\n/).filter(block => block.trim());
  
  // 如果没有空行分割，尝试按URL分割
  if (blocks.length === 1) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    const resourceBlocks: string[] = [];
    
    for (let i = 0; i < parts.length - 1; i += 2) {
      const title = parts[i]?.trim();
      const url = parts[i + 1]?.trim();
      
      if (title && url && /^https?:\/\//.test(url)) {
        resourceBlocks.push(`${title}\n${url}`);
      }
    }
    
    return resourceBlocks.length > 0 ? resourceBlocks : blocks;
  }
  
  return blocks;
}
