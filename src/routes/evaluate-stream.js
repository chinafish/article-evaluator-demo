const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // 发送进度更新函数
  const sendProgress = (step, progress, message, data = {}) => {
    res.write(`data: ${JSON.stringify({
      step,
      progress,
      message,
      data
    })}\n\n`);
  };

  try {
    const { url, content } = req.query;

    // 测试：发送初始进度
    sendProgress('test', 0, 'SSE 连接成功', { timestamp: Date.now() });

    // 等待 3 秒后关闭连接（测试用）
    setTimeout(() => {
      sendProgress('complete', 100, '🎉 测试完成', {});
      res.end();
    }, 3000);

  } catch (error) {
    console.error('[SSE Error]', error);
    sendProgress('error', 0, '❌ 连接失败', { error: error.message });
    res.end();
  }
});

module.exports = router;