import { PART_OF_SPEECH_LABELS } from './WordForm.js';
import { renderStatsPanel } from './StatsPanel.js';

function getRangeSelection(quizState) {
  if (quizState.range !== 'recent') {
    return quizState.range;
  }

  if (quizState.days === 7) {
    return 'recent-7';
  }

  return 'recent-7';
}

function renderFeedback(feedback) {
  if (!feedback) {
    return '';
  }

  const toneClass = feedback.tone ? ` feedback-${feedback.tone}` : '';
  return `<div class="feedback${toneClass}" role="status">${feedback.message}</div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getQuestionEnglish(question, words = []) {
  if (question.english) {
    return question.english;
  }

  const word = words.find((item) => item.id === question.wordId);
  return word?.english || '';
}

function getQuestionMeaning(question, words = []) {
  const word = words.find((item) => item.id === question.wordId);
  const meanings = Array.isArray(word?.meanings) ? word.meanings : [];
  return meanings.find((meaning) => meaning.id === question.meaningId) || null;
}

function getQuestionMeanings(question, words = []) {
  const word = words.find((item) => item.id === question.wordId);
  const meanings = Array.isArray(word?.meanings) ? word.meanings : [];

  if (meanings.length > 0) {
    return meanings;
  }

  return [{
    partOfSpeech: question.partOfSpeech,
    chinese: question.mode === 'zh-to-en' ? question.prompt : ''
  }];
}

function renderQuestionMeaningLines(question, words = []) {
  return getQuestionMeanings(question, words).map((meaning) => `
    <span class="question-meaning-line">
      <strong>${escapeHtml(PART_OF_SPEECH_LABELS[meaning.partOfSpeech] || 'other')}</strong>
      <span>${escapeHtml(meaning.chinese || '')}</span>
    </span>
  `).join('');
}

function renderQuestionPrompt(question, words = []) {
  if (question.mode === 'zh-to-en') {
    return `
      <div class="question-meaning-list">
        ${renderQuestionMeaningLines(question, words)}
      </div>
    `;
  }

  const meaning = getQuestionMeaning(question, words);
  const label = PART_OF_SPEECH_LABELS[meaning?.partOfSpeech || question.partOfSpeech] || 'other';

  return `
    <p class="question-prompt">
      <span class="question-pos">${escapeHtml(label)}</span>
      <span>${escapeHtml(question.prompt)}</span>
    </p>
  `;
}

function renderCurrentQuestion(quizState, words = []) {
  const question = quizState.currentQuestion;

  if (!question) {
    return `
      <div class="question-empty">
        <span aria-hidden="true">?</span>
        <p>选择模式和范围后抽一道题。</p>
      </div>
    `;
  }

  const english = getQuestionEnglish(question, words);
  return `
    <div class="question-box">
      ${renderQuestionPrompt(question, words)}
      <button
        id="listen-word-button"
        class="listen-button"
        type="button"
        data-word="${escapeHtml(english)}"
      >听一下</button>
    </div>
  `;
}

function renderWrongQuestionRows(quizState, words = []) {
  if (!quizState.wrongQuestionsVisible) {
    return '';
  }

  const rows = quizState.wrongQuestions.map((item) => {
    const question = item.question;
    const english = getQuestionEnglish(question, words) || question.prompt;
    const meaning = getQuestionMeaning(question, words);
    const partOfSpeech = meaning?.partOfSpeech || question.partOfSpeech;
    const chinese = meaning?.chinese || (question.mode === 'zh-to-en' ? question.prompt : '');

    return `
      <li class="wrong-review-item">
        <strong>${escapeHtml(english)}</strong>
        <span>
          <em>${escapeHtml(PART_OF_SPEECH_LABELS[partOfSpeech] || 'other')}</em>
          ${escapeHtml(chinese)}
        </span>
      </li>
    `;
  }).join('');

  return `<ul class="wrong-review-list">${rows}</ul>`;
}

function renderWrongQuestionReview(quizState, words = []) {
  if (!quizState.ended || quizState.reviewMode || quizState.wrongQuestions.length === 0 || quizState.wrongReviewCompleted) {
    return '';
  }

  const showButton = quizState.wrongQuestionsVisible
    ? ''
    : '<button id="show-wrong-button" class="secondary-button" type="button">显示错题</button>';

  return `
    <section class="wrong-review-panel" aria-label="错题重做">
      <div class="wrong-review-summary">
        <span>本轮错题 ${quizState.wrongQuestions.length} 道</span>
        <div class="wrong-review-actions">
          ${showButton}
          <button id="redo-wrong-button" class="secondary-button" type="button">重做错题</button>
        </div>
      </div>
      ${renderWrongQuestionRows(quizState, words)}
    </section>
  `;
}

export function renderQuizPanel(quizState, feedback, options = {}) {
  const rangeSelection = getRangeSelection(quizState);
  const submitDisabled = quizState.currentQuestion && !quizState.answeredCurrent ? '' : 'disabled';
  const startDisabled = quizState.started ? 'disabled' : '';
  const nextDisabled = quizState.started ? '' : 'disabled';
  const addWordButton = options.showAddWordButton
    ? `
      <button id="add-word-button" class="ghost-button" type="button">
        <span aria-hidden="true">+</span>
        <span>添加单词</span>
      </button>
    `
    : '';
  const libraryButton = options.showLibraryButton
    ? '<button id="quiz-library-button" class="ghost-button" type="button">查看词库</button>'
    : '';

  return `
    <section class="panel quiz-panel" aria-labelledby="quiz-title">
      <div class="panel-header">
        <div>
          <p class="eyebrow">测试</p>
          <h2 id="quiz-title">随机抽题</h2>
        </div>
        <div class="panel-actions">
          ${libraryButton}
          ${addWordButton}
          <button id="reset-quiz-button" class="ghost-button" type="button" title="重新开始">
            <span aria-hidden="true">↻</span>
            <span>重置</span>
          </button>
        </div>
      </div>

      <div class="quiz-controls">
        <label>
          <span>测试模式</span>
          <select id="quiz-mode">
            <option value="en-to-zh" ${quizState.mode === 'en-to-zh' ? 'selected' : ''}>英文 -> 中文</option>
            <option value="zh-to-en" ${quizState.mode === 'zh-to-en' ? 'selected' : ''}>中文 -> 英文</option>
          </select>
        </label>

        <label>
          <span>题目范围</span>
          <select id="quiz-range">
            <option value="all" ${rangeSelection === 'all' ? 'selected' : ''}>全部</option>
            <option value="today" ${rangeSelection === 'today' ? 'selected' : ''}>今天</option>
            <option value="yesterday" ${rangeSelection === 'yesterday' ? 'selected' : ''}>昨天</option>
            <option value="recent-7" ${rangeSelection === 'recent-7' ? 'selected' : ''}>近 7 天</option>
          </select>
        </label>
      </div>

      <div class="quiz-actions">
        <button id="quiz-start-button" class="primary-button" type="button" ${startDisabled}>
          <span aria-hidden="true">▶</span>
          <span>开始测试</span>
        </button>
        <button id="next-question-button" class="secondary-button" type="button" ${nextDisabled}>
          <span aria-hidden="true">?</span>
          <span>下一题</span>
        </button>
        <button id="finish-quiz-button" class="ghost-button" type="button" ${quizState.started ? '' : 'disabled'}>
          <span aria-hidden="true">■</span>
          <span>结束测试</span>
        </button>
      </div>

      ${renderCurrentQuestion(quizState, options.words)}
      ${renderFeedback(feedback)}
      ${renderWrongQuestionReview(quizState, options.words)}

      <form id="answer-form" class="answer-form">
        <label>
          <span>你的答案</span>
          <input name="answer" autocomplete="off" ${submitDisabled ? 'disabled' : ''} />
        </label>
        <button class="primary-button" type="submit" ${submitDisabled}>
          <span aria-hidden="true">✓</span>
          <span>提交答案</span>
        </button>
      </form>

      ${renderStatsPanel(quizState)}
    </section>
  `;
}
