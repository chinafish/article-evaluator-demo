const axios = require('axios');
const { SYSTEM_PROMPT } = require('../prompts/saasPrompt.v1.2');

class SaasAnalyzer {
  constructor() {
    const provider = process.env.AI_PROVIDER || 'openai';
    this.apiConfig = {
      provider: provider,
      apiKey: process.env.AI_API_KEY,
      baseURL: this.getBaseURLForProvider(provider),
      model: this.getModelForProvider(provider)
    };
  }

  /**
   * 分析SaaS行业文章
   * @param {Object} article - 文章对象
   * @param {Object} routeInfo - 路由信息
   * @returns {Promise<Object>} 评估结果
   */
  async analyze(article, routeInfo) {
    try {
      console.log('[SaaS分析器] 开始分析...');

      // 1. 构造SaaS专业提示词
      const prompt = this.buildPrompt(article, routeInfo);

      // 2. 调用大模型API
      const response = await this.callAI(prompt);

      // 3. 解析响应
      const evaluation = this.parseResponse(response);

      // 4. 返回结果（标注为SaaS专业评估）
      const result = {
        ...evaluation,
        analyzer_type: 'saas',
        benchmark_match: this.assessBenchmarkMatch(routeInfo),
        route_info: routeInfo,
        article_title: article.title || '未知标题',
        article_url: article.url || null
      };

      console.log('[SaaS分析器] 分析完成');
      return result;

    } catch (error) {
      throw new Error(`SaaS分析失败: ${error.message}`);
    }
  }

  /**
   * 构造SaaS专业提示词
   */
  buildPrompt(article, routeInfo) {
    return {
      system: SYSTEM_PROMPT,
      user: `请评估以下SaaS行业文章：

标题：${article.title}
来源：${article.source}
内容：${article.content}

请基于SaaS行业的专业知识基准进行深度分析，输出JSON格式的评估结果。`
    };
  }

  /**
   * 调用大模型API
   */
  async callAI(prompt) {
    const { provider, apiKey, baseURL, model } = this.apiConfig;

    console.log(`[AI调用] 提供商: ${provider}, 模型: ${model}`);

    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model: model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        temperature: 0.7,
        max_tokens: 3000  // v1.2需要更多tokens来生成结构化的action数组
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 90000  // 90秒超时
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * 解析AI响应
   */
  parseResponse(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      // 尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('AI返回格式错误');
    }
  }

  /**
   * 评估基准匹配度（SaaS专业版）
   */
  assessBenchmarkMatch(routeInfo) {
    return '行业认知基准（SaaS）';
  }

  getBaseURL() {
    switch (this.apiConfig.provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'qwen': return 'https://dashscope.aliyuncs.com/api/v1';
      case 'wenxin': return 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop';
      case 'kimi': return process.env.AI_BASE_URL;
      default: return process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    }
  }

  getModel() {
    switch (this.apiConfig.provider) {
      case 'openai': return process.env.AI_MODEL || 'gpt-3.5-turbo';
      case 'qwen': return 'qwen-plus';
      case 'wenxin': return 'ernie-bot';
      case 'kimi': return process.env.AI_MODEL;
      default: return process.env.AI_MODEL || 'gpt-3.5-turbo';
    }
  }

  getBaseURLForProvider(provider) {
    switch (provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'qwen': return 'https://dashscope.aliyuncs.com/api/v1';
      case 'wenxin': return 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop';
      case 'kimi': return process.env.AI_BASE_URL;
      default: return process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    }
  }

  getModelForProvider(provider) {
    switch (provider) {
      case 'openai': return process.env.AI_MODEL || 'gpt-3.5-turbo';
      case 'qwen': return 'qwen-plus';
      case 'wenxin': return 'ernie-bot';
      case 'kimi': return process.env.AI_MODEL;
      default: return process.env.AI_MODEL || 'gpt-3.5-turbo';
    }
  }
}

module.exports = new SaasAnalyzer();
