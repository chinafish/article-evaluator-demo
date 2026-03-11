const express = require('express');
const router = express.Router();
const articleParser = require('../services/articleParser');
const CognitiveOrchestrator = require('../services/CognitiveOrchestrator');

// 存储待处理的评估任务（用于用户选择后的后续处理）
const pendingTasks = new Map();

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

    // 认知智能体进行评估
    const result = await CognitiveOrchestrator.evaluate(article);

    // 如果返回的是路由决策（需要用户选择），返回决策信息
    if (result.routeDecision) {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // 保存任务信息
      pendingTasks.set(taskId, {
        article,
        routeDecision: result.routeDecision,
        createdAt: Date.now()
      });

      // 清理过期任务（1小时）
      setTimeout(() => {
        pendingTasks.delete(taskId);
      }, 60 * 60 * 1000);

      return res.json({
        success: true,
        requires_user_action: true,
        task_id: taskId,
        route_decision: {
          type: result.routeDecision.resultType,
          reason: result.routeDecision.reason,
          gics4: result.routeDecision.gics4,
          options: result.routeDecision.options
        },
        article_info: {
          title: article.title,
          source: article.source,
          url: article.url
        }
      });
    }

    // 直接返回评估结果
    res.json({
      success: true,
      evaluation: {
        ...result,
        article_title: article.title || '',
        article_content: article.content,
        article_html: article.htmlContent || '',
        article_url: article.url || data,
        is_partial_content: article.isPartialContent || false
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

/**
 * POST /api/evaluate/choose-option
 * 用户选择路由选项后的处理
 */
router.post('/evaluate/choose-option', async (req, res) => {
  try {
    const { task_id, option } = req.body;

    // 验证输入
    if (!task_id || !option) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: '缺少必要参数: task_id 和 option'
        }
      });
    }

    // 获取待处理任务
    const task = pendingTasks.get(task_id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: '任务不存在或已过期'
        }
      });
    }

    const { article, routeDecision } = task;

    // 处理用户选择
    if (option === 'generate_benchmark') {
      // 选项1: 生成行业认知基准
      console.log(`[用户选择] 生成行业认知基准: ${routeDecision.gics4}`);

      // 启动异步生成任务
      const generationResult = await CognitiveOrchestrator.generateIndustryBenchmark(routeDecision.gics4);

      if (generationResult.status === 'failed') {
        return res.status(500).json({
          success: false,
          error: {
            code: 'GENERATION_FAILED',
            message: `认知基准生成失败: ${generationResult.error}`
          }
        });
      }

      // 使用新生成的基准进行评估
      const evaluation = await CognitiveOrchestrator.evaluateWithIndustryBenchmark(
        article,
        {
          gics4: routeDecision.gics4,
          benchmark: generationResult.benchmark
        }
      );

      // 清理任务
      pendingTasks.delete(task_id);

      return res.json({
        success: true,
        evaluation: {
          ...evaluation,
          article_title: article.title || '',
          article_content: article.content,
          article_html: article.htmlContent || '',
          article_url: article.url,
          is_partial_content: article.isPartialContent || false
        }
      });

    } else if (option === 'use_general') {
      // 选项2: 使用通用基准
      console.log('[用户选择] 使用通用认知基准');

      const evaluation = await CognitiveOrchestrator.evaluateWithGeneralBenchmark(
        article,
        routeDecision
      );

      // 清理任务
      pendingTasks.delete(task_id);

      return res.json({
        success: true,
        evaluation: {
          ...evaluation,
          article_title: article.title || '',
          article_content: article.content,
          article_html: article.htmlContent || '',
          article_url: article.url,
          is_partial_content: article.isPartialContent || false
        }
      });

    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OPTION',
          message: `无效的选项: ${option}`
        }
      });
    }

  } catch (error) {
    console.error('[选项处理错误]', error.message);

    res.status(500).json({
      success: false,
      error: {
        code: 'OPTION_HANDLING_FAILED',
        message: '处理用户选择失败，请稍后重试'
      }
    });
  }
});

/**
 * GET /api/evaluate/stats
 * 获取模型使用统计
 */
router.get('/evaluate/stats', (req, res) => {
  try {
    const stats = CognitiveOrchestrator.getModelUsageStats();

    res.json({
      success: true,
      stats: {
        total_calls: stats.totalCalls,
        total_tokens: stats.totalTokens,
        models: stats.models
      }
    });
  } catch (error) {
    console.error('[统计错误]', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FAILED',
        message: '获取统计信息失败'
      }
    });
  }
});

module.exports = router;
