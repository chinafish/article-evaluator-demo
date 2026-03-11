let chromium;
try {
  const playwright = require('playwright-core');
  chromium = playwright.chromium;
} catch (error) {
  chromium = null;
  console.warn('[Playwright] Playwright module not found, skipping Playwright parser');
}

const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

/**
 * 使用 Playwright 解析文章（支持更多网站）
 */
class PlaywrightParser {
  constructor() {
    this.browser = null;
  }

  /**
   * 解析URL
   */
  async parseUrl(url) {
    if (!chromium) {
      throw new Error('Playwright module not available');
    }

    console.log(`[Playwright] 开始解析: ${url}`);

    let browser = null;
    let page = null;

    try {
      // 启动浏览器（使用系统安装的Chromium）
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled'
        ]
      });

      page = await browser.newPage();

      // 设置真实的User-Agent
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      });

      // 访问页面
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // 等待内容加载
      await page.waitForTimeout(2000);

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
      '.entry-title'
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

module.exports = new PlaywrightParser();
