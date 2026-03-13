/**
 * 综合产业研究报告生成器
 *
 * 整合多数据源生成深度产业研究报告：
 * 1. GICS标准目录查找
 * 2. 何志毅企业图谱数据
 * 3. industry-research-searcher技能（最新行业数据）
 * 4. stock-metric-query技能（财务数据补充）
 * 5. 何志毅产业研究范式框架
 *
 * 使用 ModelRouter 进行智能模型路由
 */

const ModelRouter = require('./ModelRouter');
const benchmarkData = require('./benchmarkData');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

class ComprehensiveResearchGenerator {
  constructor() {
    this.modelRouter = ModelRouter;

    // 路径配置（更新为从Excel加载的JSON文件）
    // 从 src/services 到 vibe-coding/article-evaluator-demo (向上2级)
    // 然后到 vibe (向上1级)
    // 然后到 何志毅合作
    const basePath = path.join(__dirname, '../../../..');

    this.gics4DataPath = path.join(basePath, '何志毅合作/图谱数据/graph12_gics4_clean.json');
    this.topCompaniesPath = path.join(basePath, '何志毅合作/图谱数据/top_companies_clean.json');
    this.companiesPath = path.join(basePath, '何志毅合作/图谱数据/companies_clean.json');
    this.industryIndexPath = path.join(basePath, '何志毅合作/图谱数据/industry_index.json');
    this.researchParadigmPath = path.join(basePath, '何志毅合作/research_paradigm_extracted.json');
    this.stockMetricClientPath = path.join(basePath, '.claude/skills/stock-metric-query/scripts/stock_metric_client.py');

    // 缓存数据
    this.gics4Data = null;
    this.topCompanies = null;
    this.companies = null;
    this.industryIndex = null;
    this.researchParadigm = null;

    // 初始化时加载数据
    this._loadGICS4Data();
    this._loadTopCompanies();
    this._loadCompanies();
    this._loadIndustryIndex();
    this._loadResearchParadigm();
  }

  /**
   * 加载GICS4数据
   */
  _loadGICS4Data() {
    try {
      if (fs.existsSync(this.gics4DataPath)) {
        const content = fs.readFileSync(this.gics4DataPath, 'utf-8');
        this.gics4Data = JSON.parse(content);
        console.log(`[综合研究] 加载GICS4数据: ${this.gics4Data.length} 条`);
      } else {
        console.warn(`[综合研究] GICS4数据不存在: ${this.gics4DataPath}`);
        this.gics4Data = [];
      }
    } catch (error) {
      console.error('[综合研究] 加载GICS4数据失败:', error.message);
      this.gics4Data = [];
    }
  }

  /**
   * 加载十强企业数据
   */
  _loadTopCompanies() {
    try {
      if (fs.existsSync(this.topCompaniesPath)) {
        const content = fs.readFileSync(this.topCompaniesPath, 'utf-8');
        this.topCompanies = JSON.parse(content);
        console.log(`[综合研究] 加载十强企业数据: ${this.topCompanies.length} 条`);
      } else {
        console.warn(`[综合研究] 十强企业数据不存在: ${this.topCompaniesPath}`);
        this.topCompanies = [];
      }
    } catch (error) {
      console.error('[综合研究] 加载十强企业数据失败:', error.message);
      this.topCompanies = [];
    }
  }

  /**
   * 加载企业数据
   */
  _loadCompanies() {
    try {
      if (fs.existsSync(this.companiesPath)) {
        const content = fs.readFileSync(this.companiesPath, 'utf-8');
        this.companies = JSON.parse(content);
        console.log(`[综合研究] 加载企业数据: ${this.companies.length} 条`);
      } else {
        console.warn(`[综合研究] 企业数据不存在: ${this.companiesPath}`);
        this.companies = [];
      }
    } catch (error) {
      console.error('[综合研究] 加载企业数据失败:', error.message);
      this.companies = [];
    }
  }

