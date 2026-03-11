const { chromium } = require('playwright-core');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const path = require('path');

/**
 * 使用本地安装的 Playwright Chromium 解析文章
 */
class LocalPlaywrightParser {
  /**
   * 解析URL
   */
  async parseUrl(url) {
    console.log(`[Playwright] 开始解析: ${url}`);

    let browser = null;
    let page = null;

    try {
      // 使用系统已安装的 Chromium
      const executablePath = path.join(
        process.env.LOCALAPPDATA,
        'ms-playwright',
        'chromium-1208',
        'chrome-win64',
        'chrome.exe'
      );

      console.log(`[Playwright] 使用浏览器: ${executablePath}`);

      browser = await chromium.launch({
        executablePath: executablePath,
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled'
        ]
      });

      page = await browser.newPage();

      // 设置真实的User-Agent和更多反检测措施
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/'
      });

      // 访问页面（使用更宽松的等待策略）
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // 额外等待让JS执行
      await page.waitForTimeout(3000);

      // 提取页面内容
      const html = await page.content();

      // 使用Readability解析
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;
      const article = new Readability(document).parse();

      if (!article || !article.content) {
        throw new Error('无法提取文章内容');
      }

      const result = {
        title: article.title || this.extractTitle(document),
        content: this.cleanText(article.textContent),
        htmlContent: article.content,
        source: this.extractSource(url),
        url: url,
        excerpt: article.excerpt || ''
      };

      console.log(`[Playwright] 解析成功 - 标题: ${result.title}, 内容长度: ${result.content.length}`);
      return result;

    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  /**
   * 提取标题
   */
  extractTitle(document) {
    const selectors = [
      'h1',
      'title',
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      '.article-title',
      '.post-title',
      '.entry-title',
      '.Post-Main .PostTitle',
      '.RichText ztext Post-RichText' // 知乎标题选择器
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const title = element.getAttribute('content') || element.textContent;
        if (title && title.trim()) {
          return title.trim();
        }
      }
    }

    return '未知标题';
  }

  /**
   * 提取来源
   */
  extractSource(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch {
      return '未知来源';
    }
  }

  /**
   * 清理文本
   */
  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
}

module.exports = new LocalPlaywrightParser();
