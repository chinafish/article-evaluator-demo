/**
 * 文章评估服务 v1.3
 *
 * 核心改进：
 * 1. 使用v1.3 Prompt模板（行业认知基准 + 通用认知基准）
 * 2. 动态上下文注入（单一行业Prompt模板支持多行业）
 * 3. GICS路由：confidence ≥ 0.7 → 行业基准，否则 → 通用基准
 * 4. 4级可信度标注（Tier 1/2/3/4）
 * 5. 集成决策建议列
 */

const { industryPromptTemplate } = require('../prompts/industryPrompt.v1.3');
const { generalPromptTemplate } = require('../prompts/generalPrompt.v1.3');
const contextBuilder = require('./contextBuilder');
const ModelRouter = require('./ModelRouter');

class ArticleEvaluatorV13 {
  constructor() {
    this.modelRouter = ModelRouter;
  }

  /**
   * 评估文章主入口
   * @param {object} article - 文章对象 {title, content, source, url}
   * @param {object} routeDecision - 路由决策对象
   * @returns {Promise<object>} 评估结果
   */
  async evaluate(article, routeDecision) {
    console.log(`[评估器v1.3] 开始评估文章: ${article.title}`);

    try {
      // 根据路由决策选择评估方式
      if (routeDecision.resultType === 'INDUSTRY_BENCHMARK_READY') {
        return await this.evaluateWithIndustryBenchmark(article, routeDecision);
      } else if (routeDecision.resultType === 'GENERAL_BENCHMARK') {
        return await this.evaluateWithGeneralBenchmark(article, routeDecision);
      } else {
        throw new Error(`未知的路由结果类型: ${routeDecision.resultType}`);
      }

    } catch (error) {
      console.error(`[评估器v1.3] 评估失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 使用行业认知基准评估
   */
  async evaluateWithIndustryBenchmark(article, routeDecision) {
    console.log(`[评估器v1.3] 使用行业认知基准: ${routeDecision.gics4}`);

    try {
      // 步骤1: 构建行业上下文
      const context = await contextBuilder.buildContext(
        routeDecision.gics4,
        routeDecision.benchmark
      );

      // 步骤2: 生成Prompt
      const prompt = industryPromptTemplate(context);

      // 步骤3: 调用AI模型
      const response = await this.modelRouter.callAI(
        'ARTICLE_EVALUATION_INDUSTRY',
        {
          system: prompt,
          user: `请评估以下文章：\n\n标题：${article.title}\n来源：${article.source || '未知'}\n${article.url ? `链接：${article.url}\n` : ''}内容：${article.content}`
        },
        {
          temperature: 0.5,
          maxTokens: 4000
        }
      );

      // 步骤4: 解析响应
      const evaluation = this.parseEvaluationResponse(response);

      // 步骤5: 添加元数据
      return {
        ...evaluation,
        meta: {
          version: 'v1.3',
          benchmark_type: 'industry',
          gics4: routeDecision.gics4,
          benchmark_name: `${routeDecision.gics4}行业认知基准`,
          evaluated_at: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`[评估器v1.3] 行业基准评估失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 使用通用认知基准评估
   */
  async evaluateWithGeneralBenchmark(article, routeDecision) {
    console.log(`[评估器v1.3] 使用通用认知基准`);

    try {
      // 步骤1: 识别文章类型
      const articleType = await this.classifyArticleType(article);

      // 步骤2: 构建通用上下文
      const context = await contextBuilder.buildGeneralContext(articleType);

      // 步骤3: 生成Prompt
      const prompt = generalPromptTemplate(context);

      // 步骤4: 调用AI模型
      const response = await this.modelRouter.callAI(
        'ARTICLE_EVALUATION_GENERAL',
        {
          system: prompt,
          user: `请评估以下文章：\n\n标题：${article.title}\n来源：${article.source || '未知'}\n${article.url ? `链接：${article.url}\n` : ''}内容：${article.content}`
        },
        {
          temperature: 0.5,
          maxTokens: 4000
        }
      );

      // 步骤5: 解析响应
      const evaluation = this.parseEvaluationResponse(response);

      // 步骤6: 添加元数据
      return {
        ...evaluation,
        meta: {
          version: 'v1.3',
          benchmark_type: 'general',
          article_type: articleType,
          benchmark_name: '通用认知基准',
          evaluated_at: new Date().toISOString(),
          reason: routeDecision.reason
        }
      };

    } catch (error) {
      console.error(`[评估器v1.3] 通用基准评估失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 识别文章类型（用于通用基准）
   */
  async classifyArticleType(article) {
    console.log(`[文章类型识别] 正在识别文章类型...`);

    const prompt = {
      system: `你是一位专业的文章分类专家。

你的任务是：根据文章内容，判断文章属于以下哪种类型：
- **生活娱乐类**：旅游、美食、影视、音乐、游戏
- **教育学习类**：课程、教程、学习方法
- **健康养生类**：医疗、健身、营养
- **科技资讯类**：数码产品、互联网应用
- **财经消费类**：理财、购物、房产
- **人文社科类**：历史、文化、社会现象

请输出JSON格式：
{
  "type": "生活娱乐类",
  "subtype": "旅游目的地推荐",
  "confidence": 0.0-1.0,
  "reason": "判断依据"
}`,
      user: `请识别以下文章的类型：

标题：${article.title}
来源：${article.source || '未知'}
内容：${article.content.substring(0, 1000)}

输出JSON格式的分类结果。`
    };

    try {
      const response = await this.modelRouter.callAI('ARTICLE_TYPE_CLASSIFICATION', prompt, {
        temperature: 0.3,
        maxTokens: 300
      });

      const result = this.parseJSONResponse(response);
      console.log(`[文章类型识别] 识别结果: ${result.type} (置信度: ${result.confidence})`);

      return result.type || '待识别';

    } catch (error) {
      console.error(`[文章类型识别] 识别失败: ${error.message}`);
      return '待识别';
    }
  }

  /**
   * 解析评估响应
   * 提取BLOCK 0/1/2/3结构
   */
  parseEvaluationResponse(response) {
    console.log(`[评估器v1.3] 解析评估响应...`);

    try {
      // 尝试解析为JSON
      const jsonResult = this.parseJSONResponse(response);
      if (jsonResult) {
        return jsonResult;
      }

      // 如果不是JSON，提取Markdown结构
      return this.parseMarkdownStructure(response);

    } catch (error) {
      console.error(`[评估器v1.3] 解析失败: ${error.message}`);

      // 降级：返回原始响应
      return {
        raw_response: response,
        parse_error: error.message
      };
    }
  }

  /**
   * 解析Markdown结构
   * 提取BLOCK 0/1/2/3
   */
  parseMarkdownStructure(markdown) {
    const blocks = {
      BLOCK_0: {},
      BLOCK_1: {},
      BLOCK_2: {},
      BLOCK_3: {}
    };

    // 提取BLOCK 0
    const block0Match = markdown.match(/### BLOCK 0 总体判断[\s\S]*?(?=### BLOCK|$)/);
    if (block0Match) {
      blocks.BLOCK_0 = {
        content: block0Match[0].trim(),
        title: '总体判断（首屏）'
      };
    }

    // 提取BLOCK 1
    const block1Match = markdown.match(/### BLOCK 1 核查详情[\s\S]*?(?=### BLOCK|$)/);
    if (block1Match) {
      blocks.BLOCK_1 = {
        content: block1Match[0].trim(),
        title: '核查详情'
      };
    }

    // 提取BLOCK 2
    const block2Match = markdown.match(/### BLOCK 2 认知盲区[\s\S]*?(?=### BLOCK|$)/);
    if (block2Match) {
      blocks.BLOCK_2 = {
        content: block2Match[0].trim(),
        title: '认知盲区'
      };
    }

    // 提取BLOCK 3
    const block3Match = markdown.match(/### BLOCK 3 评估依据[\s\S]*?(?=### BLOCK|$)/);
    if (block3Match) {
      blocks.BLOCK_3 = {
        content: block3Match[0].trim(),
        title: '评估依据',
        collapsible: true // 标记为可折叠
      };
    }

    return {
      blocks,
      full_markdown: markdown,
      structure: 'BLOCK'
    };
  }

  /**
   * 解析JSON响应
   */
  parseJSONResponse(response) {
    try {
      // 尝试直接解析
      return JSON.parse(response);
    } catch (error) {
      // 尝试提取JSON代码块
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // 尝试提取JSON对象
      const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        return JSON.parse(jsonObjectMatch[0]);
      }

      return null;
    }
  }
}

module.exports = new ArticleEvaluatorV13();
