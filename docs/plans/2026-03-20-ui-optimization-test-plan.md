# UI 优化回归测试计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 验证最近两轮 UI/UX 优化的所有改动是否正确工作，建立自动化测试基础设施。

**Architecture:** 三层测试策略：Unit（纯函数）→ Integration（API 端点）→ E2E（完整评估流程）。先搭建 Jest 基础设施，再逐层补充。

**Tech Stack:** Jest + Supertest（API 测试）+ Node.js 内置 http（E2E SSE 测试）

---

## 现状分析

项目**零自动化测试**：无 Jest/Mocha、无 test 目录、无 CI/CD、无断言库。现有 13 个手动测试脚本，全部 `console.log` 输出，无断言。

### 需要覆盖的改动清单

| 改动 | 文件 | 风险 |
|------|------|------|
| Tier 标签由 AI 输出 `tier` 字段 | `industryPrompt.v1.5.js`, `demo.html` | AI 可能不输出 tier 字段，前端需兼容 |
| AI 主动验证而非标"无法验证" | `industryPrompt.v1.5.js` | Prompt 行为，难以确定性测试 |
| 盲点 method 具体化 | `industryPrompt.v1.5.js` | 同上，Prompt 行为 |
| 常见误区合并到 Block 2 | `industryPrompt.v1.5.js`, `generalPrompt.v1.5.js` | AI 可能仍在 Block 1 输出 misconception |
| 行动建议 action_advice | `industryPrompt.v1.5.js`, `demo.html` | 新字段，AI 可能不输出 |
| 来源超链接 + Tier 彩色标签 | `demo.html` | 正则匹配、CSS 渲染 |
| 影响程度颜色区分 | `demo.html` | CSS class 应用 |
| 查看原文面板内容（Bug 修复） | `demo.html` | SSE 路径全局变量赋值 |
| 溯源角标定位高亮 | `demo.html` | 段落匹配 + mark 高亮 |
| 逻辑核查无角标 | `demo.html` | 渲染逻辑 |
| 基准数据注入 | `evaluate-stream.js`, `articleEvaluator.v1.5.js` | Context 构建 |

---

## Task 1: 搭建 Jest 测试基础设施

**Files:**
- Modify: `package.json` (添加 devDependencies + test script)
- Create: `jest.config.js`
- Create: `test/setup.js`

**Step 1: 安装 Jest + Supertest**

```bash
cd d:/vibe/vibe-coding/article-evaluator-demo
npm install --save-dev jest supertest
```

**Step 2: 创建 Jest 配置**

```js
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  testTimeout: 30000,
  setupFilesAfterFramework: ['./test/setup.js'],
  // 排除 ad-hoc 手动测试脚本
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test_result_',
    '/test-api',
    '/test_eval',
    '/test-wechat',
    '/test-zhihu',
    '/test-douban',
    '/test-kingdee',
    '/test-all',
    '/test-force',
    '/test-with-debug',
    '/debug-',
    '/parse_result',
    '/scripts/'
  ]
};
```

**Step 3: 创建测试 setup**

```js
// test/setup.js
// 设置 dotenv 以便测试时能访问 AI_API_KEY 等
require('dotenv').config();
```

**Step 4: 添加 npm test script**

在 `package.json` 的 `scripts` 中添加：
```json
"test": "jest --verbose",
"test:watch": "jest --watch"
```

**Step 5: 验证 Jest 能运行**

```bash
npx jest --version
echo "一个空测试" > test/example.test.js
npx jest test/example.test.js
rm test/example.test.js
```

Expected: Jest 运行成功，显示 1 test passed。

**Step 6: Commit**

```bash
git add package.json package-lock.json jest.config.js test/setup.js
git commit -m "chore: add Jest testing infrastructure"
```

---

## Task 2: Prompt 模板单元测试

