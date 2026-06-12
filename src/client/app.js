import { api } from './api.js';
import {
  createQuizState,
  finishWrongQuestionReview,
  hasWrongQuestion,
  recordAnswer,
  recordSeenWord,
  recordWrongQuestion,
  resetQuizProgress,
  showWrongQuestions,
  startWrongQuestionReview
} from './state.js';
import { renderQuizPanel } from './components/QuizPanel.js';
import { PART_OF_SPEECH_LABELS, renderWordForm } from './components/WordForm.js';
import { renderWordLibrary } from './components/WordLibrary.js';

const app = document.querySelector('#app');

const state = {
  words: [],
  activePanel: 'add',
  libraryEditingId: null,
  librarySort: 'default',
  librarySearch: '',
  quiz: createQuizState(),
  wordForm: {
    english: '',
    chinese: '',
    partOfSpeech: []
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
let pronunciationAudio = null;
const lookupDelayMs = 1100;
const pronunciationFallbackDelayMs = 1400;

function getCandidateKey(candidate) {
  return `${candidate.partOfSpeech}|${candidate.chinese}`;
}

const partOfSpeechByLabel = Object.fromEntries(
  Object.entries(PART_OF_SPEECH_LABELS).map(([value, label]) => [label.toLowerCase(), value])
);

function formatMeaningLine(meaning) {
  const label = PART_OF_SPEECH_LABELS[meaning.partOfSpeech] || PART_OF_SPEECH_LABELS.other;
  return `${label} ${meaning.chinese}`;
}

function getSelectedPartOfSpeeches(formData) {
  const values = formData.getAll('partOfSpeech').filter(Boolean);
  return values;
}

function parseMeaningLines(english, chineseText, fallbackPartOfSpeeches) {
  const fallbackValues = Array.isArray(fallbackPartOfSpeeches) ? fallbackPartOfSpeeches : [];

  return String(chineseText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(/^(n\.|v\.|adj\.|adv\.|phr\.|other)\s+(.+)$/i);

      if (!match) {
        return fallbackValues.map((partOfSpeech) => ({
          english,
          chinese: line,
          partOfSpeech
        }));
      }

      return {
        english,
        chinese: match[2].trim(),
        partOfSpeech: partOfSpeechByLabel[match[1].toLowerCase()] || fallbackValues[0] || 'other'
      };
    });
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
  state.notice = {
    message,
    tone,
    id: currentNoticeId,
    action: options.action || null,
    actionLabel: options.actionLabel || ''
  };

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

  const actionButton = state.notice.action
    ? `<button id="notice-action-button" class="notice-action" type="button">${state.notice.actionLabel}</button>`
    : '';

  return `
    <div class="notice notice-${state.notice.tone}" role="status">
      <span>${state.notice.message}</span>
      ${actionButton}
    </div>
  `;
}

function renderFeatureEntrypoints() {
  return `
    <section class="panel collapsed-feature-panel" aria-label="测试入口">
      <div class="feature-entry-grid">
        <button id="start-test-button" class="feature-start-button" type="button">
          <span>开始测试</span>
        </button>
        <button id="view-library-button" class="feature-start-button" type="button">
          <span>查看词库</span>
        </button>
      </div>
    </section>
  `;
}

function renderActiveFeature() {
  if (state.activePanel === 'quiz') {
    return renderQuizPanel(state.quiz, state.feedback, { showAddWordButton: true, words: state.words });
  }

  if (state.activePanel === 'library') {
    return renderWordLibrary(state.words, state.libraryEditingId, state.librarySort, state.librarySearch);
  }

  return `
    ${renderWordForm(state.wordForm, state.wordLookup)}
    ${renderFeatureEntrypoints()}
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
  focusAnswerInput();
}

function focusAnswerInput() {
  const answerInput = document.querySelector('#answer-form input[name="answer"]:not(:disabled)');

  if (answerInput) {
    answerInput.focus();
    answerInput.select();
  }
}

function focusWordInput(options = {}) {
  const wordInput = document.querySelector('#word-form input[name="english"]');

  if (wordInput) {
    wordInput.focus();

    if (options.select === false) {
      const end = wordInput.value.length;
      wordInput.setSelectionRange(end, end);
    } else {
      wordInput.select();
    }
  }
}

function speakWithBrowserVoice(english) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    setFeedback('暂时无法播放发音', 'warning');
    render();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(english);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

function showListenButtonResponse(button, label = '播放中') {
  if (!button) {
    return;
  }

  const defaultLabel = button.dataset.defaultLabel || button.textContent.trim() || '听一下';
  button.dataset.defaultLabel = defaultLabel;
  button.textContent = label;
  button.classList.add('is-active');

  window.setTimeout(() => {
    if (button.isConnected) {
      button.textContent = defaultLabel;
      button.classList.remove('is-active');
    }
  }, 900);
}

function playPronunciation(word, button) {
  const english = String(word || '').trim();
  showListenButtonResponse(button);

  if (!english) {
    setFeedback('当前题目没有可播放的英文单词', 'warning');
    render();
    return;
  }

  let didFallback = false;
  let fallbackTimer = null;
  const fallback = () => {
    if (didFallback) {
      return;
    }

    didFallback = true;
    clearTimeout(fallbackTimer);
    pronunciationAudio?.pause();
    showListenButtonResponse(button, '已朗读');
    speakWithBrowserVoice(english);
  };

  try {
    pronunciationAudio?.pause();
    pronunciationAudio = new Audio(
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(english)}&type=2`
    );
    pronunciationAudio.addEventListener('error', fallback, { once: true });
    pronunciationAudio.addEventListener('playing', () => {
      clearTimeout(fallbackTimer);
    }, { once: true });
    const playResult = pronunciationAudio.play();
    fallbackTimer = window.setTimeout(fallback, pronunciationFallbackDelayMs);

    if (playResult?.catch) {
      playResult.catch(fallback);
    }
  } catch {
    fallback();
  }
}

