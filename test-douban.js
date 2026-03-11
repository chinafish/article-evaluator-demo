const articleParser = require('./src/services/articleParser');

async function testDouban() {
  try {
    console.log('[测试] 开始解析豆瓣影评...');

    const url = 'https://movie.douban.com/review/17418875/';
    const result = await articleParser.parseUrl(url);

    console.log('\n[解析结果]');
    console.log('标题:', result.title);
    console.log('来源:', result.source);
    console.log('内容长度:', result.content.length);
    console.log('内容预览:', result.content.substring(0, 500));
    console.log('\n[测试成功] ✅');

    await articleParser.closeBrowser();
  } catch (error) {
    console.error('\n[测试失败] ❌', error.message);
    await articleParser.closeBrowser();
  }
}

testDouban();
