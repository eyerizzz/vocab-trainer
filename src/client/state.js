export const initialQuizState = {
  mode: 'zh-to-en',
  range: 'all',
  days: 7,
  currentQuestion: null,
  currentWrongAttempts: 0,
  answeredCurrent: false,
  started: false,
  ended: false,
  reviewMode: false,
  wrongQuestionsVisible: false,
  wrongReviewCompleted: false,
  seenWordIds: [],
  wrongQuestions: [],
  reviewQueue: [],
  total: 0,
  correct: 0
};

export function createQuizState() {
  return {
    ...initialQuizState,
    wrongQuestionsVisible: false,
    wrongReviewCompleted: false,
    seenWordIds: [],
    wrongQuestions: [],
    reviewQueue: []
  };
}

export function resetQuizProgress(quizState) {
  quizState.currentQuestion = null;
  quizState.currentWrongAttempts = 0;
  quizState.answeredCurrent = false;
  quizState.started = false;
  quizState.ended = false;
  quizState.reviewMode = false;
  quizState.wrongQuestionsVisible = false;
  quizState.wrongReviewCompleted = false;
  quizState.seenWordIds = [];
  quizState.wrongQuestions = [];
  quizState.reviewQueue = [];
  quizState.total = 0;
  quizState.correct = 0;
}

function getQuestionKey(question) {
  return `${question.wordId}|${question.meaningId}|${question.mode}`;
}

export function hasWrongQuestion(quizState, question) {
  const key = getQuestionKey(question);
  return quizState.wrongQuestions.some((wrongItem) => getQuestionKey(wrongItem.question) === key);
}

export function recordWrongQuestion(quizState, item) {
  const exists = hasWrongQuestion(quizState, item.question);

  if (!exists) {
    quizState.wrongQuestions.push(item);
  }

  return !exists;
}

export function recordSeenWord(quizState, wordId) {
  const cleanedWordId = String(wordId || '').trim();

  if (cleanedWordId && !quizState.seenWordIds.includes(cleanedWordId)) {
    quizState.seenWordIds.push(cleanedWordId);
  }
}

export function startWrongQuestionReview(quizState) {
  quizState.reviewMode = true;
  quizState.ended = false;
  quizState.started = true;
  quizState.wrongQuestionsVisible = false;
  quizState.wrongReviewCompleted = false;
  quizState.reviewQueue = quizState.wrongQuestions.map((item) => item.question);
  quizState.currentQuestion = null;
  quizState.currentWrongAttempts = 0;
  quizState.answeredCurrent = false;
}

export function showWrongQuestions(quizState) {
  quizState.wrongQuestionsVisible = true;
}

export function finishWrongQuestionReview(quizState) {
  quizState.currentQuestion = null;
  quizState.currentWrongAttempts = 0;
  quizState.answeredCurrent = false;
  quizState.started = false;
  quizState.ended = true;
  quizState.reviewMode = false;
  quizState.reviewQueue = [];
  quizState.wrongQuestionsVisible = false;
  quizState.wrongReviewCompleted = true;
}

export function recordAnswer(quizState, isCorrect) {
  quizState.total += 1;

  if (isCorrect) {
    quizState.correct += 1;
  }
}

export function getAccuracy(quizState) {
  if (quizState.total === 0) {
    return 0;
  }

  return Math.round((quizState.correct / quizState.total) * 100);
}
