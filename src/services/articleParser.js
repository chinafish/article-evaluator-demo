const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 尝试导入Playwright
let playwrightChromium = null;
try {
  const playwright = require('playwright-core');
  playwrightChromium = playwright.chromium;
} catch (error) {
  // Playwright不可用，将只使用Puppeteer
}

// 使用stealth插件隐藏自动化特征
puppeteer.use(StealthPlugin());

class ArticleParser {
  constructor() {
    this.browser = null;
  }

  /**
   * 获取浏览器实例（单例模式）
   */
  async getBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('[Puppeteer] 启动Edge浏览器 (Stealth模式)...');

      // 尝试多个可能的浏览器路径
      const fs = require('fs');
      const path = require('path');

      // Playwright Chromium路径（最优先，专为自动化优化）
      const possiblePlaywrightPaths = [
        path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1208', 'chrome-win64', 'chrome.exe')
      ];

      // Chrome路径
      const possibleChromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
      ];

      // Edge路径作为备选
      const possibleEdgePaths = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe'
      ];

      let executablePath = undefined;

      // 先尝试Playwright Chromium（最稳定）
      for (const chromiumPath of possiblePlaywrightPaths) {
        if (chromiumPath && fs.existsSync(chromiumPath)) {
          executablePath = chromiumPath;
          console.log(`[Puppeteer] 使用Playwright Chromium: ${chromiumPath}`);
          break;
        }
      }

      // 如果没找到Playwright Chromium，尝试Chrome
      if (!executablePath) {
        for (const chromePath of possibleChromePaths) {
          if (chromePath && fs.existsSync(chromePath)) {
            executablePath = chromePath;
            console.log(`[Puppeteer] 使用Chrome: ${chromePath}`);
            break;
          }
        }
      }

      // 如果没找到Chrome，尝试Edge
      if (!executablePath) {
        for (const edgePath of possibleEdgePaths) {
          if (edgePath && fs.existsSync(edgePath)) {
            executablePath = edgePath;
            console.log(`[Puppeteer] 使用Edge: ${edgePath}`);
            break;
          }
        }
      }

      if (!executablePath) {
        console.log('[Puppeteer] 未找到系统浏览器，将使用内置浏览器（如果可用）');
      }

      const launchOptions = {
        headless: true,
        protocolTimeout: 120000,  // 增加协议超时到2分钟
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      };

      if (executablePath) {
        launchOptions.executablePath = executablePath;
        // 添加反检测参数
        launchOptions.args.push('--disable-blink-features=AutomationControlled');
      }

      try {
        this.browser = await puppeteer.launch(launchOptions);
        console.log('[Puppeteer] 浏览器启动成功');
      } catch (error) {
        console.error('[Puppeteer] 启动失败详情:', error.message);
        console.error('[Puppeteer] 错误堆栈:', error.stack);

        // 尝试不使用executablePath启动（使用Puppeteer内置的Chromium）
        console.log('[Puppeteer] 尝试使用内置浏览器启动...');
        try {
          this.browser = await puppeteer.launch({
            headless: 'new',
            args: ['--disable-blink-features=AutomationControlled']
          });
          console.log('[Puppeteer] 内置浏览器启动成功');
          return this.browser;
        } catch (fallbackError) {
          console.error('[Puppeteer] 内置浏览器启动也失败:', fallbackError.message);
          console.error('[Puppeteer] 提示: 请运行 npx puppeteer browsers install chrome 安装内置浏览器');
        }
        throw error;
      }
    }
    return this.browser;
  }

  /**
   * 使用真实浏览器解析文章（绕过反爬虫）
   */
  async parseWithBrowser(url) {
    let page = null;

    try {
      console.log(`[Puppeteer] 开始解析: ${url}`);

      const browser = await this.getBrowser();
      page = await browser.newPage();

      // 设置反检测措施
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // 隐藏自动化特征
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        // 隐藏chrome对象
        window.chrome = {
          runtime: {}
        };
        // 伪装权限
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });

      // 访问页面（使用domcontentloaded以更快获取内容）
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 10000  // 降低到10秒，快速失败
        });
      } catch (gotoError) {
        // 如果页面加载超时，但可能已经加载了部分内容，继续尝试提取
        console.log(`[Puppeteer] 页面加载超时，尝试提取已加载内容: ${gotoError.message}`);
      }

      // 模拟真实用户行为：随机滚动
      await page.evaluate(() => {
        window.scrollBy(0, Math.floor(Math.random() * 200) + 100);
      }, { timeout: 5000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1000));

      await page.evaluate(() => {
        window.scrollBy(0, Math.floor(Math.random() * 300) + 200);
      }, { timeout: 5000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 回到顶部
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      }, { timeout: 5000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 简单等待：固定等待时间让页面渲染
      console.log('[Puppeteer] 等待页面内容渲染...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 提取标题（带超时保护）
      let title = '未知标题';
      try {
        title = await page.evaluate(() => {
          const selectors = [
            'h1.Post-MainTitle',  // 知乎
            '.Post-Title',         // 知乎
            '#activity-name',      // 微信公众号
            '.rich_media_title',   // 微信公众号
            '.review-content',     // 豆瓣影评
            '.article-content',    // 通用
            'h1',
            'title'
          ];

          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent && el.textContent.trim()) {
              return el.textContent.trim();
            }
          }
          return '未知标题';
        }, { timeout: 10000 });
      } catch (error) {
        console.log('[Puppeteer] 标题提取超时，使用默认值');
      }

      // 提取发布日期
      let publishDate = null;
      try {
        publishDate = await page.evaluate(() => {
          // 微信公众号
          const publishTimeEl = document.querySelector('#publish_time');
          if (publishTimeEl?.textContent?.trim()) {
            const ts = parseInt(publishTimeEl.textContent.trim());
            if (!isNaN(ts)) return new Date(ts * 1000).toISOString().slice(0, 10);
          }
          // 通用 time 元素
          const timeEl = document.querySelector('time[datetime]');
          if (timeEl?.getAttribute('datetime')) return timeEl.getAttribute('datetime').slice(0, 10);
          // meta 标签
          const dateMeta = document.querySelector('meta[property="article:published_time"]');
          if (dateMeta?.getAttribute('content')) return dateMeta.getAttribute('content').slice(0, 10);
          return null;
        }, { timeout: 5000 });
      } catch (error) {
        console.log('[Puppeteer] 日期提取超时');
      }

      // 提取正文内容（带超时保护）
      let contentResult;
      try {
        contentResult = await page.evaluate(() => {
          const contentSelectors = [
            '.Post-RichText',      // 知乎
            '.RichContent-inner',  // 知乎
            '#js_content',         // 微信公众号
            '.rich_media_content', // 微信公众号
            '.review-content',     // 豆瓣影评
            '.link-content',       // 豆瓣日记
            'article',
            '.article-content',
            '.post-content',
            'main'
          ];

          for (const selector of contentSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent && el.textContent.trim().length > 100) {
              return {
                text: el.textContent.trim(),
                html: el.innerHTML
              };
            }
          }

          // 如果没找到特定容器，返回body内容
          return {
            text: document.body.textContent.trim(),
            html: document.body.innerHTML
          };
        }, { timeout: 15000 });
      } catch (error) {
        console.log('[Puppeteer] 内容提取超时，尝试备用方法');
        // 备用方法：直接获取页面HTML
        const html = await page.content();
        const jsdom = new JSDOM(html);
        const bodyText = jsdom.window.document.body.textContent || '';
        contentResult = {
          text: bodyText.trim(),
          html: html
        };
      }

      // 清洗文本
      const content = this.cleanText(contentResult.text);

      // 降低内容长度要求 - 只要有内容就尝试返回
      if (content.length < 50) {
        throw new Error('文章内容过少，可能未正确加载');
      }

      // 如果内容较短，添加提示
      const isPartialContent = content.length < 500;

      // 提取来源
      const source = this.extractSource(url);

      const result = {
        title: title,
        content: content,
        htmlContent: contentResult.html,
        source: source,
        excerpt: content.substring(0, 200),
        url: url,
        isPartialContent: isPartialContent,
        publishDate: publishDate
      };

      if (isPartialContent) {
        console.log(`[Puppeteer] 解析成功（内容可能不完整） - 标题: ${result.title}, 内容长度: ${result.content.length}`);
      } else {
        console.log(`[Puppeteer] 解析成功 - 标题: ${result.title}, 内容长度: ${result.content.length}`);
      }

      return result;

    } catch (error) {
      console.error(`[Puppeteer] 解析失败: ${error.message}`);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * 解析文章链接 - 通用分级策略
   * @param {string} url - 文章链接
   * @returns {Promise<Object>} 解析结果
   */
  async parseUrl(url) {
    console.log(`[解析文章] URL: ${url}`);

    // 创建一个超时Promise，10秒后自动失败
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('TIMEOUT'));
      }, 10000);  // 10秒超时
    });

    // 创建解析Promise
    const parsePromise = this._doParse(url);

    try {
      // 使用Promise.race，哪个先完成就返回哪个
      const result = await Promise.race([parsePromise, timeoutPromise]);
      return result;
    } catch (error) {
      if (error.message === 'TIMEOUT') {
        console.log('[解析超时] 10秒内未完成解析');
        const domain = this.extractSource(url);
        throw new Error(`该网站（${domain}）响应较慢或限制了自动访问。\n\n建议方式：手动复制文章内容，粘贴到"文章内容"输入框进行评估`);
      }
      throw error;
    }
  }

  /**
   * 实际的解析逻辑（不带超时控制）
   */
  async _doParse(url) {
    // 检查是否是已知难以解析的域名
    const problematicDomains = ['zhuanlan.zhihu.com', 'zhihu.com'];
    const isProblematic = problematicDomains.some(domain => url.includes(domain));

    // 第一级：尝试使用 axios + Readability（快速）
    try {
      console.log('[1/2] 尝试快速解析...');
      const result = await this.parseWithAxios(url);
      console.log(`[1/2] 快速解析成功 - 标题: ${result.title}, 内容长度: ${result.content.length}`);
      return result;
    } catch (error) {
      console.log(`[1/2] 快速解析失败: ${error.message}`);
    }

    // 第二级：尝试使用 Puppeteer（绕过反爬虫）
    // 对于已知问题域名，跳过浏览器解析以避免长时间等待
    if (!isProblematic) {
      try {
        console.log('[2/2] 尝试真实浏览器解析...');
        const result = await this.parseWithBrowser(url);
        console.log(`[2/2] 浏览器解析成功 - 标题: ${result.title}, 内容长度: ${result.content.length}`);
        return result;
      } catch (error) {
        console.log(`[2/2] 浏览器解析失败: ${error.message}`);
      }
    } else {
      console.log('[2/2] 跳过浏览器解析（知乎等网站限制较严）');
    }

    // 第三级：失败，提示用户
    console.log('[3/3] 所有解析方式均失败');
    const domain = this.extractSource(url);
    throw new Error(`该网站（${domain}）限制了自动访问，无法提取文章内容。\n\n建议方式：手动复制文章内容，粘贴到"文章内容"输入框进行评估`);
  }

  /**
   * 通用解析方法（兼容Q分支调用）
   * @param {string} input - URL或内容
   * @returns {Promise<Object>} 解析结果
   */
  async parse(input) {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return await this.parseUrl(input);
    } else {
      // 直接内容
      return {
        title: '直接输入内容',
        content: input,
        url: null,
        publishDate: null,
        source: '直接输入'
      };
    }
  }

  /**
   * 使用 axios + Readability 解析（快速模式）
   */
  async parseWithAxios(url) {
    // 特殊处理：微信公众号 - 使用专门的解析逻辑
    if (url.includes('mp.weixin.qq.com')) {
      return await this.parseWeChatOfficialAccount(url);
    }

    const response = await axios.get(url, {
      timeout: 8000,  // 8秒超时，留出2秒给Readability解析
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.google.com/',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    const dom = new JSDOM(response.data, { url });
    const document = dom.window.document;

    // 特殊处理：微信公众号
    if (url.includes('mp.weixin.qq.com')) {
      const title = document.querySelector('#activity-name')?.textContent?.trim() ||
                    document.querySelector('.rich_media_title')?.textContent?.trim() ||
                    this.extractTitle(document);

      const contentDiv = document.querySelector('#js_content') ||
                         document.querySelector('.rich_media_content');

      if (contentDiv) {
        const content = this.cleanText(contentDiv.textContent);
        if (content.length >= 200) {
          // 提取发布日期
          let publishDate = null;
          const publishTimeEl = document.querySelector('#publish_time');
          if (publishTimeEl?.textContent?.trim()) {
            const ts = parseInt(publishTimeEl.textContent.trim());
            if (!isNaN(ts)) publishDate = new Date(ts * 1000).toISOString().slice(0, 10);
          }
          if (!publishDate) {
            const ctMatch = response.data.match(/var\s+ct\s*=\s*["'](\d+)["']/);
            if (ctMatch) publishDate = new Date(parseInt(ctMatch[1]) * 1000).toISOString().slice(0, 10);
          }
          return {
            title: title,
            content: content,
            htmlContent: contentDiv.innerHTML,
            source: '微信公众号',
            excerpt: content.substring(0, 200),
            url: url,
            publishDate: publishDate
          };
        }
      }
      // 如果提取失败，继续使用Readability
    }

    const reader = new Readability(document);
    const article = reader.parse();

    if (!article || !article.content) {
      throw new Error('无法提取文章内容');
    }

    // 从HTML中提取文本内容（textContent可能包含大量空白）
    const contentDiv = dom.window.document.createElement('div');
    contentDiv.innerHTML = article.content;
    const rawContent = contentDiv.textContent || article.textContent || '';

    // 检测1：是否有"载入中"等关键字
    if (rawContent.includes('载入中') || rawContent.includes('加载中') ||
        rawContent.includes('Loading...') || rawContent.includes('请稍候')) {
      throw new Error('页面需要JavaScript渲染');
    }

    // 检测2：内容是否过短（可能是JavaScript未渲染）
    if (rawContent.length < 200) {
      throw new Error('提取内容过短，可能需要JavaScript渲染');
    }

    return {
      title: article.title || this.extractTitle(document),
      content: this.cleanText(rawContent),
      htmlContent: article.content,
      source: this.extractSource(url),
      excerpt: article.excerpt || '',
      url: url,
      publishDate: article.publishedTime || null
    };
  }

  /**
   * 专门处理微信公众号文章
   */
  async parseWeChatOfficialAccount(url) {
    console.log('[微信公众号] 使用专门解析逻辑...');

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700203C) NetType/WIFI Windows/10 WeChat/arm64 We2.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://mp.weixin.qq.com/',
          'Cache-Control': 'max-age=0'
        }
      });

      const dom = new JSDOM(response.data, { url });
      const document = dom.window.document;

      // 提取标题
      const title = document.querySelector('#activity-name')?.textContent?.trim() ||
                    document.querySelector('.rich_media_title')?.textContent?.trim() ||
                    document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                    this.extractTitle(document);

      // 提取内容
      const contentDiv = document.querySelector('#js_content') ||
                         document.querySelector('.rich_media_content');

      if (!contentDiv) {
        throw new Error('未找到文章内容，可能需要登录或文章已删除');
      }

      const rawContent = contentDiv.textContent || '';

      // 检测是否是验证码页面或加载中
      if (rawContent.includes('验证') || rawContent.includes('请输入') ||
          rawContent.includes('点击') && rawContent.length < 500) {
        throw new Error('文章需要验证码才能访问');
      }

      // 检测内容是否过短
      if (rawContent.length < 200) {
        throw new Error(`提取内容过短 (${rawContent.length}字)，可能未正确加载`);
      }

      const content = this.cleanText(rawContent);

      // 提取发布日期
      let publishDate = null;
      // 优先从 #publish_time 元素提取
      const publishTimeEl = document.querySelector('#publish_time');
      if (publishTimeEl?.textContent?.trim()) {
        const ts = parseInt(publishTimeEl.textContent.trim());
        if (!isNaN(ts)) {
          publishDate = new Date(ts * 1000).toISOString().slice(0, 10);
        }
      }
      // 尝试从 var ct = "..." 脚本变量提取（WeChat常用）
      if (!publishDate) {
        const ctMatch = response.data.match(/var\s+ct\s*=\s*["'](\d+)["']/);
        if (ctMatch) {
          publishDate = new Date(parseInt(ctMatch[1]) * 1000).toISOString().slice(0, 10);
        }
      }
      // 尝试从 meta 标签提取
      if (!publishDate) {
        const dateMeta = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content');
        if (dateMeta) publishDate = dateMeta.slice(0, 10);
      }

      return {
        title: title,
        content: content,
        htmlContent: contentDiv.innerHTML,
        source: '微信公众号',
        excerpt: content.substring(0, 200),
        url: url,
        publishDate: publishDate,
        isPartialContent: content.length < 500
      };

    } catch (error) {
      if (error.response && error.response.status === 403) {
        throw new Error('微信公众号限制了访问，请稍后重试或复制文章内容进行评估');
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('微信公众号响应超时，建议复制文章内容进行评估');
      }
      throw error;
    }
  }

  /**
   * 清洗文本内容
   */
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')  // 多个空白转单个空格
      .replace(/\n{3,}/g, '\n\n')  // 多个换行转双换行
      .trim()
      .substring(0, 10000);  // 限制10000字
  }

  /**
   * 修复HTML中的图片路径
   */
  fixImagePaths(html, baseUrl) {
    if (!baseUrl || !html) return html;

    try {
      const urlObj = new URL(baseUrl);

      // 匹配img标签的src属性
      return html.replace(/<img([^>]*?)\s+src=["']([^"']*)["']([^>]*?)>/gi, (match, before, src, after) => {
        // 如果已经是完整URL或data URL，不做处理
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
          return match;
        }

        // 处理协议相对URL
        if (src.startsWith('//')) {
          return `<img${before} src="https:${src}"${after}>`;
        }

        // 处理绝对路径
        if (src.startsWith('/')) {
          return `<img${before} src="${urlObj.origin}${src}"${after}>`;
        }

        // 处理相对路径
        const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/'));
        const fullSrc = urlObj.origin + basePath + '/' + src;
        return `<img${before} src="${fullSrc}"${after}>`;
      });
    } catch (error) {
      console.error('[修复图片路径失败]', error.message);
      return html;
    }
  }

  /**
   * 提取标题
   */
  extractTitle(document) {
    return document.querySelector('title')?.textContent ||
           document.querySelector('h1')?.textContent ||
           '未知标题';
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
   * 错误处理
   */
  handleError(error) {
    if (error.code === 'ENOTFOUND') {
      return new Error('链接无效，请检查后重试');
    }
    if (error.code === 'ECONNABORTED') {
      return new Error('请求超时，请重试');
    }
    if (error.message.includes('HTTP 404')) {
      return new Error('文章不存在或已删除');
    }
    if (error.message.includes('HTTP 403') || error.message.includes('HTTP 401')) {
      return new Error('文章需要登录或付费，请复制粘贴内容');
    }
    return error;
  }

  /**
   * 关闭浏览器连接
   */
  async closeBrowser() {
    if (this.browser && this.browser.isConnected()) {
      await this.browser.close();
      this.browser = null;
      console.log('[Puppeteer] 浏览器已关闭');
    }
  }
}

// 优雅关闭：在进程退出时关闭浏览器
process.on('SIGINT', async () => {
  await module.exports.closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await module.exports.closeBrowser();
  process.exit(0);
});

module.exports = new ArticleParser();
