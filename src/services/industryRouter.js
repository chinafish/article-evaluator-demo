const axios = require('axios');

class IndustryRouter {
  constructor() {
    // 路由配置
    this.config = {
      confidenceThreshold: parseFloat(process.env.ROUTING_CONFIDENCE_THRESHOLD) || 0.7,
      minContentLength: parseInt(process.env.ROUTING_MIN_CONTENT_LENGTH) || 100
    };

    // 大模型配置
    const provider = process.env.AI_PROVIDER || 'openai';
    this.apiConfig = {
      provider: provider,
      apiKey: process.env.AI_API_KEY,
      baseURL: this.getBaseURLForProvider(provider),
      model: this.getRouterModelForProvider(provider)
    };
  }

  /**
   * 路由文章到合适的解析器
   * @param {Object} article - 文章对象 {title, content, source}
   * @returns {Promise<Object>} 路由结果
   */
  async route(article) {
    try {
      // 1. 快速预筛选：检查内容长度
      const contentLength = (article.title + article.content).length;
      if (contentLength < this.config.minContentLength) {
        console.log('[路由] 内容过短，使用通用解析器');
        return {
          analyzer: 'general',
          confidence: 'fallback',
          reason: '内容过短，使用通用基准'
        };
      }

      // 2. 大模型智能路由判断
      console.log('[路由] 开始LLM智能路由...');
      const routingDecision = await this.llmRouting(article);

      // 3. 根据置信度决定路由
      if (routingDecision.confidence >= this.config.confidenceThreshold) {
        console.log(`[路由] 匹配SaaS解析器 (置信度: ${routingDecision.confidence})`);
        return {
          analyzer: 'saas',
          confidence: routingDecision.confidence >= 0.85 ? 'high' : 'medium',
          confidenceScore: routingDecision.confidence,
          reason: routingDecision.reason,
          keyPoints: routingDecision.keyPoints
        };
      } else {
        console.log(`[路由] 使用通用解析器 (置信度: ${routingDecision.confidence})`);
        return {
          analyzer: 'general',
          confidence: 'fallback',
          confidenceScore: routingDecision.confidence,
          reason: routingDecision.reason || '未达到SaaS行业置信度阈值'
        };
      }

    } catch (error) {
      // 异常情况默认使用通用解析器
      console.error('[路由错误] 降级到通用解析器:', error.message);
      return {
        analyzer: 'general',
        confidence: 'fallback',
        error: error.message
      };
    }
  }

  /**
   * 大模型智能路由判断
   * @param {Object} article - 文章对象
   * @returns {Promise<Object>} 路由决策
   */
  async llmRouting(article) {
    try {
      // 构造路由提示词
      const prompt = this.buildRoutingPrompt(article);

      // 调用大模型
      const response = await this.callLLM(prompt);

      // 解析响应
      const decision = this.parseRoutingResponse(response);

      return decision;

    } catch (error) {
      throw new Error(`大模型路由失败: ${error.message}`);
    }
  }

  /**
   * 构造路由提示词
   */
  buildRoutingPrompt(article) {
    // 提取文章关键信息（避免token过长）
    const title = article.title || '';
    const contentPreview = article.content
      ? article.content.substring(0, 1500)
      : '';

    return {
      system: `你是一个专业的文章分类助手，擅长识别文章所属的行业和领域。

你的任务是：判断给定的文章是否与SaaS（软件即服务）行业相关。

# SaaS行业特征包括：
- 商业模式：订阅模式、使用量定价、免费增值
- 核心指标：MRR、ARR、CAC、LTV、流失率、NDR等
- 增长策略：PLG（产品驱动增长）、SLG（销售驱动增长）
- 产品概念：产品市场匹配（PMF）、客户成功、单元经济模型
- 相关领域：云计算、企业软件、B2B服务、互联网产品

# 判断标准：
- 0-40%：完全不相关（讨论其他行业，如零售、制造、娱乐等）
- 40-60%：弱相关（涉及软件或互联网，但非SaaS核心）
- 60-80%：中度相关（讨论SaaS相关话题）
- 80-100%：强相关（深度讨论SaaS行业的商业模式、指标、策略等）

# 输出格式（必须是有效的JSON）：
{
  "is_related": true/false,
  "confidence": 0.0-1.0,
  "reason": "判断依据",
  "key_points": ["文章关键点1", "关键点2"]
}`,

      user: `请判断以下文章是否与SaaS行业相关：

标题：${title}

内容：${contentPreview}

请输出JSON格式的判断结果。`
    };
  }

  /**
   * 调用大模型
   */
  async callLLM(prompt) {
    const { provider, apiKey, baseURL, model } = this.apiConfig;

    // 使用更低的temperature以获得更稳定的判断
    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model: model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        temperature: 0.3,  // 降低随机性，提高稳定性
        max_tokens: 500    // 路由判断不需要太长输出
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000  // 60秒超时
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * 解析路由响应
   */
  parseRoutingResponse(response) {
    try {
      // 尝试直接解析JSON
      const parsed = JSON.parse(response);

      return {
        confidence: parsed.confidence || 0,
        reason: parsed.reason || '',
        keyPoints: parsed.key_points || []
      };

    } catch (error) {
      // 如果解析失败，尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          confidence: parsed.confidence || 0,
          reason: parsed.reason || '',
          keyPoints: parsed.key_points || []
        };
      }

      // 完全解析失败，返回低置信度
      console.error('[路由响应解析失败]', response);
      return {
        confidence: 0,
        reason: '无法解析路由判断结果',
        keyPoints: []
      };
    }
  }

  /**
   * 获取路由模型（使用更快的模型）
   */
  getRouterModel() {
    const provider = this.apiConfig.provider;

    // 为路由任务选择更快的模型
    switch (provider) {
      case 'openai':
        return process.env.ROUTING_MODEL || 'gpt-3.5-turbo';
      case 'qwen':
        return 'qwen-turbo';
      case 'wenxin':
        return 'ernie-speed';
      case 'kimi':
        return process.env.ROUTING_MODEL || process.env.AI_MODEL;
      default:
        return process.env.AI_MODEL || 'gpt-3.5-turbo';
    }
  }

  /**
   * 获取API Base URL
   */
  getBaseURL() {
    switch (this.apiConfig.provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'qwen': return 'https://dashscope.aliyuncs.com/api/v1';
      case 'wenxin': return 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop';
      case 'kimi': return process.env.AI_BASE_URL;
      default: return process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    }
  }

  /**
   * 获取路由模型（用于构造函数，接受provider参数）
   */
  getRouterModelForProvider(provider) {
    switch (provider) {
      case 'openai':
        return process.env.ROUTING_MODEL || 'gpt-3.5-turbo';
      case 'qwen':
        return 'qwen-turbo';
      case 'wenxin':
        return 'ernie-speed';
      case 'kimi':
        return process.env.ROUTING_MODEL || process.env.AI_MODEL;
      default:
        return process.env.AI_MODEL || 'gpt-3.5-turbo';
    }
  }

  /**
   * 获取API Base URL（用于构造函数，接受provider参数）
   */
  getBaseURLForProvider(provider) {
    switch (provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'qwen': return 'https://dashscope.aliyuncs.com/api/v1';
      case 'wenxin': return 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop';
      case 'kimi': return process.env.AI_BASE_URL;
      default: return process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    }
  }
}

module.exports = new IndustryRouter();
