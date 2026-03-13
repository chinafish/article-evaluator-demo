/**
 * 企业基准数据服务
 *
 * 数据来源：何志毅教授企业图谱数据（清华产业研究院）
 * 数据结构：163个GICS四级分类，每个分类包含全球Top 10 + 中国Top 4企业
 * 核心指标：市值/营收/利润/净资产/研发费用/营收利润率/ROE/研发强度
 *
 * 数据已从Excel转换为JSON格式：enterprise_benchmark.json
 */

const fs = require('fs');
const path = require('path');

class BenchmarkDataService {
  constructor() {
    this.data = null;
    // 优先使用JSON格式的数据
    this.jsonDataPath = process.env.BENCHMARK_JSON_PATH ||
      'D:\\vibe\\何志毅合作\\图谱数据\\enterprise_benchmark.json';
    this.index = {
      byGics4: {},
      byGics1: {},
      byCompany: {}
    };
  }

  /**
   * 加载基准数据
   */
  async loadData() {
    if (this.data) return this.data;

    try {
      const content = fs.readFileSync(this.jsonDataPath, 'utf-8');
      this.data = JSON.parse(content);
      this.buildIndex();
      console.log(`[基准数据] 成功加载 ${this.data.length} 条行业数据`);
      return this.data;
    } catch (error) {
      console.error(`[基准数据] 加载失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 解析指标
   */
  parseMetrics(metrics) {
    if (!metrics) return null;

    const parseNumber = (str) => {
      if (!str || str === 'nan' || str === '') return null;
      const num = parseFloat(str);
      return isNaN(num) ? null : num;
    };

    return {
      市值: parseNumber(metrics['市值']),
      营收: parseNumber(metrics['营收']),
      利润: parseNumber(metrics['利润']),
      净资产: parseNumber(metrics['净资产']),
      研发费用: parseNumber(metrics['研发费用']),
      营收利润率: parseNumber(metrics['营收利润率']),
      ROE: parseNumber(metrics['ROE']),
      研发强度: parseNumber(metrics['研发强度'])
    };
  }

  /**
   * 构建索引
   */
  buildIndex() {
    this.data.forEach(row => {
      // GICS四级索引
      if (!this.index.byGics4[row.gics4]) {
        this.index.byGics4[row.gics4] = [];
      }
      this.index.byGics4[row.gics4].push(row);

      // GICS一级索引
      if (!this.index.byGics1[row.gics1]) {
        this.index.byGics1[row.gics1] = [];
      }
      this.index.byGics1[row.gics1].push(row);

      // 企业索引
      const allCompanies = [
        row.global_champion,
        ...row.global_top10,
        ...row.china_top4
      ];

      allCompanies.forEach(company => {
        if (company && company.name) {
          this.index.byCompany[company.name] = {
            company: {
              ...company,
              metrics: this.parseMetrics(company.metrics)
            },
            industry: row.gics4,
            gics1: row.gics1
          };
        }
      });
    });
  }

  /**
   * 根据GICS四级分类查询基准数据
   * 支持精确匹配和模糊匹配
   */
  async getByGics4(gics4) {
    await this.loadData();

    // 1. 尝试精确匹配
    if (this.index.byGics4[gics4]) {
      return this.index.byGics4[gics4];
    }

    // 2. 模糊匹配：查找包含关键词的GICS分类
    const keywords = gics4.replace(/行业|领域|分类/g, '').split(/[,，、\s]+/);
    for (const keyword of keywords) {
      if (keyword.length < 2) continue;

      // 查找包含关键词的GICS分类
      for (const gics4Name in this.index.byGics4) {
        if (gics4Name.includes(keyword) || keyword.includes(gics4Name)) {
          console.log(`[基准数据] 模糊匹配: "${gics4}" -> "${gics4Name}"`);
          return this.index.byGics4[gics4Name];
        }
      }
    }

    // 3. 未找到匹配
    console.log(`[基准数据] 未找到匹配: ${gics4}`);
    return [];
  }

  /**
   * 根据GICS一级分类查询基准数据
   */
  async getByGics1(gics1) {
    await this.loadData();
    return this.index.byGics1[gics1] || [];
  }

  /**
   * 根据企业名称查询
   */
  async getByCompany(companyName) {
    await this.loadData();
    return this.index.byCompany[companyName] || null;
  }

  /**
   * 搜索相关行业（模糊匹配）
   */
  async searchIndustry(keyword) {
    await this.loadData();
    const results = [];

    Object.keys(this.index.byGics4).forEach(gics4 => {
      if (gics4.includes(keyword) || keyword.includes(gics4)) {
        results.push(...this.index.byGics4[gics4]);
      }
    });

    return results;
  }

  /**
   * 获取行业基准指标统计
   */
  async getBenchmarkStats(gics4) {
    const industries = await this.getByGics4(gics4);
    if (industries.length === 0) return null;

    const allCompanies = [];
    industries.forEach(industry => {
      if (industry.global_champion && industry.global_champion.name) {
        allCompanies.push({
          ...industry.global_champion,
          metrics: this.parseMetrics(industry.global_champion.metrics)
        });
      }
      industry.global_top10.forEach(c => {
        if (c && c.name) {
          allCompanies.push({
            ...c,
            metrics: this.parseMetrics(c.metrics)
          });
        }
      });
      industry.china_top4.forEach(c => {
        if (c && c.name) {
          allCompanies.push({
            ...c,
            metrics: this.parseMetrics(c.metrics)
          });
        }
      });
    });

    const validCompanies = allCompanies.filter(c => c.metrics);

    if (validCompanies.length === 0) return null;

    // 计算统计数据
    const metrics = ['市值', '营收', '利润', '净资产', '营收利润率', 'ROE', '研发强度'];

    const stats = {};
    metrics.forEach(metric => {
      const values = validCompanies
        .map(c => c.metrics[metric])
        .filter(v => v !== null && !isNaN(v));

      if (values.length > 0) {
        stats[metric] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          max: Math.max(...values),
          min: Math.min(...values),
          median: this.calculateMedian(values),
          count: values.length
        };
      }
    });

    return {
      industry: gics4,
      companyCount: validCompanies.length,
      metrics: stats,
      topCompanies: validCompanies.slice(0, 5)
    };
  }

  /**
   * 计算中位数
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * 格式化基准数据为Prompt可用格式
   */
  async formatForPrompt(gics4) {
    const stats = await this.getBenchmarkStats(gics4);
    if (!stats) return null;

    let text = `## ${stats.industry} 行业基准数据\n`;
    text += `数据来源：何志毅教授评估指标体系（清华产业研究院）\n`;
    text += `样本数量：${stats.companyCount}家企业\n\n`;

    if (stats.metrics.营收利润率) {
      text += `### 关键指标\n`;
      text += `- 营收利润率：平均 ${(stats.metrics.营收利润率.avg * 100).toFixed(1)}%（中位数 ${(stats.metrics.营收利润率.median * 100).toFixed(1)}%）\n`;
    }
    if (stats.metrics.ROE) {
      text += `- ROE（净资产收益率）：平均 ${(stats.metrics.ROE.avg * 100).toFixed(1)}%（中位数 ${(stats.metrics.ROE.median * 100).toFixed(1)}%）\n`;
    }
    if (stats.metrics.研发强度) {
      text += `- 研发强度：平均 ${(stats.metrics.研发强度.avg * 100).toFixed(1)}%（中位数 ${(stats.metrics.研发强度.median * 100).toFixed(1)}%）\n`;
    }

    text += `\n### 行业领军企业\n`;
    stats.topCompanies.slice(0, 3).forEach((company, index) => {
      if (company.metrics && company.metrics.营收) {
        text += `${index + 1}. ${company.name}（${company.country}）- 营收 ${company.metrics.营收}亿元`;
        if (company.metrics.营收利润率) {
          text += `，利润率 ${(company.metrics.营收利润率 * 100).toFixed(1)}%`;
        }
        text += `\n`;
      }
    });

    return text;
  }

  /**
   * 获取所有GICS一级分类
   */
  async getAllGics1Categories() {
    await this.loadData();
    return Object.keys(this.index.byGics1);
  }

  /**
   * 获取所有GICS四级分类
   */
  async getAllGics4Categories() {
    await this.loadData();
    return Object.keys(this.index.byGics4);
  }
}

module.exports = new BenchmarkDataService();
