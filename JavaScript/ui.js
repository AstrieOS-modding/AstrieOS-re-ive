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
    },
    
    /**
     * Sucht auf Wallhaven nach Wallpapers
     */
    async _searchWallhaven() {
        const searchInput = document.querySelector('.wallhaven-input');
        const resultsContainer = document.getElementById('wallhaven-results');
        

        if (!searchInput || !resultsContainer) return;
        
        const query = searchInput.value;
        const category = document.getElementById('wallhaven-category')?.value || '';
        const purity = document.getElementById('wallhaven-purity')?.value || '';
        const resolution = document.getElementById('wallhaven-resolution')?.value || '';
        
        if (!query && !category && !purity && !resolution) {
            resultsContainer.innerHTML = '<p class="wallhaven-empty">Bitte gib Suchbegriffe oder Filter an</p>';
            return;
        }
        
        resultsContainer.innerHTML = '<p class="wallhaven-loading">Lade Wallpapers...</p>';
        
        try {
            // Für Demo-Zwecke verwenden wir lokale Bilder
            const demoResults = this._getDemoWallpapers(query, category);
            this._displayWallhavenResults({ data: demoResults }, resultsContainer);
            
            /*
            // Echte API-Anfrage (benötigt API-Key)
            const apiUrl = this._buildWallhavenUrl(query, category, purity, resolution);
            const response = await fetch(apiUrl);
            const data = await response.json();
            this._displayWallhavenResults(data, resultsContainer);
            */
        } catch (error) {
            console.error('[Wallhaven] Fehler:', error);
            resultsContainer.innerHTML = '<p class="wallhaven-error">Fehler beim Laden. Verwende Demo-Bilder als Fallback.</p>';
            const demoResults = this._getDemoWallpapers(query, category);
            this._displayWallhavenResults({ data: demoResults }, resultsContainer);
        }
    },
    
    /**
     * Gibt Demo-Wallpaper-Ergebnisse zurück
     */
    _getDemoWallpapers(query, category) {
        const demoImages = [
            {
                id: 'demo1',
                title: 'Natur Hintergrund',
                path: '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg',
                thumbs: {
                    large: '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg',
                    original: '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg'
                },
                views: 1500,
                favorites: 230
            },
            {
                id: 'demo2',
                title: 'Abstrakter Hintergrund',
                path: '/Res/Bild/Logo/re-ive-logo.svg',
                thumbs: {
                    large: '/Res/Bild/Logo/re-ive-logo.svg',
                    original: '/Res/Bild/Logo/re-ive-logo.svg'
                },
                views: 800,
                favorites: 120
            }
        ];
        
        if (category === 'anime') {
            return demoImages.filter(img => img.title.toLowerCase().includes('anime'));
        }
        if (category === 'people') {
            return demoImages.filter(img => img.title.toLowerCase().includes('person') || img.title.toLowerCase().includes('menschen'));
        }
        
        if (query) {
            const lowerQuery = query.toLowerCase();
            return demoImages.filter(img => img.title.toLowerCase().includes(lowerQuery));
        }
        
        return demoImages;
    },
    
    /**
     * Baut die Wallhaven API URL
     */
    _buildWallhavenUrl(query, category, purity, resolution) {
        const baseUrl = 'https://wallhaven.cc/api/v1/search';
        const params = new URLSearchParams();

        params.set('apikey', 'Gy1LmUNdPWHnopdC4e6gws5fX9oDCZlR');
        
        if (query) params.set('q', query);
        if (category) params.set('categories', category);
        if (purity) params.set('purity', purity);
        if (resolution) {
            const [width, height] = resolution.split('x');
            params.set('resolutions', `${width}x${height}`);
        }
        
        params.set('page', '1');
        params.set('sorting', 'relevance');
        params.set('order', 'desc');
        
        return `${baseUrl}?${params.toString()}`;
    },
    
    /**
     * Zeigt Wallhaven-Suchergebnisse an
     */
    _displayWallhavenResults(data, container) {
        if (!data || !data.data || data.data.length === 0) {
            container.innerHTML = '<p class="wallhaven-empty">Keine Wallpapers gefunden</p>';
            return;
        }
        
        const wallpapers = data.data;
        let html = '<div class="wallhaven-grid">';
        
        wallpapers.forEach(wallpaper => {
            const thumbUrl = wallpaper.thumbs?.large || wallpaper.thumbs?.original || wallpaper.path;
            const wallpaperUrl = wallpaper.path || `https://wallhaven.cc/wallpaper/${wallpaper.id}`;
            const escapedUrl = wallpaperUrl.replace(/'/g, "\\'");
            
            html += `
                <div class="wallhaven-card" onclick="window.WallhavenManager._selectWallpaper('${escapedUrl}')">
                    <img src="${thumbUrl}" alt="Wallpaper" class="wallhaven-thumb" loading="lazy">
                    <div class="wallhaven-card-info">
                        <span class="wallhaven-card-title">${wallpaper.title || 'Unbekannt'}</span>
                        <span class="wallhaven-card-stats">${wallpaper.views} Views | ${wallpaper.favorites} Favorites</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    /**
     * Wählt ein Wallpaper aus
     */
    _selectWallpaper(wallpaperUrl) {
        if (typeof Nutzerspeicher !== 'undefined') {
            Nutzerspeicher.speichereWallhavenHintergrund(wallpaperUrl);
        }
        
        if (typeof WindowManager !== 'undefined') {
            WindowManager.closeWindow('wallhaven-search');
        }
        
        this._showSuccess('Hintergrund erfolgreich geändert!');
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
