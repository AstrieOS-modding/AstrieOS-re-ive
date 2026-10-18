/* Settings-only wiring for version controls and safe update-debug tools. */
const SettingsDebugTools = {
    initialized: false,

    init() {
        const attach = () => {
            if (this.initialized || !document.querySelector('[data-version-check]')) return;
            this.initialized = true;
            const notifications = typeof ReleaseNotifications !== 'undefined' ? ReleaseNotifications : null;
            if (!notifications) return;

            document.querySelector('[data-version-check]').addEventListener('click', () => this.checkVersion());
            document.querySelector('[data-debug-version-check]')?.addEventListener('click', () => this.checkVersion(true));
            document.querySelector('[data-debug-fiction-update]')?.addEventListener('click', () => {
                notifications.showFictionalUpdate();
                this._setDebugStatus('Fiction Update angezeigt. "Herunterladen" erzeugt nur eine lokale Testdatei.');
            });
            document.querySelector('[data-update-download]')?.addEventListener('click', () => notifications.downloadRelease(notifications.latestRelease));
            document.querySelector('[data-update-later]')?.addEventListener('click', () => {
                const card = document.querySelector('[data-update-card]');
                if (card) card.hidden = true;
                notifications._setVersionStatus('Du bleibst bei der aktuellen Version.');
            });
            notifications._renderVersionStatus();
        };
        attach();
        document.addEventListener('settings-template-ready', attach, { once: true });
    },

    async checkVersion(isDebug = false) {
        const notifications = typeof ReleaseNotifications !== 'undefined' ? ReleaseNotifications : null;
        if (!notifications) return;
        notifications._setVersionStatus('Prüfe auf neue Releases …');
        if (isDebug) this._setDebugStatus('GitHub-Release wird geprüft …');
        await notifications.checkForRelease();
        if (!notifications.latestRelease) {
            notifications._setVersionStatus('Keine Release-Information verfügbar.');
            if (isDebug) this._setDebugStatus('Prüfung fehlgeschlagen oder es gibt noch keinen Release.');
        } else if (isDebug) {
            this._setDebugStatus(`Prüfung fertig: ${notifications.latestRelease.tag_name || 'Release gefunden'}.`);
        }
    },

    _setDebugStatus(message) {
        const status = document.querySelector('[data-debug-update-status]');
        if (status) status.textContent = message;
    }
};

SettingsDebugTools.init();

/**
 * Einstellungen-System für Hintergrund-Verwaltung
 * Unterstützt: Wallpaper-Liste, Statische Bilder, Animierte GIFs, Videos
 */

