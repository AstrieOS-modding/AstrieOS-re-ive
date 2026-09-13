let DateinTemplate = null;
let windowTemplateReady = false;
let dateinStylesLoaded = false;
let ErfolgenTemplate = null
let erfolgenStylesLoaded = false
let MusikplayerTemplate = null
let musicplayerStylesLoaded = false

function updateErfolgenUI(status) {
    const root = document.querySelector('.Window-content[data-window-id="erfolgen"]');
    if (!root) return;

    const setText = (selector, value) => {
        const element = root.querySelector(selector);
        if (element) element.textContent = value;
    };
    const percentage = Math.round((status.unlockedCount / 8) * 100);
    setText('#Erfolgen-tracken', `${percentage}%`);
    setText('#Erfolgen-nummer', status.unlockedCount);
    setText('#user-runtime', formatUserDuration(status.activeMilliseconds));
    setText('#user-session', formatUserDuration(status.longestSessionMilliseconds));
    setText('#user-clicks', status.clicks.toLocaleString('de-DE'));
    const trackedTime = status.activeMilliseconds + status.afkMilliseconds;
    setText('#user-afk', trackedTime ? Math.round((status.afkMilliseconds / trackedTime) * 100) : 0);

    root.querySelectorAll('[data-achievement]').forEach((card) => {
        const unlocked = Boolean(status.achievements[card.dataset.achievement]);
        card.classList.toggle('is-unlocked', unlocked);
        card.classList.toggle('is-locked', !unlocked);
        card.setAttribute('aria-label', unlocked ? 'Erfolg freigeschaltet' : 'Erfolg gesperrt');
    });
}

UserStatus.subscribe(updateErfolgenUI);

fetch('/ui/Nutzercenter.html')
  .then(res => res.text())
  .then(html => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const template = doc.querySelector('#Nutztercenter-placeholder');
    document.body.appendChild(template.content.cloneNode(true));
  });

fetch('/ui/Einstellungen.html')
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#einstellungen-placeholder');
        document.body.appendChild(template.content.cloneNode(true));
        document.dispatchEvent(new Event('settings-template-ready'));
    });

fetch('/ui/Benachrichtigung.html')
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#Benachrichtigung-ui');
        document.body.appendChild(template.content.cloneNode(true));
        document.dispatchEvent(new Event('notifications-template-ready'));
    });

fetch('/ui/overlay/window.html')
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#Window-border');
        if (!template) throw new Error('Fenster-Template wurde nicht gefunden.');
        WindowManager.init(template.content);
        windowTemplateReady = true;
    });

fetch('/ui/Datein.html')
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#Datein-placeholder');
        if (!template) throw new Error('Datei-Template wurde nicht gefunden.');
        DateinTemplate = template.content;
    });

fetch('/ui/Erfolgen.html')
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#Erfolgen-ui');
        if (!template) throw new Error('Datei-Template wurde nicht gefunden.');
        ErfolgenTemplate = template.content;
    });

fetch('/ui/Musikplayer.html')
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#Musikplayer-ui');
        if (!template) throw new Error('Datei-Template wurde nicht gefunden.');
        MusikplayerTemplate = template.content;
    });

function openDateinWindow() {
    if (!DateinTemplate || !windowTemplateReady) return;

    if (WindowManager.windows['datein']) {
        const w = WindowManager.windows['datein'];
        if (w.minimized) {
            WindowManager.restoreWindow('datein');
        } else {
            WindowManager.focusWindow('datein');
        }
        return;
    }

    const content = DateinTemplate.cloneNode(true);
    if (!dateinStylesLoaded) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = '/ui/Ui_css/Datein.css';
        document.head.appendChild(cssLink);
        dateinStylesLoaded = true;
    }

    WindowManager.createWindow({
        id: 'datein',
        title: 'Datein! ^⎚-⎚^',
        icon: '/Res/Bild/Icon/Topbar/folder_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg',
        content: content
    });
}

function openwindow_trophy() {
    if (!ErfolgenTemplate || !windowTemplateReady) return;

    if (WindowManager.windows['erfolgen']) {
        const w = WindowManager.windows['erfolgen'];
        if (w.minimized) {
            WindowManager.restoreWindow('erfolgen');
        } else {
            WindowManager.focusWindow('erfolgen');
        }
        return;
    }

    const content = ErfolgenTemplate.cloneNode(true);
    if (!erfolgenStylesLoaded) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = '/ui/Ui_css/Erfolgen.css';
        document.head.appendChild(cssLink);
        erfolgenStylesLoaded = true;
    }

    WindowManager.createWindow({
        id: 'erfolgen',
        title: 'Fortschritten! ᕙ(  •̀ ᗜ •́  )ᕗ',
        icon: '/Res/Bild/Icon/Topbar/trophy_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg',
        content: content
    });
    updateErfolgenUI(UserStatus.snapshot());
}

function openMusikplayerWindow() {
    if (!MusikplayerTemplate || !windowTemplateReady) return;

    if (WindowManager.windows['musikplayer']) {
        const w = WindowManager.windows['musikplayer'];
        if (w.minimized) {
            WindowManager.restoreWindow('musikplayer');
        } else {
            WindowManager.focusWindow('musikplayer');
        }
        return;
    }

    const content = MusikplayerTemplate.cloneNode(true);
    if (!musicplayerStylesLoaded) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = '/ui/Ui_css/Musikplayer.css';
        document.head.appendChild(cssLink);
        musicplayerStylesLoaded = true;
    }

    WindowManager.createWindow({
        id: 'musikplayer',
        title: 'Musikplayer! 〜⁠(⁠꒪⁠꒳⁠꒪⁠)⁠〜',
        icon: '/Res/Bild/Icon/Topbar/music_note_2_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg',
        content: content
    });
}
