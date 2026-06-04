import { api } from './api.js';
import { createQuizState, recordAnswer, resetQuizProgress } from './state.js';
import { renderQuizPanel } from './components/QuizPanel.js';
import { renderWordForm } from './components/WordForm.js';

const app = document.querySelector('#app');

const state = {
  words: [],
  activePanel: 'add',
  quiz: createQuizState(),
  wordForm: {
    english: '',
    chinese: '',
    partOfSpeech: 'noun'
  },
  wordLookup: {
    english: '',
    status: 'idle',
    candidates: [],
    selectedKeys: []
  },
  feedback: null,
  notice: null,
  isLoading: false
};

let lookupTimer = null;
let lookupRequestId = 0;
let noticeTimer = null;
let noticeId = 0;

function getCandidateKey(candidate) {
  return `${candidate.partOfSpeech}|${candidate.chinese}`;
}

function setNotice(message, tone = 'neutral', options = {}) {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }

  if (!message) {
    state.notice = null;
    return;
  }

  const currentNoticeId = ++noticeId;
  state.notice = { message, tone, id: currentNoticeId };

  if (options.autoDismissMs) {
    noticeTimer = setTimeout(() => {
      if (state.notice?.id === currentNoticeId) {
        state.notice = null;
        render();
      }
    }, options.autoDismissMs);
  }
}

function setFeedback(message, tone = 'neutral') {
  state.feedback = message ? { message, tone } : null;
}

function renderNotice() {
  if (!state.notice) {
    return '';
  }

  return `<div class="notice notice-${state.notice.tone}" role="status">${state.notice.message}</div>`;
}

function renderStartTestPanel() {
  return `
    <section class="panel collapsed-feature-panel" aria-label="测试入口">
      <button id="start-test-button" class="feature-start-button" type="button">
        <span aria-hidden="true"></span>
        <span>开始测试</span>
      </button>
    </section>
  `;
}

function renderActiveFeature() {
  if (state.activePanel === 'quiz') {
    return renderQuizPanel(state.quiz, state.feedback, { showAddWordButton: true });
  }

  return `
    ${renderWordForm(state.wordForm, state.wordLookup)}
    ${renderStartTestPanel()}
  `;
}

function render() {
  app.innerHTML = `
    <header class="app-header">
    </header>

    ${renderNotice()}

    <div class="workspace">
      ${renderActiveFeature()}
    </div>
  `;

  bindEvents();
}

async function loadWords() {
  const result = await api.getWords();
  state.words = result.words;
}

async function refreshWords() {
  await loadWords();
  render();
}

function applyQuizControlsFromForm() {
  const mode = document.querySelector('#quiz-mode')?.value || 'en-to-zh';
  const rangeSelection = document.querySelector('#quiz-range')?.value || 'all';
  const daysInput = document.querySelector('#quiz-days');
  let range = rangeSelection;
  let days = state.quiz.days;

  if (rangeSelection === 'recent-7') {
    range = 'recent';
    days = 7;
  } else if (rangeSelection === 'recent-30') {
    range = 'recent';
    days = 30;
  } else if (rangeSelection === 'custom') {
    range = 'recent';
    days = Number(daysInput?.value || state.quiz.days);
  }

  const changed = state.quiz.mode !== mode || state.quiz.range !== range || state.quiz.days !== days;

  state.quiz.mode = mode;
  state.quiz.range = range;
  state.quiz.days = days;

  if (changed) {
    resetQuizProgress(state.quiz);
    setFeedback(null);
  }
}

async function handleWordSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const english = String(formData.get('english') || '').trim();
  const selectedIndexes = formData
    .getAll('lookupCandidate')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
  const canUseLookup = state.wordLookup.english === english.toLowerCase();
  const selectedCandidates = canUseLookup
    ? selectedIndexes
        .map((index) => state.wordLookup.candidates[index])
        .filter(Boolean)
    : [];

  state.wordForm = {
    english,
    chinese: String(formData.get('chinese') || '').trim(),
    partOfSpeech: formData.get('partOfSpeech') || 'noun'
  };

  try {
    const result = selectedCandidates.length
      ? await api.addWords(selectedCandidates)
      : await api.addWord({
          english: state.wordForm.english,
          chinese: state.wordForm.chinese,
          partOfSpeech: state.wordForm.partOfSpeech
        });

    const savedCount = result.words?.length || 1;
    clearTimeout(lookupTimer);
    lookupTimer = null;
    lookupRequestId += 1;
    state.wordForm = { english: '', chinese: '', partOfSpeech: 'noun' };
    state.wordLookup = { english: '', status: 'idle', candidates: [], selectedKeys: [] };
    setNotice(savedCount > 1 ? `已保存 ${savedCount} 条释义` : '单词已保存', 'success', {
      autoDismissMs: 1800
    });
    await refreshWords();
  } catch (error) {
    setNotice(error.message, 'error');
    render();
  }
}

function updateWordFormDraft(form) {
  const formData = new FormData(form);

  state.wordForm = {
    english: String(formData.get('english') || ''),
    chinese: String(formData.get('chinese') || ''),
    partOfSpeech: formData.get('partOfSpeech') || 'noun'
  };
}