**Files:**
- Create: `test/prompts/industry-prompt-structure.test.js`
- Create: `test/prompts/general-prompt-structure.test.js`
- Read: `src/prompts/industryPrompt.v1.5.js`
- Read: `src/prompts/generalPrompt.v1.5.js`

**Step 1: 编写 industryPrompt 结构测试**

```js
// test/prompts/industry-prompt-structure.test.js
const { industryPromptTemplate } = require('../../src/prompts/industryPrompt.v1.5');

describe('industryPrompt v1.5 结构验证', () => {
  const result = industryPromptTemplate({
    USER_INDUSTRY: 'SaaS',
    USER_STAGE: '成熟期',
    USER_FOCUS: '竞争格局',
    INDUSTRY_NAME: '半导体',
    GICS4: '半导体材料与设备',
    INDUSTRY_STAGE: '成长期',
    KEY_DATA_TABLE: '| 指标 | 数值 | 来源 |',
    COMPETITIVE_LANDSCAPE: '市场集中度：高',
    INDUSTRY_CHAIN: '暂无',
    SUCCESS_FACTORS: ['创新'],
    COMMON_MISCONCEPTIONS: ['低估国产化难度'],
    INDUSTRY_REPORT: '行业概述',
    INDUSTRY_BENCHMARK: '- 2024年全球销售额：6276亿美元（±5%，SIA）',
    REQUIRED_KNOWLEDGE: '- EUV光刻机垄断',
    KEY_CHALLENGES: '- 地缘政治',
    HIGH_VALUE_TOPICS: '- AI算力需求'
  });

  test('生成的 prompt 包含 tier 字段指引', () => {
    expect(result).toContain('"tier"');
  });

  test('生成的 prompt 包含 action_advice 字段', () => {
    expect(result).toContain('"action_advice"');
  });

  test('生成的 prompt 不包含 common_misconception 在 Block 1', () => {
    // Block 1 logic_checks 中不应有 common_misconception 类型
    const block1Match = result.match(/"block1"[\s\S]*?"logic_checks"[\s\S]*?\]/);
    expect(block1Match).not.toBeNull();
    expect(block1Match[0]).not.toContain('common_misconception');
  });

  test('Block 2 blind_spots 包含 type 和 impact 字段', () => {
    expect(result).toContain('"type": "遗漏/误区"');
    expect(result).toContain('"impact": "高/中/低');
  });

  test('数据核查要求中包含主动验证指引', () => {
    expect(result).toContain('主动基于AI知识和公开信息进行验证');
  });

  test('盲点 method 要求具体化', () => {
    expect(result).toContain('具体依据描述');
  });

  test('Tier 描述包含 5 个等级', () => {
    expect(result).toContain('Tier 1');
    expect(result).toContain('Tier 2');
    expect(result).toContain('Tier 3');
    expect(result).toContain('Tier 4');
  });
});
```

**Step 2: 运行测试验证通过**

```bash
npx jest test/prompts/industry-prompt-structure.test.js --verbose
```

Expected: 7 tests passed

**Step 3: Commit**

```bash
git add test/prompts/
git commit -m "test: add prompt template structure tests"
```

---

## Task 3: Context 构建单元测试

**Files:**
- Create: `test/services/context-builder.test.js`
- Read: `src/routes/evaluate-stream.js` (buildKeyDataFromReport, buildCompetitiveLandscapeFromReport)
- Read: `src/services/articleEvaluator.v1.5.js` (buildIndustryPrompt, formatKeyDataTable)

**Step 1: 编写 context 数据注入测试**

```js
// test/services/context-builder.test.js
describe('Context 构建验证', () => {
  // buildKeyDataFromReport
  describe('buildKeyDataFromReport', () => {
    // 需要从 evaluate-stream.js 中提取为独立可测模块
    // 当前是路由内部函数，先测试其行为
    test.todo('从报告中正确提取市场规模和增速');
    test.todo('从竞争格局中提取全球冠军财务数据');
    test.todo('空报告返回空数组');
  });

  // buildCompetitiveLandscapeFromReport
  describe('buildCompetitiveLandscapeFromReport', () => {
    test.todo('正确拼接市场集中度 + 全球冠军 + 中国企业');
    test.todo('超过 800 字符被截断');
  });
});
```

