const Nutzerspeicher = {
    STORAGE_KEY: 'astrieos_user_settings',

    /**
     * Initialisiert das Nutzerspeicher-System
     */
    init() {
        // Lade gespeicherte Einstellungen beim Start
        const settings = this.laden();

        // Prüfe ob Hintergrund gespeichert ist und lade ihn
        if (settings.hintergrundUrl) {
            this.ladeHintergrund(settings.hintergrundUrl, settings.backgroundType);
        }

        // Prüfe ob Benutzername gespeichert ist
        if (settings.username) {
            document.getElementById('username').textContent = settings.username;
        }

        console.log('[Nutzerspeicher] Initialisiert. Einstellungen:', settings);
    },

    /**
     * Speichert Einstellungen im localStorage
     * @param {Object} einstellungen - Einstellungen-Objekt
     */
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
     * @returns {Object} Gespeicherte Einstellungen oder leeres Objekt
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

    /**
     * Speichert spezifische Hintergrund-URL mit Typ
     * @param {string} url - URL des Hintergrundes
     * @param {string} type - Typ: 'static', 'live', oder 'video'
     */
    hintergrundSpeichern(url, type = 'static') {
        const einstellungen = this.laden();
        einstellungen.hintergrundUrl = url;
        einstellungen.hintergrundDatum = new Date().toISOString();
        einstellungen.backgroundType = type;
        this.speichern(einstellungen);
    },

    /**
     * Lädt Hintergrund-URL und Typ aus dem Speicher
     * @returns {Object} Hintergrund-URL und Typ
     */
    hintergrundLaden() {
        const einstellungen = this.laden();
        return {
            url: einstellungen.hintergrundUrl || null,
            type: einstellungen.backgroundType || 'static'
        };
    },

    /**
     * Setzt den Hintergrund direkt im DOM
     * @param {string} url - URL des Hintergrundes
     * @param {string} type - Typ: 'static', 'live', oder 'video'
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
        }

        // Typ-basierte Behandlung
        switch (type) {
            case 'video':
                if (videoElement) {
                    // Video-Hintergrund
                    videoElement.src = url;
                    videoElement.style.display = 'block';
                    videoElement.load();
                    videoElement.play().catch(e => {
                        console.error('[Nutzerspeicher] Video Playback Fehler:', e);
                        // Fallback zu Bild
                        if (imgElement) {
                            imgElement.src = '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
                            imgElement.style.display = 'block';
                        }
                    });
                }
                break;

            case 'live':
                // Animiertes Bild (GIF/APNG)
                if (imgElement) {
                    imgElement.src = url;
                    imgElement.style.objectFit = 'contain';
                    imgElement.style.display = 'block';
                }
                break;

            default: // 'static'
                // Statisches Bild
                if (imgElement) {
                    imgElement.src = url;
                    imgElement.style.objectFit = 'cover';
                    imgElement.style.display = 'block';
                }
        }

        // Fehlerbehandlung für Bilder
        if (imgElement && type !== 'video') {
            imgElement.onerror = () => {
                console.error('[Nutzerspeicher] Fehler beim Laden:', url);
                imgElement.src = '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
            };
        }
    },

    /**
     * Speichert Benutzername
     * @param {string} username - Benutzername
     */
    benutzernameSpeichern(username) {
        const einstellungen = this.laden();
        einstellungen.username = username;
        this.speichern(einstellungen);

        // Aktualisiere UI
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            usernameElement.textContent = username;
        }
    },

    /**
     * Lädt Benutzername
     * @returns {string} Benutzername oder 'Gast!'
     */
    benutzernameLaden() {
        const einstellungen = this.laden();
        return einstellungen.username || 'Gast!';
    },

    /**
     * Setzt Standard-Hintergrund
     */
    standardHintergrund() {
        const standardUrl = '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
        this.hintergrundSpeichern(standardUrl, 'static');
        this.ladeHintergrund(standardUrl, 'static');
    },

    /**
     * Löscht gespeicherte Hintergrund-URL
     */
    hintergrundLöschen() {
        const einstellungen = this.laden();
        delete einstellungen.hintergrundUrl;
        delete einstellungen.hintergrundDatum;
        delete einstellungen.backgroundType;
        this.speichern(einstellungen);
        this.standardHintergrund();
    },

    /**
     * Speichert eine Datei als Hintergrund (Base64)
     * @param {File} file - Hochgeladene Datei
     * @param {string} type - Typ: 'static', 'live', oder 'video'
     */
    speichereDateiAlsHintergrund(file, type = 'static') {
        const reader = new FileReader();

        reader.onload = (event) => {
            const base64Url = event.target.result;
            this.hintergrundSpeichern(base64Url, type);
            this.ladeHintergrund(base64Url, type);
        };

        reader.onerror = (error) => {
            console.error('[Nutzerspeicher] Fehler beim Lesen der Datei:', error);
        };

        reader.readAsDataURL(file);
    },

    /**
     * Speichert Wallhaven-Bild-URL
     * @param {string} wallhavenUrl - Wallhaven Bild URL
     */
    speichereWallhavenHintergrund(wallhavenUrl) {
        // Konvertiere Wallhaven URL zu direkter Bild-URL
        const direkteUrl = this.konvertiereWallhavenUrl(wallhavenUrl);
        // Standardmäßig als statisch speichern
        this.hintergrundSpeichern(direkteUrl, 'static');
        this.ladeHintergrund(direkteUrl, 'static');
    },

    /**
     * Speichert Video-Hintergrund
     * @param {File} file - Hochgeladene Videodatei
     */
    speichereVideoAlsHintergrund(file) {
        const reader = new FileReader();

        reader.onload = (event) => {
            const base64Url = event.target.result;
            this.hintergrundSpeichern(base64Url, 'video');
            this.ladeHintergrund(base64Url, 'video');
        };

        reader.onerror = (error) => {
            console.error('[Nutzerspeicher] Fehler beim Lesen der Videodatei:', error);
        };

        reader.readAsDataURL(file);
    },

    /**
     * Konvertiert Wallhaven-Seiten-URL zu direkter Bild-URL
     * @param {string} url - Wallhaven Seiten URL
     * @returns {string} Direkte Bild URL
     */
    konvertiereWallhavenUrl(url) {
        if (url.includes('wallhaven.cc/full/')) {
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
    }
};

// Initialisiere beim Laden der Seite
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Nutzerspeicher.init());
} else {
    Nutzerspeicher.init();
}

window.Nutzerspeicher = Nutzerspeicher;