import {
  ENGLISH_WORD_INPUT_ATTRIBUTES,
  PART_OF_SPEECH_LABELS,
  renderPartOfSpeechOptions
} from './WordForm.js';

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

function getWordErrorStats(word) {
  return getMeanings(word).reduce((stats, meaning) => {
    const legacyErrorCount = Number(meaning.errorCount || 0);
    const spellingErrorCount = Number(meaning.spellingErrorCount ?? legacyErrorCount);
    const skipCount = Number(meaning.skipCount || 0);

    stats.spellingErrorCount += Number.isFinite(spellingErrorCount) && spellingErrorCount > 0
      ? Math.floor(spellingErrorCount)
      : 0;
    stats.skipCount += Number.isFinite(skipCount) && skipCount > 0 ? Math.floor(skipCount) : 0;
    return stats;
  }, { spellingErrorCount: 0, skipCount: 0 });
}

function getWordErrorCount(word) {
  const stats = getWordErrorStats(word);
  return stats.spellingErrorCount + stats.skipCount;
}

function normalizeSearchQuery(value) {
  return String(value || '').trim().toLowerCase();
}

function getDateFilterStart(dateFilter, now = new Date()) {
  if (dateFilter === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (dateFilter === 'yesterday') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 1);
    return start;
  }

  if (dateFilter === 'recent-7') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return null;
}

function getDateFilterEnd(dateFilter, now = new Date()) {
  if (dateFilter !== 'yesterday') {
    return null;
  }

  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  return end;
}

function wordMatchesSearch(word, query) {
  if (!query) {
    return true;
  }

  return word.english.toLowerCase().startsWith(query)
    || getMeanings(word).some((meaning) => meaning.chinese.toLowerCase().includes(query));
}

function wordMatchesDateFilter(word, dateFilter) {
  const start = getDateFilterStart(dateFilter);
  const end = getDateFilterEnd(dateFilter);

  if (!start) {
    return true;
  }

  const createdAt = new Date(word.createdAt);
  return Number.isFinite(createdAt.getTime())
    && createdAt >= start
    && (!end || createdAt < end);
}

function filterWords(words, searchQuery, dateFilter) {
  const query = normalizeSearchQuery(searchQuery);
  return words.filter((word) => wordMatchesSearch(word, query) && wordMatchesDateFilter(word, dateFilter));
}

function sortWords(words, sortMode) {
  const activeWords = sortMode === 'frequent-errors'
    ? words.filter((word) => getWordErrorCount(word) > 0)
    : words;
  const indexedWords = activeWords.map((word, index) => ({ word, index }));

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

function renderSearchSuggestions(words, searchQuery) {
  const query = normalizeSearchQuery(searchQuery);

  if (!query || /[^\w-]/.test(query)) {
    return '';
  }

  const suggestions = [...new Set(
    words
      .map((word) => word.english)
      .filter((english) => english.toLowerCase().startsWith(query))
  )].slice(0, 8);

  return suggestions.map((english) => `
    <option value="${escapeHtml(english)}"></option>
  `).join('');
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

function renderErrorStats(word) {
  const stats = getWordErrorStats(word);

  return `
    <span class="library-error-stats">
      拼写错误 ${stats.spellingErrorCount} 次 · 跳过 ${stats.skipCount} 次
    </span>
  `;
}

function renderPhonetic(word) {
  const phonetic = String(word.phonetic || '').trim();

  return phonetic ? `<span class="library-phonetic">/${escapeHtml(phonetic)}/</span>` : '';
}

function renderWordCard(word, editingWordId, options = {}) {
  const isEditing = word.id === editingWordId;

  if (isEditing) {
    return `
      <li class="library-row library-row-editing">
        <form class="word-edit-form" data-word-id="${escapeHtml(word.id)}">
          <label>
            <span>英文单词</span>
            <input name="english" ${ENGLISH_WORD_INPUT_ATTRIBUTES} value="${escapeHtml(word.english)}" required />
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
        <div class="library-word-title">
          <strong>${escapeHtml(word.english)}</strong>
          ${renderPhonetic(word)}
          ${options.showErrorStats ? renderErrorStats(word) : ''}
        </div>
        <div class="meaning-badges">${renderMeaningBadges(word)}</div>
      </div>
      <div class="library-actions">
        <button
          class="ghost-button library-listen-button"
          type="button"
          data-word="${escapeHtml(word.english)}"
        >听一下</button>
        <button class="ghost-button edit-word-button" type="button" data-word-id="${escapeHtml(word.id)}">编辑</button>
        <button class="ghost-button delete-word-button" type="button" data-word-id="${escapeHtml(word.id)}">删除</button>
      </div>
    </li>
  `;
}

export function renderWordLibrary(words, editingWordId, sortMode = 'default', searchQuery = '', dateFilter = 'all') {
  const filteredWords = filterWords(words, searchQuery, dateFilter);
  const sortedWords = sortWords(filteredWords, sortMode);
  const emptyMessage = sortMode === 'frequent-errors'
    ? '还没有经常出错的单词。'
    : searchQuery ? '没有匹配的单词。' : '还没有单词。';
  const rows = sortedWords.length
    ? sortedWords
        .map((word) => renderWordCard(word, editingWordId, {
          showErrorStats: sortMode === 'frequent-errors'
        }))
        .join('')
    : `<li class="empty-row">${emptyMessage}</li>`;

  return `
    <section class="panel library-panel" aria-labelledby="library-title">
      <div class="panel-header">
        <div>
          <h2 id="library-title">已添加单词</h2>
        </div>
        <div class="panel-actions library-toolbar">
          <label class="library-filter-control">
            <span class="visually-hidden">按添加时间筛选</span>
            <select id="library-date-filter">
              <option value="all" ${dateFilter === 'all' ? 'selected' : ''}>全部单词</option>
              <option value="today" ${dateFilter === 'today' ? 'selected' : ''}>今日添加</option>
              <option value="yesterday" ${dateFilter === 'yesterday' ? 'selected' : ''}>昨天添加</option>
              <option value="recent-7" ${dateFilter === 'recent-7' ? 'selected' : ''}>近 7 日添加</option>
            </select>
          </label>
          <label class="library-search-control">
            <span class="visually-hidden">搜索词库</span>
            <input
              id="library-search"
              type="search"
              list="library-search-suggestions"
              autocomplete="off"
              placeholder="搜索英文或中文释义"
              value="${escapeHtml(searchQuery)}"
            />
            <datalist id="library-search-suggestions">
              ${renderSearchSuggestions(words, searchQuery)}
            </datalist>
          </label>
          <div class="library-toolbar-actions">
            <button
              id="library-error-sort-button"
              class="ghost-button ${sortMode === 'frequent-errors' ? 'is-active' : ''}"
              type="button"
              aria-pressed="${sortMode === 'frequent-errors'}"
            >经常出错</button>
            <button id="library-add-button" class="ghost-button" type="button">添加单词</button>
            <button id="library-test-button" class="ghost-button" type="button">开始测试</button>
          </div>
        </div>
      </div>
      <ul class="library-list">${rows}</ul>
    </section>
  `;
}
