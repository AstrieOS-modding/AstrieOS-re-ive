const Nutzerspeicher = {
    STORAGE_KEY: 'astrieos_user_settings',
    ACCOUNTS_KEY: 'astrieos_user_accounts',
    ACTIVE_ACCOUNT_KEY: 'astrieos_active_account',
    WALLPAPERS_KEY: 'astrieos_wallpapers',
    WALLPAPER_DB_NAME: 'astrieos_wallpaper_files',
    WALLPAPER_DB_STORE: 'wallpapers',
    _wallpaperDatabasePromise: null,
    _wallpaperStorageReady: null,
    _wallpaperObjectUrls: new Map(),
    _materialYouSyncId: 0,
    _materialYouLiveTimer: null,
    _materialYouLastSavedAt: 0,
    MATERIAL_YOU_DEFAULT: '#bd82eb',

    /**
     * Initialisiert das Nutzerspeicher-System
     */
    init() {
        // Lade gespeicherte Einstellungen beim Start
        const settings = this.laden();
        this._attachMaterialYouPaletteControls();
        this._attachMaterialYouLiveControls();
        document.addEventListener('settings-template-ready', () => {
            this._attachMaterialYouPaletteControls();
            this._attachMaterialYouLiveControls();
        }, { once: true });

        // Initialisiere Konten-System
        this.initialisiereKonten();

        this._wallpaperStorageReady = this._initializeWallpaperStorage()
            .then(() => this._restoreSavedBackground())
            .catch(error => {
                console.error('[Nutzerspeicher] Wallpaper-Speicher konnte nicht initialisiert werden:', error);
                return this._restoreSavedBackground().catch(restoreError => {
                    console.error('[Nutzerspeicher] Gespeicherter Hintergrund konnte nicht wiederhergestellt werden:', restoreError);
                });
            })
            .then(() => {
                this.syncMaterialYou();
                return true;
            });

        console.log('[Nutzerspeicher] Initialisiert. Einstellungen:', settings);
    },

    /**
     * Initialisiert das Konto-System und erstellt ein Gast-Konto falls keins existiert
     */
    initialisiereKonten() {
        const konten = this.getAlleKonten();
        
        // Wenn keine Konten existieren, erstelle ein Gast-Konto
        if (konten.length === 0) {
            this.erstelleKonto('Gast!');
            console.log('[Nutzerspeicher] Gast-Konto automatisch erstellt');
        }
        
        // Stelle sicher, dass ein aktives Konto gesetzt ist
        let aktivesKonto = this.getAktivesKonto();
        if (!aktivesKonto && konten.length > 0) {
            this.setAktivesKonto(konten[0].id);
            aktivesKonto = konten[0];
        }
        
        // Aktualisiere UI mit aktivem Konto
        if (aktivesKonto) {
            this.aktualisiereUIMitKonto(aktivesKonto);
        }
    },

    /**
     * Aktualisiert die UI mit den Daten des aktiven Kontos
     * @param {Object} konto - Das Konto-Objekt
     */
    aktualisiereUIMitKonto(konto) {
        const usernameElement = document.getElementById('username');
        const userpfpElement = document.getElementById('userpfp');
        
        if (usernameElement) {
            usernameElement.textContent = konto.username || 'Gast!';
        }
        
        if (userpfpElement) {
            userpfpElement.src = konto.profilbildUrl || '/Res/Bild/Logo/AddText_07-03-07.27.32.png';
        }
        
        console.log('[Nutzerspeicher] UI aktualisiert mit Konto:', konto.username);
    },

    speichern(einstellungen) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(einstellungen));
            console.log('[Nutzerspeicher] Einstellungen gespeichert:', einstellungen);
            return true;
        } catch (error) {
            console.error('[Nutzerspeicher] Fehler beim Speichern:', error);
            return false;
        }
    },

    /**
     * Lädt Einstellungen aus localStorage
     */
    laden() {
        try {
            const gespeichert = localStorage.getItem(this.STORAGE_KEY);
            return gespeichert ? JSON.parse(gespeichert) : {};
        } catch (error) {
            console.error('[Nutzerspeicher] Fehler beim Laden:', error);
            return {};
        }
    },

    setMaterialYouEnabled(enabled) {
        const settings = this.laden();
        settings.materialYouEnabled = Boolean(enabled);
        this.speichern(settings);
        this.syncMaterialYou();
        return settings.materialYouEnabled;
    },

    setMaterialYouPalette(name) {
        const settings = this.laden();
        settings.materialYouPaletteName = name;
        settings.materialYouPalette = this._createMaterialYouPalette(settings.materialYouColor || this.MATERIAL_YOU_DEFAULT, name);
        this.speichern(settings);
        this.syncMaterialYou();
        this._renderMaterialYouPaletteControls();
        return name;
    },

    _attachMaterialYouPaletteControls() {
        const menu = document.getElementById('Materialyou-palettes');
        if (!menu) return;
        menu.querySelectorAll('[data-material-you-palette]').forEach(button => {
            if (button.dataset.bound) return;
            button.dataset.bound = 'true';
            button.addEventListener('click', () => {
                this.setMaterialYouPalette(button.dataset.materialYouPalette);
                menu.classList.remove('Open');
                document.getElementById('Palette-toggle')?.setAttribute('aria-expanded', 'false');
            });
        });
        this._renderMaterialYouPaletteControls();
    },

    _renderMaterialYouPaletteControls() {
        const menu = document.getElementById('Materialyou-palettes');
        if (!menu) return;
        const settings = this.laden();
        const selected = settings.materialYouPaletteName || 'Farbenfroh';
        const baseColor = settings.materialYouColor || this.MATERIAL_YOU_DEFAULT;
        const name = document.getElementById('Palette-name');
        if (name) name.textContent = selected;
        menu.querySelectorAll('[data-material-you-palette]').forEach(button => {
            const palette = this._createMaterialYouPalette(baseColor, button.dataset.materialYouPalette);
            const preview = button.querySelector('.Palette-preview');
            if (preview) {
                preview.style.setProperty('--palette-preview-light', palette.light);
                preview.style.setProperty('--palette-preview-dark', palette.dark);
                preview.style.setProperty('--palette-preview-accent', palette.accent);
            }
            button.setAttribute('aria-pressed', String(button.dataset.materialYouPalette === selected));
        });
    },

    _attachMaterialYouLiveControls() {
        const toggle = document.getElementById('Materialyou-live-toggle');
        const slider = document.getElementById('Materialyou-live-interval-slider');
        const numberInput = document.getElementById('Materialyou-live-interval-input');
        const valueOutput = document.getElementById('Materialyou-live-interval-value');
        if (!toggle || !slider || !numberInput || !valueOutput) return;
        const formatInterval = value => value < 1000
            ? `${value} ms`
            : `${(value / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Sekunden`;
        const render = () => {
            const settings = this.laden();
            const enabled = Boolean(settings.materialYouLiveEnabled);
            const configuredInterval = Number(settings.materialYouLiveInterval);
            const intervalValue = Number.isFinite(configuredInterval)
                ? Math.min(10000, Math.max(5, configuredInterval))
                : 5000;
            const status = document.getElementById('Materialyou-live-status');
            if (status) status.textContent = enabled ? 'An' : 'Aus';
            toggle.setAttribute('aria-pressed', String(enabled));
            slider.value = String(intervalValue);
            numberInput.value = String(intervalValue);
            valueOutput.textContent = formatInterval(intervalValue);
        };
        const saveInterval = value => {
            const settings = this.laden();
            const parsedValue = Number(value);
            const intervalValue = String(value).trim() && Number.isFinite(parsedValue)
                ? Math.min(10000, Math.max(5, Math.round(parsedValue)))
                : 5000;
            settings.materialYouLiveInterval = intervalValue;
            this.speichern(settings);
            render();
            this.syncMaterialYou();
        };
        if (!toggle.dataset.bound) {
            toggle.dataset.bound = 'true';
            toggle.addEventListener('click', () => {
                const settings = this.laden();
                settings.materialYouLiveEnabled = !settings.materialYouLiveEnabled;
                this.speichern(settings);
                this.syncMaterialYou();
                render();
            });
        }
        if (!slider.dataset.bound) {
            slider.dataset.bound = 'true';
            slider.addEventListener('input', () => {
                numberInput.value = slider.value;
                valueOutput.textContent = formatInterval(Number(slider.value));
            });
            slider.addEventListener('change', () => saveInterval(slider.value));
        }
        if (!numberInput.dataset.bound) {
            numberInput.dataset.bound = 'true';
            numberInput.addEventListener('input', () => {
                if (!numberInput.value) return;
                const value = Math.min(10000, Math.max(5, Number(numberInput.value)));
                slider.value = String(value);
                valueOutput.textContent = formatInterval(value);
            });
            numberInput.addEventListener('change', () => saveInterval(numberInput.value));
        }
        render();
    },

    syncMaterialYou() {
        const syncId = ++this._materialYouSyncId;
        if (this._materialYouLiveTimer) {
            clearInterval(this._materialYouLiveTimer);
            this._materialYouLiveTimer = null;
        }
        const settings = this.laden();
        const enabled = Boolean(settings.materialYouEnabled);
        document.documentElement.classList.toggle('material-you-enabled', enabled);
        if (!enabled) return;

        const applyPalette = palette => {
            const root = document.documentElement;
            root.style.setProperty('--material-you-light', palette.light);
            root.style.setProperty('--material-you-light-text', palette.lightText);
            root.style.setProperty('--material-you-dark', palette.dark);
            root.style.setProperty('--material-you-dark-text', palette.darkText);
            root.style.setProperty('--material-you-accent', palette.light);
        };
        applyPalette(settings.materialYouPalette || this._createMaterialYouPalette(settings.materialYouColor || this.MATERIAL_YOU_DEFAULT, settings.materialYouPaletteName));
        this._renderMaterialYouPaletteControls();

        const background = this.hintergrundLaden();
        const isVideo = background.type === 'video';
        const media = document.querySelector(isVideo ? '.Desktop-video-wallpaper' : '.Desktop-wallpaper');
        if (!media) return;

        let frameReadFailed = false;
        const sampleFrame = () => {
            if (frameReadFailed || syncId !== this._materialYouSyncId) return;
            if (isVideo && media.readyState < 2) return;
            if (!isVideo && !media.naturalWidth) return;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 32;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                context.drawImage(media, 0, 0, 32, 32);
                const pixels = context.getImageData(0, 0, 32, 32).data;
                let red = 0, green = 0, blue = 0, weightTotal = 0;
                for (let i = 0; i < pixels.length; i += 16) {
                    const saturation = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
                    if (pixels[i + 3] < 180) continue;
                    const weight = 0.25 + Math.min(saturation / 100, 1);
                    red += pixels[i] * weight; green += pixels[i + 1] * weight; blue += pixels[i + 2] * weight; weightTotal += weight;
                }
                if (!weightTotal) return;
                const color = `#${[red, green, blue].map(value => Math.round(value / weightTotal).toString(16).padStart(2, '0')).join('')}`;
                const latest = this.laden();
                if (!latest.materialYouEnabled || syncId !== this._materialYouSyncId) return;
                latest.materialYouColor = color;
                latest.materialYouPalette = this._createMaterialYouPalette(color, latest.materialYouPaletteName);
                applyPalette(latest.materialYouPalette);
                const now = Date.now();
                if (now - this._materialYouLastSavedAt >= 1000) {
                    this.speichern(latest);
                    this._materialYouLastSavedAt = now;
                    this._renderMaterialYouPaletteControls();
                }
            } catch (error) {
                frameReadFailed = true;
                console.info('[Nutzerspeicher] Hintergrundframe nicht auslesbar; aktuelle Akzentfarbe bleibt erhalten.', error);
            }
        };

        if (isVideo) {
            if (media.readyState >= 2) sampleFrame();
            else media.addEventListener('loadeddata', sampleFrame, { once: true });
        } else if (media.complete && media.naturalWidth) {
            sampleFrame();
        } else {
            media.addEventListener('load', sampleFrame, { once: true });
        }

        const isLiveWallpaper = isVideo || background.type === 'live';
        if (isLiveWallpaper && settings.materialYouLiveEnabled) {
            const configuredInterval = Number(settings.materialYouLiveInterval);
            const interval = Number.isFinite(configuredInterval)
                ? Math.min(10000, Math.max(5, configuredInterval))
                : 5000;
            this._materialYouLiveTimer = setInterval(sampleFrame, interval);
        }
    },

    _createMaterialYouPalette(hex, paletteName = 'Farbenfroh') {
        const value = hex.replace('#', '');
        const red = parseInt(value.slice(0, 2), 16) / 255;
        const green = parseInt(value.slice(2, 4), 16) / 255;
        const blue = parseInt(value.slice(4, 6), 16) / 255;
        const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
        const delta = max - min;
        let hue = 0;
        if (delta) {
            if (max === red) hue = ((green - blue) / delta) % 6;
            else if (max === green) hue = (blue - red) / delta + 2;
            else hue = (red - green) / delta + 4;
        }
        hue = (hue * 60 + 360) % 360;
        const measuredSaturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * ((max + min) / 2) - 1));
        const paletteStyles = {
            'Farbenfroh': { saturation: 0.68, light: 0.76, dark: 0.40, hueShift: 0 },
            'Dominant': { saturation: Math.max(0.36, Math.min(0.62, measuredSaturation || 0.50)), light: 0.72, dark: 0.38, hueShift: 0 },
            'Am Hellsten': { saturation: 0.58, light: 0.88, dark: 0.52, hueShift: 0 },
            'Am Dunkelsten': { saturation: 0.68, light: 0.62, dark: 0.28, hueShift: 0 },
            'Am meisten gesättigten': { saturation: 0.90, light: 0.74, dark: 0.38, hueShift: 0 },
            'Am wenigsten gesättigten': { saturation: 0.24, light: 0.78, dark: 0.42, hueShift: 0 },
            'Am lebendigsten': { saturation: 0.82, light: 0.72, dark: 0.36, hueShift: 18 }
        };
        const style = paletteStyles[paletteName] || paletteStyles.Farbenfroh;
        hue = (hue + style.hueShift) % 360;
        const saturation = style.saturation;
        const toHex = lightness => {
            const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
            const section = hue / 60;
            const x = chroma * (1 - Math.abs(section % 2 - 1));
            const [r, g, b] = section < 1 ? [chroma, x, 0] : section < 2 ? [x, chroma, 0] : section < 3 ? [0, chroma, x] : section < 4 ? [0, x, chroma] : section < 5 ? [x, 0, chroma] : [chroma, 0, x];
            const match = lightness - chroma / 2;
            return `#${[r, g, b].map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`;
        };
        return { light: toHex(style.light), lightText: toHex(0.20), dark: toHex(style.dark), darkText: toHex(0.96), accent: toHex(Math.min(0.82, style.light + 0.06)) };
    },

    /**
     * Speichert spezifische Hintergrund-URL mit Typ
     */
    hintergrundSpeichern(url, type = 'static', wallpaperId = null) {
        const einstellungen = this.laden();
        if (wallpaperId) {
            delete einstellungen.hintergrundUrl;
            einstellungen.hintergrundWallpaperId = wallpaperId;
        } else {
            delete einstellungen.hintergrundWallpaperId;
            einstellungen.hintergrundUrl = url;
        }
        einstellungen.hintergrundDatum = new Date().toISOString();
        einstellungen.backgroundType = type;
        return this.speichern(einstellungen);
    },

    /**
     * Lädt Hintergrund-URL und Typ
     */
    hintergrundLaden() {
        const einstellungen = this.laden();
        const wallpaper = einstellungen.hintergrundWallpaperId
            ? this.ladeWallpaperListe().find(item => item.id === einstellungen.hintergrundWallpaperId)
            : null;
        return {
            url: einstellungen.hintergrundUrl || wallpaper?.url || null,
            wallpaperId: einstellungen.hintergrundWallpaperId || null,
            type: einstellungen.backgroundType || 'static'
        };
    },

    /**
     * Setzt den Hintergrund auf Standard zurück
     */
    hintergrundLöschen() {
        const einstellungen = this.laden();
        delete einstellungen.hintergrundUrl;
        delete einstellungen.hintergrundWallpaperId;
        delete einstellungen.backgroundType;
        this.speichern(einstellungen);

        const standardUrl = '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
        this.ladeHintergrund(standardUrl, 'static');
        this.syncMaterialYou();
    },

    /**
     * Alias für Kompatibilität mit Einstellungen.js
     */
    standardHintergrund() {
        this.hintergrundLöschen();
    },

    /**
     * Setzt den Hintergrund direkt im DOM
     */
    ladeHintergrund(url, type = 'static') {
        const imgElement = document.querySelector('.Desktop-wallpaper');
        const videoElement = document.querySelector('.Desktop-video-wallpaper');

        if (!imgElement) return;

        // Standard: Bild anzeigen, Video verstecken
        if (imgElement) imgElement.style.display = 'block';
        if (videoElement) {
            videoElement.style.display = 'none';
            videoElement.pause();
            videoElement.removeAttribute('src');
        }

        switch (type) {
            case 'video':
                if (videoElement) {
                    if (imgElement) imgElement.style.display = 'none';
                    videoElement.src = url;
                    videoElement.style.zIndex = '0';
                    videoElement.style.display = 'block';
                    videoElement.load();
                    videoElement.play().catch(e => {
                        console.error('[Nutzerspeicher] Video Playback Fehler:', e);
                        videoElement.style.display = 'none';
                        if (imgElement) {
                            imgElement.src = '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
                            imgElement.style.objectFit = 'cover';
                            imgElement.style.display = 'block';
                        }
                    });
                }
                break;

            case 'live':
                if (imgElement) {
                    imgElement.src = url;
                    imgElement.style.objectFit = 'cover';
                    imgElement.style.display = 'block';
                }
                break;

            default:
                if (imgElement) {
                    imgElement.src = url;
                    imgElement.style.objectFit = 'cover';
                    imgElement.style.display = 'block';
                }
        }

        if (imgElement && type !== 'video') {
            imgElement.onerror = () => {
                console.error('[Nutzerspeicher] Fehler beim Laden:', url);
                imgElement.src = '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
            };
        }
        window.dispatchEvent(new CustomEvent('astrie-background-changed', { detail: { url, type } }));
        this.syncMaterialYou();
    },

    /* ===== NEUE METHODEN FÜR WALLPAPER-LISTE ===== */

    /**
     * Speichert eine Liste von Wallpapers im localStorage
     * @param {Array} wallpapers - Array von Wallpaper-Objekten
     */
    speichereWallpaperListe(wallpapers) {
        try {
            localStorage.setItem(this.WALLPAPERS_KEY, JSON.stringify(wallpapers));
            return true;
        } catch (error) {
            console.error('[Nutzerspeicher] Fehler beim Speichern der Wallpaper-Liste:', error);
            return false;
        }
    },

    /**
     * Lädt die Wallpaper-Liste aus localStorage
     * @returns {Array} Liste der Wallpapers
     */
    ladeWallpaperListe() {
        try {
            const gespeichert = localStorage.getItem(this.WALLPAPERS_KEY);
            return gespeichert ? JSON.parse(gespeichert) : [];
        } catch (error) {
            console.error('[Nutzerspeicher] Fehler beim Laden der Wallpaper-Liste:', error);
            return [];
        }
    },

    /**
     * Fügt ein Wallpaper zur Liste hinzu
     * @param {string} url - Wallpaper URL (Base64 oder Pfad)
     * @param {string} type - Typ: 'static', 'live', oder 'video'
     * @param {string} thumbnail - Optional: Thumbnail-URL
     * @param {string} name - Optional: Benutzerdefinierter Name
     * @returns {Object} Das hinzugefügte Wallpaper-Objekt
     */
    fügeWallpaperHinzu(url, type = 'static', thumbnail = null, name = null) {
        const wallpapers = this.ladeWallpaperListe();

        // Prüfe auf Duplikate
        const exists = wallpapers.some(wp => wp.url === url);
        if (exists) {
            console.log('[Nutzerspeicher] Wallpaper bereits in der Liste');
            return wallpapers.find(wp => wp.url === url);
        }

        const newWallpaper = {
            id: Date.now().toString(),
            url: url,
            type: type,
            thumbnail: thumbnail || this._generateThumbnail(url, type),
            name: name || this._generateWallpaperName(url),
            dateAdded: new Date().toISOString(),
            isCurrent: false
        };

        wallpapers.unshift(newWallpaper); // Neueste zuerst
        return this.speichereWallpaperListe(wallpapers) ? newWallpaper : null;
    },

    /**
     * Entfernt ein Wallpaper aus der Liste
     * @param {string} id - Wallpaper-ID
     * @returns {boolean} Erfolg
     */
    async entferneWallpaper(id) {
        let wallpapers = this.ladeWallpaperListe();
        const index = wallpapers.findIndex(wp => wp.id === id);

        if (index === -1) {
            console.error('[Nutzerspeicher] Wallpaper nicht gefunden:', id);
            return false;
        }

        wallpapers.splice(index, 1);
        if (!this.speichereWallpaperListe(wallpapers)) return false;
        try {
            await this._deleteWallpaperBlob(id);
        } catch (error) {
            console.warn('[Nutzerspeicher] Wallpaper-Datei konnte nicht entfernt werden:', error);
        }
        const objectUrl = this._wallpaperObjectUrls.get(id);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        this._wallpaperObjectUrls.delete(id);
        return true;
    },

    /**
     * Setzt ein Wallpaper als aktuellen Hintergrund
     * @param {string} id - Wallpaper-ID
     */
    async setzeWallpaperAlsAktiv(id) {
        const wallpapers = this.ladeWallpaperListe();
        const wallpaper = wallpapers.find(wp => wp.id === id);

        if (!wallpaper) {
            console.error('[Nutzerspeicher] Wallpaper nicht gefunden:', id);
            return false;
        }

        const previousSettings = this.laden();
        let resolvedUrl;
        try {
            resolvedUrl = await this.resolveWallpaperUrl(wallpaper.url);
        } catch (error) {
            console.error('[Nutzerspeicher] Wallpaper-Datei konnte nicht geladen werden:', error);
            return false;
        }

        const savedBackground = wallpaper.url.startsWith('indexeddb:')
            ? this.hintergrundSpeichern(null, wallpaper.type, id)
            : this.hintergrundSpeichern(wallpaper.url, wallpaper.type);
        if (!savedBackground) return false;

        // Aktualisiere aktiven Status
        const updatedWallpapers = wallpapers.map(wp => ({
            ...wp,
            isCurrent: wp.id === id
        }));

        if (!this.speichereWallpaperListe(updatedWallpapers)) {
            this.speichern(previousSettings);
            return false;
        }
        this.ladeHintergrund(resolvedUrl, wallpaper.type);
        this.syncMaterialYou();

        return true;
    },

    /**
     * Generiert einen Thumbnail für ein Wallpaper
     * @param {string} url - Wallpaper URL
     * @param {string} type - Typ
     * @returns {string} Thumbnail-URL
     */
    _generateThumbnail(url, type) {
        if (type === 'video') {
            // Für Videos: Erstes Frame oder Standard-Thumbnail
            return '/Res/Bild/Icon/EInstellungen/movie_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg';
        }
        return url; // Für Bilder: URL selbst als Thumbnail
    },

    /**
     * Generiert einen Namen für ein Wallpaper
     * @param {string} url - Wallpaper URL
     * @returns {string} Name
     */
    _generateWallpaperName(url) {
        if (url.includes('wallhaven')) {
            const match = url.match(/wallhaven-([a-zA-Z0-9]+)/);
            return match ? `Wallhaven-${match[1].substring(0, 8)}` : 'Wallhaven Wallpaper';
        }
        if (url.startsWith('data:')) {
            return `Benutzerdefiniert ${Date.now()}`;
        }
        return 'Mein Wallpaper';
    },

    /* ===== SPEZIALISIERTE METHODEN ===== */

    /**
     * Speichert eine Datei als Blob in IndexedDB
     * @param {File} file - Hochgeladene Datei
     * @param {string} type - Typ: 'static', 'live', oder 'video'
     * @param {Function} callback - Optional: Callback nach erfolgreichem Speichern
     */
    async speichereDateiAlsHintergrund(file, type = 'static', callback = null) {
        try {
            const id = `wallpaper_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            await this._storeWallpaperBlob(id, file, type);
            const addedWallpaper = this.fügeWallpaperHinzu(`indexeddb:${id}`, type);
            if (!addedWallpaper) throw new Error('Wallpaper-Metadaten konnten nicht gespeichert werden.');
            if (!await this.setzeWallpaperAlsAktiv(addedWallpaper.id)) throw new Error('Wallpaper konnte nicht aktiviert werden.');
            if (callback) callback(true);
        } catch (error) {
            console.error('[Nutzerspeicher] Fehler beim Speichern des Wallpapers:', error);
            if (callback) callback(false, error);
        }
    },

    /**
     * Speichert ein Video als Wallpaper
     * @param {File} file - Hochgeladene Videodatei
     * @param {Function} callback - Optional: Callback nach erfolgreichem Speichern
     */
    speichereVideoAlsHintergrund(file, callback = null) {
        return this.speichereDateiAlsHintergrund(file, 'video', callback);
    },

    /**
     * Speichert Wallhaven-Bild-URL
     */
    async speichereWallhavenHintergrund(wallhavenUrl) {
        const direkteUrl = this.konvertiereWallhavenUrl(wallhavenUrl);
        // Füge zur Liste hinzu
        const newWallpaper = this.fügeWallpaperHinzu(direkteUrl, 'static');
        // Setze als aktiv
        if (!newWallpaper) return false;
        return this.setzeWallpaperAlsAktiv(newWallpaper.id);
    },

    /**
     * Konvertiert Wallhaven-Seiten-URL zu direkter Bild-URL
     */
    konvertiereWallhavenUrl(url) {
        // Falls bereits eine direkte URL (w.wallhaven.cc oder wallhaven.cc/full)
        if (url.includes('w.wallhaven.cc/full/') || url.includes('wallhaven.cc/full/')) {
            return url;
        }
        const match = url.match(/wallhaven\.cc\/wallpaper\/([a-zA-Z0-9]+)/);
        if (match) {
            const wallpaperId = match[1];
            return `https://w.wallhaven.cc/full/${wallpaperId.substring(0, 2)}/wallhaven-${wallpaperId}.jpg`;
        }
        if (url.includes('th.wallhaven.cc/')) {
            return url.replace('th.wallhaven.cc/', 'w.wallhaven.cc/full/')
                      .replace(/small|thumbs/, 'full');
        }
        return url;
    },


    /**
     * Erkennt den Hintergrund-Typ aus einer Datei
     * @param {File} file - Datei
     * @returns {string} Typ: 'static', 'live', oder 'video'
     */
    erkenneHintergrundTyp(file) {
        const fileName = file.name.toLowerCase();
        const fileType = file.type.toLowerCase();

        // Video-Formate
        if (fileType.startsWith('video/') ||
            fileName.endsWith('.mp4') ||
            fileName.endsWith('.webm') ||
            fileName.endsWith('.mov') ||
            fileName.endsWith('.avi') ||
            fileName.endsWith('.mkv')) {
            return 'video';
        }

        // Animierte Bildformate
        if (fileType === 'image/gif' ||
            fileType.includes('apng') ||
            fileName.endsWith('.gif') ||
            fileName.endsWith('.apng')) {
            return 'live';
        }

        // Statische Bilder
        if (fileType.startsWith('image/')) {
            return 'static';
        }

        return 'static'; // Default
    },

    // ========== KONTO-VERWALTUNG ==========

    /**
     * Erzeugt eine einzigartige Konto-ID
     * @returns {string} Einzigartige ID
     */
    _generiereKontoId() {
        return 'konto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Speichert alle Konten
     * @param {Array} konten - Array von Konto-Objekten
     */
    _speichereKonten(konten) {
        try {
            localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(konten));
            console.log('[Nutzerspeicher] Konten gespeichert:', konten.length);
            return true;
        } catch (error) {
            console.error('[Nutzerspeicher] Fehler beim Speichern der Konten:', error);
            return false;
        }
    },

    /**
     * Lädt alle Konten aus dem Speicher
     * @returns {Array} Array von Konto-Objekten
     */
    getAlleKonten() {
        try {
            const gespeichert = localStorage.getItem(this.ACCOUNTS_KEY);
            return gespeichert ? JSON.parse(gespeichert) : [];
        } catch (error) {
            console.error('[Nutzerspeicher] Fehler beim Laden der Konten:', error);
            return [];
        }
    },

    /**
     * Setzt das aktive Konto
     * @param {string} kontoId - ID des aktiven Kontos
     */
    setAktivesKonto(kontoId) {
        try {
            localStorage.setItem(this.ACTIVE_ACCOUNT_KEY, kontoId);
            console.log('[Nutzerspeicher] Aktives Konto gesetzt:', kontoId);
        } catch (error) {
            console.error('[Nutzerspeicher] Fehler beim Setzen des aktiven Kontos:', error);
        }
    },

    /**
     * Gibt die ID des aktiven Kontos zurück
     * @returns {string|null} ID des aktiven Kontos oder null
     */
    getAktiveKontoId() {
        try {
            return localStorage.getItem(this.ACTIVE_ACCOUNT_KEY);
        } catch (error) {
            console.error('[Nutzerspeicher] Fehler beim Laden der aktiven Konto-ID:', error);
            return null;
        }
    },

    /**
     * Gibt das aktive Konto-Objekt zurück
     * @returns {Object|null} Das aktive Konto oder null
     */
    getAktivesKonto() {
        const kontoId = this.getAktiveKontoId();
        if (!kontoId) return null;
        
        const konten = this.getAlleKonten();
        return konten.find(k => k.id === kontoId) || null;
    },

    kontoHatPasswort(kontoId) {
        return Boolean(this.getAlleKonten().find(konto => konto.id === kontoId)?.passwordHash);
    },

    async setKontoPasswort(kontoId, password) {
        const konten = this.getAlleKonten();
        const konto = konten.find(item => item.id === kontoId);
        if (!konto) return false;

        if (!password) {
            delete konto.passwordHash;
            delete konto.passwordSalt;
        } else {
            if (!window.crypto?.subtle || !window.crypto.getRandomValues) {
                throw new Error('Sichere Passwortspeicherung wird von diesem Browser nicht unterstützt.');
            }
            const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
            const salt = Array.from(saltBytes, byte => byte.toString(16).padStart(2, '0')).join('');
            konto.passwordSalt = salt;
            konto.passwordHash = await this._derivePasswordHash(password, saltBytes);
        }

        return this._speichereKonten(konten) !== false;
    },

    async verifiziereKontoPasswort(kontoId, password) {
        const konto = this.getAlleKonten().find(item => item.id === kontoId);
        if (!konto) return false;
        if (!konto.passwordHash) return true;
        if (!window.crypto?.subtle) return false;
        const saltBytes = new Uint8Array((konto.passwordSalt || '').match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
        const hash = await this._derivePasswordHash(password, saltBytes);
        return hash === konto.passwordHash;
    },

    async _derivePasswordHash(password, saltBytes) {
        const key = await window.crypto.subtle.importKey(
            'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
        );
        const bits = await window.crypto.subtle.deriveBits({
            name: 'PBKDF2', salt: saltBytes, iterations: 120000, hash: 'SHA-256'
        }, key, 256);
        return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Erstellt ein neues Konto
     * @param {string} username - Benutzername
     * @param {string} profilbildUrl - URL des Profilbildes (optional)
     * @param {string} bannerUrl - URL des Banners (optional)
     * @returns {Object} Das erstellte Konto-Objekt
     */
    erstelleKonto(username, profilbildUrl = null, bannerUrl = null) {
        const konten = this.getAlleKonten();
        
        // Prüfe ob Benutzername bereits existiert
        const existiert = konten.some(k => k.username === username);
        if (existiert) {
            console.warn('[Nutzerspeicher] Benutzername bereits vorhanden:', username);
            return null;
        }
        
        const neuesKonto = {
            id: this._generiereKontoId(),
            username: username || 'Gast!',
            profilbildUrl: profilbildUrl || '/Res/Bild/Logo/AddText_07-03-07.27.32.png',
            bannerUrl: bannerUrl || '/Res/Bild/Hintergrund/Default-Banner.png',
            createdAt: new Date().toISOString()
        };
        
        konten.push(neuesKonto);
        this._speichereKonten(konten);
        
        // Wenn es das erste Konto ist, als aktiv setzen
        if (konten.length === 1) {
            this.setAktivesKonto(neuesKonto.id);
        }
        
        console.log('[Nutzerspeicher] Konto erstellt:', neuesKonto.username);
        return neuesKonto;
    },

    /**
     * Löscht ein Konto
     * @param {string} kontoId - ID des zu löschenden Kontos
     * @returns {boolean} Erfolg oder Misserfolg
     */
    loescheKonto(kontoId) {
        const konten = this.getAlleKonten();
        const aktiveId = this.getAktiveKontoId();
        
        // Nicht löschen, wenn nur ein Konto existiert
        if (konten.length <= 1) {
            console.warn('[Nutzerspeicher] Cannot löschen das letzte Konto');
            return false;
        }
        
        const index = konten.findIndex(k => k.id === kontoId);
        if (index === -1) {
            console.warn('[Nutzerspeicher] Konto nicht gefunden:', kontoId);
            return false;
        }
        
        konten.splice(index, 1);
        this._speichereKonten(konten);
        
        // Wenn das gelöschte Konto aktiv war, wechsle zum ersten Konto
        if (aktiveId === kontoId) {
            this.setAktivesKonto(konten[0].id);
            this.aktualisiereUIMitKonto(konten[0]);
        }
        
        console.log('[Nutzerspeicher] Konto gelöscht:', kontoId);
        return true;
    },

    /**
     * Wechselt zu einem anderen Konto
     * @param {string} kontoId - ID des Kontos, zu dem gewechselt werden soll
     * @returns {boolean} Erfolg oder Misserfolg
     */
    wechsleKonto(kontoId) {
        const konten = this.getAlleKonten();
        const konto = konten.find(k => k.id === kontoId);
        
        if (!konto) {
            console.warn('[Nutzerspeicher] Konto nicht gefunden:', kontoId);
            return false;
        }
        
        this.setAktivesKonto(kontoId);
        this.aktualisiereUIMitKonto(konto);
        window.dispatchEvent(new CustomEvent('astrie-account-changed', { detail: { kontoId } }));
        
        console.log('[Nutzerspeicher] Zu Konto gewechselt:', konto.username);
        return true;
    },

    /**
     * Aktualisiert ein bestehendes Konto
     * @param {string} kontoId - ID des Kontos
     * @param {Object} updates - Updates für das Konto (username, profilbildUrl, bannerUrl)
     * @returns {boolean} Erfolg oder Misserfolg
     */
    aktualisiereKonto(kontoId, updates) {
        const konten = this.getAlleKonten();
        const konto = konten.find(k => k.id === kontoId);
        
        if (!konto) {
            console.warn('[Nutzerspeicher] Konto nicht gefunden:', kontoId);
            return false;
        }
        
        // Aktualisiere nur erlaubte Felder
        if (updates.username !== undefined) {
            // Prüfe ob Benutzername bereits von einem anderen Konto verwendet wird
            const NameExists = konten.some(k => k.id !== kontoId && k.username === updates.username);
            if (!NameExists) {
                konto.username = updates.username;
            }
        }
        if (updates.profilbildUrl !== undefined) {
            konto.profilbildUrl = updates.profilbildUrl;
        }
        if (updates.bannerUrl !== undefined) {
            konto.bannerUrl = updates.bannerUrl;
        }
        
        this._speichereKonten(konten);
        window.dispatchEvent(new CustomEvent('astrie-account-changed', { detail: { kontoId } }));
        
        // Wenn dieses Konto aktiv ist, UI aktualisieren
        if (kontoId === this.getAktiveKontoId()) {
            this.aktualisiereUIMitKonto(konto);
        }
        
        console.log('[Nutzerspeicher] Konto aktualisiert:', konto.username);
        return true;
    },

    /**
     * Gibt die Daten des aktiven Kontos zurück (für Kompatibilität mit bestehendem Code)
     * @returns {Object} Benutzerdaten mit username, profilbildUrl, bannerUrl
     */
    ladeBenutzerdaten() {
        const aktivesKonto = this.getAktivesKonto();
        
        if (aktivesKonto) {
            return {
                username: aktivesKonto.username,
                profilbildUrl: aktivesKonto.profilbildUrl,
                bannerUrl: aktivesKonto.bannerUrl
            };
        }
        
        // Fallback für Kompatibilität
        const einstellungen = this.laden();
        return {
            username: einstellungen.username || 'Gast!',
            profilbildUrl: einstellungen.profilbildUrl || '/Res/Bild/Logo/AddText_07-03-07.27.32.png',
            bannerUrl: einstellungen.bannerUrl || '/Res/Bild/Hintergrund/Default-Banner.png'
        };
    },

    /**
     * Speichert Benutzerdaten für das aktive Konto
     * @param {string} username - Benutzername
     * @param {string} profilbildUrl - URL des Profilbildes
     * @param {string} bannerUrl - URL des Banners
     */
    speichereBenutzerdaten(username, profilbildUrl, bannerUrl) {
        const aktivesKonto = this.getAktivesKonto();
        
        if (aktivesKonto) {
            this.aktualisiereKonto(aktivesKonto.id, {
                username: username,
                profilbildUrl: profilbildUrl,
                bannerUrl: bannerUrl
            });
            
            // Auch in den alten Einstellungen speichern (für Kompatibilität)
            const einstellungen = this.laden();
            einstellungen.username = username;
            einstellungen.profilbildUrl = profilbildUrl;
            einstellungen.bannerUrl = bannerUrl;
            this.speichern(einstellungen);
            
            console.log('[Nutzerspeicher] Benutzerdaten für aktives Konto gespeichert:', username);
        } else {
            console.warn('[Nutzerspeicher] Kein aktives Konto gefunden');
        }
    },

    /**
     * Löscht alle Benutzerdaten (für Kompatibilität)
     * Setzt auf Gast-Konto zurück
     */
    loescheBenutzerdaten() {
        const konten = this.getAlleKonten();
        
        // Behalte nur das Gast-Konto oder erstelle eines
        if (konten.length > 0) {
            const gastKonto = konten.find(k => k.username === 'Gast!');
            if (gastKonto) {
                // Lösche alle Konten außer Gast
                const neueKonten = konten.filter(k => k.username === 'Gast!');
                this._speichereKonten(neueKonten);
                this.setAktivesKonto(gastKonto.id);
            } else {
                // Erstelle ein Gast-Konto
                const neuesGastKonto = this.erstelleKonto('Gast!');
                if (neuesGastKonto) {
                    this.setAktivesKonto(neuesGastKonto.id);
                }
            }
        } else {
            // Erstelle ein Gast-Konto
            this.erstelleKonto('Gast!');
        }
        
        // Auch alte Einstellungen zurücksetzen (für Kompatibilität)
        const einstellungen = this.laden();
        delete einstellungen.username;
        delete einstellungen.profilbildUrl;
        delete einstellungen.bannerUrl;
        this.speichern(einstellungen);
        
        console.log('[Nutzerspeicher] Benutzerdaten gelöscht, Gast-Konto aktiv');
    },

    /**
     * Speichert eine Datei als Profilbild (für aktives Konto)
     * @param {File} file - Hochgeladene Bilddatei
     */
    speichereDateiAlsProfilbild(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Url = event.target.result;
            const aktivesKonto = this.getAktivesKonto();
            
            if (aktivesKonto) {
                this.aktualisiereKonto(aktivesKonto.id, {
                    profilbildUrl: base64Url
                });
                
                // Auch in alten Einstellungen speichern (für Kompatibilität)
                const einstellungen = this.laden();
                einstellungen.profilbildUrl = base64Url;
                this.speichern(einstellungen);
                
                console.log('[Nutzerspeicher] Profilbild für aktives Konto gespeichert');
            } else {
                console.warn('[Nutzerspeicher] Kein aktives Konto gefunden');
            }
        };
        reader.onerror = (error) => {
            console.error('[Nutzerspeicher] Fehler beim Lesen der Profilbild-Datei:', error);
        };
        reader.readAsDataURL(file);
    },

    /**
     * Speichert eine Datei als Banner (für aktives Konto)
     * @param {File} file - Hochgeladene Bilddatei
     */
    speichereDateiAlsBanner(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Url = event.target.result;
            const aktivesKonto = this.getAktivesKonto();
            
            if (aktivesKonto) {
                this.aktualisiereKonto(aktivesKonto.id, {
                    bannerUrl: base64Url
                });
                
                // Auch in alten Einstellungen speichern (für Kompatibilität)
                const einstellungen = this.laden();
                einstellungen.bannerUrl = base64Url;
                this.speichern(einstellungen);
                
                console.log('[Nutzerspeicher] Banner für aktives Konto gespeichert');
            } else {
                console.warn('[Nutzerspeicher] Kein aktives Konto gefunden');
            }
        };
        reader.onerror = (error) => {
            console.error('[Nutzerspeicher] Fehler beim Lesen der Banner-Datei:', error);
        };
        reader.readAsDataURL(file);
    },
    _openWallpaperDatabase() {
        if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB wird von diesem Browser nicht unterstützt.'));
        if (!this._wallpaperDatabasePromise) {
            this._wallpaperDatabasePromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(this.WALLPAPER_DB_NAME, 1);
                request.onupgradeneeded = () => {
                    const database = request.result;
                    if (!database.objectStoreNames.contains(this.WALLPAPER_DB_STORE)) {
                        database.createObjectStore(this.WALLPAPER_DB_STORE, { keyPath: 'id' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('IndexedDB konnte nicht geöffnet werden.'));
                request.onblocked = () => reject(new Error('IndexedDB wird durch einen anderen Tab blockiert.'));
            });
        }
        return this._wallpaperDatabasePromise;
    },

    async _storeWallpaperBlob(id, blob, type) {
        const database = await this._openWallpaperDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(this.WALLPAPER_DB_STORE, 'readwrite');
            transaction.objectStore(this.WALLPAPER_DB_STORE).put({ id, blob, type });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error || new Error('Datei konnte nicht gespeichert werden.'));
            transaction.onabort = () => reject(transaction.error || new Error('Speichern der Datei wurde abgebrochen.'));
        });
    },

    async _loadWallpaperBlob(id) {
        const database = await this._openWallpaperDatabase();
        return new Promise((resolve, reject) => {
            const request = database.transaction(this.WALLPAPER_DB_STORE, 'readonly').objectStore(this.WALLPAPER_DB_STORE).get(id);
            request.onsuccess = () => resolve(request.result?.blob || null);
            request.onerror = () => reject(request.error || new Error('Datei konnte nicht geladen werden.'));
        });
    },

    async _deleteWallpaperBlob(id) {
        const database = await this._openWallpaperDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(this.WALLPAPER_DB_STORE, 'readwrite');
            transaction.objectStore(this.WALLPAPER_DB_STORE).delete(id);
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error || new Error('Datei konnte nicht gelöscht werden.'));
            transaction.onabort = () => reject(transaction.error || new Error('Löschen der Datei wurde abgebrochen.'));
        });
    },

    async resolveWallpaperUrl(value) {
        if (typeof value !== 'string' || !value.startsWith('indexeddb:')) return value;
        const id = value.slice('indexeddb:'.length);
        if (this._wallpaperObjectUrls.has(id)) return this._wallpaperObjectUrls.get(id);
        const blob = await this._loadWallpaperBlob(id);
        if (!blob) throw new Error('Wallpaper-Datei fehlt im lokalen Speicher.');
        const objectUrl = URL.createObjectURL(blob);
        this._wallpaperObjectUrls.set(id, objectUrl);
        return objectUrl;
    },

    async _initializeWallpaperStorage() {
        await this._openWallpaperDatabase();
        const wallpapers = this.ladeWallpaperListe();
        const settings = this.laden();
        const legacyActiveUrl = settings.hintergrundUrl;
        let activeWallpaperId = null;
        let changed = false;
        for (const wallpaper of wallpapers) {
            if (typeof wallpaper.url === 'string' && wallpaper.url.startsWith('data:')) {
                const legacyUrl = wallpaper.url;
                const blob = await (await fetch(wallpaper.url)).blob();
                await this._storeWallpaperBlob(wallpaper.id, blob, wallpaper.type);
                wallpaper.url = `indexeddb:${wallpaper.id}`;
                if (typeof wallpaper.thumbnail === 'string' && wallpaper.thumbnail.startsWith('data:')) {
                    wallpaper.thumbnail = `indexeddb:${wallpaper.id}`;
                }
                if (legacyUrl === legacyActiveUrl) activeWallpaperId = wallpaper.id;
                changed = true;
            }
        }
        if (changed && !this.speichereWallpaperListe(wallpapers)) throw new Error('Migrierte Wallpaper-Liste konnte nicht gespeichert werden.');

        if (typeof legacyActiveUrl === 'string' && legacyActiveUrl.startsWith('data:')) {
            const wallpaper = activeWallpaperId
                ? wallpapers.find(item => item.id === activeWallpaperId)
                : null;
            if (wallpaper) {
                delete settings.hintergrundUrl;
                settings.hintergrundWallpaperId = wallpaper.id;
                settings.backgroundType = wallpaper.type;
                if (!this.speichern(settings)) throw new Error('Migrierte Hintergrund-Einstellung konnte nicht gespeichert werden.');
            } else {
                const id = `wallpaper_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
                const blob = await (await fetch(legacyActiveUrl)).blob();
                await this._storeWallpaperBlob(id, blob, settings.backgroundType || 'static');
                const migrated = this.fügeWallpaperHinzu(`indexeddb:${id}`, settings.backgroundType || 'static');
                if (!migrated) throw new Error('Alter Hintergrund konnte nicht in die Galerie migriert werden.');
                delete settings.hintergrundUrl;
                settings.hintergrundWallpaperId = migrated.id;
                if (!this.speichern(settings)) throw new Error('Migrierte Hintergrund-Einstellung konnte nicht gespeichert werden.');
            }
        }
    },

    async _restoreSavedBackground() {
        const settings = this.laden();
        if (settings.hintergrundWallpaperId) {
            // The setting stores the gallery item's ID; the blob ID may differ.
            // Resolve through the gallery record first, then support older records
            // where both IDs were the same.
            const wallpaper = this.ladeWallpaperListe().find(item => item.id === settings.hintergrundWallpaperId);
            const storedUrl = wallpaper?.url || `indexeddb:${settings.hintergrundWallpaperId}`;
            const url = await this.resolveWallpaperUrl(storedUrl);
            this.ladeHintergrund(url, settings.backgroundType || wallpaper?.type);
        } else if (settings.hintergrundUrl) {
            this.ladeHintergrund(settings.hintergrundUrl, settings.backgroundType);
        }
        this.syncMaterialYou();
    },
};

// Initialisiere beim Laden der Seite
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Nutzerspeicher.init());
} else {
    Nutzerspeicher.init();
}

window.Nutzerspeicher = Nutzerspeicher;
