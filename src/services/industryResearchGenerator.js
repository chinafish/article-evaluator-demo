/**
 * 行业研究报告生成服务
 *
 * 阶段1：基于GICS行业 + 基准数据 + 网络搜索，生成深度产业研究报告
 *
 * 使用 ModelRouter 进行智能模型路由：
 * - 报告生成任务使用 qwen3.5-plus（强大生成能力）
 */

const ModelRouter = require('./ModelRouter');
const benchmarkData = require('./benchmarkData');

class IndustryResearchGenerator {
  constructor() {
    this.modelRouter = ModelRouter;
  }

  /**
   * 生成行业深度研究报告
   * @param {string} gics4 - GICS四级分类（如"应用软件"）
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 行业研究报告
   */
  async generateReport(gics4, options = {}) {
    console.log(`[研究报告] 开始生成: ${gics4}`);

    // 1. 检查是否已有缓存
    if (options.useCache !== false) {
      const cached = await this.loadCachedReport(gics4);
      if (cached) {
        console.log(`[研究报告] 使用缓存: ${gics4}`);
        return cached;
      }
    }

    // 2. 获取基准数据
    const benchmarkStats = await benchmarkData.getBenchmarkStats(gics4);
    const benchmarkText = await benchmarkData.formatForPrompt(gics4);

    // 3. 搜索最新行业动态（如果启用）
    let latestNews = '';
    if (options.enableSearch) {
      latestNews = await this.searchIndustryNews(gics4);
    }

    // 4. 构建Prompt
    const prompt = this.buildResearchPrompt(gics4, benchmarkText, latestNews);

    // 5. 调用AI生成报告（使用ModelRouter，自动选择qwen3.5-plus）
    const reportContent = await this.callAI(prompt);

    // 6. 解析报告
    const report = this.parseReport(reportContent, gics4);

    // 7. 添加基准数据
    report.benchmark_data = benchmarkStats;
    report.generated_at = new Date().toISOString();
    report.gics4 = gics4;

    // 8. 缓存报告
    await this.cacheReport(gics4, report);

    console.log(`[研究报告] 生成完成: ${gics4}`);
    return report;
  }

  /**
   * 构建研究报告生成Prompt
   */
  buildResearchPrompt(gics4, benchmarkText, latestNews) {
    return {
      system: `你是一位资深的产业研究专家，精通何志毅教授的产业研究方法论。你能够基于多维数据和最新信息，生成深度、客观、有洞察力的行业研究报告。

# 何志毅产业研究范式核心要点：

## 1. 产业维度分析
- 产业规模与增长趋势
- 产业链结构（上中下游）
- 竞争格局与集中度
- 技术发展趋势
- 政策环境影响

## 2. 企业评估维度
- 规模维度：市值、营收、利润、市场份额
- 效率维度：利润率、ROE、资产周转率
- 价值维度：研发投入、品牌价值、社会贡献

## 3. 全球视野
- 全球领军企业对标
- 中国企业地位分析
- 国际竞争力评估

## 4. 数据支撑
- 量化数据优先
- 清晰数据溯源
- 多维度对比

你的输出必须是严格的JSON格式。`,

      user: `请针对"${gics4}"行业生成深度研究报告。

# 基准数据（何志毅教授企业图谱）
${benchmarkText}

# 最新行业动态
${latestNews || '暂无最新动态数据'}

请按照以下JSON格式生成报告：

\`\`\`json
{
  "industry_overview": {
    "industry_name": "行业名称",
    "industry_definition": "行业定义与范围（100字以内）",
    "market_scale": "市场规模描述（量化数据）",
    "growth_trend": "增长趋势分析（量化数据）",
    "development_stage": "发展阶段（导入期/成长期/成熟期/衰退期）"
  },
  "industry_chain": {
    "upstream": {
      "description": "上游描述",
      "key_segments": ["关键环节1", "关键环节2"],
      "characteristics": "上游特征"
    },
    "midstream": {
      "description": "中游描述",
      "key_segments": ["关键环节1", "关键环节2"],
      "characteristics": "中游特征"
    },
    "downstream": {
      "description": "下游描述",
      "key_segments": ["关键环节1", "关键环节2"],
      "characteristics": "下游特征"
    }
  },
  "competitive_landscape": {
    "market_concentration": "市场集中度（高/中/低）",
    "top_players": [
      {
        "name": "企业名称",
        "position": "全球领军/挑战者/跟随者",
        "strengths": ["优势1", "优势2"],
        "market_cap": "市值/营收",
        "key_metrics": {
          "revenue_profit_margin": "营收利润率",
          "roe": "ROE",
          "rd_intensity": "研发强度"
        }
      }
    ],
    "competition_pattern": "竞争格局描述（200字以内）"
  },
  "development_trends": {
    "technology_trends": ["技术趋势1", "技术趋势2"],
    "business_model_trends": ["商业模式趋势1", "商业模式趋势2"],
    "market_trends": ["市场趋势1", "市场趋势2"],
    "policy_impact": "政策影响分析（100字以内）"
  },
  "key_challenges": {
    "challenges": [
      {
        "area": "挑战领域",
        "description": "挑战描述（100字以内）",
        "impact_level": "影响程度（高/中/低）"
      }
    ]
  },
  "opportunities": {
    "opportunities": [
      {
        "area": "机会领域",
        "description": "机会描述（100字以内）",
        "potential": "潜力评估（高/中/低）"
      }
    ]
  },
  "success_factors": {
    "critical_success_factors": [
      "关键成功因素1",
      "关键成功因素2",
      "关键成功因素3"
    ],
    "competitive_advantages": [
      "竞争优势1",
      "竞争优势2"
    ]
  },
  "investment_insights": {
    "investment_attractiveness": "投资吸引力（高/中/低）",
    "investment_thesis": "投资逻辑（200字以内）",
    "key_metrics_to_monitor": ["关键指标1", "关键指标2", "关键指标3"],
    "risk_factors": ["风险因素1", "风险因素2"]
  },
  "data_sources": {
    "primary_sources": ["数据来源1", "数据来源2"],
    "benchmark_data": "何志毅教授企业图谱数据（清华产业研究院）",
    "data_quality": "数据质量评估（高/中/低）"
  },
  "executive_summary": "执行摘要（300字以内，概括核心观点和结论）"
}
\`\`\`

重要要求：
1. 所有描述必须有数据支撑
2. 明确标注数据来源
3. 量化数据优先
4. 客观分析，避免主观臆断
5. 聚焦于对投资决策有价值的信息`
    };
  }

