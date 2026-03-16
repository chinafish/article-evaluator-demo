# 流式输出优化设计文档

**创建日期**: 2025-03-16
**作者**: Claude Sonnet 4.6
**状态**: 设计阶段
**优先级**: P0 - 用户体验关键优化

---

## 一、问题背景

### 当前问题
根据性能分析报告，单次文章评估耗时约 **125 秒**，其中：
- **AI 评估调用**: 84.72秒 (67.9%)
- **GICS 行业分类**: 36.66秒 (29.4%)

**用户体验问题**：
- 用户在评估过程中看不到任何进度
- 长时间黑屏等待产生焦虑感
- 不知道系统是否正常工作
- 无法提前查看已完成的模块

### 解决方案
采用 **Server-Sent Events (SSE)** 实现流式进度推送：
- 实时显示整体进度条
- 已完成模块立即显示
- 减少用户心理等待时间

---

## 二、技术方案

### 2.1 架构设计

```
用户提交评估请求
    ↓
前端：EventSource 连接 /api/evaluate-stream
    ↓
后端：创建 SSE 连接（text/event-stream）
    ↓
后端：逐步执行各个步骤
    ↓
每个步骤完成 → 推送进度更新
    ↓
前端：实时更新进度条和已完成模块
    ↓
所有步骤完成 → SSE 连接关闭
```

### 2.2 技术选型

| 方案 | 评分 | 说明 |
|-----|------|------|
| **SSE** | ⭐⭐⭐⭐⭐ | 单向推送，Express 原生支持，低延迟 |
| 轮询 | ⭐⭐ | 实现简单但有延迟，增加服务器负载 |
| WebSocket | ⭐⭐⭐ | 双向通信，对于单向推送场景过度设计 |

**选择 SSE 的原因**：
- Express 原生支持，无需额外依赖
- 浏览器 EventSource API 兼容性好
- 自动重连机制
- 服务器资源占用低（长连接）

---

## 三、后端设计

### 3.1 新增 SSE 端点

**路由**: `GET /api/evaluate-stream`

**请求参数**：
```
?url=<文章URL>
&content=<直接输入的内容>
```

**响应格式**: `text/event-stream`

**数据包结构**：
```javascript
{
  step: string,      // 步骤名称: 'parsing' | 'gics' | 'ai-eval' | 'strategy' | 'complete' | 'error'
  progress: number,  // 进度百分比 (0-100)
  message: string,   // 用户看到的提示信息
  data: object       // 该步骤的数据（可选）
}
```

### 3.2 进度映射表

| 进度 | 步骤 | 提示信息 | 数据内容 |
|-----|------|---------|---------|
| 5% | parsing | 正在解析文章... | - |
| 10% | parsing | ✅ 文章解析完成 | { title, content, ... } |
| 15% | gics | 正在进行 GICS 行业分类... | - |
| 30% | gics | ✅ GICS 分类完成 | { gics4, confidence, ... } |
| 35% | ai-eval | 正在进行 AI 评估分析... | - |
| 50% | ai-eval | AI 评估分析中... (已完成一半) | - |
| 80% | ai-eval | ✅ AI 评估完成 | { result, analysis, ... } |
| 85% | strategy | 正在生成战略建议... | - |
| 90% | strategy | ✅ 战略建议生成 | { suggestions, ... } |
| 100% | complete | 🎉 评估完成 | { 完整结果对象 } |

### 3.3 实现示例