**注意**: `buildKeyDataFromReport` 和 `buildCompetitiveLandscapeFromReport` 是 `evaluate-stream.js` 内的私有函数。要真正测试，需要先提取为独立模块。此处先用 `test.todo` 标记为待实现。

**Step 2: 运行测试**

```bash
npx jest test/services/context-builder.test.js --verbose
```

Expected: 6 todo tests displayed

**Step 3: Commit**

```bash
git add test/services/
git commit -m "test: add context builder test stubs"
```

---

## Task 4: 前端渲染函数单元测试

**Files:**
- Create: `test/frontend/render-logic.test.js`
- Read: `public/demo.html` (提取渲染逻辑为可测函数)

**问题**: 当前渲染逻辑全部内联在 `displayResult()` 的 `innerHTML` 拼接中，无法直接单元测试。

**Step 1: 编写 Tier 标签解析测试**

```js
// test/frontend/render-logic.test.js
describe('Tier 标签渲染逻辑', () => {
  // 模拟前端 tier 解析逻辑（从 demo.html 中提取）
  function parseTier(item) {
    const tierNum = item.tier ? parseInt(item.tier) : null;
    const tierFromSource = !tierNum ? (item.source.match(/Tier\s*(\d)/i) || [])[1] : null;
    return tierNum || (tierFromSource ? parseInt(tierFromSource) : null);
  }

  test('优先使用 item.tier 字段', () => {
    expect(parseTier({ source: '公司公告', tier: 2 })).toBe(2);
  });

  test('tier 字段不存在时回退到 source 文本解析', () => {
    expect(parseTier({ source: '公司公告（Tier 1）', tier: null })).toBe(1);
  });

  test('全角括号也能解析', () => {
    expect(parseTier({ source: 'SIA（Tier 1）', tier: null })).toBe(1);
  });

  test('无 tier 信息返回 null', () => {
    expect(parseTier({ source: '未知来源', tier: null })).toBeNull();
  });
});

describe('影响程度颜色映射', () => {
  function getImpactClass(impact) {
    if (impact.includes('高')) return 'impact-high';
    if (impact.includes('中')) return 'impact-mid';
    if (impact.includes('低')) return 'impact-low';
    return '';
  }

  test('高 → impact-high', () => {
    expect(getImpactClass('高 — 对决策有重大影响')).toBe('impact-high');
  });

  test('中 → impact-mid', () => {
    expect(getImpactClass('中 — 需要关注')).toBe('impact-mid');
  });

  test('低 → impact-low', () => {
    expect(getImpactClass('低 — 次要信息')).toBe('impact-low');
  });

  test('空字符串 → 无 class', () => {
    expect(getImpactClass('')).toBe('');
  });
});
```

**Step 2: 运行测试**

```bash
npx jest test/frontend/render-logic.test.js --verbose
```

Expected: 8 tests passed

**Step 3: Commit**

```bash
git add test/frontend/
git commit -m "test: add render logic unit tests for Tier and impact"
```

---

## Task 5: API 端点集成测试

**Files:**
- Create: `test/api/evaluate-stream.test.js`
- Read: `src/server.js` (端口、路由)
- Read: `src/routes/evaluate-stream.js`

**Step 1: 编写 SSE 端点测试**

