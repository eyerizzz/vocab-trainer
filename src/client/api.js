async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.error || '请求失败');
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const api = {
  async getWords() {
    return request('/api/words');
  },

  async addWord(word) {
    return request('/api/words', {
      method: 'POST',
      body: JSON.stringify(word)
    });
  },

  async addWords(words) {
    return request('/api/words/batch', {
      method: 'POST',
      body: JSON.stringify({ words })
    });
  },

  async lookupWord(english) {
    const params = new URLSearchParams({ english });
    return request(`/api/words/lookup?${params.toString()}`);
  },

  async getRandomQuestion({ mode, range, days }) {
    const params = new URLSearchParams({ mode, range });

    if (range === 'recent') {
      params.set('days', String(days));
    }

    return request(`/api/quiz/random?${params.toString()}`);
  },

  async checkAnswer({ wordId, mode, answer }) {
    return request('/api/quiz/check', {
      method: 'POST',
      body: JSON.stringify({ wordId, mode, answer })
    });
  }
};
