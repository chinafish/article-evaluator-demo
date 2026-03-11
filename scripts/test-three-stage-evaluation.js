/**
 * 三阶段评估流程测试脚本
 */

const orchestrator = require('../src/services/evaluationOrchestrator');

// 测试文章（SaaS相关）
const testArticle = {
  title: '2024年SaaS行业发展趋势：AI驱动的新增长时代',
  source: '36氪',
  url: 'https://36kr.com/p/12345678',
  content: `
2024年，SaaS行业正迎来AI驱动的全新增长机遇。根据最新行业数据，全球SaaS市场规模已突破3000亿美元，
年增长率保持在20%以上。

在应用软件领域，以Salesforce、SAP为代表的领军企业持续加大AI投入。Salesforce 2024财年营收达到403亿美元，
利润率为18%，继续领跑全球CRM市场。

中国市场方面，用友网络、金蝶国际等企业也在加速AI转型。用友网络2024年营收92亿元，虽然在规模上与全球巨头
仍有差距，但在云服务转型方面取得显著进展。

行业分析人士指出，未来SaaS行业的竞争将更加聚焦于AI能力、数据安全和客户成功三个维度。
预计到2025年，AI原生SaaS产品将占据市场主导地位。

投资建议：关注具备AI技术优势和行业Know-how的企业，这类企业有望在下一轮竞争中胜出。
  `.trim()
};

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          三阶段评估流程测试 - SaaS行业                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // 检查已有缓存
    console.log('\n[检查缓存]');
    const cached = await orchestrator.listCached();
    console.log(`已缓存的报告: ${cached.reports.length}个`);
    console.log(`已缓存的基准: ${cached.benchmarks.length}个`);

    if (cached.reports.length > 0) {
      console.log(`  报告列表: ${cached.reports.join(', ')}`);
    }
    if (cached.benchmarks.length > 0) {
      console.log(`  基准列表: ${cached.benchmarks.join(', ')}`);
    }

    // 选择要评估的行业
    const gics4 = '应用软件';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`评估配置:`);
    console.log(`  行业: ${gics4}`);
    console.log(`  文章: ${testArticle.title}`);
    console.log(`  模式: 完整三阶段评估`);
    console.log(`${'='.repeat(60)}`);

    // 执行评估
    const result = await orchestrator.evaluate(testArticle, gics4, {
      useCache: true,  // 使用缓存
      enableSearch: false  // 暂不启用网络搜索
    });

    // 输出结果摘要
    console.log(`\n${'='.repeat(60)}`);
    console.log(`评估结果摘要:`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\n[总体评估]`);
    console.log(`评分: ${result.evaluation.overall_assessment.score}`);
    console.log(`评级: ${result.evaluation.overall_assessment.rating}`);
    console.log(`总结: ${result.evaluation.overall_assessment.one_sentence_summary}`);

    console.log(`\n[维度得分]`);
    const dimensions = result.evaluation.dimension_scores || {};
    Object.entries(dimensions).forEach(([key, value]) => {
      console.log(`${key}: ${value.score}分`);
    });

    console.log(`\n[基准对比]`);
    const comparison = result.evaluation.benchmark_comparison || {};
    console.log(`超出基准: ${comparison.above_benchmark?.length || 0}项`);
    console.log(`符合基准: ${comparison.meets_benchmark?.length || 0}项`);
    console.log(`低于基准: ${comparison.below_benchmark?.length || 0}项`);

    console.log(`\n[判断]`);
    const verdict = result.evaluation.verdict || {};
    console.log(`可靠性: ${verdict.is_reliable}`);
    console.log(`价值: ${verdict.is_valuable}`);
    console.log(`建议: ${verdict.reading_time_recommendation}`);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`完整评估结果已保存到内存，可进一步处理`);
    console.log(`${'='.repeat(60)}`);

    // 保存完整结果到文件
    const fs = require('fs');
    const outputPath = './cache/last_evaluation_result.json';
    fs.mkdirSync('./cache', { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`\n完整结果已保存到: ${outputPath}`);

  } catch (error) {
    console.error(`\n[错误] ${error.message}`);
    console.error(error.stack);
  }
}

// 运行测试
runTest();
