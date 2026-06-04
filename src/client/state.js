export const initialQuizState = {
  mode: 'en-to-zh',
  range: 'all',
  days: 7,
  currentQuestion: null,
  answeredCurrent: false,
  total: 0,
  correct: 0
};

export function createQuizState() {
  return { ...initialQuizState };
}

export function resetQuizProgress(quizState) {
  quizState.currentQuestion = null;
  quizState.answeredCurrent = false;
  quizState.total = 0;
  quizState.correct = 0;
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