```javascript
// src/routes/evaluate-stream.js (新建文件)

app.get('/api/evaluate-stream', async (req, res) => {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // 立即发送响应头

  // 发送进度更新函数
  const sendProgress = (step, progress, message, data = {}) => {
    res.write(`data: ${JSON.stringify({
      step,
      progress,
      message,
      data
    })}\n\n`);
  };

  try {
    const { url, content } = req.query;

    // 步骤1: 解析文章 (0-10%)
    sendProgress('parsing', 5, '正在解析文章...', {});
    const article = await articleParser.parse(url || content);
    sendProgress('parsing', 10, '✅ 文章解析完成', article);

    // 步骤2: GICS分类 (10-30%)
    sendProgress('gics', 15, '正在进行 GICS 行业分类...', {});
    const gicsResult = await gicsClassifier.classify(article);
    sendProgress('gics', 30, '✅ GICS 分类完成', gicsResult);

    // 步骤3: AI评估 (30-80%)
    sendProgress('ai-eval', 35, '正在进行 AI 评估分析...', {});
    const aiResult = await articleEvaluator.evaluate(article, gicsResult, (internalProgress) => {
      // AI评估内部进度回调 (35%-80%)
      const adjustedProgress = 35 + (internalProgress * 45);
      sendProgress('ai-eval', adjustedProgress, 'AI 评估分析中...', {});
    });
    sendProgress('ai-eval', 80, '✅ AI 评估完成', aiResult);

    // 步骤4: 战略建议 (80-90%)
    sendProgress('strategy', 85, '正在生成战略建议...', {});
    const strategy = await strategyGenerator.generate(aiResult);
    sendProgress('strategy', 90, '✅ 战略建议生成', strategy);

    // 步骤5: 完成 (100%)
    sendProgress('complete', 100, '🎉 评估完成', {
      result: { article, gicsResult, aiResult, strategy }
    });

  } catch (error) {
    console.error('[SSE Error]', error);
    sendProgress('error', 0, '❌ 评估失败', { error: error.message });
  }

  res.end();
});
```

### 3.4 错误处理

```javascript
// 超时处理
const TIMEOUT = 180000; // 3分钟
const timeout = setTimeout(() => {
  sendProgress('error', 0, '❌ 评估超时', {
    error: '评估时间过长，请稍后重试'
  });
  res.end();
}, TIMEOUT);

// 清理定时器
clearTimeout(timeout);
```

---

## 四、前端设计

### 4.1 UI 组件结构

```html
<!-- 顶部进度条 -->
<div class="progress-header" id="progressHeader" style="display: none;">
  <div class="progress-bar">
    <div class="progress-fill" id="progressFill" style="width: 0%"></div>
  </div>
  <div class="progress-info">
    <span class="progress-text" id="progressText">准备评估...</span>
    <span class="progress-percentage" id="progressPercentage">0%</span>
  </div>
</div>
```

### 4.2 CSS 样式

```css
.progress-header {
  position: sticky;
  top: 0;
  background: white;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  z-index: 1000;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 14px;
}

.progress-text {
  color: #64748b;
}

.progress-percentage {
  font-weight: bold;
  color: #3b82f6;
}
```

### 4.3 模块状态管理

```css
/* 加载中状态 */
.module-loading {
  opacity: 0.6;
  pointer-events: none;
  position: relative;
  min-height: 100px;
}

.module-loading::after {
  content: "⏳ 生成中...";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 14px;
  color: #64748b;
}

/* 完成状态 - 淡入动画 */
.module-complete {
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 待加载状态 - 隐藏 */
.module-pending {
  display: none;
}
```

### 4.4 JavaScript 实现

```javascript
// 替换原有的 startEvaluation 函数
async function startEvaluation(articleInput) {
  const progressHeader = document.getElementById('progressHeader');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const progressPercentage = document.getElementById('progressPercentage');

  // 显示进度条
  progressHeader.style.display = 'block';
  progressFill.style.width = '0%';
  progressText.textContent = '准备评估...';
  progressPercentage.textContent = '0%';

  // 隐藏评估结果区域（准备显示）
  const resultSection = document.getElementById('resultSection');
  resultSection.style.display = 'block';

  // 创建 SSE 连接
  const params = new URLSearchParams();
  if (articleInput.url) {
    params.append('url', articleInput.url);
  } else {
    params.append('content', articleInput.content);
  }

  const eventSource = new EventSource(`/api/evaluate-stream?${params.toString()}`);

  // 监听消息
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // 更新进度条
    progressFill.style.width = `${data.progress}%`;
    progressText.textContent = data.message;
    progressPercentage.textContent = `${data.progress}%`;

    // 根据步骤更新界面
    handleStepUpdate(data);

    // 完成时关闭连接
    if (data.step === 'complete' || data.step === 'error') {
      eventSource.close();

      if (data.step === 'complete') {
        showCompleteButton();
      }
    }
  };

  // 错误处理
  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    eventSource.close();
    showError('连接中断，请重试');
    showRetryButton();
  };
}

// 处理步骤更新
function handleStepUpdate(data) {
  switch(data.step) {
    case 'parsing':
      if (data.progress === 10) {
        displayArticle(data.data);
      }
      break;

    case 'gics':
      if (data.progress === 30) {
        displayGICSResult(data.data);
      }
      break;

    case 'ai-eval':
      // 可以在 AI 评估过程中显示加载动画
      if (data.progress < 80) {
        showAIEvaluationLoading();
      } else {
        displayAIResult(data.data);
      }
      break;

    case 'strategy':
      if (data.progress === 90) {
        displayStrategy(data.data);
      }
      break;

    case 'complete':
      displayFinalResult(data.data.result);
      break;

    case 'error':
      showError(data.data.error);
      break;
  }
}

// 显示重试按钮
function showRetryButton(callback) {
  const existingButton = document.getElementById('retryButton');
  if (existingButton) existingButton.remove();

  const button = document.createElement('button');
  button.id = 'retryButton';
  button.textContent = '🔄 重新评估';
  button.onclick = () => {
    button.remove();
    if (callback) callback();
  };

  document.querySelector('.progress-info').appendChild(button);
}
```

