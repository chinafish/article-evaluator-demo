require('dotenv').config();
const axios = require('axios');

const key = process.env.AI_API_KEY;
const baseURL = process.env.AI_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const model = process.env.AI_MODEL || 'kimi-k2-250905';

console.log('Key:', key ? key.substring(0, 8) + '...' : '未设置');
console.log('URL:', baseURL);
console.log('Model:', model);

axios.post(`${baseURL}/chat/completions`, {
  model: model,
  messages: [{ role: 'user', content: '你好，回复一个字' }],
  max_tokens: 50
}, {
  headers: {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  },
  timeout: 20000
}).then(r => {
  console.log('✅ API连通:', r.data.choices[0].message.content);
}).catch(e => {
  console.log('❌ API失败:', e.message, '| code:', e.code);
  if (e.response) {
    console.log('HTTP状态:', e.response.status, JSON.stringify(e.response.data));
  }
});

