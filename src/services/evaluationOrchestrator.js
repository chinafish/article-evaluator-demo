/**
 * 评估编排器
 *
 * 协调三阶段评估流程：
 * 1. 生成产业研究报告
 * 2. 生成行业判断基准
 * 3. 评估文章
 */

const industryResearchGenerator = require('./industryResearchGenerator');
const industryBenchmarkGenerator = require('./industryBenchmarkGenerator');
const articleEvaluatorWithBenchmark = require('./articleEvaluatorWithBenchmark');
const benchmarkData = require('./benchmarkData');

class EvaluationOrchestrator {
  /**
   * 完整的三阶段评估流程
   * @param {Object} article - 文章对象
   * @param {string} gics4 - GICS四级分类
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 评估结果
   */
  async evaluate(article, gics4, options = {}) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`开始三阶段评估流程`);
    console.log(`文章: ${article.title}`);
    console.log(`行业: ${gics4}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // 阶段1：生成产业研究报告
      console.log(`[阶段1/3] 生成产业研究报告...`);
      const report = await industryResearchGenerator.generateReport(gics4, {
        useCache: options.useCache !== false,
        enableSearch: options.enableSearch || false
      });
      console.log(`[阶段1/3] ✅ 产业研究报告生成完成\n`);

      // 阶段2：生成行业判断基准
      console.log(`[阶段2/3] 生成行业判断基准...`);
      const benchmark = await industryBenchmarkGenerator.generateBenchmark(report, {
        useCache: options.useCache !== false
      });
      console.log(`[阶段2/3] ✅ 行业判断基准生成完成\n`);

      // 阶段3：评估文章
      console.log(`[阶段3/3] 评估文章...`);
      const evaluation = await articleEvaluatorWithBenchmark.evaluate(article, benchmark, report);
      console.log(`[阶段3/3] ✅ 文章评估完成\n`);

      // 组装完整结果
      const result = {
        evaluation: evaluation,
        benchmark_summary: this.summarizeBenchmark(benchmark),
        report_summary: this.summarizeReport(report),
        metadata: {
          gics4: gics4,
          evaluation_date: new Date().toISOString(),
          stages_completed: 3,
          cache_used: options.useCache !== false
        }
      };

      console.log(`${'='.repeat(60)}`);
      console.log(`评估流程全部完成！`);
      console.log(`${'='.repeat(60)}\n`);

      return result;

    } catch (error) {
      console.error(`[评估流程] 错误: ${error.message}`);
      throw error;
    }
  }

  /**
   * 快速评估（跳过报告生成，使用已有基准）
   * @param {Object} article - 文章对象
   * @param {string} gics4 - GICS四级分类
   * @returns {Promise<Object>} 评估结果
   */
  async quickEvaluate(article, gics4) {
    console.log(`\n[快速评估] ${article.title} (${gics4})`);

    // 尝试加载已有基准
    const benchmark = await industryBenchmarkGenerator.loadCachedBenchmark(gics4);
    if (!benchmark) {
      throw new Error(`未找到行业判断基准: ${gics4}。请先运行完整评估流程生成基准。`);
    }

    console.log(`[快速评估] 使用已缓存的判断基准`);

    // 评估文章
    const evaluation = await articleEvaluatorWithBenchmark.evaluate(article, benchmark);

    return {
      evaluation: evaluation,
      benchmark_summary: this.summarizeBenchmark(benchmark),
      metadata: {
        gics4: gics4,
        evaluation_date: new Date().toISOString(),
        evaluation_mode: 'quick'
      }
    };
  }

  /**
   * 批量评估多篇文章
   * @param {Array} articles - 文章数组
   * @param {string} gics4 - GICS四级分类
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 评估结果数组
   */
  async batchEvaluate(articles, gics4, options = {}) {
    console.log(`\n[批量评估] 开始评估 ${articles.length} 篇文章 (${gics4})`);

    // 只在第一次生成报告和基准
    let report, benchmark;

    if (options.generateBenchmark !== false) {
      console.log(`[批量评估] 生成报告和基准...`);
      report = await industryResearchGenerator.generateReport(gics4, {
        useCache: options.useCache !== false
      });
      benchmark = await industryBenchmarkGenerator.generateBenchmark(report, {
        useCache: options.useCache !== false
      });
    } else {
      benchmark = await industryBenchmarkGenerator.loadCachedBenchmark(gics4);
      if (!benchmark) {
        throw new Error(`未找到行业判断基准: ${gics4}`);
      }
    }

    // 逐篇评估文章
    const results = [];
    for (let i = 0; i < articles.length; i++) {
      console.log(`\n[批量评估] 评估第 ${i + 1}/${articles.length} 篇...`);
      try {
        const evaluation = await articleEvaluatorWithBenchmark.evaluate(
          articles[i],
          benchmark,
          report
        );
        results.push({
          article: articles[i],
          evaluation: evaluation,
          status: 'success'
        });
      } catch (error) {
        console.error(`[批量评估] 第 ${i + 1} 篇评估失败: ${error.message}`);
        results.push({
          article: articles[i],
          evaluation: null,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log(`\n[批量评估] 完成！成功: ${results.filter(r => r.status === 'success').length}/${results.length}`);

    return results;
  }

  /**
   * 总结基准信息
   */
  summarizeBenchmark(benchmark) {
    return {
      gics4: benchmark.gics4,
      version: benchmark.metadata?.benchmark_version,
      generated_at: benchmark.generated_at,
      evaluation_dimensions: Object.keys(benchmark.evaluation_dimensions || {}),
      scoring_levels: Object.keys(benchmark.scoring_criteria || {})
    };
  }

  /**
   * 总结报告信息
   */
  summarizeReport(report) {
    return {
      gics4: report.gics4,
      generated_at: report.generated_at,
      industry_overview: {
        name: report.industry_overview?.industry_name,
        stage: report.industry_overview?.development_stage
      },
      key_trends: report.development_trends?.technology_trends?.slice(0, 3) || [],
      key_challenges: report.key_challenges?.challenges?.slice(0, 3).map(c => ({
        area: c.area,
        impact: c.impact_level
      })) || []
    };
  }

  /**
   * 列出已缓存的报告和基准
   */
  async listCached() {
    const fs = require('fs');
    const path = require('path');

    const reportDir = path.join(__dirname, '../../cache/industry_reports');
    const benchmarkDir = path.join(__dirname, '../../cache/industry_benchmarks');

    const reports = fs.existsSync(reportDir)
      ? fs.readdirSync(reportDir).map(f => f.replace('.json', ''))
      : [];

    const benchmarks = fs.existsSync(benchmarkDir)
      ? fs.readdirSync(benchmarkDir).map(f => f.replace('.json', ''))
      : [];

    return {
      reports: reports.sort(),
      benchmarks: benchmarks.sort()
    };
  }

  /**
   * 清除所有缓存
   */
  async clearAllCache() {
    await industryResearchGenerator.clearCache();
    await industryBenchmarkGenerator.clearCache();
  }
}

module.exports = new EvaluationOrchestrator();
