const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

async function debugWechat() {
  const url = 'https://mp.weixin.qq.com/s/GBLPWWn2XRpbzHVdAfw98w';

  console.log('[1] 测试axios解析...');

  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Referer': 'https://www.google.com/'
    }
  });

  console.log(`[2] HTTP状态: ${response.status}`);
  console.log(`[3] HTML长度: ${response.data.length}`);

  const dom = new JSDOM(response.data, { url });
  const document = dom.window.document;

  // 尝试直接查找微信内容
  const jsContent = document.querySelector('#js_content');
  const richMedia = document.querySelector('.rich_media_content');

  console.log(`[4] #js_content: ${jsContent ? '找到' : '未找到'}`);
  console.log(`[5] .rich_media_content: ${richMedia ? '找到' : '未找到'}`);

  if (jsContent) {
    console.log(`[6] #js_content文本长度: ${jsContent.textContent.trim().length}`);
    console.log(`[7] #js_content预览: ${jsContent.textContent.trim().substring(0, 100)}...`);
  }

  if (richMedia) {
    console.log(`[8] .rich_media_content文本长度: ${richMedia.textContent.trim().length}`);
    console.log(`[9] .rich_media_content预览: ${richMedia.textContent.trim().substring(0, 100)}...`);
  }

  // 使用Readability
  const reader = new Readability(document);
  const article = reader.parse();

  console.log(`[10] Readability找到文章: ${article ? '是' : '否'}`);
  if (article) {
    console.log(`[11] Readability标题: ${article.title}`);
    console.log(`[12] Readability内容长度: ${article.textContent.length}`);
    console.log(`[13] Readability内容预览: ${article.textContent.substring(0, 100)}...`);
  }
}

debugWechat().catch(console.error);
