const express = require('express');
const router = express.Router();
const articleParser = require('../services/articleParser');
const CognitiveOrchestrator = require('../services/CognitiveOrchestrator');
const { ArticleEvaluatorV15 } = require('../services/articleEvaluator.v1.5');
const benchmarkData = require('../services/benchmarkData');
const industryBenchmarkGenerator = require('../services/industryBenchmarkGenerator');

const articleEvaluatorV15 = new ArticleEvaluatorV15();

router.get('/', async (req, res) => {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

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

    if (!url && !content) {
      sendProgress('error', 0, '❌ 请提供文章 URL 或内容', {});
      return res.end();
    }

    // 超时处理
    const TIMEOUT = 180000; // 3分钟
    const timeout = setTimeout(() => {
      sendProgress('error', 0, '❌ 评估超时', {
        error: '评估时间过长，请稍后重试'
      });
      res.end();
    }, TIMEOUT);

    // 步骤1: 解析文章 (0-10%)
    sendProgress('parsing', 0, '准备评估...', {});
    sendProgress('parsing', 5, '正在解析文章...', {});

    let article;
    if (url) {
      article = await articleParser.parseUrl(url);
    } else {
      // 直接内容处理
      article = {
        title: '直接输入内容',
        content: content,
        url: null,
        publishDate: null
      };
    }

    sendProgress('parsing', 10, '✅ 文章解析完成', {
      title: article.title,
      content: article.content?.substring(0, 200) + '...'
    });

    // 步骤2: GICS分类 (10-30%)
    sendProgress('gics', 15, 'GICS 行业分类中... (正在分析 163 个行业)', {});
    const gicsResult = await CognitiveOrchestrator.classifyGICS(article);
    sendProgress('gics', 30, '✅ GICS 分类完成', {
      gics4: gicsResult.gics4,
      confidence: gicsResult.confidence,
      industryName: gicsResult.industryName
    });

    // 步骤3: AI评估 (30-80%)
    sendProgress('ai-eval', 35, 'AI 评估分析中... (这是最大头的步骤，请稍候)', {});

    // 获取行业基准
    const industryBenchmark = await benchmarkData.getByGics4(gicsResult.gics4);
    const hasIndustryBenchmark = industryBenchmark && industryBenchmark.length > 0;

    // 加载缓存的行业研究报告（含竞争格局、产业链等深度数据）
    const cachedBenchmark = await industryBenchmarkGenerator.loadCachedBenchmark(gicsResult.gics4);
    const report = cachedBenchmark?.industry_research_report || null;

    // 使用缓存中的准确行业名称（可能比GICS分类结果更完整）
    const accurateGics4 = cachedBenchmark?.gics4 || gicsResult.gics4;

    // 构建v1.5评估上下文
    const benchmark = hasIndustryBenchmark ? industryBenchmark[0] : null;

    // 从缓存基准中提取精确数据（供数据核查和盲点检测使用）
    const keyDataPoints = cachedBenchmark?.evaluation_dimensions?.factual_accuracy?.key_data_points || [];
    const requiredKnowledge = cachedBenchmark?.evaluation_dimensions?.industry_insight?.required_knowledge || [];
    const highValueTopics = cachedBenchmark?.evaluation_dimensions?.strategic_value?.high_value_topics || [];
    const keyChallenges = report?.key_challenges?.challenges || [];

    const context = {
      userIndustry: 'SaaS',
      userStage: '成熟期',
      userFocus: '竞争格局、客户增长',
      industryName: accurateGics4,
      gics4: accurateGics4,
      industryStage: report?.industry_overview?.development_stage || benchmark?.industry_stage || '成长期',

      // 从缓存研究报告中提取关键数据
      keyData: buildKeyDataFromReport(report),
      competitiveLandscape: buildCompetitiveLandscapeFromReport(report),
      industryChain: report?.industry_chain || '',
      successFactors: Array.isArray(report?.success_factors) ? report.success_factors :
        Array.isArray(report?.success_factors?.critical_success_factors) ? report.success_factors.critical_success_factors :
        Array.isArray(benchmark?.critical_success_factors) ? benchmark.critical_success_factors : [],
      commonMisconceptions: benchmark?.common_misconceptions || [],

      // 研究报告摘要（截断控制prompt大小）
      industryReport: report ? `${report.executive_summary || ''}\n\n${report.industry_overview?.industry_definition || ''}`.substring(0, 800) : '暂无',

      // 行业认知基准：注入精确基准数据（替代之前的'已提供'占位符）
      industryBenchmark: keyDataPoints.length > 0
        ? keyDataPoints.map(p => `- ${p.metric}：${p.benchmark_value}（可接受偏差：${p.acceptable_range}，来源：${p.source}）`).join('\n')
        : '暂无精确基准数据',

      // 行业知识维度和挑战（供盲点检测使用）
      requiredKnowledge: requiredKnowledge,
      keyChallenges: keyChallenges,
      highValueTopics: highValueTopics,

      articleType: null
    };

    let aiResult;
    if (hasIndustryBenchmark) {
      aiResult = await articleEvaluatorV15.evaluateWithIndustry(
        article,
        context,
        (internalProgress) => {
          const adjustedProgress = 35 + (internalProgress * 0.45);
          const message = internalProgress < 50
            ? 'AI 评估分析中... (这是最大头的步骤，请稍候)'
            : internalProgress < 80
            ? 'AI 评估分析中... (已完成一半)'
            : 'AI 评估分析中... (即将完成)';
          sendProgress('ai-eval', Math.round(adjustedProgress), message, {});
        }
      );
    } else {
      aiResult = await articleEvaluatorV15.evaluateWithGeneral(
        article,
        context,
        (internalProgress) => {
          const adjustedProgress = 35 + (internalProgress * 0.45);
          sendProgress('ai-eval', Math.round(adjustedProgress), 'AI 评估分析中...', {});
        }
      );
    }

    sendProgress('ai-eval', 80, '✅ AI 评估完成', {
      decisionPriority: aiResult.decision_priority || 'N/A',
      relevance: aiResult.relevance_score || 'N/A',
      urgency: aiResult.urgency_level || 'N/A'
    });

    // 步骤4: 生成战略建议 (80-90%)
    sendProgress('strategy', 85, '正在生成战略建议...', {});
    const finalResult = {
      article,
      gics: gicsResult,
      evaluation: {
        ...aiResult,
        industry_data: hasIndustryBenchmark ? industryBenchmark : null,
        industry_report: report
      }
    };

    // 在成功完成时清除超时
    clearTimeout(timeout);

    // 步骤5: 完成 (90-100%)
    sendProgress('complete', 100, '🎉 评估完成', finalResult);
    res.end();

  } catch (error) {
    console.error('[SSE Error]', error);
    sendProgress('error', 0, '❌ 解析失败', { error: error.message });
    res.end();
  }
});