  /**
   * 加载行业索引
   */
  _loadIndustryIndex() {
    try {
      if (fs.existsSync(this.industryIndexPath)) {
        const content = fs.readFileSync(this.industryIndexPath, 'utf-8');
        this.industryIndex = JSON.parse(content);
        console.log(`[综合研究] 加载行业索引: ${Object.keys(this.industryIndex).length} 个行业`);
      } else {
        console.warn(`[综合研究] 行业索引不存在: ${this.industryIndexPath}`);
        this.industryIndex = {};
      }
    } catch (error) {
      console.error('[综合研究] 加载行业索引失败:', error.message);
      this.industryIndex = {};
    }
  }

  /**
   * 加载研究范式框架
   */
  _loadResearchParadigm() {
    try {
      if (fs.existsSync(this.researchParadigmPath)) {
        const content = fs.readFileSync(this.researchParadigmPath, 'utf-8');
        this.researchParadigm = JSON.parse(content);
        console.log(`[综合研究] 加载研究范式框架: ${this.researchParadigm.title}`);
      } else {
        console.warn(`[综合研究] 研究范式文件不存在: ${this.researchParadigmPath}`);
        this.researchParadigm = null;
      }
    } catch (error) {
      console.error('[综合研究] 加载研究范式框架失败:', error.message);
      this.researchParadigm = null;
    }
  }

  /**
   * 查找何志毅企业图谱中的行业数据
   * @param {string} gics4 - GICS四级分类名称
   * @returns {Object|null} 行业数据
   */
  findHeZhiyiIndustryData(gics4) {
    if (!this.gics4Data) return null;
    if (!gics4 || typeof gics4 !== 'string') {
      console.warn(`[综合研究] findHeZhiyiIndustryData: gics4参数无效 (${typeof gics4})`);
      return null;
    }

    // 在GICS4数据中查找
    let gics4Record = null;

    // 精确匹配
    gics4Record = this.gics4Data.find(item => {
      const gics4Name = item['GICS四级'];
      return gics4Name === gics4;
    });

    if (!gics4Record) {
      // 模糊匹配
      if (!gics4 || typeof gics4 !== 'string') {
        return null;
      }
      const keywords = gics4.replace(/行业|领域|分类/g, '').split(/[,，、\s]+/);
      for (const keyword of keywords) {
        if (keyword.length < 2) continue;

        gics4Record = this.gics4Data.find(item => {
          const gics4Name = item['GICS四级'];
          return gics4Name && gics4Name.includes(keyword);
        });

        if (gics4Record) {
          console.log(`[综合研究] GICS4数据模糊匹配: "${gics4}" -> "${gics4Record['GICS四级']}"`);
          break;
        }
      }
    }

    if (!gics4Record) return null;

    // 在企业数据中查找该行业的企业
    const industryCompanies = this.companies ? this.companies.filter(item => {
      const itemGics4 = item['GICS四级'];
      return itemGics4 === gics4 || (gics4Record['GICS四级'] && itemGics4 === gics4Record['GICS四级']);
    }) : [];

    // 构建返回数据
    const result = {
      gics4: gics4Record['GICS四级'] || gics4,
      gics1: gics4Record['GICS一级'] || '',
      stats: gics4Record,
      companies: industryCompanies.slice(0, 10), // 只返回前10个企业
      total_companies: industryCompanies.length
    };

    return result;
  }

  /**
   * 调用industry-research-searcher技能搜索最新行业数据
   * @param {string} gics4 - GICS四级分类名称
   * @returns {Promise<string>} 搜索结果
   */
  async searchLatestIndustryData(gics4) {
    console.log(`[综合研究] 搜索最新行业数据: ${gics4}`);

    try {
      // 构建搜索查询
      const searchQuery = `${gics4}行业 2024年 市场规模 增长趋势 竞争格局`;

      // 调用industry-research-searcher技能
      // 这里需要通过某种方式调用技能，可以使用：
      // 1. HTTP API端点
      // 2. Python子进程
      // 3. 直接调用相关服务

      // 暂时使用Web搜索作为替代
      const searchResult = await this._performWebSearch(searchQuery);

      return searchResult;
    } catch (error) {
      console.error('[综合研究] 搜索最新行业数据失败:', error.message);
      return '';
    }
  }