async function loadWords() {
  const result = await api.getWords();
  state.words = result.words;
}

async function refreshWords() {
  await loadWords();
  render();
}

function replaceStoredWord(updatedWord) {
  if (!updatedWord?.id) {
    return;
  }

  state.words = state.words.map((word) => (
    word.id === updatedWord.id ? updatedWord : word
  ));
}

function findExistingWord(english) {
  const normalizedEnglish = String(english || '').trim().toLowerCase();
  return state.words.find((word) => word.english.toLowerCase() === normalizedEnglish);
}

function applyQuizControlsFromForm() {
  const mode = document.querySelector('#quiz-mode')?.value || 'zh-to-en';
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
  const chinese = String(formData.get('chinese') || '').trim();
  const partOfSpeeches = getSelectedPartOfSpeeches(formData);
  const meanings = parseMeaningLines(english, chinese, partOfSpeeches);

  state.wordForm = {
    english,
    chinese,
    partOfSpeech: partOfSpeeches
  };

  if (meanings.length === 0 && chinese) {
    setNotice('请选择词性，或在中文释义前写 n. / v. / adj. 等词性', 'warning');
    render();
    return;
  }

  const existingWord = findExistingWord(english);

  if (existingWord) {
    setNotice('这个单词已添加过了', 'warning', {
      action: 'library',
      actionLabel: '去词库'
    });
    render();
    focusWordInput({ select: false });
    return;
  }

  try {
    const result = meanings.length > 1
      ? await api.addWords(meanings)
      : await api.addWord({
          english: meanings[0]?.english || state.wordForm.english,
          chinese: meanings[0]?.chinese || state.wordForm.chinese,
          partOfSpeech: meanings[0]?.partOfSpeech || state.wordForm.partOfSpeech[0]
        });

    const savedCount = result.savedCount || result.words?.length || 1;
    clearTimeout(lookupTimer);
    lookupTimer = null;
    lookupRequestId += 1;
    state.wordForm = { english: '', chinese: '', partOfSpeech: [] };
    state.wordLookup = { english: '', status: 'idle', candidates: [], selectedKeys: [] };
    setNotice(savedCount > 1 ? `已保存 ${savedCount} 条释义` : '单词已保存', 'success', {
      autoDismissMs: 1800
    });
    await refreshWords();
    focusWordInput();
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
    partOfSpeech: getSelectedPartOfSpeeches(formData)
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
    focusWordInput({ select: false });
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
    focusWordInput({ select: false });
  }
}

function scheduleWordLookup(english) {
  clearTimeout(lookupTimer);
  lookupRequestId += 1;

  const requestId = lookupRequestId;
  lookupTimer = setTimeout(() => {
    lookupWord(english, requestId);
  }, lookupDelayMs);
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

  const selectedCandidates = selectedIndexes
    .map((index) => state.wordLookup.candidates[index])
    .filter(Boolean);

  if (selectedCandidates.length > 0) {
    state.wordForm.chinese = selectedCandidates.map(formatMeaningLine).join('\n');
    state.wordForm.partOfSpeech = [...new Set(
      selectedCandidates.map((candidate) => candidate.partOfSpeech).filter(Boolean)
    )];
  } else {
    state.wordForm.chinese = '';
  }

  render();
}