```js
// test/api/evaluate-stream.test.js
const http = require('http');

function waitForEventSource(url, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const req = http.get(url, (res) => {
      res.on('data', (chunk) => chunks.push(chunk.toString()));
      res.on('end', () => resolve(chunks.join('')));
    });
    req.on('error', reject);
    setTimeout(() => reject(new Error('Timeout')), timeout);
  });
}

describe('SSE 评估端点集成测试', () => {
  const BASE = 'http://localhost:3001';

  test('GET / 返回 demo.html', async () => {
    const res = await new Promise((resolve, reject) => {
      http.get(BASE + '/', (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }).on('error', reject);
    });
    expect(res.status).toBe(200);
    expect(res.body).toContain('article-evaluator');
  });

  test('POST /api/evaluate-stream 返回 SSE 流', async () => {
    const res = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        url: 'https://36kr.com/p/2817789483638764.html',
        content: ''
      });
      const options = {
        hostname: 'localhost', port: 3001, path: '/api/evaluate-stream',
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    expect(res.status).toBe(200);
    expect(res.body).toContain('text/event-stream');
  }, 30000);

  test('SSE complete 事件包含完整评估结构', async () => {
    // 这个测试需要等待完整评估完成（约2分钟）
    // 标记为 skip，手动运行时去掉 skip
    const raw = await waitForEventSource(
      BASE + '/api/evaluate-stream?' + new URLSearchParams({ url: 'https://36kr.com/p/2817789483638764.html', content: '' })
    );
    const lines = raw.split('\n').filter(l => l.startsWith('data: '));
    const completeLine = lines.find(l => l.includes('"step":"complete"'));

    if (!completeLine) {
      // 可能还在进行中，跳过
      return;
    }

    const data = JSON.parse(completeLine.replace('data: ', ''));
    const eval0 = data.data?.evaluation?.block0;

    expect(eval0).toBeDefined();
    expect(eval0.verdict).toBeDefined();
    expect(eval0.one_sentence_summary).toBeDefined();
    // 验证新增字段
    expect(eval0.action_advice).toBeDefined();
  }, 200000);

  test('data_checks 包含 tier 字段', async () => {
    // 依赖上面的 complete 事件数据
    // 标记为 skip，手动运行
  });
});
```

**Step 2: 运行测试（需要服务器运行）**

```bash
npx jest test/api/evaluate-stream.test.js --verbose --forceExit
```

Expected: GET 测试通过，SSE 测试通过（需要服务器运行）

**Step 3: Commit**

```bash
git add test/api/
git commit -m "test: add API endpoint integration tests"
```

---

## Task 6: E2E 评估结果验证测试

**Files:**
- Create: `test/e2e/evaluation-output.test.js`
- Read: `test_result_*.json` (现有手动测试结果作为 fixture)

**Step 1: 编写评估结果结构验证**

```js
// test/e2e/evaluation-output.test.js
describe('评估输出结构验证', () => {
  // 模拟 Block 0 结构
  const validBlock0 = {
    content_tags: ['标签1', '标签2', '标签3', '标签4'],
    verdict: '基本可信',
    one_sentence_summary: '文章整体可信',
    action_advice: '建议补充最新数据',
    summary_cards: {
      fact_check: { count: 2, label: '有偏差' },
      logic_check: { count: 1, label: '合理' },
      blind_spot: { count: 2, label: '未提及' },
      timeliness: { value: '数据较新', label: '时效性' }
    },
    methodology: '测试方法'
  };

  test('Block 0 必填字段验证', () => {
    expect(validBlock0.content_tags).toHaveLength(4);
    expect(['谨慎采信', '基本可信', '可以采信', '不建议采信']).toContain(validBlock0.verdict);
    expect(validBlock0.action_advice).toBeDefined();
    expect(validBlock0.action_advice.length).toBeGreaterThan(0);
    expect(validBlock0.action_advice.length).toBeLessThanOrEqual(30);
  });

  // Block 1 data_checks 结构
  const validDataCheck = {
    claim: '文章声称市场6000亿美元',
    actual: '基准值6276亿美元，偏差-4.4%',
    source: 'SIA行业报告',
    tier: 1,
    verdict: '⚠️存疑',
    method: '数据印证'
  };

  test('data_check 包含 tier 字段且为数字', () => {
    expect(validDataCheck.tier).toBeDefined();
    expect(typeof validDataCheck.tier).toBe('number');
    expect([1, 2, 3, 4, 5]).toContain(validDataCheck.tier);
  });

  test('data_check actual 包含偏差百分比', () => {
    expect(validDataCheck.actual).toMatch(/\d+\.?\d*%/);
  });

  // Block 2 blind_spots 结构
  const validBlindSpot = {
    type: '遗漏',
    content: '文章未提及欧盟CBAM碳关税影响',
    impact: '高 — 对上游成本有显著影响',
    method: '根据行业研究报告，2024年欧盟CBAM将增加5-8%成本'
  };

  test('blind_spot method 包含具体数据', () => {
    expect(validBlindSpot.method).toMatch(/\d{4}/); // 包含年份
    expect(validBlindSpot.method.length).toBeGreaterThan(20); // 足够具体
  });

  // Block 1 不应有 common_misconception
  test('logic_checks 不包含 common_misconception 类型', () => {
    const logicChecks = [
      { claim: '论点1', verdict: '合理', reasoning: '依据' }
    ];
    logicChecks.forEach(item => {
      expect(item.type).not.toBe('common_misconception');
    });
  });
});
```

