/**
 * 文章评估服务 v1.5（基于Block 0/1/2/3结构）
 *
 * 特点：
 * - 使用 v1.5 Prompt 模板
 * - 输出 Block 0/1/2/3 四层结构
 * - 五级核查标签（✅✅⚠️❌🔍）
 */

const ModelRouter = require('./ModelRouter');
const { industryPromptTemplate } = require('../prompts/industryPrompt.v1.5');
const { generalPromptTemplate } = require('../prompts/generalPrompt.v1.5');
const perfTracker = require('../utils/performanceTracker');

class ArticleEvaluatorV15 {
  constructor() {
    this.modelRouter = ModelRouter;
  }

  /**
   * 评估文章（使用行业认知基准）
   * @param {Object} article - 文章对象
   * @param {Object} context - 评估上下文
   * @param {Function} progressCallback - 进度回调
   * @returns {Promise<Object>} 评估结果
   */
  async evaluateWithIndustry(article, context, progressCallback = null) {
    console.log(`[v1.5评估] 开始行业评估: ${article.title}`);
    perfTracker.start('v1.5行业评估');

    // 1. 构建Prompt
    perfTracker.start('构建v1.5Prompt');
    const prompt = this.buildIndustryPrompt(article, context);
    perfTracker.end('构建v1.5Prompt');

    if (progressCallback) progressCallback(0);

    // 2. 调用AI
    perfTracker.start('AI评估调用');
    const evaluationContent = await this.callAI(prompt);
    if (progressCallback) progressCallback(50);
    perfTracker.end('AI评估调用');

    // 3. 解析结果
    perfTracker.start('解析v1.5结果');
    const evaluation = this.parseEvaluation(evaluationContent);
    perfTracker.end('解析v1.5结果');

    // 4. 添加元数据
    const result = this.addMetadata(evaluation, article, context, 'INDUSTRY');

    if (progressCallback) progressCallback(100);
    perfTracker.end('v1.5行业评估');

    console.log(`[v1.5评估] 评估完成: ${article.title}`);
    return result;
  }

  /**
   * 评估文章（使用通用认知基准）
   * @param {Object} article - 文章对象
   * @param {Object} context - 评估上下文
   * @param {Function} progressCallback - 进度回调
   * @returns {Promise<Object>} 评估结果
   */
  async evaluateWithGeneral(article, context, progressCallback = null) {
    console.log(`[v1.5评估] 开始通用评估: ${article.title}`);
    perfTracker.start('v1.5通用评估');

    // 1. 构建Prompt
    perfTracker.start('构建v1.5Prompt');
    const prompt = this.buildGeneralPrompt(article, context);
    perfTracker.end('构建v1.5Prompt');

    if (progressCallback) progressCallback(0);

    // 2. 调用AI
    perfTracker.start('AI评估调用');
    const evaluationContent = await this.callAI(prompt);
    if (progressCallback) progressCallback(50);
    perfTracker.end('AI评估调用');

    // 3. 解析结果
    perfTracker.start('解析v1.5结果');
    const evaluation = this.parseEvaluation(evaluationContent);
    perfTracker.end('解析v1.5结果');

    // 4. 添加元数据
    const result = this.addMetadata(evaluation, article, context, 'GENERAL');

    if (progressCallback) progressCallback(100);
    perfTracker.end('v1.5通用评估');

    console.log(`[v1.5评估] 评估完成: ${article.title}`);
    return result;
  }

