const express = require('express');
const router = express.Router();
const articleParser = require('../services/articleParser');
const CognitiveOrchestrator = require('../services/CognitiveOrchestrator');

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

    // 继续测试...
    sendProgress('complete', 100, '🎉 分类完成', { article, gicsResult });
    res.end();

  } catch (error) {
    console.error('[SSE Error]', error);
    sendProgress('error', 0, '❌ 解析失败', { error: error.message });
    res.end();
  }
});

module.exports = router;