import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStatsPanel } from '../src/client/components/StatsPanel.js';

test('renders tested word count instead of raw answer attempts', () => {
  const html = renderStatsPanel({
    total: 3,
    correct: 2
  });

  assert.match(html, /已测试单词/);
  assert.doesNotMatch(html, /答题数/);
  assert.match(html, /67%/);
});