module.exports = router;

/**
 * 从行业研究报告中提取关键数据表格
 */
function buildKeyDataFromReport(report) {
  if (!report?.industry_overview) return [];
  const overview = report.industry_overview;
  const rows = [];
  if (overview.market_scale) rows.push({ metric: '市场规模', value: overview.market_scale, source: '行业研究报告' });
  if (overview.growth_trend) rows.push({ metric: '增长趋势', value: overview.growth_trend, source: '行业研究报告' });
  if (overview.global_positioning) rows.push({ metric: '全球定位', value: overview.global_positioning, source: '行业研究报告' });

  // 从竞争格局中提取全球冠军的关键财务数据
  const champ = report.competitive_landscape?.global_champion_analysis;
  if (champ?.key_financials) {
    const kf = champ.key_financials;
    rows.push({ metric: '全球头部企业', value: `${champ.name} (${champ.country})`, source: '行业研究报告' });
    if (kf.revenue) rows.push({ metric: `${champ.name} 营收`, value: kf.revenue, source: '行业研究报告' });
    if (kf.profit_margin) rows.push({ metric: `${champ.name} 利润率`, value: kf.profit_margin, source: '行业研究报告' });
    if (kf.market_cap) rows.push({ metric: `${champ.name} 市值`, value: kf.market_cap, source: '行业研究报告' });
  }

  // 从竞争格局中提取市场集中度
  const cl = report.competitive_landscape;
  if (cl?.market_concentration) rows.push({ metric: '市场集中度', value: cl.market_concentration, source: '行业研究报告' });

  return rows;
}

/**
 * 从行业研究报告中构建竞争格局描述
 */
function buildCompetitiveLandscapeFromReport(report) {
  if (!report?.competitive_landscape) return '暂无';
  const cl = report.competitive_landscape;
  let text = '';

  // 市场集中度
  if (cl.market_concentration) {
    text += `市场集中度：${cl.market_concentration}。`;
  }

  // 全球冠军
  if (cl.global_champion_analysis) {
    const champ = cl.global_champion_analysis;
    text += `全球龙头企业：${champ.name}（${champ.country}），${champ.market_position}。`;
    if (champ.strengths?.length) text += `核心优势：${champ.strengths.join('、')}。`;
  }

  // 中国企业
  if (cl.chinese_companies_analysis?.length) {
    const names = cl.chinese_companies_analysis.map(c => `${c.name}(${c.global_ranking})`).join('、');
    text += `中国代表企业：${names}。`;
  }

  // 竞争模式
  if (cl.competition_pattern) {
    text += cl.competition_pattern;
  }

  return text.substring(0, 800);
}