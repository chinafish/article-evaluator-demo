const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

async function testWithDebug() {
  const url = 'https://mp.weixin.qq.com/s/GBLPWWn2XRpbzHVdAfw98w';

  console.log('[测试] 开始...');
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Referer': 'https://www.google.com/'
    }
  });

  const dom = new JSDOM(response.data, { url });
  const document = dom.window.document;
  const reader = new Readability(document);
  const article = reader.parse();

  console.log('[调试] Readability解析结果:');
  console.log('  - 标题:', article.title);
  console.log('  - 是否有content:', !!article.content);
  console.log('  - textContent长度:', article.textContent.length);

  const content = article.textContent || '';

  console.log('\n[检测] 执行检测逻辑:');
  console.log('  - content.includes("载入中"):', content.includes('载入中'));
  console.log('  - content.includes("加载中"):', content.includes('加载中'));
  console.log('  - content.includes("Loading..."):', content.includes('Loading...'));
  console.log('  - content.includes("请稍候"):', content.includes('请稍候'));
  console.log('  - content.length < 200:', content.length < 200);

  console.log('\n[结果] 实际内容长度:', content.length);
  console.log('[结果] 内容预览:', content.substring(0, 100));
}

testWithDebug().catch(console.error);
