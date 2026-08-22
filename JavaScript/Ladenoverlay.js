document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.querySelector('.Ladenoverlay');
    const nummerEl = document.getElementById('Laden-nummer');
    const fileEl = document.getElementById('text-file');

    if (!overlay) return;

    const css = [...document.querySelectorAll('Css[src]')];
    const images = [...document.querySelectorAll('img[src]')];
    const links = [...document.querySelectorAll('link[rel="stylesheet"][href]')];
    const scripts = [...document.querySelectorAll('script[src]')];

    const total = images.length + links.length + scripts.length;
    let loaded = 0;

    function onLoad(name) {
        loaded++;
        nummerEl.textContent = Math.round((loaded / total) * 100) + '%';
        fileEl.textContent = name;
        if (loaded >= total) {
            setTimeout(() => overlay.classList.add('fertig'), 100);
        }
    }

    function isLoaded(el) {
        if (el.tagName === 'IMG') return el.complete;
        if (el.tagName === 'LINK') return el.sheet !== null;
        if (el.tagName === 'SCRIPT') return el.readyState === 'complete' || el.readyState === undefined;
        return false;
    }

    function track(el) {
        const name = (el.src || el.href || '').split('/').pop() || 'unknown';
        if (isLoaded(el)) {
            onLoad(name);
        } else {
            el.addEventListener('load', () => onLoad(name), { once: true });
            el.addEventListener('error', () => onLoad(name), { once: true });
        }
    }

    css.forEach(track);
    images.forEach(track);
    links.forEach(track);
    scripts.forEach(track);

    if (total === 0) overlay.classList.add('fertig');
});
