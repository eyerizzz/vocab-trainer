export function shouldSubmitWordFormOnEnter(event) {
  return event.key === 'Enter'
    && !event.shiftKey
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.isComposing;
}