---

## 五、数据流设计

### 5.1 完整数据流

```
┌─────────┐     ┌──────────────┐     ┌──────────┐
│  浏览器  │────▶│ SSE 连接建立 │────▶│ Express  │
└─────────┘     └──────────────┘     └──────────┘
                                            │
                              ┌─────────────┼─────────────┐
                              │             │             │
                              ▼             ▼             ▼
                         ┌─────────┐  ┌─────────┐  ┌─────────┐
                         │解析文章 │  │GICS分类 │  │ AI评估  │
                         │ 5-10%  │  │ 15-30%  │  │ 35-80%  │
                         └─────────┘  └─────────┘  └─────────┘
                              │             │             │
                              └─────────────┼─────────────┘
                                            ▼
                                    ┌──────────────┐
                                    │ 推送进度更新  │
                                    │ (SSE Event)  │
                                    └──────────────┘
                                            │
                              ┌─────────────┼─────────────┐
                              │             │             │
                              ▼             ▼             ▼
                         ┌─────────┐  ┌─────────┐  ┌─────────┐
                         │更新进度条│  │显示已完成│  │动画效果 │
                         └─────────┘  └─────────┘  └─────────┘
```

### 5.2 状态机设计

```
[IDLE] → [PARSING] → [GICS] → [AI_EVAL] → [STRATEGY] → [COMPLETE]
   │          │          │          │            │            │
   │          ▼          ▼          ▼            ▼            ▼
   │       5-10%      15-30%      35-80%       85-90%       100%
   │
   └───→ [ERROR] (任何步骤失败)
```

---

## 六、用户体验优化

### 6.1 骨架屏加载效果

```html
<!-- 评估报告骨架屏 -->
<div class="skeleton-card" id="evalSkeleton" style="display: none;">
  <div class="skeleton-header">
    <div class="skeleton-title"></div>
    <div class="skeleton-badge"></div>
  </div>
  <div class="skeleton-body">
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line medium"></div>
  </div>
</div>

<style>
.skeleton-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin: 20px 0;
}

.skeleton-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.skeleton-title {
  width: 60%;
  height: 24px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-badge {
  width: 80px;
  height: 24px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 12px;
}

.skeleton-line {
  height: 16px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  margin-bottom: 12px;
  border-radius: 4px;
}

.skeleton-line.short { width: 60%; }
.skeleton-line.medium { width: 80%; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
</style>
```

### 6.2 友好的提示文案

| 进度 | 主提示 | 副提示（可选） |
|-----|--------|--------------|
| 0% | 准备评估... | 预计耗时 1-2 分钟 |
| 5% | 正在解析文章... | 获取文章内容 |
| 10% | ✅ 文章解析完成 | - |
| 15% | GICS 行业分类中... | 正在分析 163 个行业 |
| 30% | ✅ GICS 分类完成 | 找到匹配行业 |
| 35% | AI 评估分析中... | 这是最大头的步骤 |
| 50% | AI 评估分析中... | 已完成一半，请稍候 |
| 80% | ✅ AI 评估完成 | 分析完成 |
| 85% | 正在生成战略建议... | 整理关键建议 |
| 90% | ✅ 战略建议生成 | - |
| 100% | 🎉 评估完成 | 点击查看完整报告 |

### 6.3 已完成模块可交互

- ✅ 模块一旦完成立即可滚动查看
- ✅ 已完成模块可以折叠/展开
- ✅ 支持在生成过程中点击已完成模块的溯源链接