const EinstellungenHintergrund = {
    initialized: false,
    currentBackgroundType: 'static',

    /**
     * Initialisiert die Hintergrund-Einstellungen
     */
    init() {
        if (this.initialized) {
            this._renderWallpaperListe();
            return;
        }
        this.initialized = true;

        this._attachEventListeners();
        this._loadBackgroundSettings();
        this._renderWallpaperListe(); // Liste beim Start anzeigen

        console.log('[EinstellungenHintergrund] Initialisiert');
    },

    /**
     * Lädt gespeicherte Hintergrund-Einstellungen
     */
    _loadBackgroundSettings() {
        if (typeof Nutzerspeicher !== 'undefined') {
            const settings = Nutzerspeicher.laden();
            if (settings.backgroundType) {
                this.currentBackgroundType = settings.backgroundType;
            }
        }
    },

    /**
     * Befestigt Event Listener an die UI-Elemente
     */
    _attachEventListeners() {
        const uploadButton = document.querySelector('.Hintergrund-nutzer-upload');
        if (uploadButton) {
            uploadButton.addEventListener('click', () => this.openHintergrundUpload());
        }

        const wallhavenButton = document.querySelector('.Hintergrund-nutzer-wallhaven');
        if (wallhavenButton) {
            wallhavenButton.addEventListener('click', () => {
                if (typeof WallhavenManager !== 'undefined') {
                    WallhavenManager.openWallhavenWindow();
                } else {
                    this._showError('Wallhaven-Integration nicht verfügbar!');
                }
            });
        }

        const resetButton = document.querySelector('.Hintergrund-standard');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetHintergrund());
        }
    },

    /**
     * Öffnet den Datei-Upload Dialog
     */
    openHintergrundUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*, video/*, image/gif, image/apng';
        input.style.display = 'none';

        input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this._handleFileUpload(file);
            }
            document.body.removeChild(input);
        });

        document.body.appendChild(input);
        input.click();
    },

    /**
     * Verarbeitet hochgeladene Datei
     */
    async _handleFileUpload(file) {
        if (typeof Nutzerspeicher === 'undefined') {
            this._showError('Nutzerspeicher nicht verfügbar!');
            return;
        }

        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            const confirmed = await Popup.confirm(`Die Datei ist sehr groß (${(file.size / (1024 * 1024)).toFixed(2)} MB). Möchtest du fortfahren?`, {
                title: 'Große Datei',
                type: 'warning',
                confirmLabel: 'Trotzdem laden'
            });
            if (!confirmed) {
                return;
            }
        }

        const backgroundType = this._detectBackgroundType(file);
        this.currentBackgroundType = backgroundType;

        // Callback-Funktion für nach dem Speichern
        const onComplete = (success, error) => {
            if (success) {
                this._renderWallpaperListe();
                this._showSuccess(`Hintergrund hochgeladen! (Typ: ${backgroundType})`);
            } else {
                this._showError(`Fehler beim Hochladen: ${error?.message || 'Unbekannter Fehler'}`);
            }
        };

        if (backgroundType === 'video') {
            Nutzerspeicher.speichereVideoAlsHintergrund(file, onComplete);
        } else {
            Nutzerspeicher.speichereDateiAlsHintergrund(file, backgroundType, onComplete);
        }
    },

    /**
     * Erkennt den Hintergrund-Typ
     */
    _detectBackgroundType(file) {
        const fileName = file.name.toLowerCase();
        const fileType = file.type.toLowerCase();

        if (fileType.startsWith('video/') ||
            fileName.endsWith('.mp4') ||
            fileName.endsWith('.webm') ||
            fileName.endsWith('.mov')) {
            return 'video';
        }

        if (fileType === 'image/gif' ||
            fileName.endsWith('.gif') ||
            fileName.endsWith('.apng')) {
            return 'live';
        }

        return 'static';
    },

    /**
     * Rendert die Wallpaper-Liste
     */
    async _renderWallpaperListe() {
        if (typeof Nutzerspeicher === 'undefined') return;

        if (Nutzerspeicher._wallpaperStorageReady) await Nutzerspeicher._wallpaperStorageReady;

        const wallpapers = Nutzerspeicher.ladeWallpaperListe();
        const container = document.querySelector('.Hintergrund-btn');

        if (!container) return;

        container.replaceChildren();

        if (wallpapers.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'Hintergrund-leer';
            emptyMessage.textContent = 'Keine Wallpapers in der Galerie :(';
            container.appendChild(emptyMessage);
            return;
        }

        const gallery = document.createElement('div');
        gallery.className = 'wallpaper-gallery';

        const resolvedWallpapers = await Promise.all(wallpapers.map(async wallpaper => {
            try {
                return {
                    ...wallpaper,
                    resolvedUrl: await Nutzerspeicher.resolveWallpaperUrl(wallpaper.url),
                    resolvedThumbnail: await Nutzerspeicher.resolveWallpaperUrl(wallpaper.thumbnail || wallpaper.url)
                };
            } catch (error) {
                console.error('[Einstellungen] Wallpaper-Datei konnte nicht angezeigt werden:', error);
                return { ...wallpaper, resolvedUrl: '', resolvedThumbnail: '' };
            }
        }));

        resolvedWallpapers.forEach(wallpaper => {
            const isCurrent = Boolean(wallpaper.isCurrent);
            const isVideo = wallpaper.type === 'video';
            const item = document.createElement('div');
            item.className = `wallpaper-item${isCurrent ? ' active' : ''}`;
            item.title = String(wallpaper.name || 'Wallpaper');
            item.addEventListener('click', () => this.setWallpaper(wallpaper.id));

            const thumbnail = document.createElement('div');
            thumbnail.className = 'wallpaper-thumbnail';
            if (isVideo) {
                const video = document.createElement('video');
                video.autoplay = true;
                video.loop = true;
                video.muted = true;
                video.playsInline = true;
                video.className = 'wallpaper-video-thumb';
                if (String(wallpaper.url).startsWith('data:')) video.controls = true;
                const source = document.createElement('source');
                source.src = wallpaper.resolvedUrl;
                source.type = this._getVideoMimeType(String(wallpaper.resolvedUrl));
                video.appendChild(source);
                thumbnail.appendChild(video);
            } else {
                const image = document.createElement('img');
                image.src = wallpaper.resolvedThumbnail || wallpaper.resolvedUrl || '';
                image.alt = String(wallpaper.name || 'Wallpaper');
                image.loading = 'lazy';
                thumbnail.appendChild(image);
            }

            const info = document.createElement('div');
            info.className = 'wallpaper-info';
            const name = document.createElement('span');
            name.className = 'wallpaper-name';
            name.textContent = String(wallpaper.name || 'Wallpaper');
            const type = document.createElement('span');
            type.className = 'wallpaper-type';
            type.textContent = this._getTypeLabel(wallpaper.type);
            info.append(name, type);

            const actions = document.createElement('div');
            actions.className = 'wallpaper-actions';
            const makeAction = (className, title, icon, onClick) => {
                const button = document.createElement('button');
                button.className = className;
                button.title = title;
                button.addEventListener('click', onClick);
                const iconImage = document.createElement('img');
                iconImage.src = icon;
                iconImage.width = 18;
                iconImage.height = 18;
                iconImage.alt = '';
                button.appendChild(iconImage);
                return button;
            };
            actions.append(
                makeAction('wallpaper-set-btn', 'Als Hintergrund setzen', '/Res/Bild/Icon/EInstellungen/Hintergrund formaten/image_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg', event => {
                    event.stopPropagation();
                    this.setWallpaper(wallpaper.id);
                }),
                makeAction('wallpaper-delete-btn', 'Löschen', '/Res/Bild/Icon/Datein/Folder/delete_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg', event => {
                    event.stopPropagation();
                    this.deleteWallpaper(wallpaper.id, event);
                })
            );

            item.append(thumbnail, info, actions);
            if (isCurrent) {
                const badge = document.createElement('div');
                badge.className = 'wallpaper-current-badge';
                badge.textContent = 'Aktiv';
                item.appendChild(badge);
            }
            gallery.appendChild(item);
        });

        container.appendChild(gallery);
    },

    /**
     * Setzt ein Wallpaper als Hintergrund
     * @param {string} id - Wallpaper-ID
     */
    async setWallpaper(id) {
        if (typeof Nutzerspeicher !== 'undefined') {
            if (await Nutzerspeicher.setzeWallpaperAlsAktiv(id)) {
                this._renderWallpaperListe();
                this._showSuccess('Hintergrund geändert!');
            } else {
                this._showError('Hintergrund konnte nicht geladen oder gespeichert werden.');
            }
        }
    },

    /**
     * Löscht ein Wallpaper
     * @param {string} id - Wallpaper-ID
     * @param {Event} event - Event-Objekt
     */
    async deleteWallpaper(id, event) {
        if (event) event.stopPropagation();

        if (await Popup.confirm('Möchtest du dieses Wallpaper wirklich löschen?', {
            title: 'Wallpaper löschen',
            type: 'warning',
            confirmLabel: 'Löschen'
        })) {
            if (typeof Nutzerspeicher !== 'undefined') {
                // Speichere das Wallpaper-Objekt BEVOR es gelöscht wird
                const wallpapersBefore = Nutzerspeicher.ladeWallpaperListe();
                const deletedWallpaper = wallpapersBefore.find(wp => wp.id === id);

                const success = await Nutzerspeicher.entferneWallpaper(id);

                if (success) {
                    // Prüfe ob gelöschtes Wallpaper aktiv war
                    const settings = Nutzerspeicher.laden();
                    if (deletedWallpaper && (deletedWallpaper.url === settings.hintergrundUrl || deletedWallpaper.id === settings.hintergrundWallpaperId)) {
                        // Wenn aktives Wallpaper gelöscht wurde, setze Standard
                        if (typeof Nutzerspeicher.standardHintergrund === 'function') {
                            Nutzerspeicher.standardHintergrund();
                        } else {
                            const standardUrl = '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
                            Nutzerspeicher.hintergrundSpeichern(standardUrl, 'static');
                            Nutzerspeicher.ladeHintergrund(standardUrl, 'static');
                        }
                    }

                    this._renderWallpaperListe();
                    this._showSuccess('Wallpaper gelöscht!');
                } else {
                    this._showError('Fehler beim Löschen des Wallpapers');
                }
            }
        }
    },

    /**
     * Gibt Label für Typ zurück
     */
    _getTypeLabel(type) {
        switch (type) {
            case 'video': return 'Video';
            case 'live': return 'Animiert';
            default: return 'Bild';
        }
    },

    /**
     * Setzt den Hintergrund auf Standard zurück
     */
    resetHintergrund() {
        if (typeof Nutzerspeicher !== 'undefined') {
            const standardUrl = '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
            Nutzerspeicher.hintergrundSpeichern(standardUrl, 'static');
            Nutzerspeicher.ladeHintergrund(standardUrl, 'static');
            this.currentBackgroundType = 'static';
        }
        this._renderWallpaperListe();
        this._showSuccess('Hintergrund auf Standard zurückgesetzt!');
    },

    /* ===== HILFSMETHODEN ===== */

    /**
     * Gibt den korrekten MIME-Type für Video-URLs zurück
     * @param {string} url - Video-URL
     * @returns {string} MIME-Type
     */
    _getVideoMimeType(url) {
        if (url.startsWith('data:')) {
            const match = url.match(/^data:(video\/[^;]+)/);
            return match ? match[1] : 'video/mp4';
        }
        const ext = url.split('.').pop().toLowerCase();
        const mimeTypes = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
            mkv: 'video/x-matroska'
        };
        return mimeTypes[ext] || 'video/mp4';
    },

    /* ===== BESTEHENDE METHODEN ===== */

    setBackgroundType(type) {
        const validTypes = ['static', 'live', 'video'];
        if (validTypes.includes(type)) {
            this.currentBackgroundType = type;
            if (typeof Nutzerspeicher !== 'undefined') {
                const settings = Nutzerspeicher.laden();
                settings.backgroundType = type;
                Nutzerspeicher.speichern(settings);
            }
        }
    },

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
                border-radius: 14px;
                z-index: 100000000;
                animation: slideUp 0.3s ease;
            `;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    },

    _showError(message) {
        if (typeof Popup !== 'undefined') {
            Popup.alert(message, { title: 'Fehler', type: 'error' });
        } else {
            console.error(`[Einstellungen] ${message}`);
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        SettingsDebugTools.init();
        EinstellungenHintergrund.init();
    });
} else {
    SettingsDebugTools.init();
    EinstellungenHintergrund.init();
}

window.EinstellungenHintergrund = EinstellungenHintergrund;
