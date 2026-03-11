require('dotenv').config();
const axios = require('axios');

async function testAPI() {
  console.log('🔍 测试Kimi API连接...\n');

  const apiKey = process.env.AI_API_KEY;
  const baseURL = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;

  console.log(`配置信息:`);
  console.log(`- API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : '未设置'}`);
  console.log(`- Base URL: ${baseURL}`);
  console.log(`- Model: ${model}\n`);

  try {
    console.log('📡 发送测试请求...');

    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model: model,
        messages: [
          { role: 'system', content: '你是人工智能助手。' },
          { role: 'user', content: '你好' }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('\n✅ API连接成功！');
    console.log('响应:', response.data.choices[0].message.content);

  } catch (error) {
    console.error('\n❌ API连接失败！');

    if (error.code === 'ECONNRESET') {
      console.error('错误类型: 连接被重置 (ECONNRESET)');
      console.error('可能原因:');
      console.error('  1. API Key无效或格式错误');
      console.error('  2. 网络连接问题（防火墙/代理）');
      console.error('  3. API服务不可用');
      console.error('  4. Base URL配置错误');
    } else if (error.response) {
      console.error('HTTP状态:', error.response.status);
      console.error('错误数据:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('错误信息:', error.message);
    }
  }
}

testAPI();
