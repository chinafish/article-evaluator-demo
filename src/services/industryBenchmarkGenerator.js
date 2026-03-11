/**
 * 行业判断基准生成服务
 *
 * 阶段2：基于产业研究报告 + 基线数据，生成行业判断基准
 *
 * 使用 ModelRouter 进行智能模型路由：
 * - 基准生成任务使用 qwen3.5-plus（强大生成能力）
 */

const ModelRouter = require('./ModelRouter');

class IndustryBenchmarkGenerator {
  constructor() {
    this.modelRouter = ModelRouter;
  }

  /**
   * 生成行业判断基准
   * @param {Object} report - 行业研究报告
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 行业判断基准
   */
  async generateBenchmark(report, options = {}) {
    const gics4 = report.gics4;
    console.log(`[判断基准] 开始生成: ${gics4}`);

    // 1. 检查缓存
    if (options.useCache !== false) {
      const cached = await this.loadCachedBenchmark(gics4);
      if (cached) {
        console.log(`[判断基准] 使用缓存: ${gics4}`);
        return cached;
      }
    }

    // 2. 构建Prompt
    const prompt = this.buildBenchmarkPrompt(report);

    // 3. 调用AI生成基准（使用ModelRouter，自动选择qwen3.5-plus）
    const benchmarkContent = await this.callAI(prompt);

    // 4. 解析基准
    const benchmark = this.parseBenchmark(benchmarkContent, gics4);

    // 5. 添加元数据
    benchmark.generated_at = new Date().toISOString();
    benchmark.gics4 = gics4;
    benchmark.report_version = report.generated_at;

    // 6. 缓存基准
    await this.cacheBenchmark(gics4, benchmark);

    console.log(`[判断基准] 生成完成: ${gics4}`);
    return benchmark;
  }

  /**
   * 构建基准生成Prompt
   */
  buildBenchmarkPrompt(report) {
    return {
      system: `你是一位资深的产业评估专家。你的任务是基于深度产业研究报告，提炼出可操作的、量化的行业判断基准。

这个基准将用于：
1. 评估单篇文章的质量和价值
2. 判断文章内容是否符合行业实情
3. 识别文章中的认知偏差和误导信息
4. 为高管提供决策支持

你的输出必须是严格的JSON格式。`,

      user: `基于以下行业研究报告，生成该行业的判断基准。

# 行业研究报告摘要

## 行业概况
${JSON.stringify(report.industry_overview, null, 2)}

## 竞争格局
${JSON.stringify(report.competitive_landscape, null, 2)}

## 发展趋势
${JSON.stringify(report.development_trends, null, 2)}

## 关键挑战
${JSON.stringify(report.key_challenges, null, 2)}

## 成功因素
${JSON.stringify(report.success_factors, null, 2)}

## 执行摘要
${report.executive_summary}

# 基准数据（何志毅教授企业图谱）
${JSON.stringify(report.benchmark_data, null, 2)}

请按照以下JSON格式生成判断基准：

\`\`\`json
{
  "evaluation_dimensions": {
    "factual_accuracy": {
      "description": "事实准确性评估",
      "key_data_points": [
        {
          "metric": "关键指标名称",
          "benchmark_value": "基准值",
          "acceptable_range": "可接受范围",
          "source": "数据来源"
        }
      ],
      "red_flags": ["错误信号1", "错误信号2"]
    },
    "industry_insight": {
      "description": "行业洞察力评估",
      "required_knowledge": ["必备知识1", "必备知识2"],
      "advanced_concepts": ["高级概念1", "高级概念2"],
      "common_misconceptions": ["常见误解1", "常见误解2"]
    },
    "strategic_value": {
      "description": "战略价值评估",
      "high_value_topics": ["高价值话题1", "高价值话题2"],
      "low_value_topics": ["低价值话题1", "低价值话题2"],
      "decision_relevance": "决策相关性判断标准"
    },
    "data_quality": {
      "description": "数据质量评估",
      "preferred_sources": ["优先来源1", "优先来源2"],
      "reliable_indicators": ["可靠指标1", "可靠指标2"],
      "warning_signs": ["警告信号1", "警告信号2"]
    }
  },
  "scoring_criteria": {
    "excellent": {
      "threshold": "评分阈值（如：90分以上）",
      "characteristics": ["特征1", "特征2"],
      "example": "示例描述"
    },
    "good": {
      "threshold": "评分阈值（如：70-90分）",
      "characteristics": ["特征1", "特征2"],
      "example": "示例描述"
    },
    "acceptable": {
      "threshold": "评分阈值（如：50-70分）",
      "characteristics": ["特征1", "特征2"],
      "example": "示例描述"
    },
    "poor": {
      "threshold": "评分阈值（如：50分以下）",
      "characteristics": ["特征1", "特征2"],
      "example": "示例描述"
    }
  },
  "comparison_standards": {
    "quantitative_benchmarks": [
      {
        "indicator": "指标名称",
        "industry_average": "行业平均值",
        "top_quartile": "前25%水平",
        "bottom_quartile": "后25%水平"
      }
    ],
    "qualitative_standards": [
      {
        "dimension": "维度名称",
        "high_standard": "高标准描述",
        "low_standard": "低标准描述"
      }
    ]
  },
  "blind_spots_to_check": {
    "common_omissions": ["常见遗漏1", "常见遗漏2"],
    "critical_contexts": ["关键背景1", "关键背景2"],
    "risk_factors": ["风险因素1", "风险因素2"]
  },
  "actionable_insights": {
    "high_priority_actions": [
      {
        "trigger_condition": "触发条件",
        "suggested_action": "建议行动",
        "expected_outcome": "预期结果"
      }
    ],
    "monitoring_metrics": [
      "监控指标1",
      "监控指标2"
    ]
  },
  "metadata": {
    "benchmark_version": "v1.0",
    "applicability": "适用范围描述",
    "limitations": ["局限性1", "局限性2"],
    "update_frequency": "建议更新频率"
  }
}
\`\`\`

重要要求：
1. 所有基准必须可量化或可明确判断
2. 评分标准要清晰可执行
3. 对比标准要有具体数值
4. 盲点检查要实用
5. 行动建议要具体可行
6. 必须基于研究报告的内容，不要编造`
    };
  }