async function lookupWord(english, requestId) {
  const query = english.trim().toLowerCase();

  if (!query) {
    state.wordLookup = { english: '', status: 'idle', candidates: [], selectedKeys: [] };
    render();
    return;
  }

  state.wordLookup = {
    english: query,
    status: 'loading',
    candidates: [],
    selectedKeys: []
  };
  render();

  try {
    const result = await api.lookupWord(query);

    if (requestId !== lookupRequestId) {
      return;
    }

    state.wordLookup = {
      english: result.english,
      status: result.candidates.length ? 'ready' : 'empty',
      candidates: result.candidates,
      selectedKeys: []
    };
    render();
  } catch (error) {
    if (requestId !== lookupRequestId) {
      return;
    }

    state.wordLookup = {
      english: query,
      status: error.status === 404 ? 'server-error' : 'error',
      candidates: [],
      selectedKeys: []
    };
    render();
  }
}

function scheduleWordLookup(english) {
  clearTimeout(lookupTimer);
  lookupRequestId += 1;

  const requestId = lookupRequestId;
  lookupTimer = setTimeout(() => {
    lookupWord(english, requestId);
  }, 520);
}

function handleWordFormInput(event) {
  const form = event.currentTarget;
  const previousEnglish = state.wordForm.english.trim().toLowerCase();

  updateWordFormDraft(form);

  const nextEnglish = state.wordForm.english.trim().toLowerCase();

  if (previousEnglish !== nextEnglish) {
    scheduleWordLookup(nextEnglish);
  }
}

function handleLookupCandidateChange(event) {
  if (event.target.name !== 'lookupCandidate') {
    return;
  }

  const selectedIndexes = new FormData(event.currentTarget)
    .getAll('lookupCandidate')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));

  state.wordLookup.selectedKeys = selectedIndexes
    .map((index) => state.wordLookup.candidates[index])
    .filter(Boolean)
    .map(getCandidateKey);
}

async function handleNextQuestion() {
  applyQuizControlsFromForm();

  if (state.quiz.range === 'recent' && (!Number.isInteger(state.quiz.days) || state.quiz.days <= 0)) {
    setFeedback('自定义天数必须是正整数', 'error');
    render();
    return;
  }

  try {
    const result = await api.getRandomQuestion({
      mode: state.quiz.mode,
      range: state.quiz.range,
      days: state.quiz.days
    });

    if (result.empty) {
      state.quiz.currentQuestion = null;
      state.quiz.answeredCurrent = false;
      setFeedback(result.message, 'warning');
    } else {
      state.quiz.currentQuestion = result.question;
      state.quiz.answeredCurrent = false;
      setFeedback(`已从 ${result.poolSize} 条可测试单词中抽题`, 'neutral');
    }

    render();
  } catch (error) {
    setFeedback(error.message, 'error');
    render();
  }
}

async function handleAnswerSubmit(event) {
  event.preventDefault();

  if (!state.quiz.currentQuestion || state.quiz.answeredCurrent) {
    return;
  }

  const formData = new FormData(event.currentTarget);
  const answer = formData.get('answer');

  try {
    const result = await api.checkAnswer({
      wordId: state.quiz.currentQuestion.wordId,
      mode: state.quiz.mode,
      answer
    });

    recordAnswer(state.quiz, result.correct);
    state.quiz.answeredCurrent = true;

    if (result.correct) {
      setFeedback('回答正确', 'success');
    } else {
      setFeedback(`回答错误，正确答案是：${result.correctAnswer}`, 'error');
    }

    render();
  } catch (error) {
    setFeedback(error.message, 'error');
    render();
  }
}

function handleQuizControlChange() {
  applyQuizControlsFromForm();
  render();
}

function showAddPanel() {
  state.activePanel = 'add';
  render();
}

function showQuizPanel() {
  state.activePanel = 'quiz';
  clearTimeout(lookupTimer);
  lookupTimer = null;
  lookupRequestId += 1;
  setNotice(null);
  render();
}

function bindEvents() {
  const wordForm = document.querySelector('#word-form');

  wordForm?.addEventListener('submit', handleWordSubmit);
  wordForm?.addEventListener('input', handleWordFormInput);
  wordForm?.addEventListener('change', (event) => {
    updateWordFormDraft(wordForm);
    handleLookupCandidateChange(event);
  });
  document.querySelector('#answer-form')?.addEventListener('submit', handleAnswerSubmit);
  document.querySelector('#next-question-button')?.addEventListener('click', handleNextQuestion);
  document.querySelector('#reset-quiz-button')?.addEventListener('click', () => {
    resetQuizProgress(state.quiz);
    setFeedback(null);
    render();
  });
  document.querySelector('#start-test-button')?.addEventListener('click', showQuizPanel);
  document.querySelector('#add-word-button')?.addEventListener('click', showAddPanel);
  document.querySelector('#quiz-mode')?.addEventListener('change', handleQuizControlChange);
  document.querySelector('#quiz-range')?.addEventListener('change', handleQuizControlChange);
  document.querySelector('#quiz-days')?.addEventListener('change', handleQuizControlChange);
}

async function init() {
  try {
    await loadWords();
  } catch (error) {
    setNotice(error.message, 'error');
  }

  render();
}

init();
