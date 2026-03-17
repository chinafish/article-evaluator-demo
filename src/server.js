require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// 路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'demo.html'));
});

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'demo.html'));
});

// API路由
app.use('/api', require('./routes/evaluate'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/evaluate-stream', require('./routes/evaluate-stream'));

// 管理员页面
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// 代理路由：用于iframe跨域加载内容
app.get('/api/proxy', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).send('Missing URL parameter');
    }

    console.log(`[代理请求] URL: ${url}`);

    // 解析URL获取源域名
    let sourceOrigin = '';
    try {
      const urlObj = new URL(url);
      sourceOrigin = urlObj.origin;
    } catch (e) {
      console.error('[代理错误] 无效的URL:', url);
    }

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': sourceOrigin || url  // 添加Referer头
      },
      responseType: 'text',
      maxRedirects: 5
    });

    // 获取HTML内容
    let html = response.data;

    // 注入基础CSS以确保可读性
    const injectedCSS = `
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif !important;
          line-height: 1.6 !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 20px !important;
        }
        img {
          max-width: 100% !important;
          height: auto !important;
        }
      </style>
    `;

    // 在</head>前注入CSS和base标签
    if (html.includes('</head>')) {
      // 添加base标签，让相对路径的资源可以正确加载
      const baseTag = sourceOrigin ? `<base href="${sourceOrigin}/">` : '';
      html = html.replace('</head>', baseTag + injectedCSS + '</head>');
    } else {
      html = (sourceOrigin ? `<base href="${sourceOrigin}/">` : '') + injectedCSS + html;
    }

    // 设置正确的Content-Type
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');

    res.send(html);

  } catch (error) {
    console.error('[代理错误]', error.message);
    res.status(500).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;color:#666;"><div style="text-align:center;"><h3>代理失败</h3><p>${error.message}</p><p>请尝试在新窗口打开原文</p></div></body></html>`);
  }
});

// 性能报告API
app.get('/api/performance/report', (req, res) => {
  try {
    const perfTracker = require('./utils/performanceTracker');
    const report = perfTracker.getLatestReport();

    if (!report) {
      return res.json({
        success: false,
        error: {
          message: '暂无性能报告，请先进行一次评估'
        }
      });
    }

    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: '获取性能报告失败: ' + error.message
      }
    });
  }
});

// 404处理（必须放在最后）
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                               ║
║  📊 文章评估智能体 Demo v1.2 (P0优化版)                      ║
║                                                               ║
║  ✅ 决策优先级判断                                           ║
║  ✅ 相关性评估                                               ║
║  ✅ 紧迫性判断                                               ║
║  ✅ 优化卡片呈现                                             ║
║                                                               ║
║  服务地址: http://localhost:${PORT}                           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
