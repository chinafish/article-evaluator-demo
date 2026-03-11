/**
 * 生成三个实例行业的认知基准
 * 行业：SaaS软件、光伏、新能源
 */

// 加载环境变量（必须在所有require之前）
const path = require('path');
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

console.log('[环境变量] MODEL_ROUTING_ENABLED:', process.env.MODEL_ROUTING_ENABLED);
console.log('[环境变量] DASHSCOPE_API_KEY:', process.env.DASHSCOPE_API_KEY ? '已设置' : '未设置');

const BenchmarkData = require('../src/services/benchmarkData');
const IndustryResearchGenerator = require('../src/services/industryResearchGenerator');
const IndustryBenchmarkGenerator = require('../src/services/industryBenchmarkGenerator');

async function generateIndustryBenchmarks() {
  console.log('[初始化] 开始生成三个实例行业的认知基准...\n');

  // 定义三个目标行业
  const industries = [
    { name: 'SaaS软件', gics4: '应用软件' },
    { name: '光伏', gics4: '电气设备' },
    { name: '新能源', gics4: '汽车零部件' }
  ];

  for (const industry of industries) {
    try {
      console.log(`[${industry.name}] 1. 生成行业研究报告...`);

      // 步骤1: 生成行业研究报告
      const report = await IndustryResearchGenerator.generateReport(industry.gics4, {
        useCache: false,  // 强制重新生成
        enableSearch: false
      });

      console.log(`[${industry.name}] 研究报告生成完成`);

      console.log(`[${industry.name}] 2. 生成行业认知基准...`);

      // 步骤2: 生成行业认知基准
      const benchmark = await IndustryBenchmarkGenerator.generateBenchmark(report, {
        useCache: false  // 强制重新生成
      });

      console.log(`[${industry.name}] ✅ 认知基准生成完成!`);
      console.log(`[${industry.name}] 基准包含: ${Object.keys(benchmark.evaluation_dimensions || {}).length} 个评估维度\n`);

    } catch (error) {
      console.error(`[${industry.name}] ❌ 生成失败: ${error.message}\n`);
    }
  }

  console.log('[初始化] 完成!');
  process.exit(0);
}

generateIndustryBenchmarks();