  /**
   * 执行网络搜索（带兜底机制）
   * 优先级：Tavily -> web-search-prime -> WebSearch -> 返回空字符串
   * @param {string} query - 搜索查询
   * @returns {Promise<string>} 搜索结果
   */
  async _performWebSearch(query) {
    console.log(`[综合研究] 执行网络搜索: ${query}`);

    // 获取环境变量
    const tavilyApiKey = process.env.TAVILY_API_KEY || '';

    // 方法1: 尝试使用Tavily（如果API key存在）
    if (tavilyApiKey) {
      try {
        console.log('[综合研究] 尝试使用 Tavily 搜索...');
        const result = await this._searchWithTavily(query, tavilyApiKey);
        if (result) {
          console.log('[综合研究] Tavily 搜索成功');
          return result;
        }
      } catch (error) {
        console.warn(`[综合研究] Tavily 搜索失败: ${error.message}`);
        // 检查是否是配额用完的情况
        if (error.message.includes('429') || error.message.includes('rate limit') ||
            error.message.includes('credits') || error.message.includes('quota')) {
          console.warn('[综合研究] Tavily 配额已用完，切换到备用搜索');
        }
      }
    } else {
      console.log('[综合研究] 未配置 Tavily API Key，跳过');
    }

    // 方法2: 尝试使用 web-search-prime MCP工具
    try {
      console.log('[综合研究] 尝试使用 web-search-prime...');
      const result = await this._searchWithWebSearchPrime(query);
      if (result) {
        console.log('[综合研究] web-search-prime 搜索成功');
        return result;
      }
    } catch (error) {
      console.warn(`[综合研究] web-search-prime 搜索失败: ${error.message}`);
    }

    // 方法3: 尝试使用 WebSearch
    try {
      console.log('[综合研究] 尝试使用 WebSearch...');
      const result = await this._searchWithWebSearch(query);
      if (result) {
        console.log('[综合研究] WebSearch 搜索成功');
        return result;
      }
    } catch (error) {
      console.warn(`[综合研究] WebSearch 搜索失败: ${error.message}`);
    }

    // 所有方法都失败
    console.warn('[综合研究] 所有搜索方法均失败，返回空结果');
    return '';
  }

  /**
   * 使用Tavily进行搜索
   * @param {string} query - 搜索查询
   * @param {string} apiKey - Tavily API Key
   * @returns {Promise<string>} 搜索结果
   */
  async _searchWithTavily(query, apiKey) {
    try {
      const fetch = require('node-fetch');

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          search_depth: 'advanced',
          max_results: 10,
          include_answer: true,
          include_raw_content: false,
          days_back: 30
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded (429)');
        }
        if (response.status === 401) {
          throw new Error('Invalid API key (401)');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // 格式化搜索结果
      if (data.answer) {
        let result = `# 搜索结果摘要\n\n${data.answer}\n\n`;

        if (data.results && data.results.length > 0) {
          result += `# 详细信息来源\n\n`;
          data.results.forEach((item, index) => {
            result += `${index + 1}. **${item.title}**\n`;
            result += `   - URL: ${item.url}\n`;
            result += `   - 内容: ${item.content?.substring(0, 200) || 'N/A'}...\n\n`;
          });
        }

        return result;
      }

      return '';
    } catch (error) {
      throw error;
    }
  }

