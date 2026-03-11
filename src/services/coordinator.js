const industryRouter = require('./industryRouter');
const saasAnalyzer = require('./saasAnalyzer');
const generalAnalyzer = require('./generalAnalyzer');

class Coordinator {
  /**
   * 统一分析接口
   * @param {Object} article - 文章对象
   * @returns {Promise<Object>} 评估结果
   */
  async analyze(article) {
    try {
      // 1. 路由：决定使用哪个解析器
      console.log('\n[协调器] 开始路由...');
      const routeResult = await industryRouter.route(article);

      console.log(`[协调器] 路由结果: ${routeResult.analyzer}, 置信度: ${routeResult.confidence}`);

      // 2. 根据路由结果选择解析器
      let evaluation;
      if (routeResult.analyzer === 'saas') {
        evaluation = await saasAnalyzer.analyze(article, routeResult);
      } else {
        evaluation = await generalAnalyzer.analyze(article, routeResult);
      }

      return evaluation;

    } catch (error) {
      // 3. 如果SaaS解析器失败，降级到通用解析器
      console.error('[协调器] 分析失败，降级到通用解析器:', error.message);

      try {
        return await generalAnalyzer.analyze(article, {
          analyzer: 'general',
          confidence: 'fallback',
          reason: 'SaaS解析失败，降级处理'
        });
      } catch (fallbackError) {
        throw new Error(`所有解析器均失败: ${fallbackError.message}`);
      }
    }
  }
}

module.exports = new Coordinator();
