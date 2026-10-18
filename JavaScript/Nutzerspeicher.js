const Nutzerspeicher = {
    STORAGE_KEY: 'astrieos_user_settings',
    ACCOUNTS_KEY: 'astrieos_user_accounts',
    ACTIVE_ACCOUNT_KEY: 'astrieos_active_account',
    WALLPAPERS_KEY: 'astrieos_wallpapers',

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

        // Initialisiere Konten-System
        this.initialisiereKonten();

        // Prüfe ob Benutzername gespeichert ist (für Kompatibilität)
        if (settings.username) {
            document.getElementById('username').textContent = settings.username;
        }

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

    /**
     * Speichert spezifische Hintergrund-URL mit Typ
     */
    hintergrundSpeichern(url, type = 'static') {
        const einstellungen = this.laden();
        einstellungen.hintergrundUrl = url;
        einstellungen.hintergrundDatum = new Date().toISOString();
        einstellungen.backgroundType = type;
        this.speichern(einstellungen);
    },

    /**
     * Lädt Hintergrund-URL und Typ
     */
    hintergrundLaden() {
        const einstellungen = this.laden();
        return {
            url: einstellungen.hintergrundUrl || null,
            type: einstellungen.backgroundType || 'static'
        };
    },

    /**
     * Setzt den Hintergrund auf Standard zurück
     */
    hintergrundLöschen() {
        const einstellungen = this.laden();
        delete einstellungen.hintergrundUrl;
        delete einstellungen.backgroundType;
        this.speichern(einstellungen);

        const standardUrl = '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
        this.ladeHintergrund(standardUrl, 'static');
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
        }

        switch (type) {
            case 'video':
                if (videoElement) {
                    videoElement.src = url;
                    videoElement.style.display = 'block';
                    videoElement.load();
                    videoElement.play().catch(e => {
                        console.error('[Nutzerspeicher] Video Playback Fehler:', e);
                        if (imgElement) {
                            imgElement.src = '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
                            imgElement.style.display = 'block';
                        }
                    });
                }
                break;

            case 'live':
                if (imgElement) {
                    imgElement.src = url;
                    imgElement.style.objectFit = 'contain';
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
        this.speichereWallpaperListe(wallpapers);

        return newWallpaper;
    },

    /**
     * Entfernt ein Wallpaper aus der Liste
     * @param {string} id - Wallpaper-ID
     * @returns {boolean} Erfolg
     */
    entferneWallpaper(id) {
        let wallpapers = this.ladeWallpaperListe();
        const index = wallpapers.findIndex(wp => wp.id === id);

        if (index === -1) {
            console.error('[Nutzerspeicher] Wallpaper nicht gefunden:', id);
            return false;
        }

        wallpapers.splice(index, 1);
        this.speichereWallpaperListe(wallpapers);
        return true;
    },

    /**
     * Setzt ein Wallpaper als aktuellen Hintergrund
     * @param {string} id - Wallpaper-ID
     */
    setzeWallpaperAlsAktiv(id) {
        const wallpapers = this.ladeWallpaperListe();
        const wallpaper = wallpapers.find(wp => wp.id === id);

        if (!wallpaper) {
            console.error('[Nutzerspeicher] Wallpaper nicht gefunden:', id);
            return false;
        }

        // Aktualisiere aktiven Status
        const updatedWallpapers = wallpapers.map(wp => ({
            ...wp,
            isCurrent: wp.id === id
        }));

        this.speichereWallpaperListe(updatedWallpapers);
        this.hintergrundSpeichern(wallpaper.url, wallpaper.type);
        this.ladeHintergrund(wallpaper.url, wallpaper.type);

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
     * Speichert eine Datei als Wallpaper (Base64)
     * @param {File} file - Hochgeladene Datei
     * @param {string} type - Typ: 'static', 'live', oder 'video'
     * @param {Function} callback - Optional: Callback nach erfolgreichem Speichern
     */
    speichereDateiAlsHintergrund(file, type = 'static', callback = null) {
        const reader = new FileReader();

        reader.onload = (event) => {
            const base64Url = event.target.result;
            // Füge zur Liste hinzu
            this.fügeWallpaperHinzu(base64Url, type);
            // Setze als aktiv
            const wallpapers = this.ladeWallpaperListe();
            const newWallpaper = wallpapers[0];
            if (newWallpaper) {
                this.setzeWallpaperAlsAktiv(newWallpaper.id);
            }
            if (callback) callback(true);
        };

        reader.onerror = (error) => {
            console.error('[Nutzerspeicher] Fehler beim Lesen der Datei:', error);
            if (callback) callback(false, error);
        };

        reader.readAsDataURL(file);
    },

    /**
     * Speichert ein Video als Wallpaper
     * @param {File} file - Hochgeladene Videodatei
     * @param {Function} callback - Optional: Callback nach erfolgreichem Speichern
     */
    speichereVideoAlsHintergrund(file, callback = null) {
        const reader = new FileReader();

        reader.onload = (event) => {
            const base64Url = event.target.result;
            this.fügeWallpaperHinzu(base64Url, 'video');
            const wallpapers = this.ladeWallpaperListe();
            const newWallpaper = wallpapers[0];
            if (newWallpaper) {
                this.setzeWallpaperAlsAktiv(newWallpaper.id);
            }
            if (callback) callback(true);
        };

        reader.onerror = (error) => {
            console.error('[Nutzerspeicher] Fehler beim Lesen der Videodatei:', error);
            if (callback) callback(false, error);
        };

        reader.readAsDataURL(file);
    },

    /**
     * Speichert Wallhaven-Bild-URL
     */
    speichereWallhavenHintergrund(wallhavenUrl) {
        const direkteUrl = this.konvertiereWallhavenUrl(wallhavenUrl);
        // Füge zur Liste hinzu
        const newWallpaper = this.fügeWallpaperHinzu(direkteUrl, 'static');
        // Setze als aktiv
        if (newWallpaper) {
            this.setzeWallpaperAlsAktiv(newWallpaper.id);
        }
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
        } catch (error) {
            console.error('[Nutzerspeicher] Fehler beim Speichern der Konten:', error);
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
    }
};

// Initialisiere beim Laden der Seite
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Nutzerspeicher.init());
} else {
    Nutzerspeicher.init();
}

window.Nutzerspeicher = Nutzerspeicher;