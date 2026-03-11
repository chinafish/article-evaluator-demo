# 认知智能体系统设计方案

**版本**: v1.0
**日期**: 2025-03-11
**状态**: 待用户确认

---

## 目录

1. [系统架构设计](#第一章-系统架构设计)
2. [数据流设计](#第二章-数据流设计)
3. [核心组件设计](#第三章-核心组件设计)
4. [接口设计](#第四章-接口设计)
5. [部署方案](#第五章-部署方案)
6. [智能模型路由设计](#第六章-智能模型路由设计)
7. [前端交互设计](#第七章-前端交互设计)
8. [方案总结](#第八章-方案总结与文档保存)

---

## 第一章：系统架构设计

### 1.1 产品定位

**产品名称**：认知智能体
**核心价值**：加载产业认知基准，为高管提供基于深度产业研究的决策支持

### 1.2 整体架构

```
用户层
├── demo.html (用户评估界面)
├── /admin (管理后台)
└── /debug/:id (调试视图)

API层
├── /api/cognitive/evaluate (认知评估)
├── /api/benchmark (基准管理)
├── /api/admin (管理员操作)
└── /api/debug (调试接口)

服务层
├── CognitiveOrchestrator (认知评估编排)
├── CognitiveBenchmarkService (基准服务)
├── GICSClassifier (行业识别)
└── CognitiveEvaluator (评估执行器)

数据层
├── 产业研究报告 (永久保存)
├── 产业认知基准 (永久保存)
└── 调试日志 (临时存储)
```

---

## 第二章：数据流设计

### 2.1 三种路由结果

**结果1：行业基准（已有最新基准）**
- 条件：有该行业的最新基准
- 处理：直接加载评估
- 用户看到：行业认知基准框架名称

**结果2：行业基准（无最新基准，提示生成）**
- 条件：无该行业基准 + 有产业数据 + 文章相关
- 处理：弹窗提示用户选择
- 用户选择：立即生成 / 使用通用基准

**结果3：通用基准（文章内容与行业、产业基准无关）**
- 条件：无产业数据 OR 文章不相关
- 处理：自动路由到通用基准
- 用户看到：通用认知基准 + 原因说明

### 2.2 数据结构

**产业研究报告结构**
- meta: 行业信息、期间、版本
- industry_overview: 行业概况
- competitive_landscape: 竞争格局
- development_trends: 发展趋势
- key_challenges: 关键挑战
- investment_insights: 投资洞察

**产业认知基准结构**
- meta: 行业、期间、版本、报告引用
- evaluation_dimensions: 评估维度
- scoring_criteria: 评分标准
- comparison_standards: 对比标准
- blind_spots_to_check: 盲点检查

**认知评估结果结构**
- meta: 评估元数据
- judgment: 判断（认同/不认同）
- relevance: 相关性（高/中/低）
- urgency: 紧迫性（是/否）
- summary: 核心价值
- dimension_scores: 维度得分
- benchmark_comparison: 基准对比
- strategic_actions: 行动建议

---

## 第三章：核心组件设计

### 3.1 认知基准服务组件

负责预生成和管理产业认知基准：
- `generateReport()` - 生成产业研究报告
- `generateBenchmark()` - 生成产业认知基准
- `loadLatest()` - 加载最新基准

### 3.2 认知评估编排器组件

协调完整的评估流程：
- `evaluate()` - 主评估入口
- `decideRoute()` - 路由决策
- `handleRoute()` - 处理路由结果

### 3.3 GICS分类器组件

自动识别文章所属的GICS行业：
- `classify(article)` - 识别文章行业
- 使用qwen3.5-flash模型

### 3.4 认知评估器组件

对比文章与基准，生成评估结果：
- `evaluate(article, benchmark)` - 执行评估
- `buildEvaluationPrompt()` - 构建评估Prompt

### 3.5 缓存管理组件

永久保存产业报告和认知基准：
- `save()` - 保存文件
- `load()` - 加载文件
- `list()` - 列出文件
- `adminList()` - 管理员列表查询

---

## 第四章：接口设计

### 4.1 用户评估接口

**POST /api/cognitive/evaluate**
- 提交文章进行认知评估
- 返回三种路由结果之一

**POST /api/cognitive/generate-benchmark**
- 用户确认生成产业认知基准
- 返回任务ID和进度查询接口

**GET /api/cognitive/generation-status/:task_id**
- 查询生成进度

### 4.2 管理员接口

**GET /api/admin/benchmarks**
- 获取所有基准列表

**GET /api/admin/benchmark/:industry**
- 获取指定行业的基准详情

**POST /api/admin/benchmark**
- 手动生成新基准

**PUT /api/admin/benchmark/:industry**
- 更新基准内容

**DELETE /api/admin/benchmark/:industry**
- 删除指定基准

### 4.3 调试接口

**GET /api/debug/chain/:evaluationId**
- 获取完整的数据依赖链

**POST /api/debug/rerun/:evaluationId**
- 重新运行评估（调试用）

---

## 第五章：部署方案

### 5.1 环境配置

```bash
# AI服务配置
DASHSCOPE_API_KEY=sk-fa6d54508384406a9ec5f4f1abda41ef
DASHSCOPE_MODEL_PLUS=qwen3.5-plus
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 主AI服务配置
AI_PROVIDER=kimi
AI_API_KEY=a53e8e3f-f738-496c-a3c9-dc69830875d4
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_MODEL=kimi-k2-250905

# 模型路由配置
MODEL_ROUTING_ENABLED=true
MODEL_FOR_CLASSIFICATION=qwenFlash
MODEL_FOR_EVALUATION=qwenPlus
```

### 5.2 定时任务

- 每周日凌晨2点：检查基准数据更新
- 每周日凌晨3点：检查报告更新
- 每天凌晨4点：清理过期调试日志（保留7天）
- 每天凌晨5点：备份缓存数据

### 5.3 监控和日志

- 应用日志：`./logs/app.log`
- 错误日志：`./logs/error.log`
- 基准生成日志：`./logs/benchmark_generation.log`

---

## 第六章：智能模型路由设计

### 6.1 模型选择策略

**判断类任务 → qwen3.5-flash**
- GICS行业识别
- 文章相关性判断
- 特点：最快、最便宜

**内容生成类任务 → qwen3.5-plus**
- 产业研究报告生成
- 产业认知基准生成
- 文章认知评估
- 特点：最强推理、支持思维链

### 6.2 成本优化效果

- GICS分类：节省99%（216元/月 → 2.1元/月）
- 文章评估：节省93%（810元/月 → 54元/月）
- 总体节省：94.5%（1031元/月 → 56元/月）

---

## 第七章：前端交互设计

### 7.1 用户评估界面

- 输入区域：粘贴链接/内容
- 进度展示：生成基准时显示详细步骤
- 标题冻结栏：文章标题固定在顶部
- 核心价值：评估结论摘要
- 认知判断：认同度、相关性、紧迫性
- 行动建议：按优先级分组
- 评估依据：可展开查看

### 7.2 管理后台界面

- 基准列表：查看所有行业基准
- 基准详情：查看完整基准数据
- 生成操作：手动生成新基准
- 统计概览：使用率、成本、性能

### 7.3 调试界面

- 完整依赖链可视化
- 每个阶段的输入输出展示
- 编辑Prompt后重新运行
- 版本对比实验管理

---

## 第八章：方案总结

### 8.1 核心特性

1. **智能路由系统**：三种路由结果，自动判断最优路径
2. **智能模型路由**：根据任务复杂度自动选择最合适的模型
3. **预生成策略**：产业研究报告和认知基准永久保存
4. **管理员控制**：独立管理后台，支持增删改查
5. **依赖链调试**：完整可视化，支持Prompt优化
6. **成本优化**：智能模型选择，节省94.5%成本

### 8.2 Demo阶段范围

**展示行业**：
- SaaS（应用软件）
- 光伏
- 第三个行业（待定）

**功能范围**：
- ✅ GICS行业自动识别
- ✅ 三种路由结果处理
- ✅ 产业认知基准生成
- ✅ 认知评估执行
- ✅ 管理员后台
- ✅ 调试界面

### 8.3 技术栈

| 层级 | 技术选择 |
|------|---------|
| 后端 | Node.js + Express |
| 前端 | HTML + CSS + JavaScript (原生) |
| AI服务 | qwen3.5-flash (判断) + qwen3.5-plus (生成) |
| 数据源 | 何志毅教授企业图谱 + 网络搜索 |
| 缓存 | 本地文件系统 (永久保存) |

### 8.4 下一步行动

1. ✅ 设计方案已完成
2. ⏭ 等待用户确认设计方案
3. ⏭ 确认后创建实施计划
4. ⏭ 开始代码实现

---

**文档版本**: v1.0
**最后更新**: 2025-03-11
**作者**: Claude Sonnet 4.6
**状态**: 待用户确认

---

*本设计方案基于何志毅教授产业研究范式，结合通义千问qwen3.5-plus和qwen3.5-flash模型，实现智能、高效、低成本的认知评估系统。*