  /**
   * 调用AI生成基准
   */
  /**
   * 调用AI生成基准
   * 使用 ModelRouter 进行智能路由，自动选择 qwen3.5-plus
   */
  async callAI(prompt) {
    console.log('[判断基准] 开始调用AI生成模型（qwen3.5-plus）...');

    try {
      // 使用 ModelRouter，指定任务类型为 BENCHMARK_GENERATION
      // ModelRouter 会自动选择 qwen3.5-plus 模型
      const response = await this.modelRouter.callAI('BENCHMARK_GENERATION', prompt, {
        temperature: 0.7,
        maxTokens: 6000
      });

      console.log('[判断基准] AI调用成功');
      return response;
    } catch (error) {
      console.error('[判断基准] AI调用失败:', error.message);
      throw error;
    }
  }

  /**
   * 解析基准
   */
  parseBenchmark(content, gics4) {
    try {
      return JSON.parse(content);
    } catch (error) {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      const jsonMatch2 = content.match(/\{[\s\S]*\}/);
      if (jsonMatch2) {
        return JSON.parse(jsonMatch2[0]);
      }
      throw new Error('无法解析判断基准');
    }
  }

  /**
   * 缓存基准
   */
  async cacheBenchmark(gics4, benchmark) {
    const fs = require('fs');
    const path = require('path');
    const cacheDir = path.join(__dirname, '../../cache/industry_benchmarks');

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const filename = `${gics4.replace(/[\/\\]/g, '_')}.json`;
    const filepath = path.join(cacheDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(benchmark, null, 2), 'utf-8');
  }

  /**
   * 加载缓存基准
   */
  async loadCachedBenchmark(gics4) {
    const fs = require('fs');
    const path = require('path');
    const cacheDir = path.join(__dirname, '../../cache/industry_benchmarks');
    const filename = `${gics4.replace(/[\/\\]/g, '_')}.json`;
    const filepath = path.join(cacheDir, filename);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    // 检查缓存是否过期（30天）
    const stats = fs.statSync(filepath);
    const cacheAge = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    if (cacheAge > 30) {
      console.log(`[判断基准] 缓存已过期: ${gics4} (${cacheAge.toFixed(1)}天)`);
      return null;
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 清除缓存
   */
  async clearCache(gics4 = null) {
    const fs = require('fs');
    const path = require('path');
    const cacheDir = path.join(__dirname, '../../cache/industry_benchmarks');

    if (!fs.existsSync(cacheDir)) {
      return;
    }

    if (gics4) {
      const filename = `${gics4.replace(/[\/\\]/g, '_')}.json`;
      const filepath = path.join(cacheDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`[判断基准] 已清除缓存: ${gics4}`);
      }
    } else {
      const files = fs.readdirSync(cacheDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(cacheDir, file));
      });
      console.log(`[判断基准] 已清除所有缓存 (${files.length}个文件)`);
    }
  }
}

module.exports = new IndustryBenchmarkGenerator();
