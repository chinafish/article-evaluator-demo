const express = require('express');
const router = express.Router();
const articleParser = require('../services/articleParser');
const CognitiveOrchestrator = require('../services/CognitiveOrchestrator');
const articleEvaluator = require('../services/articleEvaluatorWithBenchmark');
const benchmarkData = require('../services/benchmarkData');

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

    // 步骤1: 解析文章 (0-10%)
    sendProgress('parsing', 5, '正在解析文章...', {});
    const article = await articleParser.parse(url || content);
    sendProgress('parsing', 10, '✅ 文章解析完成', {
      title: article.title,
      content: article.content?.substring(0, 200) + '...'
    });

    // 步骤2: GICS分类 (10-30%)
    sendProgress('gics', 15, '正在进行 GICS 行业分类...', {});
    const gicsResult = await CognitiveOrchestrator.classifyGICS(article);
    sendProgress('gics', 30, '✅ GICS 分类完成', {
      gics4: gicsResult.gics4,
      confidence: gicsResult.confidence,
      industryName: gicsResult.industryName
    });

    // 步骤3: AI评估 (30-80%)
    sendProgress('ai-eval', 35, '正在进行 AI 评估分析...', {});

    // 获取行业基准（简化版）
    const industryBenchmark = await benchmarkData.getByGics4(gicsResult.gics4);

    // 如果没有行业基准，使用通用基准
    const benchmark = industryBenchmark && industryBenchmark.length > 0
      ? industryBenchmark[0]
      : { gics4: '通用', evaluation_dimensions: {}, scoring_criteria: {}, comparison_standards: {}, blind_spots_to_check: {} };

    const aiResult = await articleEvaluator.evaluate(
      article,
      benchmark,
      null, // report
      (internalProgress) => {
        // AI评估内部进度回调 (35%-80%)
        const adjustedProgress = 35 + (internalProgress * 0.45);
        sendProgress('ai-eval', Math.round(adjustedProgress), 'AI 评估分析中...', {});
      }
    );

    sendProgress('ai-eval', 80, '✅ AI 评估完成', {
      decisionPriority: aiResult.decision_priority || 'N/A',
      relevance: aiResult.relevance_score || 'N/A',
      urgency: aiResult.urgency_level || 'N/A'
    });

    // 继续测试...
    sendProgress('complete', 100, '🎉 评估完成', { article, gicsResult, aiResult });
    res.end();

  } catch (error) {
    console.error('[SSE Error]', error);
    sendProgress('error', 0, '❌ 解析失败', { error: error.message });
    res.end();
  }
});

module.exports = router;