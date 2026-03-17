/**
 * 认知智能体编排器
 *
 * 实现三种路由结果的智能编排：
 * 1. 行业基准（已有最新基准）→ 直接评估
 * 2. 行业基准（无最新基准，提示生成）→ 提示用户选择
 * 3. 通用基准（文章无关或无数据）→ 通用评估
 */

const ModelRouter = require('./ModelRouter');
const industryBenchmarkGenerator = require('./industryBenchmarkGenerator');
const comprehensiveResearchGenerator = require('./comprehensiveResearchGenerator');
const articleEvaluatorWithBenchmark = require('./articleEvaluatorWithBenchmark');
const { ArticleEvaluatorV15 } = require('./articleEvaluator.v1.5');
const benchmarkData = require('./benchmarkData');
const perfTracker = require('../utils/performanceTracker');

class CognitiveOrchestrator {
  constructor() {
    this.modelRouter = ModelRouter;
    this.evaluatorV15 = new ArticleEvaluatorV15();
  }

  /**
   * 认知评估主入口
   * @param {Object} article - 文章对象 {title, content, source, url}
   * @returns {Promise<Object>} 评估结果或路由决策
   */
  async evaluate(article) {
    try {
      perfTracker.clear();
      console.log('\n[认知智能体] 开始认知评估流程...');
      perfTracker.start('认知评估总流程');

      // 步骤1: GICS行业分类（使用qwen3.5-flash）
      perfTracker.start('GICS行业分类');
      const gicsClassification = await this.classifyGICS(article);
      perfTracker.end('GICS行业分类');

      // 步骤2: 检查行业基准数据是否存在
      perfTracker.start('检查基准数据');
      const hasBenchmarkData = await this.checkBenchmarkData(gicsClassification.gics4);
      perfTracker.end('检查基准数据');

      // 步骤3: 检查是否有缓存的行业认知基准
      perfTracker.start('加载缓存基准');
      const cachedBenchmark = await this.loadCachedBenchmark(gicsClassification.gics4);
      perfTracker.end('加载缓存基准');

      // 步骤4: 检查文章与行业的相关性（如果有行业数据）
      perfTracker.start('文章相关性检查');
      const articleRelevance = hasBenchmarkData
        ? await this.checkArticleRelevance(article, gicsClassification)
        : { isRelevant: false, confidence: 0, reason: '无该行业基准数据' };
      perfTracker.end('文章相关性检查');

      // 步骤5: 路由决策
      perfTracker.start('路由决策');
      const routeDecision = this.makeRouteDecision({
        gicsClassification,
        hasBenchmarkData,
        cachedBenchmark,
        articleRelevance
      });
      perfTracker.end('路由决策');

      console.log(`[认知智能体] 路由决策: ${routeDecision.resultType}`);
      console.log(`[认知智能体] 路由原因: ${routeDecision.reason}`);

      // 步骤6: 处理路由结果
      const result = await this.handleRoute(article, routeDecision);

      perfTracker.end('认知评估总流程');
      perfTracker.generateReport();

      return result;

    } catch (error) {
      console.error('[认知智能体] 评估失败:', error.message);
      perfTracker.generateReport();
      // 降级到通用评估
      return await this.evaluateWithGeneralBenchmark(article, { error: error.message });
    }
  }

  /**
   * 步骤1: GICS行业分类
   * 使用qwen3.5-flash快速分类
   */
  async classifyGICS(article) {
    console.log('[GICS分类] 开始识别文章所属行业...');

    const prompt = {
      system: `你是一位专业的行业分类专家，熟悉GICS（全球行业分类标准）四级分类体系。

你的任务是：根据文章内容，从以下163个GICS四级分类中选择最准确的一个。

重要：gics4必须是以下分类之一，不能自己编造！

常见GICS四级分类示例：
【信息技术】
- 应用软件、系统软件、信息技术咨询、互联网服务与基础架构

【医疗健康】
- 医疗健康技术、医疗健康设备、医疗健康服务、制药

【金融】
- 综合金融服务、区域性银行、特殊金融服务

【汽车】
- 新能源汽车、汽车制造、汽车零件与设备、汽车零售

【其他】
- 光伏产品材料与设备、互动媒体与服务、人力资源与就业服务

请输出JSON格式：
{
  "gics1": "GICS一级分类",
  "gics2": "GICS二级分类",
  "gics3": "GICS三级分类",
  "gics4": "GICS四级分类（必须从数据中存在的分类选择）",
  "confidence": 0.0-1.0,
  "reason": "判断依据"
}`,
      user: `请识别以下文章所属的GICS四级分类：

标题：${article.title}
来源：${article.source || '未知'}
内容：${article.content.substring(0, 2000)}

重要：请从现有的GICS四级分类中选择最匹配的，特别是新能源汽车相关文章应选择"新能源汽车"分类。

输出JSON格式的分类结果。`
    };

    try {
      const response = await this.modelRouter.callAI('GICS_CLASSIFICATION', prompt, {
        temperature: 0.3,
        maxTokens: 500
      });

      const classification = this.parseJSONResponse(response);

      // 标准化GICS分类名称
      if (!classification.gics4) {
        classification.gics4 = classification.gics3 || classification.gics2 || classification.gics1 || '通用';
      }

      console.log(`[GICS分类] 识别结果: ${classification.gics4} (置信度: ${classification.confidence})`);
      return classification;

    } catch (error) {
      console.error('[GICS分类] 分类失败:', error.message);
      return {
        gics1: '通用',
        gics2: '通用',
        gics3: '通用',
        gics4: '通用',
        confidence: 0,
        reason: '分类失败，使用默认'
      };
    }
  }

