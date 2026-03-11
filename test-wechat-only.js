const articleParser = require('./src/services/articleParser');

async function testWeChat() {
  try {
    console.log('测试微信公众号链接...');
    const result = await articleParser.parseWithAxios('https://mp.weixin.qq.com/s/GBLPWWn2XRpbzHVdAfw98w');

    console.log('\n解析结果:');
    console.log('标题:', result.title);
    console.log('内容长度:', result.content.length);
    console.log('内容预览:', result.content.substring(0, 200));

    await articleParser.closeBrowser();
  } catch (error) {
    console.error('\n错误:', error.message);
    await articleParser.closeBrowser();
  }
}

testWeChat();