async function handleNextQuestion() {
  if (!state.quiz.started) {
    return;
  }

  applyQuizControlsFromForm();

  if (state.quiz.range === 'recent' && (!Number.isInteger(state.quiz.days) || state.quiz.days <= 0)) {
    setFeedback('自定义天数必须是正整数', 'error');
    render();
    return;
  }

  try {
    let feedbackMessage = null;

    if (state.quiz.currentQuestion && !state.quiz.answeredCurrent) {
      await addCurrentQuestionToWrongSet({
        countAsAnswer: true,
        persistError: true,
        reason: 'skipped'
      });
      feedbackMessage = '已跳过，已加入错题本';
    }

    await loadNextQuestion(feedbackMessage);
    render();
  } catch (error) {
    setFeedback(error.message, 'error');
    render();
  }
}

async function handleQuizStart() {
  applyQuizControlsFromForm();

  if (state.quiz.range === 'recent' && (!Number.isInteger(state.quiz.days) || state.quiz.days <= 0)) {
    setFeedback('自定义天数必须是正整数', 'error');
    render();
    return;
  }

  try {
    resetQuizProgress(state.quiz);
    state.quiz.started = true;
    await loadNextQuestion();
    render();
  } catch (error) {
    state.quiz.started = false;
    setFeedback(error.message, 'error');
    render();
  }
}

async function loadNextQuestion(successMessage) {
  if (state.quiz.reviewMode) {
    const nextQuestion = state.quiz.reviewQueue.shift();

    if (!nextQuestion) {
      finishWrongQuestionReview(state.quiz);
      setFeedback('错题已重做完成', 'success');
      return;
    }

    state.quiz.started = true;
    state.quiz.currentQuestion = nextQuestion;
    state.quiz.currentWrongAttempts = 0;
    state.quiz.answeredCurrent = false;
    setFeedback(successMessage || null, successMessage ? 'warning' : 'neutral');
    return;
  }

  const result = await api.getRandomQuestion({
    mode: state.quiz.mode,
    range: state.quiz.range,
    days: state.quiz.days,
    excludeWordIds: state.quiz.seenWordIds
  });

  if (result.empty) {
    state.quiz.currentQuestion = null;
    state.quiz.currentWrongAttempts = 0;
    state.quiz.answeredCurrent = false;
    state.quiz.started = false;
    state.quiz.ended = Boolean(result.exhausted);
    setFeedback(result.message, 'warning');
    return;
  }

  state.quiz.started = true;
  state.quiz.ended = false;
  state.quiz.currentQuestion = result.question;
  recordSeenWord(state.quiz, result.question.wordId);
  state.quiz.currentWrongAttempts = 0;
  state.quiz.answeredCurrent = false;
  setFeedback(successMessage || null, successMessage ? 'warning' : 'neutral');
}

async function addCurrentQuestionToWrongSet(options = {}) {
  const question = state.quiz.currentQuestion;

  if (!question) {
    return;
  }

  if (options.countAsAnswer) {
    recordAnswer(state.quiz, false);
  }

  const addedToWrongSet = recordWrongQuestion(state.quiz, {
    question,
    submittedAnswer: options.submittedAnswer || '',
    reason: options.reason || 'wrong'
  });

  if (addedToWrongSet && options.persistError !== false) {
    const result = await api.markWrong({
      wordId: question.wordId,
      meaningId: question.meaningId,
      reason: options.reason
    });
    replaceStoredWord(result.word);
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
      meaningId: state.quiz.currentQuestion.meaningId,
      mode: state.quiz.mode,
      answer
    });

    recordAnswer(state.quiz, result.correct);

    if (result.correct) {
      state.quiz.answeredCurrent = true;
      state.quiz.currentWrongAttempts = 0;
      await loadNextQuestion();
    } else {
      state.quiz.currentWrongAttempts += 1;

      if (state.quiz.currentWrongAttempts >= 2) {
        state.quiz.answeredCurrent = true;
        await addCurrentQuestionToWrongSet({
          submittedAnswer: String(answer || '').trim(),
          reason: 'two-wrong'
        });
        await loadNextQuestion('已错两次，已加入错题本');
      } else {
        state.quiz.answeredCurrent = false;
        setFeedback('回答错误，再试一次', 'error');
      }
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
  state.libraryEditingId = null;
  render();
  focusWordInput();
}

function showQuizPanel() {
  state.activePanel = 'quiz';
  state.libraryEditingId = null;
  clearTimeout(lookupTimer);
  lookupTimer = null;
  lookupRequestId += 1;
  setNotice(null);
  render();
}

function finishQuiz() {
  state.quiz.started = false;
  state.quiz.ended = true;
  state.quiz.currentQuestion = null;
  state.quiz.currentWrongAttempts = 0;
  state.quiz.answeredCurrent = false;
  state.quiz.reviewMode = false;
  state.quiz.reviewQueue = [];
  state.quiz.wrongQuestionsVisible = false;
  setFeedback(null);
  render();
}

