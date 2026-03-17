/**
 * 耗时分析工具
 * 用于监控和记录各个步骤的执行时间
 * 增强版：支持保存到文件和Web界面显示
 */

const fs = require('fs');
const path = require('path');

class PerformanceTracker {
  constructor() {
    this.timings = [];
    this.marks = new Map();
    this.reportDir = path.join(__dirname, '../../logs');
    this.ensureReportDir();
  }

  /**
   * 确保报告目录存在
   */
  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  /**
   * 开始计时
   * @param {string} label - 步骤标签
   */
  start(label) {
    const startTime = Date.now();
    this.marks.set(label, {
      startTime,
      label,
      category: this.getCategory(label)
    });
    console.log(`\n⏱️  [开始] ${label}`);
  }

  /**
   * 结束计时
   * @param {string} label - 步骤标签
   */
  end(label) {
    const mark = this.marks.get(label);
    if (!mark) {
      console.warn(`⚠️  未找到计时标记: ${label}`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - mark.startTime;

    this.timings.push({
      label,
      category: mark.category,
      duration,
      startTime: mark.startTime,
      endTime
    });

    console.log(`✅ [完成] ${label} - 耗时: ${this.formatDuration(duration)}`);
  }

  /**
   * 记录一个时间点（用于计算间隔）
   * @param {string} label - 标签
   */
  mark(label) {
    const time = Date.now();
    console.log(`📍 [标记] ${label} - ${new Date(time).toLocaleTimeString()}`);
    this.marks.set(`mark_${label}`, { time, label });
  }

  /**
   * 生成耗时报告
   * @param {boolean} saveToFile - 是否保存到文件
   */
  generateReport(saveToFile = true) {
    const report = this.buildReport();

    // 在终端输出
    console.log(report.text);

    // 保存到文件
    if (saveToFile && this.timings.length > 0) {
      this.saveReport(report.json);
    }

    return report.json;
  }

  /**
   * 构建报告数据
   */
  buildReport() {
    const lines = [];
    lines.push('\n' + '='.repeat(80));
    lines.push('📊 性能分析报告');
    lines.push('='.repeat(80));

    if (this.timings.length === 0) {
      lines.push('暂无计时数据');
      return { text: lines.join('\n'), json: null };
    }

    // 按类别分组
    const byCategory = this.timings.reduce((acc, timing) => {
      if (!acc[timing.category]) {
        acc[timing.category] = [];
      }
      acc[timing.category].push(timing);
      return acc;
    }, {});

    // 总耗时
    const totalDuration = this.timings.reduce((sum, t) => sum + t.duration, 0);

    // 打印总览
    lines.push('\n📈 总体统计:');
    lines.push(`   总耗时: ${this.formatDuration(totalDuration)}`);
    lines.push(`   步骤数: ${this.timings.length}`);
    lines.push(`   平均耗时: ${this.formatDuration(totalDuration / this.timings.length)}`);

    // 打印各类别统计
    lines.push('\n📊 分类统计:');
    Object.entries(byCategory).forEach(([category, timings]) => {
      const categoryTotal = timings.reduce((sum, t) => sum + t.duration, 0);
      const avgTime = categoryTotal / timings.length;
      const percentage = ((categoryTotal / totalDuration) * 100).toFixed(1);

      lines.push(`\n   【${category}】`);
      lines.push(`   - 总耗时: ${this.formatDuration(categoryTotal)}`);
      lines.push(`   - 平均: ${this.formatDuration(avgTime)}`);
      lines.push(`   - 占比: ${percentage}%`);
      lines.push(`   - 次数: ${timings.length}`);

      // 打印该类别下的详细步骤
      timings
        .sort((a, b) => b.duration - a.duration)
        .forEach((timing, index) => {
          const bar = this.generateBar(timing.duration, categoryTotal);
          lines.push(`     ${index + 1}. ${timing.label}: ${this.formatDuration(timing.duration)} ${bar}`);
        });
    });

    // 打印最耗时步骤
    lines.push('\n🔥 最耗时步骤 TOP 5:');
    this.timings
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .forEach((timing, index) => {
        const percentage = ((timing.duration / totalDuration) * 100).toFixed(1);
        lines.push(`   ${index + 1}. ${timing.label}`);
        lines.push(`      耗时: ${this.formatDuration(timing.duration)} (${percentage}%)`);
        lines.push(`      类别: ${timing.category}`);
      });

    lines.push('\n' + '='.repeat(80));
    lines.push(`报告生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('='.repeat(80));

    // 构建JSON数据
    const reportJson = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDuration,
        stepCount: this.timings.length,
        averageDuration: totalDuration / this.timings.length
      },
      byCategory: Object.entries(byCategory).map(([category, timings]) => {
        const categoryTotal = timings.reduce((sum, t) => sum + t.duration, 0);
        return {
          category,
          totalDuration: categoryTotal,
          averageDuration: categoryTotal / timings.length,
          percentage: ((categoryTotal / totalDuration) * 100).toFixed(1) + '%',
          count: timings.length,
          steps: timings.map(t => ({
            label: t.label,
            duration: t.duration,
            startTime: new Date(t.startTime).toISOString(),
            endTime: new Date(t.endTime).toISOString()
          }))
        };
      }),
      topSteps: this.timings
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map(t => ({
          label: t.label,
          category: t.category,
          duration: t.duration,
          percentage: ((t.duration / totalDuration) * 100).toFixed(1) + '%'
        }))
    };

    return {
      text: lines.join('\n'),
      json: reportJson
    };
  }

  /**
   * 保存报告到文件
   */
  saveReport(reportData) {
    try {
      // 保存JSON格式的详细报告
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const jsonFile = path.join(this.reportDir, `perf-report-${timestamp}.json`);
      fs.writeFileSync(jsonFile, JSON.stringify(reportData, null, 2), 'utf8');

      // 保存最新报告（便于访问）
      const latestJsonFile = path.join(this.reportDir, 'latest-perf-report.json');
      fs.writeFileSync(latestJsonFile, JSON.stringify(reportData, null, 2), 'utf8');

      console.log(`\n💾 报告已保存到:`);
      console.log(`   - ${jsonFile}`);
      console.log(`   - ${latestJsonFile} (最新)`);
    } catch (error) {
      console.error(`❌ 保存报告失败:`, error.message);
    }
  }

  /**
   * 获取最新报告
   */
  getLatestReport() {
    const latestFile = path.join(this.reportDir, 'latest-perf-report.json');
    try {
      if (fs.existsSync(latestFile)) {
        const data = fs.readFileSync(latestFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('读取最新报告失败:', error.message);
    }
    return null;
  }

  /**
   * 获取步骤分类
   */
  getCategory(label) {
    if (label.includes('解析') || label.includes('Puppeteer')) return '文章解析';
    if (label.includes('GICS') || label.includes('分类')) return 'GICS分类';
    if (label.includes('相关性') || label.includes('判断')) return '相关性检查';
    if (label.includes('评估') || label.includes('AI')) return 'AI评估';
    if (label.includes('基准') || label.includes('缓存')) return '基准加载';
    if (label.includes('网络') || label.includes('搜索')) return '网络请求';
    if (label.includes('路由') || label.includes('决策')) return '路由决策';
    return '其他';
  }

  /**
   * 格式化时长
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      const seconds = (ms / 1000).toFixed(1);
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * 生成进度条
   */
  generateBar(value, total) {
    const percentage = (value / total) * 100;
    const length = Math.floor(percentage / 2); // 每2%一个字符
    return '█'.repeat(length) + '░'.repeat(50 - length);
  }

  /**
   * 清除所有计时数据
   */
  clear() {
    this.timings = [];
    this.marks.clear();
    console.log('🧹 计时数据已清除');
  }
}

// 导出单例
const perfTracker = new PerformanceTracker();

module.exports = perfTracker;
