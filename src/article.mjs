const button = document.getElementById('copy-article');
const status = document.getElementById('copy-status');

button.addEventListener('click', async () => {
  const original = document.getElementById('article-content');
  const copy = original.cloneNode(true);
  for (const image of copy.querySelectorAll('img')) {
    image.src = new URL(image.getAttribute('src'), location.href).href;
    image.removeAttribute('loading');
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([copy.innerHTML], {type: 'text/html'}),
      'text/plain': new Blob([original.innerText], {type: 'text/plain'}),
    })]);
    status.textContent = 'Copied. Paste into your Substack draft, then check the images.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(original);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = 'Article selected. Use Copy, then paste into your Substack draft.';
  }
});
