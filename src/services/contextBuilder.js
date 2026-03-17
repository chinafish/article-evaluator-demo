/**
 * 上下文构建器 v1.3
 *
 * 功能：为行业认知基准Prompt构建动态上下文变量
 * 架构：单一行业Prompt模板 + 动态变量注入
 */

const fs = require('fs');
const path = require('path');
const benchmarkData = require('./benchmarkData');

class IndustryContextBuilder {
  constructor() {
    this.cacheDir = path.join(__dirname, '../../cache/industry_benchmarks');
  }

  /**
   * 构建行业上下文
   * @param {string} gics4 - GICS四级分类
   * @param {object} cachedBenchmark - 缓存的行业认知基准
   * @returns {Promise<object>} 上下文变量对象
   */
  async buildContext(gics4, cachedBenchmark) {
    console.log(`[上下文构建] 开始构建 ${gics4} 行业上下文...`);

    try {
      const context = {
        INDUSTRY_NAME: this.getIndustryName(gics4),
        GICS4: gics4,
        INDUSTRY_STAGE: await this.getIndustryStage(gics4, cachedBenchmark),
        INDUSTRY_DATA: await this.getIndustryData(gics4),
        INDUSTRY_REPORT: await this.getIndustryReport(cachedBenchmark),
        INDUSTRY_BENCHMARK: await this.getIndustryBenchmark(cachedBenchmark),
        SEARCH_KEYWORDS: this.getSearchKeywords(gics4)
      };

      console.log(`[上下文构建] 构建完成`);
      return context;

    } catch (error) {
      console.error(`[上下文构建] 构建失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取行业名称
   */
  getIndustryName(gics4) {
    // 移除可能的"行业"、"领域"后缀
    return gics4.replace(/行业|领域|分类/g, '').trim();
  }

  /**
   * 获取行业发展阶段
   */
  async getIndustryStage(gics4, cachedBenchmark) {
    if (cachedBenchmark && cachedBenchmark.industry_research_report) {
      const report = cachedBenchmark.industry_research_report;

      // 从研究报告的"行业概述"中提取发展阶段
      if (report.industry_overview && report.industry_overview.development_stage) {
        return report.industry_overview.development_stage;
      }
    }

    // 默认值
    return '成长期';
  }

  /**
   * 获取行业关键数据
   * 格式化为Markdown表格
   */
  async getIndustryData(gics4) {
    console.log(`[上下文构建] 获取行业数据: ${gics4}`);

    try {
      // 从何志毅企业图谱数据获取统计指标
      const stats = await benchmarkData.getBenchmarkStats(gics4);

      if (!stats) {
        return `暂无 ${gics4} 的企业图谱统计数据`;
      }

      let markdown = `### ${stats.industry} 行业基准数据（何志毅企业图谱）\n\n`;
      markdown += `**样本数量**：${stats.companyCount} 家企业\n\n`;

      // 关键指标
      if (stats.metrics || Object.keys(stats.metrics).length > 0) {
        markdown += `**关键指标**：\n\n`;

        if (stats.metrics.营收利润率) {
          const avg = (stats.metrics.营收利润率.avg * 100).toFixed(1);
          const median = (stats.metrics.营收利润率.median * 100).toFixed(1);
          markdown += `- 营收利润率：平均 ${avg}%（中位数 ${median}%）\n`;
        }

        if (stats.metrics.ROE) {
          const avg = (stats.metrics.ROE.avg * 100).toFixed(1);
          const median = (stats.metrics.ROE.median * 100).toFixed(1);
          markdown += `- ROE（净资产收益率）：平均 ${avg}%（中位数 ${median}%）\n`;
        }

        if (stats.metrics.研发强度) {
          const avg = (stats.metrics.研发强度.avg * 100).toFixed(1);
          const median = (stats.metrics.研发强度.median * 100).toFixed(1);
          markdown += `- 研发强度：平均 ${avg}%（中位数 ${median}%）\n`;
        }

        markdown += `\n`;
      }

      // 行业领军企业
      if (stats.topCompanies && stats.topCompanies.length > 0) {
        markdown += `**行业领军企业**：\n\n`;
        stats.topCompanies.slice(0, 5).forEach((company, index) => {
          if (company.metrics) {
            let line = `${index + 1}. **${company.name}**（${company.country}）`;

            if (company.metrics.营收) {
              line += ` - 营收 ${company.metrics.营收}亿元`;
            }
            if (company.metrics.营收利润率) {
              line += `，利润率 ${(company.metrics.营收利润率 * 100).toFixed(1)}%`;
            }

            markdown += `${line}\n`;
          }
        });
      }

      return markdown;

    } catch (error) {
      console.error(`[上下文构建] 获取行业数据失败: ${error.message}`);
      return `获取 ${gics4} 行业数据失败`;
    }
  }

  /**
   * 获取行业研究报告摘要
   * 从综合产业研究报告中提取关键信息
   */
  async getIndustryReport(cachedBenchmark) {
    if (!cachedBenchmark || !cachedBenchmark.industry_research_report) {
      return `暂无行业研究报告`;
    }

    const report = cachedBenchmark.industry_research_report;
    let markdown = `### 行业研究报告摘要\n\n`;

    // 1. 行业概述
    if (report.industry_overview) {
      const overview = report.industry_overview;
      markdown += `**行业定义**：${overview.industry_definition || '暂无'}\n\n`;

      if (overview.market_scale) {
        markdown += `**市场规模**：${overview.market_scale}\n\n`;
      }

      if (overview.growth_trend) {
        markdown += `**增长趋势**：${overview.growth_trend}\n\n`;
      }

      if (overview.development_stage) {
        markdown += `**发展阶段**：${overview.development_stage}\n\n`;
      }

      if (overview.global_positioning) {
        markdown += `**全球定位**：${overview.global_positioning}\n\n`;
      }
    }

    // 2. 产业链（简化版）
    if (report.industry_chain) {
      const chain = report.industry_chain;
      markdown += `**产业链结构**：\n\n`;

      if (chain.upstream) {
        markdown += `- **上游**：${chain.upstream.description}（${chain.upstream.key_segments.join('、')}）\n`;
      }
      if (chain.midstream) {
        markdown += `- **中游**：${chain.midstream.description}（${chain.midstream.key_segments.join('、')}）\n`;
      }
      if (chain.downstream) {
        markdown += `- **下游**：${chain.downstream.description}（${chain.downstream.key_segments.join('、')}）\n`;
      }

      markdown += `\n`;
    }

    // 3. 竞争格局（简化版）
    if (report.competitive_landscape) {
      const landscape = report.competitive_landscape;

      if (landscape.market_concentration) {
        markdown += `**市场集中度**：${landscape.market_concentration}\n\n`;
      }

      if (landscape.key_players && landscape.key_players.length > 0) {
        markdown += `**主要玩家**：\n\n`;
        landscape.key_players.slice(0, 3).forEach(player => {
          markdown += `- **${player.name}**：${player.position || '领先企业'}（${player.strategy || '策略未知'}）\n`;
        });
        markdown += `\n`;
      }
    }

    // 4. 发展趋势（简化版）
    if (report.development_trends && report.development_trends.length > 0) {
      markdown += `**发展趋势**：\n\n`;
      report.development_trends.slice(0, 3).forEach((trend, index) => {
        markdown += `${index + 1}. **${trend.trend_name}**：${trend.description}\n`;
      });
      markdown += `\n`;
    }

    return markdown;
  }

  /**
   * 获取行业认知基准
   * 从缓存中提取认知基准的核心评估维度
   */
  async getIndustryBenchmark(cachedBenchmark) {
    if (!cachedBenchmark) {
      return `暂无行业认知基准`;
    }

    let markdown = `### ${cachedBenchmark.gics4} 行业认知基准\n\n`;

    // 评估维度
    if (cachedBenchmark.evaluation_dimensions) {
      const dimensions = cachedBenchmark.evaluation_dimensions;
      markdown += `**评估维度**：\n\n`;

      Object.keys(dimensions).forEach(key => {
        const dim = dimensions[key];
        markdown += `- **${dim.description}**\n`;
        if (dim.key_points && dim.key_points.length > 0) {
          markdown += `  - ${dim.key_points.join('、')}\n`;
        }
      });

      markdown += `\n`;
    }

    // 评分标准（如果有）
    if (cachedBenchmark.scoring_criteria) {
      const criteria = cachedBenchmark.scoring_criteria;
      markdown += `**评分标准**：\n\n`;

      Object.keys(criteria).forEach(level => {
        const c = criteria[level];
        markdown += `- **${level}**（${c.threshold}）：${c.characteristics.join('、')}\n`;
      });

      markdown += `\n`;
    }

    return markdown;
  }

  /**
   * 获取搜索关键词
   * 用于网络搜索和数据验证
   */
  getSearchKeywords(gics4) {
    // 提取关键词
    const keywords = [];

    // 1. GICS四级分类
    keywords.push(gics4);

    // 2. 移除后缀的名称
    const cleanName = gics4.replace(/行业|领域|分类/g, '').trim();
    if (cleanName !== gics4) {
      keywords.push(cleanName);
    }

    // 3. 拆分复合词
    const parts = cleanName.split(/[,，、\s]+/);
    parts.forEach(part => {
      if (part.length >= 2 && !keywords.includes(part)) {
        keywords.push(part);
      }
    });

    return keywords.join('、');
  }

  /**
   * 构建通用认知基准上下文
   * @param {string} articleType - 文章类型
   * @returns {Promise<object>} 上下文变量对象
   */
  async buildGeneralContext(articleType = '待识别') {
    console.log(`[上下文构建] 构建通用认知基准上下文...`);

    return {
      articleContent: '', // 通用基准不需要文章内容预注入
      articleType: articleType
    };
  }
}

module.exports = new IndustryContextBuilder();
