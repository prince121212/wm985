// AI客服知识库
export interface FAQItem {
  keywords: string[];
  question: string;
  answer: string;
  category: string;
}

export interface KnowledgeSection {
  title: string;
  content: string;
}

// 系统功能知识库
export const SYSTEM_KNOWLEDGE: Record<string, KnowledgeSection> = {
  // 用户系统
  register: {
    title: "用户注册",
    content: "用户注册流程：1. 访问注册页面 2. 填写邮箱和密码 3. 验证邮箱 4. 完成注册后获得10积分新用户奖励"
  },
  login: {
    title: "用户登录", 
    content: "登录方式：支持邮箱密码登录，登录token有效期为10年，无需频繁重新登录"
  },
  profile: {
    title: "个人中心",
    content: "个人中心功能包括：个人资料管理、我的上传、我的收藏、我的订单、积分记录、邀请记录、API密钥管理"
  },

  // 积分系统
  credits_earning: {
    title: "积分获取",
    content: "积分获取方式：1. 注册赠送10积分 2. 被邀请注册额外获得5积分 3. 上传优质资源通过审核后获得奖励 4. 管理员手动赠送"
  },
  credits_spending: {
    title: "积分消费",
    content: "积分消费规则：访问付费资源需要消耗相应积分，自己上传的资源访问时积分先扣除再奖励，总量不变"
  },
  credits_types: {
    title: "积分类型",
    content: "积分分为限期积分和永久积分，消费时优先扣除限期积分，奖励积分为永久有效"
  },

  // 资源管理
  upload: {
    title: "资源上传",
    content: "上传流程：1. 选择合适的分类 2. 填写资源信息（标题、描述、链接） 3. 添加相关标签 4. 设置积分价格 5. 提交等待审核"
  },
  categories: {
    title: "分类体系",
    content: "系统包含6大主分类：文学艺术、历史文化、教育学术、科学技术、社会生活、媒体娱乐，每个主分类下有多个子分类"
  },
  approval: {
    title: "审核机制",
    content: "资源审核流程：管理员审核资源内容和链接有效性，审核通过后资源状态变为已审核，用户可以访问和下载"
  },
  search: {
    title: "搜索功能",
    content: "支持按标题、描述、标签搜索资源，可以按分类筛选，支持按时间、评分、访问量排序。如果用户询问特定主题的资源，建议使用搜索功能查找。"
  },
  resource_inquiry: {
    title: "资源内容查询",
    content: "关于具体有哪些资源内容，AI客服无法提供具体资源推荐。建议用户：1. 使用网站搜索功能输入关键词查找 2. 浏览相关分类页面 3. 查看热门资源推荐"
  },

  // 其他功能
  favorites: {
    title: "收藏功能",
    content: "用户可以收藏喜欢的资源，在个人中心查看收藏列表，方便后续访问"
  },
  comments: {
    title: "评论系统",
    content: "用户可以对资源进行评论和评分，支持回复评论，管理员可以删除不当评论"
  },
  invite: {
    title: "邀请系统",
    content: "用户可以邀请新用户注册，被邀请者注册成功后，邀请者和被邀请者都会获得积分奖励"
  }
};

// 常见问题解答
export const FAQ_DATABASE: FAQItem[] = [
  {
    keywords: ["积分", "不够", "余额", "充值", "获取"],
    question: "如何获得更多积分？",
    answer: "您可以通过以下方式获得积分：\n1. 邀请新用户注册（双方都获得奖励）\n2. 上传优质资源等待审核通过\n3. 联系管理员申请积分赠送\n4. 注册时已获得10积分新用户奖励",
    category: "积分系统"
  },
  {
    keywords: ["上传", "失败", "审核", "拒绝", "不通过"],
    question: "资源上传失败或审核不通过怎么办？",
    answer: "资源上传问题可能原因：\n1. 资源链接无效或无法访问\n2. 分类选择不准确\n3. 资源内容不符合平台规范\n4. 标题或描述信息不完整\n请检查以上问题后重新上传",
    category: "资源管理"
  },
  {
    keywords: ["登录", "密码", "忘记", "重置", "账户"],
    question: "忘记密码或无法登录怎么办？",
    answer: "登录问题解决方法：\n1. 使用邮箱重置密码功能\n2. 检查邮箱地址是否正确\n3. 联系管理员协助重置密码\n4. 如果问题持续，可以重新注册账户",
    category: "用户系统"
  },
  {
    keywords: ["访问", "下载", "链接", "打不开", "无法访问"],
    question: "资源无法访问或下载怎么办？",
    answer: "资源访问问题排查：\n1. 确认积分余额是否充足\n2. 检查资源是否已通过审核\n3. 确认网络连接正常\n4. 尝试刷新页面重新访问\n5. 如果问题持续，请联系管理员",
    category: "资源管理"
  },
  {
    keywords: ["分类", "选择", "标签", "添加"],
    question: "如何选择合适的分类和标签？",
    answer: "分类和标签选择建议：\n1. 根据资源内容选择最匹配的主分类和子分类\n2. 添加3-5个相关标签，便于其他用户搜索\n3. 标签应该准确描述资源特点\n4. 可以参考同类资源的分类和标签",
    category: "资源管理"
  },
  {
    keywords: ["邀请", "推荐", "奖励", "链接"],
    question: "如何邀请其他用户注册？",
    answer: "邀请用户步骤：\n1. 在个人中心找到邀请功能\n2. 生成专属邀请链接\n3. 分享链接给朋友\n4. 朋友通过链接注册成功后，双方都获得积分奖励",
    category: "邀请系统"
  },
  {
    keywords: ["管理员", "联系", "客服", "举报", "反馈"],
    question: "如何联系管理员或举报问题？",
    answer: "联系管理员方式：\n1. 使用页面右下角的反馈功能\n2. 在评论区举报不当内容\n3. 通过邮件联系管理员\n4. 在相关页面提交反馈表单",
    category: "其他"
  },
  {
    keywords: ["AI", "客服", "机器人", "自动", "智能"],
    question: "AI客服能帮我做什么？",
    answer: "AI客服可以帮助您：\n1. 解答系统使用相关问题\n2. 提供操作指导和建议\n3. 解释积分系统和功能说明\n4. 协助解决常见问题\n如果AI无法解决您的问题，请使用反馈功能联系人工客服",
    category: "其他"
  },
  {
    keywords: ["收藏", "喜欢", "保存", "书签"],
    question: "如何收藏喜欢的资源？",
    answer: "收藏资源的方法：\n1. 在资源详情页点击收藏按钮\n2. 收藏的资源会保存到个人中心\n3. 在'我的收藏'页面可以查看所有收藏\n4. 可以随时取消收藏",
    category: "资源管理"
  },
  {
    keywords: ["资源", "内容", "有哪些", "推荐", "数字", "数学", "编程", "技术", "学习", "教程", "课程", "书籍", "视频", "什么资源"],
    question: "系统里有哪些资源内容？",
    answer: "关于具体的资源内容，我建议您：\n1. 使用网站顶部的搜索功能，输入您感兴趣的关键词\n2. 浏览左侧的分类菜单，查看不同类别的资源\n3. 查看首页的热门资源推荐\n4. 访问资源列表页面浏览所有资源\n\nAI客服主要帮助解答系统使用问题，无法提供具体的资源推荐 😊",
    category: "资源管理"
  }
];

