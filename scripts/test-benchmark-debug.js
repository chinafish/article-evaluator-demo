/**
 * 基准数据服务调试脚本
 */

const benchmarkData = require('../src/services/benchmarkData');

async function test() {
  console.log('=== 基准数据调试 ===\n');

  try {
    // 1. 加载数据
    const data = await benchmarkData.loadData();
    console.log(`加载数据: ${data.length} 条\n`);

    // 2. 查看第一条数据
    console.log('=== 第一条数据（石油天然气钻井）===');
    const first = data[0];
    console.log('ID:', first.id);
    console.log('GICS四级:', first.gics4);
    console.log('GICS一级:', first.gics1);
    console.log('全球冠军:', first.globalChampion);
    console.log('全球亚军数量:', first.globalTop10.length);
    console.log('中国领军数量:', first.chinaTop4.length);

    // 3. 查看索引
    console.log('\n=== 索引状态 ===');
    console.log('byGics4 keys:', Object.keys(benchmarkData.index.byGics4).slice(0, 5));
    console.log('byGics1 keys:', Object.keys(benchmarkData.index.byGics1));
    console.log('byCompany sample:', Object.keys(benchmarkData.index.byCompany).slice(0, 10));

    // 4. 测试查询
    console.log('\n=== 测试查询 ===');
    const energy = await benchmarkData.getByGics1('能源');
    console.log('能源行业数量:', energy.length);
    if (energy[0]) {
      console.log('第一个能源行业:', energy[0].gics4);
      console.log('冠军企业:', energy[0].globalChampion);
    }

  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
  }
}

test();
