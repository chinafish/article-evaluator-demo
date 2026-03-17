/**
 * 性能追踪器
 *
 * 用于追踪各个阶段的执行时间
 */

class PerformanceTracker {
  constructor() {
    this.timers = {};
    this.records = [];
  }

  /**
   * 开始计时
   * @param {string} label - 计时标签
   */
  start(label) {
    this.timers[label] = {
      start: Date.now(),
      end: null,
      duration: null
    };
  }

  /**
   * 结束计时
   * @param {string} label - 计时标签
   */
  end(label) {
    if (this.timers[label]) {
      this.timers[label].end = Date.now();
      this.timers[label].duration = this.timers[label].end - this.timers[label].start;

      this.records.push({
        label,
        ...this.timers[label]
      });

      return this.timers[label].duration;
    }
    return null;
  }

  /**
   * 获取计时记录
   */
  getRecords() {
    return this.records;
  }

  /**
   * 获取某个阶段的耗时
   * @param {string} label - 计时标签
   */
  getDuration(label) {
    return this.timers[label] ? this.timers[label].duration : null;
  }

  /**
   * 清空所有记录
   */
  clear() {
    this.timers = {};
    this.records = [];
  }

  /**
   * 打印性能报告
   */
  report() {
    console.log('\n=== 性能报告 ===');
    this.records.forEach(record => {
      console.log(`${record.label}: ${record.duration}ms`);
    });
    console.log('================\n');
  }
}

module.exports = new PerformanceTracker();
