let DateinTemplate = null;
let windowTemplateReady = false;
let dateinStylesLoaded = false;
let ErfolgenTemplate = null
let erfolgenStylesLoaded = false
let MusikplayerTemplate = null
let musicplayerStylesLoaded = false
let WallhavenTemplate = null;
let wallhavenStylesLoaded = false;

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

fetch('/ui/Gretter.html')
    .then(res => {
        if (!res.ok) throw new Error(`Greeter konnte nicht geladen werden (${res.status}).`);
        return res.text();
    })
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#Nutzer_gretterui');
        if (!template) throw new Error('Greeter-Template wurde nicht gefunden.');
        document.body.appendChild(template.content.cloneNode(true));
        if (!document.querySelector('link[data-gretter-styles]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/ui/Ui_css/Gretter.css';
            link.dataset.gretterStyles = 'true';
            document.head.appendChild(link);
        }
        document.dispatchEvent(new Event('gretter-template-ready'));
    })
    .catch(error => console.error('[Greeter]', error));

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

// Lade Wallhaven-Template
fetch('/ui/Wallhaven.html')
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#wallhaven-ui');
        if (!template) throw new Error('Wallhaven-Template wurde nicht gefunden.');
        WallhavenTemplate = template.content;
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
        title: 'Musikplayer! 〜امبر annakva👅🏻‬‬(⁀ᴥ⁀)‬',
        icon: '/Res/Bild/Icon/Topbar/music_note_2_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg',
        content: content
    });
}

/**
 * WallhavenManager - Verwaltet die Wallhaven-Suche
 */
