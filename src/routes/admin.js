const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const comprehensiveResearchGenerator = require('../services/comprehensiveResearchGenerator');
const industryBenchmarkGenerator = require('../services/industryBenchmarkGenerator');

/**
 * GET /api/admin/benchmarks
 * 获取所有行业基准列表
 */
router.get('/benchmarks', async (req, res) => {
  try {
    const cacheDir = path.join(__dirname, '../../cache/industry_benchmarks');

    // 确保缓存目录存在
    if (!fs.existsSync(cacheDir)) {
      return res.json({
        success: true,
        benchmarks: [],
        stats: {
          total: 0,
          totalSize: 0
        }
      });
    }

    // 读取所有基准文件
    const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'));

    let totalSize = 0;
    const benchmarks = [];

    for (const file of files) {
      const filepath = path.join(cacheDir, file);
      const stats = fs.statSync(filepath);

      try {
        const content = fs.readFileSync(filepath, 'utf-8');
        const benchmark = JSON.parse(content);

        // 解析GICS名称（文件名格式：GICS名称.json）
        const gics4 = file.replace('.json', '').replace(/_/g, '/');

        benchmarks.push({
          filename: file,
          gics4: gics4,
          generated_at: benchmark.generated_at || stats.mtime.toISOString(),
          file_size: stats.size,
          industry_research_report: !!benchmark.industry_research_report
        });

        totalSize += stats.size;
      } catch (error) {
        console.error(`[管理员] 读取基准文件失败: ${file}`, error.message);
      }
    }

    // 按生成时间排序
    benchmarks.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));

    res.json({
      success: true,
      benchmarks: benchmarks,
      stats: {
        total: benchmarks.length,
        totalSize: totalSize
      }
    });

  } catch (error) {
    console.error('[管理员] 获取基准列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/benchmarks/:filename
 * 获取指定基准的详细信息
 */
router.get('/benchmarks/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const cacheDir = path.join(__dirname, '../../cache/industry_benchmarks');
    const filepath = path.join(cacheDir, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: '基准文件不存在'
      });
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const benchmark = JSON.parse(content);

    // 解析GICS名称
    benchmark.gics4 = filename.replace('.json', '').replace(/_/g, '/');

    res.json({
      success: true,
      benchmark: benchmark
    });

  } catch (error) {
    console.error('[管理员] 获取基准详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/benchmarks/:filename
 * 删除指定的基准文件
 */
router.delete('/benchmarks/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const cacheDir = path.join(__dirname, '../../cache/industry_benchmarks');
    const filepath = path.join(cacheDir, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: '基准文件不存在'
      });
    }

    // 删除文件
    fs.unlinkSync(filepath);

    console.log(`[管理员] 已删除基准: ${filename}`);

    res.json({
      success: true,
      message: '基准已删除'
    });

  } catch (error) {
    console.error('[管理员] 删除基准失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/benchmarks/regenerate
 * 重新生成指定行业的基准和研究报告
 */
router.post('/benchmarks/regenerate', async (req, res) => {
  try {
    const { gics4 } = req.body;

    if (!gics4) {
      return res.status(400).json({
        success: false,
        error: '缺少行业名称参数'
      });
    }

    console.log(`[管理员] 开始重新生成基准: ${gics4}`);
    console.log(`[管理员] gics4 type: ${typeof gics4}, value: ${JSON.stringify(gics4)}`);

    // 步骤1: 生成行业研究报告（启用网络搜索获取最新数据）
    console.log(`[管理员] 步骤1: 生成行业研究报告...`);
    const researchReport = await comprehensiveResearchGenerator.generateComprehensiveReport(gics4, {
      enableSearch: true,
      useCache: false  // 强制重新获取最新数据
    });

    if (!researchReport) {
      return res.status(500).json({
        success: false,
        error: '生成行业研究报告失败'
      });
    }

    console.log(`[管理员] 行业研究报告生成完成`);

    // 确保研究报告包含 gics4 字段
    if (!researchReport.gics4) {
      researchReport.gics4 = gics4;
      console.log(`[管理员] 补充 gics4 字段到研究报告`);
    }

    // 步骤2: 基于新的研究报告生成认知基准
    console.log(`[管理员] 步骤2: 生成认知基准...`);
    const benchmark = await industryBenchmarkGenerator.generateBenchmark(researchReport, { useCache: false });

    if (!benchmark) {
      return res.status(500).json({
        success: false,
        error: '生成认知基准失败'
      });
    }

    console.log(`[管理员] 认知基准生成完成`);

    // 步骤3: 保存基准文件
    const cacheDir = path.join(__dirname, '../../cache/industry_benchmarks');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const filename = gics4.replace(/\//g, '_') + '.json';
    const filepath = path.join(cacheDir, filename);

    const benchmarkData = {
      gics4: gics4,
      generated_at: new Date().toISOString(),
      industry_research_report: researchReport,
      evaluation_dimensions: benchmark.evaluation_dimensions,
      filename: filename
    };

    fs.writeFileSync(filepath, JSON.stringify(benchmarkData, null, 2), 'utf-8');

    console.log(`[管理员] 基准已保存: ${filename}`);

    res.json({
      success: true,
      message: '基准重新生成成功',
      benchmark: benchmarkData
    });

  } catch (error) {
    console.error('[管理员] 重新生成基准失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
