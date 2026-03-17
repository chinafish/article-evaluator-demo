const http = require('http');
const fs = require('fs');
const path = require('path');

const articles = [
  { label: 'SaaS', url: 'https://m.36kr.com/p/1545574584805634' },
  { label: '光伏', url: 'https://finance.sina.com.cn/wm/2026-03-04/doc-inhpvpqn0368333.shtml' },
  { label: '半导体', url: 'https://www.21jingji.com/article/20260303/herald/d18990d8af66f966782aa91abe0da356.html' },
  { label: '咖啡（跨行业）', url: 'https://m.36kr.com/p/3016204261434885' }
];

const targetIndex = parseInt(process.argv[2] || '0');
const article = articles[targetIndex];

console.log(`\n========== 开始评估: ${article.label} ==========`);
console.log(`URL: ${article.url}\n`);

const data = JSON.stringify({ type: 'url', data: article.url, forceGeneral: true });

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/evaluate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(body);
      
      // 如果需要用户选择，自动选择通用基准
      if (result.requires_user_action && result.task_id) {
        console.log(`检测到需要路由选择，自动选择通用基准...`);
        const chooseData = JSON.stringify({ task_id: result.task_id, option: 'use_general' });
        const chooseReq = http.request({
          hostname: 'localhost', port: 3000,
          path: '/api/evaluate/choose-option', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(chooseData) }
        }, chooseRes => {
          let chooseBody = '';
          chooseRes.on('data', chunk => chooseBody += chunk);
          chooseRes.on('end', () => {
            const chooseResult = JSON.parse(chooseBody);
            const outputFile = path.join(__dirname, `test_result_${targetIndex}_${article.label}.json`);
            fs.writeFileSync(outputFile, JSON.stringify(chooseResult, null, 2), 'utf-8');
            console.log(`结果已保存到: ${outputFile}`);
            console.log('===== 评估结果摘要 =====');
            console.log(JSON.stringify(chooseResult.evaluation?.overall_assessment, null, 2));
          });
        });
        chooseReq.write(chooseData);
        chooseReq.end();
        return;
      }
      
      const outputFile = path.join(__dirname, `test_result_${targetIndex}_${article.label}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`结果已保存到: ${outputFile}`);
      
      if (result.success) {
        console.log('===== 评估结果摘要 =====');
        console.log(JSON.stringify(result.evaluation?.overall_assessment || result.evaluation, null, 2));
      } else {
        console.log('评估失败:', result.error);
      }
    } catch (e) {
      console.log('解析失败:', e.message);
      console.log('原始响应（前2000字符）:', body.substring(0, 2000));
    }
  });
});

req.on('error', e => console.log('请求错误:', e.message));
req.write(data);
req.end();
