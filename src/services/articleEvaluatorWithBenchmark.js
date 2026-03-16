/**
 * 文章评估服务（基于行业判断基准）
 *
 * 阶段3：对比文章内容与行业判断基准，生成评估结果
 *
 * 使用 ModelRouter 进行智能模型路由：
 * - 文章评估任务使用 qwen3.5-plus（强大生成能力）
 */

const axios = require('axios');
const ModelRouter = require('./ModelRouter');
const perfTracker = require('../utils/performanceTracker');

class ArticleEvaluatorWithBenchmark {
  constructor() {
    this.modelRouter = ModelRouter;
  }

  /**
   * 评估文章
   * @param {Object} article - 文章对象 {title, content, source, url}
   * @param {Object} benchmark - 行业判断基准
   * @param {Object} report - 行业研究报告（可选）
   * @param {Function} progressCallback - 进度回调函数（可选）
   * @returns {Promise<Object>} 评估结果
   */
  async evaluate(article, benchmark, report = null, progressCallback = null) {
    console.log(`[文章评估] 开始评估: ${article.title}`);
    perfTracker.start('文章评估');

    // 1. 构建评估Prompt
    perfTracker.start('构建评估Prompt');
    const prompt = this.buildEvaluationPrompt(article, benchmark, report);
    perfTracker.end('构建评估Prompt');

    // 在调用 AI 前发送进度
    if (progressCallback) progressCallback(0);

    // 2. 调用AI评估（使用ModelRouter，自动选择qwen3.5-plus）
    perfTracker.start('AI评估调用');
    const evaluationContent = await this.callAI(prompt);

    // 在调用 AI 后发送进度
    if (progressCallback) progressCallback(50);

    perfTracker.end('AI评估调用');

    // 3. 解析评估结果
    perfTracker.start('解析评估结果');
    const evaluation = this.parseEvaluation(evaluationContent);
    perfTracker.end('解析评估结果');

    // 完成时发送进度
    if (progressCallback) progressCallback(100);

    // 4. 添加元数据
    evaluation.article_title = article.title;
    evaluation.article_source = article.source;
    evaluation.article_url = article.url || null;
    evaluation.benchmark_gics4 = benchmark.gics4;
    evaluation.evaluated_at = new Date().toISOString();

    perfTracker.end('文章评估');
    console.log(`[文章评估] 评估完成: ${article.title}`);
    return evaluation;
  }