  /**
   * 步骤2: 检查行业基准数据是否存在
   */
  async checkBenchmarkData(gics4) {
    try {
      const data = await benchmarkData.getByGics4(gics4);
      const hasData = data && data.length > 0;
      console.log(`[基准数据检查] ${gics4}: ${hasData ? '有数据' : '无数据'}`);
      return hasData;
    } catch (error) {
      console.error('[基准数据检查] 检查失败:', error.message);
      return false;
    }
  }

  /**
   * 步骤3: 加载缓存的行业认知基准
   */
  async loadCachedBenchmark(gics4) {
    try {
      const benchmark = await industryBenchmarkGenerator.loadCachedBenchmark(gics4);
      if (benchmark) {
        console.log(`[基准缓存] 找到缓存基准: ${gics4}`);
        return benchmark;
      }
      console.log(`[基准缓存] 无缓存基准: ${gics4}`);
      return null;
    } catch (error) {
      console.error('[基准缓存] 加载失败:', error.message);
      return null;
    }
  }

  /**
   * 步骤4: 检查文章与行业的相关性
   * 使用qwen3.5-flash快速判断
   */
  async checkArticleRelevance(article, gicsClassification) {
    console.log('[相关性检查] 检查文章与行业的相关性...');

    const prompt = {
      system: `你是一位专业的文章相关性判断专家。

你的任务是：判断文章是否与指定行业高度相关。

判断标准：
- 高相关：文章深度讨论该行业的商业模式、技术、市场、企业、发展趋势等
- 中相关：文章涉及该行业，但不是主要内容
- 低相关：文章只是提及该行业，或内容关联度很低
- 不相关：文章内容与该行业无关

请输出JSON格式：
{
  "isRelevant": true/false,
  "confidence": 0.0-1.0,
  "reason": "判断依据"
}`,
      user: `请判断以下文章是否与 "${gicsClassification.gics4}" 行业高相关：

标题：${article.title}
内容：${article.content.substring(0, 1500)}

输出JSON格式的判断结果。`
    };

    try {
      const response = await this.modelRouter.callAI('ARTICLE_RELEVANCE_CHECK', prompt, {
        temperature: 0.3,
        maxTokens: 300
      });

      const result = this.parseJSONResponse(response);
      console.log(`[相关性检查] ${result.isRelevant ? '相关' : '不相关'} (置信度: ${result.confidence})`);
      return result;

    } catch (error) {
      console.error('[相关性检查] 检查失败:', error.message);
      return { isRelevant: true, confidence: 0.5, reason: '检查失败，默认相关' };
    }
  }

  /**
   * 步骤5: 路由决策
   */
  makeRouteDecision(context) {
    const { gicsClassification, hasBenchmarkData, cachedBenchmark, articleRelevance } = context;

    // 路由结果1: 行业基准（已有最新基准）
    if (cachedBenchmark && articleRelevance.isRelevant) {
      return {
        resultType: 'INDUSTRY_BENCHMARK_READY',
        reason: `已找到${gicsClassification.gics4}行业认知基准，可直接使用`,
        gics4: gicsClassification.gics4,
        benchmark: cachedBenchmark,
        needsUserAction: false
      };
    }

    // 路由结果2: 行业基准（无最新基准，提示生成）
    // 条件：有行业数据 + 文章相关
    if (hasBenchmarkData && articleRelevance.isRelevant && !cachedBenchmark) {
      return {
        resultType: 'INDUSTRY_BENCHMARK_NEEDS_GENERATION',
        reason: `${gicsClassification.gics4}行业有基准数据，但认知基准尚未生成。可以生成该行业的专业认知基准，或使用通用基准进行评估。`,
        gics4: gicsClassification.gics4,
        canGenerate: true,
        needsUserAction: true,
        options: [
          {
            type: 'generate_benchmark',
            label: '生成行业认知基准',
            description: '将为您生成该行业的专业认知基准（需2-3分钟），评估结果更精准'
          },
          {
            type: 'use_general',
            label: '使用通用基准',
            description: '立即使用通用认知基准进行快速评估'
          }
        ]
      };
    }

    // 路由结果3: 通用基准
    // 条件：无行业数据 OR 文章不相关
    let generalReason = '';
    if (!hasBenchmarkData) {
      generalReason = `暂无${gicsClassification.gics4}行业的基准数据`;
    } else if (!articleRelevance.isRelevant) {
      generalReason = `文章内容与${gicsClassification.gics4}行业相关性较低（${articleRelevance.reason}）`;
    }

    return {
      resultType: 'GENERAL_BENCHMARK',
      reason: `${generalReason}，使用通用认知基准进行评估。`,
      gics4: gicsClassification.gics4,
      needsUserAction: false
    };
  }

