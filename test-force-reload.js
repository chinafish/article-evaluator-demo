// 强制重新加载模块
delete require.cache[require.resolve('./src/services/articleParser')];
const articleParser = require('./src/services/articleParser');

async function testWeChat() {
  try {
    console.log('测试微信公众号链接（强制重新加载）...');
    const result = await articleParser.parseUrl('https://mp.weixin.qq.com/s/GBLPWWn2XRpbzHVdAfw98w');

    console.log('\n解析结果:');
    console.log('标题:', result.title);
    console.log('内容长度:', result.content.length);
    console.log('内容预览:', result.content.substring(0, 200));

    if (result.content.length < 200) {
      console.log('\n⚠️  内容仍然过短，代码修改未生效！');
    } else {
      console.log('\n✅ 内容长度正常！');
    }

    await articleParser.closeBrowser();
  } catch (error) {
    console.error('\n错误:', error.message);
    await articleParser.closeBrowser();
  }
}

testWeChat();
