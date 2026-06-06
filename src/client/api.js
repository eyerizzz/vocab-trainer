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

  async updateWord(wordId, word) {
    return request(`/api/words/${encodeURIComponent(wordId)}`, {
      method: 'PUT',
      body: JSON.stringify(word)
    });
  },

  async deleteWord(wordId) {
    return request(`/api/words/${encodeURIComponent(wordId)}`, {
      method: 'DELETE'
    });
  },

  async getRandomQuestion({ mode, range, days, excludeWordIds = [] }) {
    const params = new URLSearchParams({ mode, range });

    if (range === 'recent') {
      params.set('days', String(days));
    }

    if (excludeWordIds.length > 0) {
      params.set('excludeWordIds', excludeWordIds.join(','));
    }

    return request(`/api/quiz/random?${params.toString()}`);
  },

  async checkAnswer({ wordId, meaningId, mode, answer, recordError }) {
    return request('/api/quiz/check', {
      method: 'POST',
      body: JSON.stringify({ wordId, meaningId, mode, answer, recordError })
    });
  },

  async markWrong({ wordId, meaningId, reason }) {
    return request('/api/quiz/wrong', {
      method: 'POST',
      body: JSON.stringify({ wordId, meaningId, reason })
    });
  }
};
