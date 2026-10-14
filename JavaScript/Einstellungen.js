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
 * Ermöglicht Benutzern das Ändern des Hintergrunds über Upload oder externe Dienste
 */

const EinstellungenHintergrund = {
    initialized: false,
    currentBackgroundType: 'static',

    /**
     * Initialisiert die Hintergrund-Einstellungen
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;

        this._attachEventListeners();
        this._loadBackgroundSettings();
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
                    console.error('[EinstellungenHintergrund] WallhavenManager nicht verfügbar');
                }
            });
        }

        const resetButton = document.querySelector('.Hintergrund-standard');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetHintergrund());
        }
    },

    /**
     * Öffnet den Datei-Upload Dialog für Hintergrundbilder und Videos
     */
    openHintergrundUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        // Unterstütze alle Bild- und Videoformate
        input.accept = 'image/*, video/mp4, video/webm, video/mov, video/avi, video/mkv';
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
     * @param {File} file - Hochgeladene Datei
     */
    _handleFileUpload(file) {
        // Dateigröße prüfen - nur Warnung bei sehr großen Dateien (>100MB)
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            if (!confirm(`Die Datei ist sehr groß (${(file.size / (1024 * 1024)).toFixed(2)}MB). Das kann den Browser stark verlangsamen. Trotzdem fortfahren?`)) {
                return;
            }
        }

        // Typ erkennen
        const backgroundType = this._detectBackgroundType(file);
        this.currentBackgroundType = backgroundType;

        // Datei speichern
        if (typeof Nutzerspeicher !== 'undefined') {
            if (backgroundType === 'video') {
                Nutzerspeicher.speichereVideoAlsHintergrund(file, backgroundType);
            } else {
                Nutzerspeicher.speichereDateiAlsHintergrund(file, backgroundType);
            }
        }

        this._showSuccess(`Hintergrund erfolgreich hochgeladen! (Typ: ${backgroundType})`);
    },

    /**
     * Erkennt den Hintergrund-Typ
     * @param {File} file - Datei
     * @returns {string} Typ: 'static', 'live', oder 'video'
     */
    _detectBackgroundType(file) {
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

        return 'static';
    },

    /**
     * Setzt den Hintergrundtyp manuell
     * @param {string} type - 'static', 'live', oder 'video'
     */
    setBackgroundType(type) {
        const validTypes = ['static', 'gif', 'video'];
        if (validTypes.includes(type)) {
            this.currentBackgroundType = type;
            if (typeof Nutzerspeicher !== 'undefined') {
                const settings = Nutzerspeicher.laden();
                settings.backgroundType = type;
                Nutzerspeicher.speichern(settings);
            }
        }
    },

    /**
     * Setzt den Hintergrund auf Standard zurück
     */
    resetHintergrund() {
        if (typeof Nutzerspeicher !== 'undefined') {
            Nutzerspeicher.hintergrundLöschen();
            this.currentBackgroundType = 'static';
        }
        this._showSuccess('Hintergrund auf Standard zurückgesetzt!');
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

    /**
     * Zeigt eine Fehlermeldung an
     */
    _showError(message) {
        if (typeof Benachrichtigung !== 'undefined') {
            new Benachrichtigung('Fehler', message, '/Res/Bild/Icon/Topbar/error_24dp_FF0000_FILL1_wght400_GRAD0_opsz24.svg');
        } else {
            alert(`Fehler: ${message}`);
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