  /**
   * 构建评估Prompt
   */
  buildEvaluationPrompt(article, benchmark, report) {
    // 提取关键评估维度
    const dimensions = benchmark.evaluation_dimensions || {};
    const scoring = benchmark.scoring_criteria || {};
    const comparison = benchmark.comparison_standards || {};
    const blindSpots = benchmark.blind_spots_to_check || {};

    return {
      system: `你是一位专业的文章评估专家。你的任务是对比文章内容与行业判断基准，生成客观、量化、有洞察力的评估报告。

评估原则：
1. 客观公正：基于事实和数据进行评估
2. 量化优先：使用具体数字和明确标准
3. 清晰溯源：明确标注数据来源
4. 建设性：提供可改进的建议
5. 决策导向：为高管提供决策价值

你的输出必须是严格的JSON格式。`,

      user: `请评估以下文章。

# 文章信息
标题：${article.title}
来源：${article.source || '未知'}
URL：${article.url || '未提供'}

# 文章内容
${article.content}

# 行业判断基准

## 评估维度
${JSON.stringify(dimensions, null, 2)}

## 评分标准
${JSON.stringify(scoring, null, 2)}

## 对比标准
${JSON.stringify(comparison, null, 2)}

## 盲点检查
${JSON.stringify(blindSpots, null, 2)}

${report ? `
# 行业背景信息
${report.executive_summary}

## 行业关键数据
市场规模：${report.industry_overview?.market_scale || '暂无'}
增长趋势：${report.industry_overview?.growth_trend || '暂无'}
` : ''}

请按照以下JSON格式生成评估报告：

\`\`\`json
{
  "overall_assessment": {
    "score": "总体评分（0-100）",
    "rating": "评级（excellent/good/acceptable/poor）",
    "one_sentence_summary": "一句话总结（50字以内）"
  },
  "dimension_scores": {
    "factual_accuracy": {
      "score": "事实准确性得分（0-100）",
      "assessment": "评估说明（150字以内）",
      "strengths": ["优点1", "优点2"],
      "weaknesses": ["不足1", "不足2"],
      "data_verification": [
        {
          "claim": "文章声称",
          "benchmark_value": "基准值",
          "article_value": "文章值",
          "deviation": "偏差程度",
          "verdict": "判断（符合/基本符合/不符合）"
        }
      ]
    },
    "industry_insight": {
      "score": "行业洞察力得分（0-100）",
      "assessment": "评估说明（150字以内）",
      "demonstrated_knowledge": ["展示的知识点1", "展示的知识点2"],
      "missing_knowledge": ["缺失的知识点1", "缺失的知识点2"],
      "misconceptions_detected": ["发现的误解1", "发现的误解2"]
    },
    "strategic_value": {
      "score": "战略价值得分（0-100）",
      "assessment": "评估说明（150字以内）",
      "key_insights": ["关键洞察1", "关键洞察2"],
      "opportunities": [
        {
          "type": "市场机会/技术机会/政策机会",
          "description": "机会描述（100字以内）",
          "urgency": "紧急程度（高/中/低）",
          "potential_impact": "潜在影响（高/中/低）"
        }
      ],
      "risks": [
        {
          "type": "市场风险/技术风险/政策风险",
          "description": "风险描述（100字以内）",
          "probability": "发生概率（高/中/低）",
          "mitigation": "缓解措施"
        }
      ],
      "decision_relevance": "决策相关性（高/中/低）",
      "actionability": "可执行性（高/中/低）",
      "investment_recommendation": {
        "verdict": "建议（积极关注/谨慎观察/保持距离）",
        "rationale": "理由说明",
        "time_horizon": "时间周期（短期/中期/长期）"
      }
    },
    "data_quality": {
      "score": "数据质量得分（0-100）",
      "assessment": "评估说明（150字以内）",
      "source_credibility": "来源可信度（高/中/低）",
      "data_recency": "数据时效性",
      "quantification_level": "量化程度（高/中/低）"
    }
  },
  "benchmark_comparison": {
    "above_benchmark": [
      {
        "area": "超出领域",
        "description": "描述（50字以内）",
        "evidence": "证据"
      }
    ],
    "meets_benchmark": [
      {
        "area": "符合领域",
        "description": "描述（50字以内）",
        "evidence": "证据"
      }
    ],
    "below_benchmark": [
      {
        "area": "低于领域",
        "description": "描述（50字以内）",
        "evidence": "证据",
        "improvement_suggestion": "改进建议"
      }
    ]
  },
  "competitive_analysis": {
    "industry_leaders": [
      {
        "company": "对标企业1",
        "strengths": ["优势1", "优势2"],
        "financial_metrics": {
          "revenue_growth": "营收增长率",
          "profit_margin": "利润率",
          "roe": "ROE"
        },
        "strategic_focus": "战略重点"
      }
    ],
    "article_comparison": {
      "similarities": ["与对标企业的相似点1", "相似点2"],
      "differences": ["差异点1", "差异点2"],
      "gap_analysis": "差距分析"
    }
  },
  "blind_spot_analysis": {
    "identified_blind_spots": [
      {
        "spot": "盲点描述",
        "importance": "重要性（高/中/低）",
        "suggested_addition": "建议补充内容"
      }
    ],
    "critical_missing_context": [
      "缺失的关键背景1",
      "缺失的关键背景2"
    ]
  },
  "quantitative_analysis": {
    "data_points_mentioned": "提到的数据点数量",
    "quantified_claims": "被量化的声称数量",
    "source_citations": "来源引用数量",
    "benchmark_references": "基准引用数量"
  },
  "recommendations": {
    "for_readers": [
      {
        "priority": "优先级（高/中/低）",
        "recommendation": "建议内容",
        "rationale": "理由"
      }
    ],
    "for_authors": [
      {
        "priority": "优先级（高/中/低）",
        "recommendation": "建议内容",
        "rationale": "理由"
      }
    ]
  },
  "verdict": {
    "is_reliable": "是否可靠（是/否/部分可靠）",
    "is_valuable": "是否有价值（高价值/有价值/一般价值/低价值）",
    "target_audience": "目标受众",
    "reading_time_recommendation": "建议阅读时间（值得精读/值得浏览/不建议阅读）"
  },
  "data_sources": {
    "article_sources": ["文章来源1", "文章来源2"],
    "verification_sources": ["验证来源1", "验证来源2"],
    "benchmark_source": "何志毅教授企业图谱数据（清华产业研究院）"
  },
  "confidence_and_trust": {
    "overall_confidence": {
      "score": "总体置信度（0-100）",
      "level": "置信度等级（高/中/低）",
      "explanation": "置信度说明（为何有此置信度）"
    },
    "data_quality_score": {
      "overall": "数据质量总分（0-100）",
      "completeness": "数据完整性评分（0-100）",
      "credibility": "数据可信度评分（0-100）",
      "recency": "数据时效性评分（0-100）",
      "quantification": "数据量化程度评分（0-100）"
    },
    "evaluation_traceability": {
      "assessment_basis": [
        {
          "aspect": "评估维度（如：事实准确性）",
          "score": "评分",
          "evidence": "评分依据（具体证据）",
          "source": "数据来源"
        }
      ],
      "uncertainty_areas": [
        {
          "area": "不确定领域",
          "reason": "不确定原因",
          "impact": "对评估结果的影响",
          "suggested_verification": "建议验证方式"
        }
      ],
      "key_data_points_verified": [
        {
          "claim": "文章声称",
          "verified_value": "验证值",
          "source": "验证来源",
          "confidence": "验证置信度（高/中/低）"
        }
      ]
    }
  }
}
\`\`\`

评估要点：
1. 严格对照基准标准进行评分
2. 每个判断都要有证据支撑，明确标注来源
3. 诚实标注不确定领域，不要过度自信
4. 提供数据质量评分，帮助用户判断可信度
5. 可溯源：每个关键判断都能追溯到具体依据`
    };
  }

  /**
   * 调用AI评估
   * 使用 ModelRouter 进行智能路由，自动选择 qwen3.5-plus
   */
  async callAI(prompt) {
    console.log('[AI评估] 开始调用AI评估模型（qwen3.5-plus）...');

    try {
      // 使用 ModelRouter，指定任务类型为 ARTICLE_EVALUATION
      // ModelRouter 会自动选择 qwen3.5-plus 模型
      const response = await this.modelRouter.callAI('ARTICLE_EVALUATION', prompt, {
        temperature: 0.7,
        maxTokens: 8000
      });

      console.log('[AI评估] AI调用成功');
      return response;
    } catch (error) {
      console.error('[AI评估] 调用失败:', error.message);
      throw error;
    }
  }

  /**
   * 解析评估结果
   */
  parseEvaluation(content) {
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
      throw new Error('无法解析评估结果');
    }
  }
}

module.exports = new ArticleEvaluatorWithBenchmark();
