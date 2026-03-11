const express = require('express');
const router = express.Router();
const articleParser = require('../services/articleParser');
const coordinator = require('../services/coordinator');

/**
 * POST /api/evaluate
 * 评估文章内容
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { type, data } = req.body;

    // 验证输入
    if (!type || !['url', 'content'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: '不支持的输入类型，请使用 url 或 content'
        }
      });
    }

    if (!data || typeof data !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATA',
          message: '输入数据无效'
        }
      });
    }

    // 解析文章
    let article;
    if (type === 'url') {
      // 验证URL格式
      try {
        new URL(data);
      } catch {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_URL_FORMAT',
            message: 'URL格式不正确'
          }
        });
      }

      article = await articleParser.parseUrl(data);
    } else {
      // 内容输入
      if (data.length < 50) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CONTENT_TOO_SHORT',
            message: '内容过少，无法进行有效评估（至少50字）'
          }
        });
      }

      if (data.length > 10000) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CONTENT_TOO_LONG',
            message: '内容过长，建议提供核心段落（5000字以内）'
          }
        });
      }

      article = {
        title: '用户提供的文章',
        content: data,
        source: '用户输入'
      };
    }

    console.log(`[评估请求] 类型: ${type}, 标题: ${article.title}`);

    // 协调器进行评估
    const evaluation = await coordinator.analyze(article);

    // 返回结果，包含原文内容用于溯源
    res.json({
      success: true,
      evaluation: {
        ...evaluation,
        article_title: article.title || '',  // 文章标题
        article_content: article.content,  // 纯文本内容
        article_html: article.htmlContent || '',  // HTML内容（保持排版）
        article_url: article.url || data,  // 原文URL
        is_partial_content: article.isPartialContent || false  // 是否为部分内容
      }
    });

  } catch (error) {
    console.error('[评估错误]', error.message);

    // 根据错误类型返回不同的状态码
    if (error.message.includes('链接无效')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: '链接无效，请检查后重试'
        }
      });
    }

    if (error.message.includes('请求超时')) {
      return res.status(408).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: '请求超时，请重试'
        }
      });
    }

    if (error.message.includes('限制了自动访问') || error.message.includes('无法自动解析')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PARSE_FAILED',
          message: error.message  // 使用原始错误消息
        }
      });
    }

    // 默认错误
    res.status(500).json({
      success: false,
      error: {
        code: 'EVALUATION_FAILED',
        message: '评估失败，请稍后重试'
      }
    });
  }
});

module.exports = router;