  /**
   * 使用web-search-prime MCP工具进行搜索
   * @param {string} query - 搜索查询
   * @returns {Promise<string>} 搜索结果
   */
  async _searchWithWebSearchPrime(_query) {
    // 注意：这个方法需要在有MCP环境的情况下才能使用
    // 在当前的Node.js环境中，可能需要通过其他方式调用
    // 暂时返回空，如果需要可以通过HTTP API调用
    throw new Error('web-search-prime MCP工具暂未集成');
  }

  /**
   * 使用WebSearch进行搜索
   * @param {string} query - 搜索查询
   * @returns {Promise<string>} 搜索结果
   */
  async _searchWithWebSearch(_query) {
    // 注意：WebSearch是Claude的工具，在Node.js环境中需要通过其他方式
    // 暂时返回空
    throw new Error('WebSearch工具暂未集成');
  }

  /**
   * 调用stock-metric-query技能获取财务数据
   * @param {Array<string>} companyNames - 公司名称列表
   * @param {Array<string>} reportPeriods - 报告期列表
   * @returns {Promise<Object>} 财务数据
   */
  async queryStockMetrics(companyNames, reportPeriods = ['FY2024-Annual']) {
    console.log(`[综合研究] 查询财务指标: ${companyNames.join(', ')}`);

    try {
      // 构建Python脚本调用
      const pythonCode = `
import sys
sys.path.append('${path.dirname(this.stockMetricClientPath)}')
from stock_metric_client import query_stock_metrics
import json

result = query_stock_metrics(
    stock_names=${JSON.stringify(companyNames)},
    report_periods=${JSON.stringify(reportPeriods)}
)
print(json.dumps(result, ensure_ascii=False))
`;

      // 执行Python脚本
      const { stdout, stderr } = await execPromise(
        `cd "${path.dirname(this.stockMetricClientPath)}" && python -c "${pythonCode.replace(/"/g, '\\"')}"`
      );

      if (stderr) {
        console.warn('[综合研究] Python脚本警告:', stderr);
      }

      const result = JSON.parse(stdout);
      return result;
    } catch (error) {
      console.error('[综合研究] 查询财务指标失败:', error.message);
      return { success: false, error: error.message, contents: [] };
    }
  }

  /**
   * 补充何志毅数据中缺失的财务指标
   * @param {Object} heZhiyiData - 何志毅企业图谱数据
   * @returns {Promise<Object>} 补充后的数据
   */
  async enrichHeZhiyiData(heZhiyiData) {
    if (!heZhiyiData) return null;

    console.log('[综合研究] 补充何志毅数据财务指标');

    try {
      // 收集需要查询的公司名称
      const companiesToQuery = [];
      const enrichedData = JSON.parse(JSON.stringify(heZhiyiData));

      // 检查global_champion
      if (enrichedData.global_champion && enrichedData.global_champion.name) {
        companiesToQuery.push(enrichedData.global_champion.name);
      }

      // 检查top10中研发强度为nan的公司
      if (enrichedData.global_top10) {
        enrichedData.global_top10.forEach(company => {
          if (company.metrics && company.metrics.研发强度 === 'nan' && company.name) {
            companiesToQuery.push(company.name);
          }
        });
      }

      // 查询财务数据
      if (companiesToQuery.length > 0) {
        const stockMetrics = await this.queryStockMetrics(companiesToQuery);

        if (stockMetrics.success && stockMetrics.contents && stockMetrics.contents.length > 0) {
          // 解析并更新数据
          // 这里需要根据stock-metric-query的返回格式进行解析
          console.log('[综合研究] 财务数据查询成功，开始更新...');
        }
      }

      return enrichedData;
    } catch (error) {
      console.error('[综合研究] 补充何志毅数据失败:', error.message);
      return heZhiyiData;
    }
  }