  /**
   * 调用AI生成报告
   */
  /**
   * 调用AI生成报告
   * 使用 ModelRouter 进行智能路由，自动选择 qwen3.5-plus
   */
  async callAI(prompt) {
    console.log('[研究报告] 开始调用AI生成模型（qwen3.5-plus）...');

    try {
      // 使用 ModelRouter，指定任务类型为 INDUSTRY_REPORT_GENERATION
      // ModelRouter 会自动选择 qwen3.5-plus 模型
      const response = await this.modelRouter.callAI('INDUSTRY_REPORT_GENERATION', prompt, {
        temperature: 0.7,
        maxTokens: 8000
      });

      console.log('[研究报告] AI调用成功');
      return response;
    } catch (error) {
      console.error('[研究报告] AI调用失败:', error.message);
      throw error;
    }
  }

  /**
   * 解析AI返回的JSON
   */
  parseReport(content, gics4) {
    console.log('[研究报告解析] 原始内容长度:', content.length);

    try {
      return JSON.parse(content);
    } catch (error) {
      console.log('[研究报告解析] 直接JSON解析失败，尝试提取...');

      // 尝试提取JSON部分
      let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        console.log('[研究报告解析] 找到 ```json 标记');
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.log('[研究报告解析] ```json 内的JSON解析失败');
        }
      }

      // 尝试不带标记的JSON
      jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('[研究报告解析] 找到JSON对象');
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.log('[研究报告解析] JSON对象解析失败，尝试清理...');
          // 尝试清理常见的JSON错误
          let cleaned = jsonMatch[0]
            .replace(/,\s*}/g, '}')  // 移除尾随逗号
            .replace(/,\s*]/g, ']')  // 移除数组尾随逗号
            .replace(/[\x00-\x1F\x7F]/g, '');  // 移除控制字符
          return JSON.parse(cleaned);
        }
      }

      console.error('[研究报告解析] 所有方法都失败');
      throw new Error('无法解析AI返回的报告');
    }
  }

  /**
   * 搜索最新行业新闻
   */
  async searchIndustryNews(gics4) {
    // TODO: 实现网络搜索功能
    // 可以使用搜索API（如Bing Search API）
    return '';
  }

  /**
   * 缓存报告
   */
  async cacheReport(gics4, report) {
    const fs = require('fs');
    const path = require('path');
    const cacheDir = path.join(__dirname, '../../cache/industry_reports');

    // 确保目录存在
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const filename = `${gics4.replace(/[\/\\]/g, '_')}.json`;
    const filepath = path.join(cacheDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  }

  /**
   * 加载缓存报告
   */
  async loadCachedReport(gics4) {
    const fs = require('fs');
    const path = require('path');
    const cacheDir = path.join(__dirname, '../../cache/industry_reports');
    const filename = `${gics4.replace(/[\/\\]/g, '_')}.json`;
    const filepath = path.join(cacheDir, filename);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    // 检查缓存是否过期（7天）
    const stats = fs.statSync(filepath);
    const cacheAge = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    if (cacheAge > 7) {
      console.log(`[研究报告] 缓存已过期: ${gics4} (${cacheAge.toFixed(1)}天)`);
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
    const cacheDir = path.join(__dirname, '../../cache/industry_reports');

    if (!fs.existsSync(cacheDir)) {
      return;
    }

    if (gics4) {
      const filename = `${gics4.replace(/[\/\\]/g, '_')}.json`;
      const filepath = path.join(cacheDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`[研究报告] 已清除缓存: ${gics4}`);
      }
    } else {
      const files = fs.readdirSync(cacheDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(cacheDir, file));
      });
      console.log(`[研究报告] 已清除所有缓存 (${files.length}个文件)`);
    }
  }
}

module.exports = new IndustryResearchGenerator();
