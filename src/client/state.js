export const initialQuizState = {
  mode: 'zh-to-en',
  range: 'all',
  days: 7,
  currentQuestion: null,
  answeredCurrent: false,
  started: false,
  ended: false,
  reviewMode: false,
  wrongQuestions: [],
  reviewQueue: [],
  total: 0,
  correct: 0
};

export function createQuizState() {
  return {
    ...initialQuizState,
    wrongQuestions: [],
    reviewQueue: []
  };
}

export function resetQuizProgress(quizState) {
  quizState.currentQuestion = null;
  quizState.answeredCurrent = false;
  quizState.started = false;
  quizState.ended = false;
  quizState.reviewMode = false;
  quizState.wrongQuestions = [];
  quizState.reviewQueue = [];
  quizState.total = 0;
  quizState.correct = 0;
}

export function recordWrongQuestion(quizState, item) {
  const key = `${item.question.wordId}|${item.question.meaningId}|${item.question.mode}`;
  const exists = quizState.wrongQuestions.some((wrongItem) => (
    `${wrongItem.question.wordId}|${wrongItem.question.meaningId}|${wrongItem.question.mode}` === key
  ));

  if (!exists) {
    quizState.wrongQuestions.push(item);
  }
}

export function startWrongQuestionReview(quizState) {
  quizState.reviewMode = true;
  quizState.ended = false;
  quizState.started = true;
  quizState.reviewQueue = quizState.wrongQuestions.map((item) => item.question);
  quizState.currentQuestion = null;
  quizState.answeredCurrent = false;
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