  /**
   * 构建何志毅研究范式提示词
   * @returns {string} 研究范式提示词
   */
  buildResearchParadigmPrompt() {
    if (!this.researchParadigm || !this.researchParadigm.sections) {
      return '';
    }

    const paradigm = this.researchParadigm;

    return `
# 何志毅产业研究基本范式（四步式）

## 1. 基准定位与范围界定
${paradigm.sections.filter(s => s.includes('基准定位') || s.includes('产业归类') || s.includes('全球坐标')).join('\n')}

## 2. 多维要素解构与评估
### 评估维度体系化（九大维度）：
${paradigm.sections.filter(s => s.includes('核心驱动') || s.includes('创新投入') || s.includes('创新产出') || s.includes('创新载体') || s.includes('行业话语权') || s.includes('市场表现') || s.includes('软实力') || s.includes('经营绩效') || s.includes('全球化')).join('\n')}

### 数据驱动的实证分析：
${paradigm.sections.find(s => s.includes('数据驱动的实证分析')) || ''}

## 3. 战略模式识别与特点诊断
${paradigm.sections.filter(s => s.includes('战略模式') || s.includes('对标分析') || s.includes('创新战略')).join('\n')}

## 4. 发展前景的结构化推演
${paradigm.sections.filter(s => s.includes('发展前景') || s.includes('结构化挑战') || s.includes('发展阶段')).join('\n')}

## 研究精髓总结
${paradigm.sections[paradigm.sections.length - 1] || ''}
`;
  }

  /**
   * 生成综合产业研究报告
   * @param {string} gics4 - GICS四级分类名称
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 综合研究报告
   */
  async generateComprehensiveReport(gics4, options = {}) {
    console.log(`[综合研究] 开始生成综合研究报告: ${gics4}`);
    console.log(`[综合研究] gics4 type: ${typeof gics4}, value: ${JSON.stringify(gics4)}`);

    // 1. 检查缓存
    if (options.useCache !== false) {
      const cached = await this.loadCachedReport(gics4);
      if (cached) {
        console.log(`[综合研究] 使用缓存: ${gics4}`);
        return cached;
      }
    }

    // 2. 获取何志毅企业图谱数据
    const heZhiyiData = this.findHeZhiyiIndustryData(gics4);

    // 3. 补充财务数据（如果何志毅数据存在且有缺失）
    const enrichedHeZhiyiData = heZhiyiData ? await this.enrichHeZhiyiData(heZhiyiData) : null;

    // 4. 获取基准数据
    const benchmarkStats = await benchmarkData.getBenchmarkStats(gics4);
    const benchmarkText = await benchmarkData.formatForPrompt(gics4);

    // 5. 搜索最新行业动态（如果启用）
    let latestNews = '';
    if (options.enableSearch) {
      latestNews = await this.searchLatestIndustryData(gics4);
    }

    // 6. 构建研究范式提示词
    const paradigmPrompt = this.buildResearchParadigmPrompt();

    // 7. 构建完整Prompt
    const prompt = this.buildComprehensivePrompt(
      gics4,
      enrichedHeZhiyiData,
      benchmarkText,
      latestNews,
      paradigmPrompt
    );

    // 8. 调用AI生成报告
    const reportContent = await this.callAI(prompt);

    // 9. 解析报告
    const report = this.parseReport(reportContent, gics4);

    // 10. 添加元数据
    report.benchmark_data = benchmarkStats;
    report.he_zhiyi_data = enrichedHeZhiyiData;
    report.generated_at = new Date().toISOString();
    report.gics4 = gics4;
    report.research_methodology = 'he_zhiyi_paradigm';

    // 11. 缓存报告
    await this.cacheReport(gics4, report);

    console.log(`[综合研究] 综合报告生成完成: ${gics4}`);
    return report;
  }

