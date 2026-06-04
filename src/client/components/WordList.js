import { PART_OF_SPEECH_LABELS } from './WordForm.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return '未知时间';
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function renderWordList(words) {
  const rows = words.length
    ? words
        .slice()
        .reverse()
        .map((word) => `
          <li class="word-row">
            <div class="word-main">
              <strong>${escapeHtml(word.english)}</strong>
              <span>${escapeHtml(word.chinese)}</span>
            </div>
            <div class="word-meta">
              <span>${PART_OF_SPEECH_LABELS[word.partOfSpeech] || '其他'}</span>
              <time>${formatDate(word.createdAt)}</time>
            </div>
          </li>
        `)
        .join('')
    : '<li class="empty-row">还没有单词，先添加一条开始测试。</li>';

  return `
    <section class="panel word-list-panel" aria-labelledby="word-list-title">
      <div class="panel-header">
        <div>
          <p class="eyebrow">词库</p>
          <h2 id="word-list-title">已录入单词</h2>
        </div>
        <span class="count-badge">${words.length} 条</span>
      </div>
      <ul class="word-list">${rows}</ul>
    </section>
  `;
}