// 判断是否为资源查询
function isResourceInquiry(query: string): boolean {
  const queryLower = query.toLowerCase();

  // 基础资源相关词汇
  const resourceKeywords = ['资源', '内容', '有哪些', '推荐', '什么资源'];
  const hasResourceKeyword = resourceKeywords.some(keyword => queryLower.includes(keyword));

  // 学科相关词汇
  const subjectKeywords = ['课程', '教程', '数学', '编程', '技术', '学习', '书籍', '视频', '数字'];
  const hasSubjectKeyword = subjectKeywords.some(keyword => queryLower.includes(keyword));

  // 查询模式匹配
  const queryPatterns = [
    queryLower.includes('什么') && hasSubjectKeyword,
    queryLower.includes('有') && queryLower.includes('吗'),
    queryLower.includes('推荐') && hasSubjectKeyword
  ];

  return hasResourceKeyword || queryPatterns.some(pattern => pattern);
}

// 关键词匹配函数
export function searchKnowledge(query: string): { faqs: FAQItem[], knowledge: KnowledgeSection[] } {
  const queryLower = query.toLowerCase();

  // 搜索FAQ - 改进匹配逻辑
  const matchedFAQs = FAQ_DATABASE.filter(faq => {
    // 检查关键词匹配
    const keywordMatch = faq.keywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
    // 检查问题和答案匹配
    const contentMatch = faq.question.toLowerCase().includes(queryLower) ||
                        faq.answer.toLowerCase().includes(queryLower);

    // 特殊处理：如果是资源查询，优先匹配资源查询FAQ
    if (isResourceInquiry(query) && faq.question.includes('系统里有哪些资源内容')) {
      return true;
    }

    return keywordMatch || contentMatch;
  });

  // 搜索系统知识
  const matchedKnowledge = Object.values(SYSTEM_KNOWLEDGE).filter(section =>
    section.title.toLowerCase().includes(queryLower) ||
    section.content.toLowerCase().includes(queryLower)
  );

  return {
    faqs: matchedFAQs.slice(0, 3), // 最多返回3个FAQ
    knowledge: matchedKnowledge.slice(0, 2) // 最多返回2个知识点
  };
}

// 上下文接口定义
export interface ChatContext {
  previousMessages?: Array<{
    type: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

// 构建AI提示词 - 优化版本
export function buildAIPrompt(userMessage: string, context?: ChatContext): string {
  const { faqs, knowledge } = searchKnowledge(userMessage);
  
  let prompt = `你是文明知识库的专业AI客服助手。

【重要指令】请严格按照以下知识库信息回答用户问题，禁止使用知识库之外的任何信息。

【用户问题】${userMessage}

【知识库内容】
`;

  if (knowledge.length > 0) {
    prompt += "\n【系统功能说明】\n";
    knowledge.forEach(item => {
      prompt += `- ${item.title}：${item.content}\n`;
    });
  }

  if (faqs.length > 0) {
    prompt += "\n【常见问题解答】\n";
    faqs.forEach(faq => {
      prompt += `问：${faq.question}\n答：${faq.answer}\n\n`;
    });
  }

  if (knowledge.length === 0 && faqs.length === 0) {
    prompt += "\n【提示】没有找到相关的知识库信息。\n";
  }

  prompt += `

【严格要求】
1. 只能使用上述知识库内容回答问题
2. 如果知识库有相关信息，必须完整引用并详细回答
3. 特别注意：如果用户询问具体资源内容（如"有哪些数学资源"、"推荐什么课程"等），要引导用户使用搜索功能，不要说没有相关信息
4. 如果知识库完全没有相关信息，才回答："抱歉，我的知识库中暂时没有这个问题的答案，建议您通过反馈功能联系人工客服获得帮助 😊"
5. 禁止编造任何信息
6. 使用友好专业的语气
7. 回答要条理清晰，使用换行和编号

【特殊处理】
- 资源内容查询：引导用户使用搜索功能或浏览分类
- 系统功能问题：基于知识库详细回答
- 操作指导问题：提供具体步骤

现在请严格按照要求回答：`;

  return prompt;
}
