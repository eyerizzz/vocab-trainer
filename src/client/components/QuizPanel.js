import { PART_OF_SPEECH_LABELS } from './WordForm.js';
import { renderStatsPanel } from './StatsPanel.js';

function getRangeSelection(quizState) {
  if (quizState.range !== 'recent') {
    return quizState.range;
  }

  if (quizState.days === 7) {
    return 'recent-7';
  }

  if (quizState.days === 30) {
    return 'recent-30';
  }

  return 'custom';
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
      <p class="question-prompt">
        <span class="question-pos">${escapeHtml(PART_OF_SPEECH_LABELS[question.partOfSpeech] || 'other')}</span>
        <span>${escapeHtml(question.prompt)}</span>
      </p>
      <button
        id="listen-word-button"
        class="listen-button"
        type="button"
        data-word="${escapeHtml(english)}"
      >听一下</button>
    </div>
  `;
}

function renderWrongQuestionReview(quizState) {
  if (!quizState.ended || quizState.wrongQuestions.length === 0) {
    return '';
  }

  return `
    <section class="wrong-review-panel" aria-label="错题重做">
      <span>本轮错题 ${quizState.wrongQuestions.length} 道</span>
      <button id="redo-wrong-button" class="secondary-button" type="button">
        <span aria-hidden="true">↻</span>
        <span>重做错题</span>
      </button>
    </section>
  `;
}

export function renderQuizPanel(quizState, feedback, options = {}) {
  const rangeSelection = getRangeSelection(quizState);
  const customHidden = rangeSelection === 'custom' ? '' : 'hidden';
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

  return `
    <section class="panel quiz-panel" aria-labelledby="quiz-title">
      <div class="panel-header">
        <div>
          <p class="eyebrow">测试</p>
          <h2 id="quiz-title">随机抽题</h2>
        </div>
        <div class="panel-actions">
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
            <option value="recent-7" ${rangeSelection === 'recent-7' ? 'selected' : ''}>近 7 天</option>
            <option value="recent-30" ${rangeSelection === 'recent-30' ? 'selected' : ''}>近 30 天</option>
            <option value="custom" ${rangeSelection === 'custom' ? 'selected' : ''}>自定义</option>
          </select>
        </label>

        <label id="custom-days-field" class="${customHidden}">
          <span>最近天数</span>
          <input id="quiz-days" type="number" min="1" step="1" value="${quizState.days}" />
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
      ${renderWrongQuestionReview(quizState)}

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
