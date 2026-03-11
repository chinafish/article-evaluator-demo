/**
 * 基准数据服务测试脚本
 */

const benchmarkData = require('../src/services/benchmarkData');

async function test() {
  console.log('=== 基准数据服务测试 ===\n');

  try {
    // 1. 测试数据加载
    console.log('1. 测试数据加载...');
    const data = await benchmarkData.loadData();
    console.log(`   ✅ 成功加载 ${data.length} 条行业数据\n`);

    // 2. 测试GICS一级分类查询
    console.log('2. 测试GICS一级分类查询（能源）...');
    const energyIndustries = await benchmarkData.getByGics1('能源');
    console.log(`   ✅ 找到 ${energyIndustries.length} 个能源相关行业`);
    if (energyIndustries.length > 0) {
      console.log(`   示例: ${energyIndustries[0].gics4}`);
      if (energyIndustries[0].globalChampion) {
        console.log(`   全球冠军: ${energyIndustries[0].globalChampion.name}`);
      }
    }
    console.log('');

    // 3. 测试企业查询
    console.log('3. 测试企业查询（中海油服）...');
    const company = await benchmarkData.getByCompany('中海油服');
    if (company) {
      console.log(`   ✅ 找到企业: ${company.company.name}`);
      console.log(`   所属行业: ${company.industry}`);
      console.log(`   GICS一级: ${company.gics1}`);
      if (company.company.metrics) {
        console.log(`   营收: ${company.company.metrics.营收}亿元`);
        console.log(`   营收利润率: ${(company.company.metrics.营收利润率 * 100).toFixed(1)}%`);
      }
    } else {
      console.log('   ⚠️ 未找到企业');
    }
    console.log('');

    // 4. 测试行业基准统计
    console.log('4. 测试行业基准统计（石油天然气钻井）...');
    const stats = await benchmarkData.getBenchmarkStats('石油天然气钻井');
    if (stats) {
      console.log(`   ✅ 样本数量: ${stats.companyCount}家企业`);
      if (stats.metrics.营收利润率) {
        console.log(`   营收利润率平均: ${(stats.metrics.营收利润率.avg * 100).toFixed(1)}%`);
        console.log(`   营收利润率中位数: ${(stats.metrics.营收利润率.median * 100).toFixed(1)}%`);
      }
      if (stats.metrics.ROE) {
        console.log(`   ROE平均: ${(stats.metrics.ROE.avg * 100).toFixed(1)}%`);
      }
      console.log(`   Top 3企业:`);
      stats.topCompanies.slice(0, 3).forEach((c, i) => {
        if (c.metrics && c.metrics.营收) {
          console.log(`     ${i + 1}. ${c.name} - 营收${c.metrics.营收}亿元`);
        }
      });
    } else {
      console.log('   ⚠️ 未找到统计数据');
    }
    console.log('');

    // 5. 测试Prompt格式化
    console.log('5. 测试Prompt格式化（软件服务）...');
    const promptText = await benchmarkData.formatForPrompt('软件服务');
    if (promptText) {
      console.log('   ✅ 生成的Prompt内容:');
      console.log('   ' + promptText.replace(/\n/g, '\n   '));
    } else {
      console.log('   ⚠️ 未生成Prompt内容');
    }
    console.log('');

    // 6. 测试行业搜索
    console.log('6. 测试行业搜索（软件）...');
    const searchResults = await benchmarkData.searchIndustry('软件');
    console.log(`   ✅ 找到 ${searchResults.length} 个包含"软件"的行业`);
    if (searchResults.length > 0) {
      console.log(`   示例行业: ${searchResults.slice(0, 3).map(r => r.gics4).join(', ')}`);
    }
    console.log('');

    console.log('=== 测试完成 ===');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
test();