  /**
   * 构建行业评估Prompt
   */
  buildIndustryPrompt(article, context) {
    const promptVars = {
      // 用户背景（Demo阶段固定值，后续从问卷获取）
      USER_INDUSTRY: context.userIndustry || 'SaaS',
      USER_STAGE: context.userStage || '成熟期',
      USER_FOCUS: context.userFocus || '竞争格局、客户增长',

      // 行业上下文
      INDUSTRY_NAME: context.industryName || context.gics4 || '未知行业',
      GICS4: context.gics4 || '未知',
      INDUSTRY_STAGE: context.industryStage || '成熟增长期',

      // 行业数据（从benchmark和report中提取，截断避免过长）
      KEY_DATA_TABLE: this.formatKeyDataTable(context.keyData),
      COMPETITIVE_LANDSCAPE: (context.competitiveLandscape || '暂无').substring(0, 500),
      SUCCESS_FACTORS: (context.successFactors || ['暂无']).slice(0, 5),
      COMMON_MISCONCEPTIONS: (context.commonMisconceptions || []).slice(0, 3),

      // 报告和基准（截断避免过长）
      INDUSTRY_REPORT: (context.industryReport || '暂无').substring(0, 800),
      INDUSTRY_BENCHMARK: '已提供'
    };

    const promptText = industryPromptTemplate(promptVars);

    // 提取system和user部分
    const systemMatch = promptText.match(/你是一位[\s\S]*?(?=---)/);
    const userMatch = promptText.match(/## 用户背景[\s\S]*/);

    return {
      system: systemMatch ? systemMatch[0].trim() : '你是一位专业的文章可信度分析师。',
      user: userMatch ? userMatch[0].trim() + `\n\n# 待评估文章\n标题：${article.title}\n来源：${article.source}\n内容：${article.content}` : `请评估以下文章：\n${article.content}`
    };
  }

  /**
   * 构建通用评估Prompt
   */
  buildGeneralPrompt(article, context) {
    const promptVars = {
      USER_FOCUS: context.userFocus || '通用商业分析',
      ARTICLE_TYPE: context.articleType || '待识别'
    };

    const promptText = generalPromptTemplate(promptVars);

    const systemMatch = promptText.match(/你是一位[\s\S]*?(?=---)/);
    const userMatch = promptText.match(/## 用户背景[\s\S]*/);

    return {
      system: systemMatch ? systemMatch[0].trim() : '你是一位专业的文章可信度分析师。',
      user: userMatch ? userMatch[0].trim() + `\n\n# 待评估文章\n标题：${article.title}\n来源：${article.source}\n内容：${article.content}` : `请评估以下文章：\n${article.content}`
    };
  }

  /**
   * 格式化关键数据表格
   */
  formatKeyDataTable(keyData) {
    if (!keyData || !Array.isArray(keyData)) {
      return '| 指标 | 数值 | 来源 |\n|------|------|------|\n| 暂无 | 暂无 | 暂无 |';
    }
    const rows = keyData.map(d => `| ${d.metric} | ${d.value} | ${d.source} |`).join('\n');
    return `| 指标 | 数值 | 来源 |\n|------|------|------|\n${rows}`;
  }

  /**
   * 调用AI
   */
  async callAI(prompt) {
    return await this.modelRouter.callAI('ARTICLE_EVALUATION', prompt, {
      temperature: 0.7,
      maxTokens: 4000
    });
  }

  /**
   * 解析评估结果
   */
  parseEvaluation(content) {
    try {
      // 尝试直接解析JSON
      return JSON.parse(content);
    } catch (error) {
      // 尝试提取JSON代码块
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      // 尝试提取花括号内容
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        return JSON.parse(braceMatch[0]);
      }
      throw new Error('无法解析AI返回的JSON格式');
    }
  }

  /**
   * 添加元数据
   */
  addMetadata(evaluation, article, context, type) {
    // 从 BLOCK 0 中提取决策相关信息
    const block0 = evaluation.block0 || {};
    const summaryCards = block0.summary_cards || {};

    // 计算决策优先级（基于判定结果）
    let decisionPriority = 'N/A';
    const verdict = block0.verdict || '';
    if (verdict.includes('不建议采信') || verdict.includes('谨慎')) {
      decisionPriority = '低';
    } else if (verdict.includes('基本可信') || verdict.includes('可以采信')) {
      decisionPriority = '中';
    } else if (verdict.includes('高度可信')) {
      decisionPriority = '高';
    }

    // 计算相关性（基于内容标签数量）
    let relevanceScore = 'N/A';
    const contentTags = block0.content_tags || [];
    if (contentTags.length >= 4) {
      relevanceScore = '高';
    } else if (contentTags.length >= 2) {
      relevanceScore = '中';
    } else if (contentTags.length > 0) {
      relevanceScore = '低';
    }

    // 计算紧迫性（基于时效性）
    let urgencyLevel = 'N/A';
    const timeliness = summaryCards.timeliness || {};
    if (timeliness.value) {
      if (timeliness.value.includes('2021') || timeliness.value.includes('2022')) {
        urgencyLevel = '低'; // 数据较旧
      } else if (timeliness.value.includes('2023') || timeliness.value.includes('2024')) {
        urgencyLevel = '中'; // 数据较新
      } else if (timeliness.value.includes('预测')) {
        urgencyLevel = '高'; // 预测性内容
      }
    }

    return {
      ...evaluation,
      // 添加决策相关字段（供 evaluate-stream.js 使用）
      decision_priority: decisionPriority,
      relevance_score: relevanceScore,
      urgency_level: urgencyLevel,
      // 原有字段
      article_title: article.title,
      article_source: article.source,
      article_url: article.url || null,
      evaluated_at: new Date().toISOString(),
      evaluator_version: 'v1.5',
      route_info: {
        type: type === 'INDUSTRY' ? 'INDUSTRY_BENCHMARK' : 'GENERAL_BENCHMARK',
        gics4: context.gics4 || null,
        benchmark_name: type === 'INDUSTRY' ? `${context.gics4}行业认知基准(v1.5)` : '通用认知基准(v1.5)',
        evaluator_version: 'v1.5'
      },
      // 保留原始数据供前端使用
      _raw_context: {
        userIndustry: context.userIndustry,
        userStage: context.userStage,
        industryName: context.industryName,
        gics4: context.gics4
      }
    };
  }
}

module.exports = { ArticleEvaluatorV15 };
