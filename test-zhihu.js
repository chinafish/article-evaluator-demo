const puppeteer = require('puppeteer-core');

async function testZhihu() {
  console.log('[测试] 启动Edge浏览器...');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    console.log('[测试] 访问知乎文章...');

    await page.goto('https://zhuanlan.zhihu.com/p/1961070895243190831', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('[测试] 等待内容加载...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 获取页面标题和URL看看是否有重定向
    const pageTitle = await page.title();
    const currentUrl = page.url();

    console.log('当前URL:', currentUrl);
    console.log('页面标题:', pageTitle);

    // 尝试获取标题
    const title = await page.evaluate(() => {
      const titleEl = document.querySelector('h1.Post-MainTitle') ||
                      document.querySelector('.Post-Title') ||
                      document.querySelector('h1');
      return titleEl?.textContent?.trim() || '未找到标题';
    });

    // 尝试获取内容
    const content = await page.evaluate(() => {
      const contentEl = document.querySelector('.Post-RichText') ||
                        document.querySelector('.RichContent-inner');
      return contentEl?.textContent?.trim().substring(0, 200) || '未找到内容';
    });

    // 获取页面HTML的前500个字符看看是什么
    const htmlPreview = await page.evaluate(() => {
      return document.body.innerHTML.substring(0, 500);
    });

    console.log('[测试结果]');
    console.log('标题:', title);
    console.log('内容预览:', content);
    console.log('HTML预览:', htmlPreview);
    console.log('[测试] 成功！✅');

  } catch (error) {
    console.error('[测试] 失败:', error.message);
  } finally {
    await browser.close();
  }
}

testZhihu();
