# 文章评估智能体 Demo v1.2

## 版本说明

**v1.2 P0优化版** - 决策优先级判断 + 优化卡片呈现

### 核心优化
- ✅ 决策优先级判断（高/中/低）
- ✅ 相关性评估
- ✅ 紧迫性判断
- ✅ 可行动的具体建议
- ✅ 优化卡片呈现（核心信息前置）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 AI API Key
```

### 3. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

### 4. 访问应用

浏览器打开：http://localhost:3000

## 功能特性

- 🔗 **输入方式**：支持粘贴链接或粘贴内容
- 🤖 **智能路由**：LLM语义理解路由，准确率85-95%
- 📊 **专业评估**：SaaS行业深度分析
- 🎯 **决策支持**：优先级判断 + 可行动建议
- 💡 **认知盲区**：识别文章的认知偏差

## 项目结构

```
article-evaluator-demo/
├── src/
│   ├── server.js              # 服务器入口
│   ├── routes/                # 路由模块
│   │   ├── evaluate.js        # 评估接口
│   │   └── admin.js           # 管理后台接口
│   ├── services/              # 服务模块
│   │   ├── articleParser.js   # 文章解析
│   │   ├── industryRouter.js  # 行业路由
│   │   ├── saasAnalyzer.js    # SaaS解析器
│   │   ├── generalAnalyzer.js # 通用解析器
│   │   ├── coordinator.js     # 解析器协调
│   │   ├── comprehensiveResearchGenerator.js # 研究报告生成器
│   │   └── industryBenchmarkGenerator.js # 基准生成器
│   └── prompts/               # 提示词
│       ├── saasPrompt.v1.2.js    # SaaS提示词 v1.2
│       └── generalPrompt.v1.2.js # 通用提示词 v1.2
├── public/
│   ├── demo.html             # 主界面 v1.2
│   └── admin.html            # 管理后台
├── cache/
│   ├── industry_benchmarks/  # 行业基准数据
│   └── industry_reports/     # 行业研究报告
├── package.json
├── .env.example
├── PROJECT_HISTORY.md       # 项目开发历史
└── README.md
```

## 技术栈

- **后端**: Node.js + Express
- **前端**: HTML + CSS + JavaScript（原生）
- **AI服务**: OpenAI API / 通义千问 / 文心一言
- **文章解析**: Mozilla Readability + Puppeteer
- **数据源**: Tavily搜索API

## API接口

### POST /api/evaluate
评估文章内容

**请求**:
```json
{
  "type": "url" | "content",
  "data": "文章链接或内容"
}
```

**响应**:
```json
{
  "success": true,
  "evaluation": {
    "judgment": "认同",
    "relevance": "高",
    "urgency": "是",
    "urgency_reason": "...",
    "input_diagnosis": "...",
    "macro_benchmark": "...",
    "blind_spot_alert": "...",
    "strategic_actions": [
      {
        "priority": "高",
        "action": "...",
        "timeline": "...",
        "reason": "..."
      }
    ],
    "summary": "..."
  }
}
```

### 管理后台接口
- GET /api/admin/benchmarks - 获取基准列表
- GET /api/admin/benchmarks/:filename - 获取基准详情
- POST /api/admin/benchmarks/regenerate - 重新生成基准
- DELETE /api/admin/benchmarks/:filename - 删除基准

## 测试验证

### 准备测试文章

收集5-10篇SaaS相关文章，覆盖：
- 公司级分析（2-3篇）
- 行业级分析（2-3篇）
- 观点性文章（2-3篇）

### 验收标准

| 维度 | 指标 | 通过标准 |
|-----|------|---------|
| **功能完整性** | 输入输出 | ✅ 支持链接和内容输入<br>✅ 生成完整评估 |
| **优先级判断** | 决策支持 | ✅ 每条建议标注优先级<br>✅ 优先级判断合理 |
| **卡片呈现** | 用户体验 | ✅ 核心信息前置<br>✅ 可折叠区域正常 |
| **内容质量** | 评估准确性 | ✅ 事实判断准确<br>✅ 盲区指出有价值 |

## 常见问题

### Q: 大模型API调用失败？
A: 检查API Key是否正确，网络是否畅通

### Q: 文章解析失败？
A: 使用"粘贴内容"方式作为备选

### Q: 评估质量不理想？
A: 优化提示词工程，调整输出格式

## 后续优化

基于MVP反馈，可能的优化方向：
- 情境输入模块（用户填写公司信息）
- 团队对齐模式（生成讨论引导）
- 对比评估功能（多篇文章对比）
- 待办清单功能（一键添加行动建议）
- 批量更新基准功能
- 版本历史对比

## 版本历史

- **v1.3** (2026-03-13) - 管理后台优化：行业研究报告 + 重新生成功能
- **v1.2** (2026-03-04) - P0优化版：决策优先级判断 + 优化卡片呈现
- **v1.1** (2026-03-04) - LLM智能路由
- **v1.0** (2026-03-04) - 初始版本

## 联系方式

如有问题，请联系项目负责人。
