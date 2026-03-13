/**
 * 智能模型路由服务
 *
 * 根据任务复杂度自动选择最合适的AI模型，实现成本与质量的最优平衡
 *
 * 任务类型：
 * - classification: GICS行业分类、文章相关性判断等（使用 qwen3.5-flash）
 * - generation: 产业研究报告生成、认知基准生成、文章评估等（使用 qwen3.5-plus）
 */

const axios = require('axios');

class ModelRouter {
  constructor() {
    // 模型配置
    this.models = {
      // Qwen Flash - 快速、低成本，适合判断类任务
      qwenFlash: {
        name: 'qwen3.5-flash',
        provider: 'qwen',
        apiKey: process.env.DASHSCOPE_API_KEY,
        baseURL: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        taskType: 'classification',
        description: '快速判断模型'
      },
      // Qwen Plus - 强大推理能力，适合内容生成类任务
      qwenPlus: {
        name: 'qwen3.5-plus',
        provider: 'qwen',
        apiKey: process.env.DASHSCOPE_API_KEY,
        baseURL: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        taskType: 'generation',
        description: '强大生成模型'
      },
      // Kimi - 主AI服务（兼容）
      kimi: {
        name: process.env.AI_MODEL || 'kimi-k2-250905',
        provider: 'kimi',
        apiKey: process.env.AI_API_KEY,
        baseURL: process.env.AI_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
        taskType: 'generation',
        description: '主AI服务'
      }
    };

    // 任务到模型的映射配置
    this.taskModelMapping = {
      // 判断类任务 → qwenFlash
      GICS_CLASSIFICATION: 'qwenFlash',
      ARTICLE_RELEVANCE_CHECK: 'qwenFlash',
      ROUTING_DECISION: 'qwenFlash',

      // 生成类任务 → qwenPlus
      INDUSTRY_REPORT_GENERATION: 'qwenPlus',
      BENCHMARK_GENERATION: 'qwenPlus',
      ARTICLE_EVALUATION: 'qwenPlus',

      // 默认模型
      DEFAULT: 'qwenPlus'
    };

    // 模型使用统计（用于成本追踪）
    this.usageStats = {
      qwenFlash: { calls: 0, tokens: 0 },
      qwenPlus: { calls: 0, tokens: 0 },
      kimi: { calls: 0, tokens: 0 }
    };
  }

  /**
   * 根据任务类型获取合适的模型
   * @param {string} taskType - 任务类型
   * @returns {Object} 模型配置
   */
  getModelForTask(taskType) {
    // 延迟检查环境变量，避免模块加载顺序问题
    const routingEnabled = process.env.MODEL_ROUTING_ENABLED === 'true';

    if (!routingEnabled) {
      console.log(`[模型路由] 智能路由已禁用（MODEL_ROUTING_ENABLED=${process.env.MODEL_ROUTING_ENABLED}），使用默认模型: kimi`);
      return this.models.kimi;
    }

    // 查找任务对应的模型
    const modelKey = this.taskModelMapping[taskType] || this.taskModelMapping.DEFAULT;
    const model = this.models[modelKey];

    console.log(`[模型路由] 任务: ${taskType} → 模型: ${model.name} (${model.description})`);
    return model;
  }

  /**
   * 调用AI完成指定任务
   * @param {string} taskType - 任务类型
   * @param {Object} prompt - {system, user}
   * @param {Object} options - 额外选项 {temperature, maxTokens}
   * @returns {Promise<string>} AI响应内容
   */
  async callAI(taskType, prompt, options = {}) {
    const model = this.getModelForTask(taskType);

    try {
      console.log(`[AI调用] 开始调用模型: ${model.name}`);
      console.log(`[AI调用] 任务类型: ${taskType}`);

      const response = await axios.post(
        `${model.baseURL}/chat/completions`,
        {
          model: model.name,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 4000
        },
        {
          headers: {
            'Authorization': `Bearer ${model.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || 180000  // 默认180秒（3分钟）
        }
      );

      const content = response.data.choices[0].message.content;

      // 记录使用统计
      this.recordUsage(model.provider, response.data.usage || {});

      console.log(`[AI调用] 调用成功: ${model.name}`);
      return content;

    } catch (error) {
      console.error(`[AI调用] 调用失败: ${model.name}`, error.message);
      throw new Error(`AI调用失败 (${model.name}): ${error.message}`);
    }
  }

  /**
   * 记录模型使用统计
   */
  recordUsage(provider, usage) {
    const stats = this.usageStats[provider];
    if (stats) {
      stats.calls += 1;
      stats.tokens += usage.total_tokens || 0;
    }
  }

  /**
   * 获取使用统计
   */
  getUsageStats() {
    return {
      models: this.usageStats,
      totalCalls: Object.values(this.usageStats).reduce((sum, s) => sum + s.calls, 0),
      totalTokens: Object.values(this.usageStats).reduce((sum, s) => sum + s.tokens, 0)
    };
  }

  /**
   * 重置使用统计
   */
  resetUsageStats() {
    this.usageStats = {
      qwenFlash: { calls: 0, tokens: 0 },
      qwenPlus: { calls: 0, tokens: 0 },
      kimi: { calls: 0, tokens: 0 }
    };
  }

  /**
   * 为现有代码提供兼容的API
   * 保持与原有服务的兼容性
   */
  async callAICompat(prompt, options = {}) {
    // 如果没有指定任务类型，使用默认
    const taskType = options.taskType || 'ARTICLE_EVALUATION';
    return this.callAI(taskType, prompt, options);
  }
}

// 导出单例
module.exports = new ModelRouter();