  /**
   * 构建综合研究报告生成Prompt
   */
  buildComprehensivePrompt(gics4, heZhiyiData, benchmarkText, latestNews, paradigmPrompt) {
    // 格式化何志毅数据
    let heZhiyiDataText = '暂无何志毅企业图谱数据';
    if (heZhiyiData) {
      // 从stats中提取关键指标
      const stats = heZhiyiData.stats || {};

      heZhiyiDataText = `
## 何志毅企业图谱数据（清华产业研究院）

**行业分类**: ${heZhiyiData.gics4} (${heZhiyiData.gics1})
**中国企业数量**: ${stats['中国企业数量'] || 'N/A'}
**美国企业数量**: ${stats['美国企业数量'] || 'N/A'}
**中国企业产业盈利面**: ${stats['中国产业盈利面'] || 'N/A'}
**美国企业产业盈利面**: ${stats['美国产业盈利面'] || 'N/A'}

### 行业财务指标对比

**市值对比**:
- 中国企业市值: ${stats['中国市值'] || 'N/A'}
- 美国企业市值: ${stats['美国市值'] || 'N/A'}

**营收对比**:
- 中国企业营收: ${stats['中国营收'] || 'N/A'}
- 美国企业营收: ${stats['美国营收'] || 'N/A'}

**利润对比**:
- 中国企业利润: ${stats['中国利润'] || 'N/A'}
- 美国企业利润: ${stats['美国利润'] || 'N/A'}

**估值指标对比**:
- 中国PE: ${stats['中国PE'] || 'N/A'}, 美国PE: ${stats['美国PE'] || 'N/A'}
- 中国ROE: ${stats['中国ROE'] || 'N/A'}, 美国ROE: ${stats['美国ROE'] || 'N/A'}

**市场集中度**:
- 中国市值集中度: ${stats['中国市值集中度'] || 'N/A'}
- 美国市值集中度: ${stats['美国市值集中度'] || 'N/A'}

### 该行业代表企业（前${Math.min(10, heZhiyiData.total_companies || 0)}家）
${heZhiyiData.companies && heZhiyiData.companies.length > 0 ? heZhiyiData.companies.slice(0, 10).map((company, i) => {
  const companyName = company['企业'] || company['全球领军\\n市值/营收/利润/净资产/研发费用/营业利润率/ROE/研发强度'] || `企业${i+1}`;
  return `${i + 1}. ${companyName}`;
}).join('\n') : '暂无企业数据'}
`;
    }

    return {
      system: `你是一位资深的产业研究专家，精通何志毅教授的产业研究方法论。你能够基于多维数据和最新信息，生成深度、客观、有洞察力的行业研究报告。

${paradigmPrompt}

你的输出必须是严格的JSON格式。`,

      user: `请针对"${gics4}"行业生成深度研究报告。

# 何志毅企业图谱数据（清华产业研究院）
${heZhiyiDataText}

# 基准数据统计
${benchmarkText}

# 最新行业动态
${latestNews || '暂无最新动态数据'}

请严格按照何志毅产业研究范式（四步式：定位-解构-诊断-展望），生成该行业的深度研究报告。

报告JSON格式要求：

\`\`\`json
{
  "industry_overview": {
    "industry_name": "行业名称",
    "industry_definition": "行业定义与范围（100字以内）",
    "market_scale": "市场规模描述（量化数据，包含全球和中国市场规模）",
    "growth_trend": "增长趋势分析（3-5年历史数据+未来预测）",
    "development_stage": "发展阶段（导入期/成长期/成熟期/衰退期）",
    "global_positioning": "全球定位分析（中国在全球的地位）"
  },
  "industry_chain": {
    "upstream": {
      "description": "上游描述",
      "key_segments": ["关键环节1", "关键环节2"],
      "characteristics": "上游特征",
      "key_companies": ["代表企业1", "代表企业2"]
    },
    "midstream": {
      "description": "中游描述",
      "key_segments": ["关键环节1", "关键环节2"],
      "characteristics": "中游特征",
      "key_companies": ["代表企业1", "代表企业2"]
    },
    "downstream": {
      "description": "下游描述",
      "key_segments": ["关键环节1", "关键环节2"],
      "characteristics": "下游特征",
      "key_companies": ["代表企业1", "代表企业2"]
    }
  },
  "competitive_landscape": {
    "market_concentration": "市场集中度（高/中/低），CR5/CR10数据",
    "global_champion_analysis": {
      "name": "全球领军企业名称",
      "country": "所属国家",
      "market_position": "市场地位",
      "strengths": ["优势1", "优势2"],
      "key_financials": {
        "market_cap": "市值",
        "revenue": "营收",
        "profit": "利润",
        "profit_margin": "利润率",
        "roe": "ROE"
      },
      "competitive_advantages": ["竞争优势1", "竞争优势2"]
    },
    "chinese_companies_analysis": [
      {
        "name": "中国企业名称",
        "global_ranking": "全球排名",
        "strengths": ["优势1", "优势2"],
        "weaknesses": ["劣势1", "劣势2"],
        "vs_global_champion": "与全球冠军的对比分析"
      }
    ],
    "competition_pattern": "竞争格局描述（300字以内，包含竞争模式、趋势变化）",
    "market_segmentation": {
      "by_product_type": ["产品细分1", "产品细分2"],
      "by_price_segment": ["价格区间1", "价格区间2"],
      "by_region": ["区域市场1", "区域市场2"]
    }
  },
  "development_trends": {
    "technology_trends": [
      {
        "trend": "技术趋势名称",
        "description": "详细描述（100字以内）",
        "impact_level": "影响程度（高/中/低）",
        "timeframe": "预计实现时间"
      }
    ],
    "business_model_trends": [
      {
        "trend": "商业模式趋势名称",
        "description": "详细描述（100字以内）",
        "impact_level": "影响程度（高/中/低）",
        "timeframe": "预计实现时间"
      }
    ],
    "market_trends": [
      {
        "trend": "市场趋势名称",
        "description": "详细描述（100字以内）",
        "impact_level": "影响程度（高/中/低）",
        "timeframe": "预计实现时间"
      }
    ],
    "policy_impact": "政策影响分析（200字以内，包含国内外政策）"
  },
  "key_challenges": {
    "challenges": [
      {
        "area": "挑战领域",
        "description": "挑战描述（150字以内）",
        "impact_level": "影响程度（高/中/低）",
        "potential_solutions": ["可能的解决方案1", "可能的解决方案2"]
      }
    ]
  },
  "opportunities": {
    "opportunities": [
      {
        "area": "机会领域",
        "description": "机会描述（150字以内）",
        "potential": "潜力评估（高/中/低）",
        "key_drivers": ["驱动因素1", "驱动因素2"]
      }
    ]
  },
  "success_factors": {
    "critical_success_factors": [
      "关键成功因素1（基于何志毅九大维度分析）",
      "关键成功因素2",
      "关键成功因素3"
    ],
    "competitive_advantages": [
      "竞争优势1",
      "竞争优势2"
    ]
  },
  "investment_insights": {
    "investment_attractiveness": "投资吸引力（高/中/低）",
    "investment_thesis": "投资逻辑（300字以内，基于何志毅研究范式）",
    "key_metrics_to_monitor": [
      "关键指标1（可量化）",
      "关键指标2（可量化）",
      "关键指标3（可量化）"
    ],
    "risk_factors": [
      "风险因素1",
      "风险因素2"
    ],
    "recommended_focus_areas": [
      "建议关注领域1",
      "建议关注领域2"
    ]
  },
  "strategic_recommendations": {
    "for_new Entrants": "新进入者建议（100字以内）",
    "for_incumbents": "现有企业建议（100字以内）",
    "for_investors": "投资者建议（100字以内）",
    "for_policy_makers": "政策制定者建议（100字以内）"
  },
  "data_sources": {
    "primary_sources": [
      "数据来源1（注明机构和时间）",
      "数据来源2（注明机构和时间）"
    ],
    "he_zhiyi_atlas": "何志毅教授企业图谱数据（清华产业研究院）",
    "data_quality": "数据质量评估（高/中/低）",
    "data_completeness": "数据完整性说明"
  },
  "executive_summary": "执行摘要（400字以内，概括核心观点、结论和建议）"
}
\`\`\`

重要要求：
1. **严格遵循何志毅四步式研究范式**：定位-解构-诊断-展望
2. **数据必须量化**：所有描述必须有具体数据支撑
3. **全球视野**：必须包含全球领军企业分析和国际对比
4. **九大维度评估**：核心驱动、创新投入、创新产出、创新载体、行业话语权、市场表现、软实力、经营绩效、全球化水平
5. **战略模式识别**：不仅仅是数据罗列，要提炼出独特的战略模式
6. **结构化推演**：对未来挑战和机遇进行结构化分析
7. **明确数据来源**：所有数据必须标注来源`
    };
  }