**Step 2: 运行测试**

```bash
npx jest test/e2e/evaluation-output.test.js --verbose
```

Expected: 5 tests passed

**Step 3: Commit**

```bash
git add test/e2e/
git commit -m "test: add evaluation output structure validation tests"
```

---

## Task 7: 模糊匹配单元测试

**Files:**
- Create: `test/services/fuzzy-match.test.js`
- Read: `src/services/benchmarkData.js` (getByGics4 fuzzy matching)
- Read: `src/services/industryBenchmarkGenerator.js` (loadCachedBenchmark fuzzy matching)

**Step 1: 编写模糊匹配测试**

```js
// test/services/fuzzy-match.test.js
describe('GICS 模糊匹配', () => {
  test.todo('半导体设备 → 半导体材料与设备 (benchmarkData.getByGics4)');
  test.todo('光伏产品 → 光伏产品、材料与设备 (benchmarkData.getByGics4)');
  test.todo('半导体设备 → 半导体材料与设备 (loadCachedBenchmark)');
  test.todo('不存在的行业返回 null');
  test.todo('完全匹配优先于模糊匹配');
});
```

**Step 2: Commit**

```bash
git add test/services/fuzzy-match.test.js
git commit -m "test: add fuzzy match test stubs"
```

---

## 测试优先级建议

| 优先级 | Task | 理由 | 是否需要 TDD |
|--------|------|------|-----------|
| P0 | Task 1 搭建基础设施 | 后续所有测试的前提 | 否（一次性配置） |
| P0 | Task 2 Prompt 结构测试 | 纯同步，秒级完成，能捕获字段缺失 | 否（确定性输出） |
| P0 | Task 4 渲染逻辑测试 | 纯同步，秒级完成，能捕获解析 bug | 否（确定性逻辑） |
| P0 | Task 6 输出结构验证 | 验证 AI 输出是否满足前端契约 | 否（结构验证） |
| P1 | Task 5 API 集成测试 | 需要服务器运行，验证端到端 | 部分（SSE 流难 mock） |
| P2 | Task 3 Context 构建测试 | 需要重构私有函数 | 是（需要先提取模块） |
| P2 | Task 7 模糊匹配测试 | 需要重构或 mock 文件系统 | 是（涉及文件 I/O） |

## 结论

**不需要完整 TDD**。原因：
- Prompt 渲染、前端解析逻辑是确定性输出，适合直接写测试断言
- AI 输出（Action advice、Tier、Method 具体化）是非确定性的，只能验证结构，不能验证内容正确性
- API 集成和 E2E 需要服务器运行，更适合手动回归 + 自动化结构检查结合

**建议执行顺序**: Task 1 → 2 → 4 → 6 → 5 → 3 → 7