  /**
   * 步骤6: 处理路由结果
   */
  async handleRoute(article, routeDecision) {
    switch (routeDecision.resultType) {
      case 'INDUSTRY_BENCHMARK_READY':
        return await this.evaluateWithIndustryBenchmark(article, routeDecision);

      case 'INDUSTRY_BENCHMARK_NEEDS_GENERATION':
        // 返回路由决策，等待用户选择
        return {
          routeDecision: routeDecision,
          article: {
            title: article.title,
            source: article.source,
            url: article.url
          }
        };

      case 'GENERAL_BENCHMARK':
        return await this.evaluateWithGeneralBenchmark(article, routeDecision);

      default:
        throw new Error(`未知的路由结果类型: ${routeDecision.resultType}`);
    }
  }

  /**
   * 使用行业认知基准评估（v1.5版本）
   */
  async evaluateWithIndustryBenchmark(article, routeDecision) {
    console.log('[评估] 使用行业认知基准进行评估 (v1.5)...');

    // 获取行业基准数据和研究报告
    const industryData = await benchmarkData.getByGics4(routeDecision.gics4);
    const industryReport = routeDecision.benchmark.industry_research_report || null;

    // 构建v1.5评估上下文
    const context = {
      // 用户背景（Demo阶段固定值）
      userIndustry: 'SaaS',
      userStage: '成熟期',
      userFocus: '竞争格局、客户增长',

      // 行业上下文
      industryName: routeDecision.gics4,
      gics4: routeDecision.gics4,
      industryStage: routeDecision.benchmark.industry_stage || '成熟增长期',

      // 行业数据（从benchmark中提取）
      keyData: this.extractKeyData(industryData),
      competitiveLandscape: routeDecision.benchmark.competitive_landscape || '暂无',
      successFactors: routeDecision.benchmark.critical_success_factors || [],
      commonMisconceptions: routeDecision.benchmark.common_misconceptions || [],

      // 报告和基准
      industryReport: industryReport?.executive_summary || '暂无',
      industryBenchmark: JSON.stringify(routeDecision.benchmark, null, 2)
    };

    // 使用v1.5评估器
    const evaluation = await this.evaluatorV15.evaluateWithIndustry(article, context);

    return {
      ...evaluation,
      industry_data: industryData,
      industry_report: industryReport
    };
  }

  /**
   * 从行业数据中提取关键指标
   */
  extractKeyData(industryData) {
    if (!industryData || !industryData.global_top10) {
      return [];
    }
    // 提取头部企业的关键指标作为行业参考
    const champion = industryData.global_champion;
    if (!champion) return [];

    return [
      { metric: '全球龙头市值', value: champion.metrics?.市值 + '亿美元' || 'N/A', source: '企业图谱' },
      { metric: '全球龙头营收', value: champion.metrics?.营收 + '亿美元' || 'N/A', source: '企业图谱' },
      { metric: '平均研发强度', value: (champion.metrics?.研发强度 * 100)?.toFixed(0) + '%' || 'N/A', source: '企业图谱' }
    ];
  }

  /**
   * 使用通用基准评估（v1.5版本）
   */
  async evaluateWithGeneralBenchmark(article, routeDecision) {
    console.log('[评估] 使用通用认知基准进行评估 (v1.5)...');

    // 构建v1.5通用评估上下文
    const context = {
      userFocus: '通用商业分析',
      articleType: this.detectArticleType(article)
    };

    // 使用v1.5评估器
    const evaluation = await this.evaluatorV15.evaluateWithGeneral(article, context);

    return {
      ...evaluation,
      route_info: {
        type: 'GENERAL_BENCHMARK',
        reason: routeDecision.reason,
        benchmark_name: '通用认知基准(v1.5)',
        evaluator_version: 'v1.5'
      }
    };
  }