  /**
   * 调用AI生成报告
   */
  async callAI(prompt) {
    console.log('[综合研究] 开始调用AI生成模型（qwen3.5-plus）...');

    try {
      const response = await this.modelRouter.callAI('INDUSTRY_REPORT_GENERATION', prompt, {
        temperature: 0.7,
        maxTokens: 12000
      });

      console.log('[综合研究] AI调用成功');
      return response;
    } catch (error) {
      console.error('[综合研究] AI调用失败:', error.message);
      throw error;
    }
  }

  /**
   * 解析AI返回的JSON
   */
  parseReport(content, gics4) {
    console.log('[综合研究] 开始解析报告...');

    try {
      return JSON.parse(content);
    } catch (error) {
      console.log('[综合研究] 直接JSON解析失败，尝试提取...');

      // 尝试提取JSON部分
      let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.log('[综合研究] ```json 内的JSON解析失败');
        }
      }

      // 尝试不带标记的JSON - 使用更智能的方法找到完整的JSON对象
      let braceCount = 0;
      let jsonStart = -1;
      let jsonEnd = -1;
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{' && jsonStart === -1) {
            jsonStart = i;
            braceCount = 1;
          } else if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0 && jsonStart !== -1) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
      }

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = content.substring(jsonStart, jsonEnd);
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          console.log('[综合研究] 提取的JSON解析失败，尝试清理...');
          let cleaned = jsonStr
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
            .replace(/[\x00-\x1F\x7F]/g, '');
          return JSON.parse(cleaned);
        }
      }

      console.error('[综合研究] 所有方法都失败');
      throw new Error('无法解析AI返回的报告');
    }
  }

  /**
   * 缓存报告
   */
  async cacheReport(gics4, report) {
    const cacheDir = path.join(__dirname, '../../cache/industry_reports');

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const filename = `${gics4.replace(/[\/\\]/g, '_')}.json`;
    const filepath = path.join(cacheDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  }

  /**
   * 加载缓存报告
   */
  async loadCachedReport(gics4) {
    const cacheDir = path.join(__dirname, '../../cache/industry_reports');
    const filename = `${gics4.replace(/[\/\\]/g, '_')}.json`;
    const filepath = path.join(cacheDir, filename);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    // 检查缓存是否过期（7天）
    const stats = fs.statSync(filepath);
    const cacheAge = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    if (cacheAge > 7) {
      console.log(`[综合研究] 缓存已过期: ${gics4} (${cacheAge.toFixed(1)}天)`);
      return null;
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 清除缓存
   */
  async clearCache(gics4 = null) {
    const cacheDir = path.join(__dirname, '../../cache/industry_reports');

    if (!fs.existsSync(cacheDir)) {
      return;
    }

    if (gics4) {
      const filename = `${gics4.replace(/[\/\\]/g, '_')}.json`;
      const filepath = path.join(cacheDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`[综合研究] 已清除缓存: ${gics4}`);
      }
    } else {
      const files = fs.readdirSync(cacheDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(cacheDir, file));
      });
      console.log(`[综合研究] 已清除所有缓存 (${files.length}个文件)`);
    }
  }
}

module.exports = new ComprehensiveResearchGenerator();
