const articleParser = require('./src/services/articleParser');

async function testAllLinks() {
  const links = [
    {
      name: '微信公众号',
      url: 'https://mp.weixin.qq.com/s/GBLPWWn2XRpbzHVdAfw98w'
    },
    {
      name: '知乎',
      url: 'https://zhuanlan.zhihu.com/p/1961070895243190831'
    },
    {
      name: '豆瓣',
      url: 'https://movie.douban.com/review/17418875/'
    },
    {
      name: '金蝶社区',
      url: 'https://vip.kingdee.com/school/detail/688792889777894656?productLineId=40&lang=zh-CN'
    }
  ];

  const results = [];

  for (const link of links) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试: ${link.name}`);
    console.log(`URL: ${link.url}`);
    console.log(`${'='.repeat(60)}`);

    try {
      const result = await articleParser.parseUrl(link.url);

      console.log(`\n✅ 成功`);
      console.log(`标题: ${result.title}`);
      console.log(`来源: ${result.source}`);
      console.log(`内容长度: ${result.content.length}`);
      console.log(`内容预览: ${result.content.substring(0, 100)}...`);

      // 检查内容是否过短
      if (result.content.length < 50) {
        console.log(`⚠️  警告: 内容过短，可能解析失败`);
        results.push({ name: link.name, status: '内容过短' });
      } else {
        results.push({ name: link.name, status: '成功' });
      }

    } catch (error) {
      console.log(`\n❌ 失败: ${error.message}`);
      results.push({ name: link.name, status: '失败', error: error.message });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('测试总结:');
  console.log(`${'='.repeat(60)}`);
  results.forEach(r => {
    console.log(`${r.name}: ${r.status}${r.error ? ' - ' + r.error : ''}`);
  });

  await articleParser.closeBrowser();
}

testAllLinks();