const WallhavenManager = {
    wallhavenWindow: null,
    currentPage: 1,
    lastPage: 1,
    
    /**
     * Öffnet das Wallhaven-Suchfenster
     */
    openWallhavenWindow() {
        if (!WallhavenTemplate || !windowTemplateReady) return;

        if (WindowManager.windows['wallhaven-search']) {
            const w = WindowManager.windows['wallhaven-search'];
            if (w.minimized) {
                WindowManager.restoreWindow('wallhaven-search');
            } else {
                WindowManager.focusWindow('wallhaven-search');
            }
            return;
        }

        const content = WallhavenTemplate.cloneNode(true);
        if (!wallhavenStylesLoaded) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = '/ui/Ui_css/Wallhaven.css';
            document.head.appendChild(cssLink);
            wallhavenStylesLoaded = true;
        }

        this.wallhavenWindow = WindowManager.createWindow({
            id: 'wallhaven-search',
            title: 'Wallhaven Suche',
            icon: '/Res/Bild/Icon/Topbar/search_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg',
            content: content,
            width: 800,
            height: 600
        });
        const root = this.wallhavenWindow?.content;
        root?.querySelector('.wallhaven-button')?.addEventListener('click', () => this._searchWallhaven(1));
        root?.querySelector('.wallhaven-input')?.addEventListener('keydown', event => {
            if (event.key === 'Enter') this._searchWallhaven(1);
        });
    },
    
    /**
     * Sucht auf Wallhaven nach Wallpapers
     */
    async _searchWallhaven(page = 1) {
        const root = WindowManager.windows['wallhaven-search']?.content;
        const searchInput = root?.querySelector('.wallhaven-input');
        const resultsContainer = root?.querySelector('#wallhaven-results');
        const pagination = root?.querySelector('#wallhaven-pagination');
        if (!searchInput || !resultsContainer) return;

        const query = searchInput.value.trim();
        const category = root.querySelector('#wallhaven-category')?.value || '111';
        const purity = root.querySelector('#wallhaven-purity')?.value || '100';
        const resolution = root.querySelector('#wallhaven-resolution')?.value || '';
        const apiKey = root.querySelector('.wallhaven-api-key')?.value.trim() || '';
        resultsContainer.replaceChildren();
        resultsContainer.appendChild(this._statusMessage('wallhaven-loading', 'Suche auf Wallhaven…'));
        if (pagination) pagination.replaceChildren();

        try {
            const apiUrl = this._buildWallhavenUrl(query, category, purity, resolution, page, apiKey);
            const response = await fetch(apiUrl);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Wallhaven antwortete mit HTTP ${response.status}.`);
            }
            this.currentPage = data.meta?.current_page || page;
            this.lastPage = data.meta?.last_page || 1;
            this._displayWallhavenResults(data, resultsContainer);
            this._renderWallhavenPagination(pagination);
        } catch (error) {
            console.error('[Wallhaven] Fehler:', error);
            resultsContainer.replaceChildren(this._statusMessage('wallhaven-error', `Wallhaven-Suche fehlgeschlagen: ${error.message}`));
        }
    },

    _statusMessage(className, message) {
        const element = document.createElement('p');
        element.className = className;
        element.textContent = message;
        return element;
    },
    
    /**
     * Baut die Wallhaven API URL
     */
    _buildWallhavenUrl(query, category, purity, resolution, page = 1, apiKey = '') {
        const baseUrl = 'https://wallhaven.cc/api/v1/search';
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        params.set('categories', category || '111');
        params.set('purity', purity || '100');
        if (resolution) params.set('resolutions', resolution);
        if (apiKey) params.set('apikey', apiKey);
        params.set('page', String(page));
        params.set('sorting', 'relevance');
        params.set('order', 'desc');
        return `${baseUrl}?${params.toString()}`;
    },

    _renderWallhavenPagination(container) {
        if (!container || this.lastPage <= 1) return;
        const button = (label, page, disabled = false) => {
            const element = document.createElement('button');
            element.className = 'wallhaven-page';
            element.textContent = label;
            element.disabled = disabled;
            element.addEventListener('click', () => this._searchWallhaven(page));
            return element;
        };
        container.append(
            button('‹', this.currentPage - 1, this.currentPage <= 1),
            this._statusMessage('wallhaven-page-label', `${this.currentPage} / ${this.lastPage}`),
            button('›', this.currentPage + 1, this.currentPage >= this.lastPage)
        );
    },
    
    /**
     * Zeigt Wallhaven-Suchergebnisse an
     */
    _displayWallhavenResults(data, container) {
        if (!data || !data.data || data.data.length === 0) {
            container.replaceChildren(this._statusMessage('wallhaven-empty', 'Keine Wallpapers gefunden'));
            return;
        }
        const grid = document.createElement('div');
        grid.className = 'wallhaven-grid';
        data.data.forEach(wallpaper => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'wallhaven-card';
            card.style.cssText = 'width:100%;padding:0;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer;';
            card.addEventListener('click', () => this._selectWallpaper(wallpaper.path || `https://wallhaven.cc/wallpaper/${wallpaper.id}`));
            const image = document.createElement('img');
            image.src = wallpaper.thumbs?.large || wallpaper.thumbs?.original || wallpaper.path || '';
            image.alt = String(wallpaper.id || 'Wallhaven wallpaper');
            image.className = 'wallhaven-thumb';
            image.loading = 'lazy';
            const info = document.createElement('div');
            info.className = 'wallhaven-card-info';
            const title = document.createElement('span');
            title.className = 'wallhaven-card-title';
            title.textContent = wallpaper.id || 'Wallhaven Wallpaper';
            const stats = document.createElement('span');
            stats.className = 'wallhaven-card-stats';
            stats.textContent = `${Number(wallpaper.views || 0).toLocaleString()} Views | ${Number(wallpaper.favorites || 0).toLocaleString()} Favorites`;
            info.append(title, stats);
            card.append(image, info);
            grid.appendChild(card);
        });
        container.replaceChildren(grid);
    },
    
    /**
     * Wählt ein Wallpaper aus
     */
    async _selectWallpaper(wallpaperUrl) {
        try {
            if (typeof Nutzerspeicher === 'undefined' || !await Nutzerspeicher.speichereWallhavenHintergrund(wallpaperUrl)) {
                throw new Error('Das Wallpaper konnte nicht gespeichert oder aktiviert werden.');
            }
            if (typeof WindowManager !== 'undefined') WindowManager.closeWindow('wallhaven-search');
            this._showSuccess('Hintergrund erfolgreich geändert!');
        } catch (error) {
            console.error('[Wallhaven] Wallpaper konnte nicht angewendet werden:', error);
            const root = WindowManager.windows['wallhaven-search']?.content;
            const results = root?.querySelector('#wallhaven-results');
            if (results) results.replaceChildren(this._statusMessage('wallhaven-error', error.message));
        }
    },
    
    /**
     * Zeigt eine Erfolgsmeldung an
     */
    _showSuccess(message) {
        if (typeof Benachrichtigung !== 'undefined') {
            new Benachrichtigung('Hintergrund', message, '/Res/Bild/Icon/Topbar/check_circle_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg');
        } else {
            const notification = document.createElement('div');
            notification.className = 'hintergrund-notification';
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                z-index: 1000000;
                animation: slideUp 0.3s ease;
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }
};

// Export für andere Module
window.WallhavenManager = WallhavenManager;