async function redoWrongQuestions() {
  if (state.quiz.wrongQuestions.length === 0) {
    return;
  }

  startWrongQuestionReview(state.quiz);
  await loadNextQuestion();
  render();
}

function handleShowWrongQuestions() {
  showWrongQuestions(state.quiz);
  render();
}

function showLibraryPanel() {
  state.activePanel = 'library';
  state.libraryEditingId = null;
  setNotice(null);
  render();
}

function goToLibraryFromNotice() {
  const english = state.wordForm.english.trim().toLowerCase();

  if (state.notice?.action !== 'library') {
    return;
  }

  state.activePanel = 'library';
  state.libraryEditingId = null;
  state.librarySearch = english;
  setNotice(null);
  render();
}

function toggleLibraryErrorSort() {
  state.librarySort = state.librarySort === 'frequent-errors' ? 'default' : 'frequent-errors';
  state.libraryEditingId = null;
  render();
}

function handleLibrarySearchInput(event) {
  state.librarySearch = event.currentTarget.value;
  state.libraryEditingId = null;
  render();

  const searchInput = document.querySelector('#library-search');

  if (searchInput) {
    const position = state.librarySearch.length;
    searchInput.focus();
    searchInput.setSelectionRange(position, position);
  }
}

async function handleWordEditSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const partOfSpeechValues = formData.getAll('partOfSpeech');
  const chineseValues = formData.getAll('chinese');
  const meanings = partOfSpeechValues
    .map((partOfSpeech, index) => ({
      partOfSpeech,
      chinese: String(chineseValues[index] || '').trim()
    }))
    .filter((meaning) => meaning.chinese);

  try {
    await api.updateWord(form.dataset.wordId, {
      english: formData.get('english'),
      meanings
    });
    state.libraryEditingId = null;
    setNotice('单词已更新', 'success', { autoDismissMs: 1800 });
    await refreshWords();
  } catch (error) {
    setNotice(error.message, 'error');
    render();
  }
}

async function handleDeleteWord(wordId) {
  const word = state.words.find((item) => item.id === wordId);

  if (!word || !window.confirm(`确定删除 ${word.english} 吗？`)) {
    return;
  }

  try {
    await api.deleteWord(wordId);
    setNotice('单词已删除', 'success', { autoDismissMs: 1800 });
    await refreshWords();
  } catch (error) {
    setNotice(error.message, 'error');
    render();
  }
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
  document.querySelector('#quiz-start-button')?.addEventListener('click', handleQuizStart);
  document.querySelector('#next-question-button')?.addEventListener('click', handleNextQuestion);
  document.querySelector('#finish-quiz-button')?.addEventListener('click', finishQuiz);
  document.querySelector('#listen-word-button')?.addEventListener('click', (event) => {
    playPronunciation(event.currentTarget.dataset.word, event.currentTarget);
    focusAnswerInput();
  });
  document.querySelectorAll('.library-listen-button').forEach((button) => {
    button.addEventListener('click', () => {
      playPronunciation(button.dataset.word, button);
    });
  });
  document.querySelector('#show-wrong-button')?.addEventListener('click', handleShowWrongQuestions);
  document.querySelector('#redo-wrong-button')?.addEventListener('click', redoWrongQuestions);
  document.querySelector('#reset-quiz-button')?.addEventListener('click', () => {
    resetQuizProgress(state.quiz);
    setFeedback(null);
    render();
  });
  document.querySelector('#start-test-button')?.addEventListener('click', showQuizPanel);
  document.querySelector('#add-word-button')?.addEventListener('click', showAddPanel);
  document.querySelector('#view-library-button')?.addEventListener('click', showLibraryPanel);
  document.querySelector('#notice-action-button')?.addEventListener('click', goToLibraryFromNotice);
  document.querySelector('#library-add-button')?.addEventListener('click', showAddPanel);
  document.querySelector('#library-test-button')?.addEventListener('click', showQuizPanel);
  document.querySelector('#library-search')?.addEventListener('input', handleLibrarySearchInput);
  document.querySelector('#library-error-sort-button')?.addEventListener('click', toggleLibraryErrorSort);
  document.querySelectorAll('.edit-word-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.libraryEditingId = button.dataset.wordId;
      render();
    });
  });
  document.querySelectorAll('.delete-word-button').forEach((button) => {
    button.addEventListener('click', () => handleDeleteWord(button.dataset.wordId));
  });
  document.querySelectorAll('.word-edit-form').forEach((form) => {
    form.addEventListener('submit', handleWordEditSubmit);
  });
  document.querySelectorAll('.cancel-edit-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.libraryEditingId = null;
      render();
    });
  });
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
