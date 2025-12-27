export function getCurrentUrl() {
  return window.location.href;
}

export function redirectTo(url) {
  window.location.href = url;
}

export function createPopup(url, options = {}) {
  const {
    name = 'oauth_popup',
    width = 600,
    height = 700,
    features = ''
  } = options;

  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;
  
  const popupFeatures = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes${features}`;
  
  return window.open(url, name, popupFeatures);
}

export function parseUrlParams() {
  const search = window.location.search;
  const hash = window.location.hash.substring(1);
  
  const params = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash);
  
  // Merge search and hash params
  for (const [key, value] of hashParams.entries()) {
    params.append(key, value);
  }
  
  return Object.fromEntries(params.entries());
}

export function cleanupUrl() {
  if (window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

export function createHiddenIframe(url) {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  return iframe;
}