  /**
   * 检测文章类型
   */
  detectArticleType(article) {
    const content = (article.title + ' ' + article.content).toLowerCase();
    if (content.includes('财报') || content.includes('营收') || content.includes('利润')) {
      return '财经分析';
    }
    if (content.includes('行业') || content.includes('市场') || content.includes('趋势')) {
      return '行业研究';
    }
    if (content.includes('产品') || content.includes('技术') || content.includes('创新')) {
      return '产品技术';
    }
    return '综合资讯';
  }

  /**
   * 生成行业认知基准（用户选择后调用）
   * @param {string} gics4 - GICS四级分类
   * @returns {Promise<Object>} 生成进度和结果
   */
  async generateIndustryBenchmark(gics4) {
    console.log(`[基准生成] 开始生成 ${gics4} 行业认知基准...`);

    const taskId = `task_${Date.now()}`;
    const progress = {
      taskId,
      gics4,
      status: 'in_progress',
      steps: []
    };

    try {
      // 步骤1: 生成综合产业研究报告（使用何志毅研究范式）
      progress.steps.push({ step: 1, name: '生成综合产业研究报告', status: 'in_progress' });

      const report = await comprehensiveResearchGenerator.generateComprehensiveReport(gics4, {
        enableSearch: true // 启用网络搜索获取最新数据
      });

      progress.steps[0].status = 'completed';
      progress.steps.push({ step: 2, name: '生成行业认知基准', status: 'in_progress' });

      // 步骤2: 生成行业认知基准
      const benchmark = await industryBenchmarkGenerator.generateBenchmark(report, {
        useCache: false // 强制重新生成
      });

      progress.steps[1].status = 'completed';
      progress.status = 'completed';
      progress.benchmark = benchmark;

      console.log(`[基准生成] 生成完成: ${gics4}`);
      return progress;

    } catch (error) {
      progress.status = 'failed';
      progress.error = error.message;
      console.error(`[基准生成] 生成失败: ${error.message}`);
      return progress;
    }
  }

  /**
   * 加载通用基准
   */
  async loadGeneralBenchmark() {
    // 通用基准缓存文件路径
    const fs = require('fs');
    const path = require('path');
    const cachePath = path.join(__dirname, '../../cache/general_benchmark.json');

    // 如果缓存存在，直接返回
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(content);
    }

    // 否则生成通用基准
    console.log('[通用基准] 生成通用认知基准...');
    return this.generateGeneralBenchmark();
  }

  /**
   * 生成通用认知基准
   */
  async generateGeneralBenchmark() {
    // 简化的通用基准结构
    const generalBenchmark = {
      meta: {
        benchmark_type: 'general',
        description: '通用认知基准，适用于无特定行业基准的文章',
        version: '1.0',
        generated_at: new Date().toISOString()
      },
      evaluation_dimensions: {
        factual_accuracy: {
          description: '事实准确性评估',
          key_points: ['数据准确性', '信息来源可靠', '逻辑一致性']
        },
        industry_insight: {
          description: '内容洞察力评估',
          key_points: ['深度分析', '独到见解', '专业性']
        },
        strategic_value: {
          description: '战略价值评估',
          key_points: ['决策参考价值', '可执行性', '前瞻性']
        },
        data_quality: {
          description: '数据质量评估',
          key_points: ['数据完整性', '数据时效性', '来源可信度']
        }
      },
      scoring_criteria: {
        excellent: { threshold: '90分以上', characteristics: ['数据详实准确', '分析深入独到', '决策价值高'] },
        good: { threshold: '70-90分', characteristics: ['数据基本准确', '分析有一定深度', '有参考价值'] },
        acceptable: { threshold: '50-70分', characteristics: ['数据存在一些问题', '分析较为表面', '参考价值有限'] },
        poor: { threshold: '50分以下', characteristics: ['数据严重失实', '缺乏分析', '无参考价值'] }
      }
    };

    // 缓存通用基准
    const fs = require('fs');
    const path = require('path');
    const cacheDir = path.join(__dirname, '../../cache');
    const cachePath = path.join(cacheDir, 'general_benchmark.json');

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    fs.writeFileSync(cachePath, JSON.stringify(generalBenchmark, null, 2), 'utf-8');

    return generalBenchmark;
  }

  /**
   * 解析JSON响应
   */
  parseJSONResponse(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      const jsonMatch2 = response.match(/\{[\s\S]*\}/);
      if (jsonMatch2) {
        return JSON.parse(jsonMatch2[0]);
      }
      throw new Error('无法解析JSON响应');
    }
  }

  /**
   * 获取模型使用统计
   */
  getModelUsageStats() {
    return this.modelRouter.getUsageStats();
  }
}

module.exports = new CognitiveOrchestrator();
