import { PART_OF_SPEECH_LABELS, renderPartOfSpeechOptions } from './WordForm.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getMeanings(word) {
  return Array.isArray(word.meanings)
    ? word.meanings
    : [{
        id: word.meaningId || `${word.id}_meaning`,
        partOfSpeech: word.partOfSpeech,
        chinese: word.chinese
      }];
}

function getWordErrorCount(word) {
  return getMeanings(word).reduce((total, meaning) => {
    const errorCount = Number(meaning.errorCount || 0);
    return total + (Number.isFinite(errorCount) ? Math.max(errorCount, 0) : 0);
  }, 0);
}

function sortWords(words, sortMode) {
  const indexedWords = words.map((word, index) => ({ word, index }));

  if (sortMode === 'frequent-errors') {
    indexedWords.sort((left, right) => {
      const errorDifference = getWordErrorCount(right.word) - getWordErrorCount(left.word);

      if (errorDifference !== 0) {
        return errorDifference;
      }

      return left.index - right.index;
    });
  }

  return indexedWords.map((item) => item.word);
}

function renderMeaningBadges(word) {
  return getMeanings(word).map((meaning) => `
    <span class="meaning-badge">
      <strong>${PART_OF_SPEECH_LABELS[meaning.partOfSpeech] || 'other'}</strong>
      ${escapeHtml(meaning.chinese)}
    </span>
  `).join('');
}

function renderMeaningEditRows(word) {
  const meanings = getMeanings(word);
  const rows = [...meanings, { partOfSpeech: 'noun', chinese: '' }];

  return rows.map((meaning) => `
    <div class="meaning-edit-row">
      <select name="partOfSpeech">
        ${renderPartOfSpeechOptions(meaning.partOfSpeech)}
      </select>
      <input name="chinese" value="${escapeHtml(meaning.chinese)}" placeholder="中文释义" />
    </div>
  `).join('');
}

function renderWordCard(word, editingWordId) {
  const isEditing = word.id === editingWordId;

  if (isEditing) {
    return `
      <li class="library-row library-row-editing">
        <form class="word-edit-form" data-word-id="${escapeHtml(word.id)}">
          <label>
            <span>英文单词</span>
            <input name="english" value="${escapeHtml(word.english)}" required />
          </label>
          <div class="meaning-edit-list">
            ${renderMeaningEditRows(word)}
          </div>
          <div class="library-actions">
            <button class="primary-button" type="submit">
              <span aria-hidden="true">✓</span>
              <span>保存修改</span>
            </button>
            <button class="ghost-button cancel-edit-button" type="button">取消</button>
          </div>
        </form>
      </li>
    `;
  }

  return `
    <li class="library-row">
      <div class="library-word-main">
        <strong>${escapeHtml(word.english)}</strong>
        <div class="meaning-badges">${renderMeaningBadges(word)}</div>
      </div>
      <div class="library-actions">
        <button class="ghost-button edit-word-button" type="button" data-word-id="${escapeHtml(word.id)}">编辑</button>
        <button class="ghost-button delete-word-button" type="button" data-word-id="${escapeHtml(word.id)}">删除</button>
      </div>
    </li>
  `;
}

export function renderWordLibrary(words, editingWordId, sortMode = 'default') {
  const sortedWords = sortWords(words, sortMode);
  const rows = sortedWords.length
    ? sortedWords.map((word) => renderWordCard(word, editingWordId)).join('')
    : '<li class="empty-row">还没有单词。</li>';

  return `
    <section class="panel library-panel" aria-labelledby="library-title">
      <div class="panel-header">
        <div>
          <p class="eyebrow">词库</p>
          <h2 id="library-title">全部单词</h2>
        </div>
        <div class="panel-actions">
          <button
            id="library-error-sort-button"
            class="ghost-button ${sortMode === 'frequent-errors' ? 'is-active' : ''}"
            type="button"
            aria-pressed="${sortMode === 'frequent-errors'}"
          >经常出错</button>
          <button id="library-add-button" class="ghost-button" type="button">
            <span aria-hidden="true">+</span>
            <span>添加单词</span>
          </button>
          <button id="library-test-button" class="ghost-button" type="button">
            <span aria-hidden="true">?</span>
            <span>开始测试</span>
          </button>
        </div>
      </div>
      <ul class="library-list">${rows}</ul>
    </section>
  `;
}
