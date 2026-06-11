const buttons = document.querySelectorAll('[data-screen]');
const screens = document.querySelectorAll('.screen');
const pills = document.querySelectorAll('.pill');
const tabs = document.querySelectorAll('.tab');

function showScreen(id) {
  screens.forEach(screen => screen.classList.toggle('active', screen.id === id));
  pills.forEach(btn => btn.classList.toggle('active', btn.dataset.screen === id));
  tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.screen === id));
}

function showToast(message) {
  let toast = document.querySelector('.prototype-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'prototype-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

buttons.forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

document.querySelectorAll('[data-jump]').forEach(card => {
  card.addEventListener('click', () => showScreen(card.dataset.jump));
});

document.querySelectorAll('[data-copy-resource]').forEach(btn => {
  btn.addEventListener('click', async () => {
    await copyText(btn.dataset.copyResource);
    showToast('资源链接已复制，请在浏览器或对应 App 中打开');
  });
});

document.querySelectorAll('[data-share-success]').forEach(btn => {
  btn.addEventListener('click', () => {
    showToast('分享路径已生成：好友进入小程序后双方各得20积分');
  });
});