---

## 七、实施计划

### Phase 1: MVP（最小可行版本）

**目标**: 实现基础流式进度推送

**后端任务**：
1. ✅ 创建 `/api/evaluate-stream` 端点
2. ✅ 实现进度推送函数 `sendProgress`
3. ✅ 集成文章解析、GICS分类、AI评估流程
4. ✅ 基础错误处理和超时控制

**前端任务**：
1. ✅ 创建进度条 UI 组件
2. ✅ 实现 EventSource 连接
3. ✅ 处理 SSE 消息并更新进度
4. ✅ 显示已完成模块

**预期效果**: 用户能看到整体进度，3个主要进度节点

**时间**: 1天

---

### Phase 2: 体验优化

**目标**: 细化进度节点，优化视觉效果

**后端任务**：
1. ✅ 细化到 6 个进度节点
2. ✅ 优化提示文案
3. ✅ 改进错误处理

**前端任务**：
1. ✅ 添加骨架屏加载效果
2. ✅ 实现模块淡入动画
3. ✅ 优化进度条样式
4. ✅ 添加重试功能

**预期效果**: 体验接近 ChatGPT 流式输出

**时间**: 1天

---

### Phase 3: 高级功能（可选）

**目标**: AI 内部流式输出

**后端任务**：
1. ✅ 集成通义千问流式 API
2. ✅ 实现 AI 评估内部的实时进度推送
3. ✅ 断点续传机制

**前端任务**：
1. ✅ 显示 AI 生成内容逐字出现
2. ✅ 评估历史记录
3. ✅ 下载评估报告

**预期效果**: 极致体验，每个字都是流式出现

**时间**: 2天

---

## 八、成功指标

### 8.1 性能指标
- 进度更新延迟 < 100ms
- SSE 连接稳定性 > 99%
- 前端渲染流畅度 60fps

### 8.2 用户体验指标
- 心理等待时间减少 60%+
- 用户满意度提升
- 评估中途退出率降低

### 8.3 技术指标
- 服务器内存占用增加 < 10MB per connection
- 并发支持能力不受影响

---

## 九、风险和应对

### 风险1: SSE 连接断开

**应对**:
- EventSource 自动重连机制
- 前端显示重试按钮
- 后端记录评估状态，支持断点续传

### 风险2: 进度估算不准确

**应对**:
- 使用固定进度节点而非动态估算
- 提示用户"预计耗时"而非精确时间
- AI 评估使用大进度范围 (30-80%)

### 风险3: 浏览器兼容性

**应对**:
- EventSource 在所有现代浏览器支持
- 提供降级方案：传统 fetch API

---

## 十、测试计划

### 10.1 单元测试
- ✅ SSE 端点响应正确
- ✅ 进度推送函数工作正常
- ✅ 错误处理逻辑正确

### 10.2 集成测试
- ✅ 完整评估流程 SSE 推送
- ✅ 前端实时更新进度
- ✅ 模块正确显示

### 10.3 用户体验测试
- ✅ 进度条流畅度
- ✅ 提示文案清晰度
- ✅ 错误处理友好性

---

## 十一、后续优化方向

1. **AI 流式输出**: 集成通义千问 stream API，实现逐字显示
2. **评估队列**: 支持批量评估，并行处理多个文章
3. **实时协作**: 多人同时查看同一评估进度
4. **移动端优化**: 适配移动设备的进度显示
5. **WebSocket 升级**: 如果需要双向通信，升级到 WebSocket

---

## 附录

### A. 相关文件
- `src/routes/evaluate-stream.js` - SSE 端点实现
- `public/demo.html` - 前端界面修改
- `src/services/articleEvaluatorWithBenchmark.js` - AI 评估服务

### B. API 文档

#### GET /api/evaluate-stream

**请求参数**:
```
?url=<文章URL>
&content=<直接输入的内容>
```

**响应**: Server-Sent Events 流

**事件格式**:
```
data: {"step":"parsing","progress":10,"message":"✅ 文章解析完成","data":{...}}

```

### C. 参考资料
- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Express SSE Guide](https://expressjs.com/en/resources/middleware/sse.html)
- [通义千问流式输出文档](https://help.aliyun.com/zh/dashscope/developer-reference/api-details)

---

**文档版本**: v1.0
**最后更新**: 2025-03-16
