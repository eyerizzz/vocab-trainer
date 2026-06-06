export const PART_OF_SPEECH_LABELS = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  phrase: 'phr.',
  other: 'other'
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderPartOfSpeechOptions(selected = 'noun') {
  return Object.entries(PART_OF_SPEECH_LABELS)
    .map(([value, label]) => {
      const isSelected = value === selected ? 'selected' : '';
      return `<option value="${value}" ${isSelected}>${label}</option>`;
    })
    .join('');
}

function getSelectedPartOfSpeeches(partOfSpeech = []) {
  const values = Array.isArray(partOfSpeech) ? partOfSpeech : [partOfSpeech];
  return values.filter(Boolean);
}

function renderPartOfSpeechChoices(partOfSpeech = []) {
  const selectedValues = getSelectedPartOfSpeeches(partOfSpeech);

  return Object.entries(PART_OF_SPEECH_LABELS)
    .map(([value, label]) => {
      const checked = selectedValues.includes(value) ? 'checked' : '';
      return `
        <label class="part-choice">
          <input type="checkbox" name="partOfSpeech" value="${value}" ${checked} />
          <span>${label}</span>
        </label>
      `;
    })
    .join('');
}

function getCandidateKey(candidate) {
  return `${candidate.partOfSpeech}|${candidate.chinese}`;
}

function renderLookupArea(lookup) {
  if (!lookup || lookup.status === 'idle') {
    return '';
  }

  if (lookup.status === 'loading') {
    return '<div class="lookup-status">正在查找释义...</div>';
  }

  if (lookup.status === 'error') {
    return '<div class="lookup-status lookup-status-warning">未能联网查词，请手动填写。</div>';
  }

  if (lookup.status === 'server-error') {
    return '<div class="lookup-status lookup-status-warning">本地服务还没加载查词接口，请重启服务后再试。</div>';
  }

  if (lookup.status === 'empty') {
    return '<div class="lookup-status lookup-status-warning">未找到在线释义，请手动填写。</div>';
  }

  if (!lookup.candidates?.length) {
    return '';
  }

  const rows = lookup.candidates.map((candidate, index) => {
    const key = getCandidateKey(candidate);
    const checked = lookup.selectedKeys?.includes(key) ? 'checked' : '';
    const label = PART_OF_SPEECH_LABELS[candidate.partOfSpeech] || 'other';

    return `
      <label class="lookup-option">
        <input type="checkbox" name="lookupCandidate" value="${index}" ${checked} />
        <span>
          <strong>${escapeHtml(label)}</strong>
          ${escapeHtml(candidate.chinese)}
        </span>
      </label>
    `;
  }).join('');

  return `
    <fieldset class="lookup-results">
      <legend>可选释义</legend>
      <div class="lookup-options">${rows}</div>
    </fieldset>
  `;
}

export function renderWordForm(form = {}, lookup = { status: 'idle', candidates: [], selectedKeys: [] }) {
  const english = escapeHtml(form.english || '');
  const chinese = escapeHtml(form.chinese || '');
  const partOfSpeech = form.partOfSpeech || [];

  return `
    <section class="panel input-panel" aria-labelledby="word-form-title">
      <div class="panel-header">
        <div>
          <h2 id="word-form-title">添加单词</h2>
        </div>
      </div>

      <form id="word-form" class="word-form">
        <label>
          <span>英文单词</span>
          <input name="english" autocomplete="off" placeholder="example" value="${english}" required />
        </label>

        ${renderLookupArea(lookup)}

        <label>
          <span>中文释义</span>
          <textarea name="chinese" autocomplete="off" placeholder="例子；示例">${chinese}</textarea>
        </label>

        <div class="word-form-footer">
          <fieldset class="part-choice-group">
            <legend>词性</legend>
            <div class="part-choice-grid">
              ${renderPartOfSpeechChoices(partOfSpeech)}
            </div>
          </fieldset>

          <button class="primary-button word-save-button" type="submit">保存单词</button>
        </div>
      </form>
    </section>
  `;
}
