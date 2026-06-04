import { getAccuracy } from '../state.js';

export function renderStatsPanel(quizState) {
  return `
    <section class="stats-grid" aria-label="本次测试统计">
      <div class="stat-tile">
        <span>答题数</span>
        <strong>${quizState.total}</strong>
      </div>
      <div class="stat-tile">
        <span>正确数</span>
        <strong>${quizState.correct}</strong>
      </div>
      <div class="stat-tile">
        <span>正确率</span>
        <strong>${getAccuracy(quizState)}%</strong>
      </div>
    </section>
  `;
}
