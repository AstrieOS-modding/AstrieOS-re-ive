/**
 * Nutzerkonto-Verwaltung für AstrieOS
 * Verwaltet das Nutzercenter-UI und die Interaktion mit dem Multi-Konto-System
 * Arbeitet mit den bestehenden toggle.js-Funktionen zusammen
 */
const Nutzerkonto = {
    // Referenzen auf DOM-Elemente
    userCenterElement: null,
    userCustomElement: null,
    kontoDashboard: null,

    /**
     * Initialisiert das Nutzerkonto-System
     */
    init() {
        // Warte auf das Nutzercenter-Element (wird von ui.js geladen)
        const waitForElement = setInterval(() => {
            this.userCenterElement = document.querySelector('.PLaceholder-nutzercenter');
            this.userCustomElement = document.querySelector('.Placeholder-usercustom');
            this.kontoDashboard = document.querySelector('#konto-dashboard') || 
                                  this.userCenterElement?.querySelector('.Placeholder-dashboard');

            if (this.userCenterElement && this.userCustomElement && this.kontoDashboard) {
                clearInterval(waitForElement);
                this.setupEventHandlers();
                this.aktualisiereKontoDashboard();
                this.ladeUndZeigeBenutzerdaten();
                console.log('[Nutzerkonto] Initialisiert');
            }
        }, 100);

        // Falls das Element bereits existiert
        if (this.userCenterElement && this.userCustomElement && this.kontoDashboard) {
            this.setupEventHandlers();
            this.aktualisiereKontoDashboard();
            this.ladeUndZeigeBenutzerdaten();
        }
    },

    /**
     * Erstellt die Konto-Buttons im Dashboard
     */
    aktualisiereKontoDashboard() {
        if (!this.kontoDashboard || typeof Nutzerspeicher === 'undefined') return;

        // Dashboard leeren
        this.kontoDashboard.innerHTML = '';

        const konten = Nutzerspeicher.getAlleKonten();
        const aktiveId = Nutzerspeicher.getAktiveKontoId();

        // Für jedes Konto einen Button erstellen
        konten.forEach(konto => {
            const button = document.createElement('div');
            button.className = 'Placeholder-user-btn';
            button.dataset.kontoId = konto.id;
            
            // Wenn aktiv, hervorheben
            if (konto.id === aktiveId) {
                button.classList.add('aktiv');
            }

            const avatar = document.createElement('img');
            avatar.className = 'Placeholder-pfp-icon';
            avatar.src = konto.profilbildUrl || '/Res/Bild/Logo/AddText_07-03-07.27.32.png';
            avatar.width = 64;
            avatar.height = 64;
            const label = document.createElement('p');
            const username = document.createElement('span');
            username.textContent = konto.username || 'Gast!';
            label.appendChild(username);
            button.append(avatar, label);

            // Event-Listener hinzufügen
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.wechsleKonto(konto.id);
            });

            this.kontoDashboard.appendChild(button);
        });

        console.log('[Nutzerkonto] Konto-Dashboard aktualisiert:', konten.length, 'Konten');
    },

    /**
     * Zeigt Dialog zum Erstellen eines neuen Kontos
     */
    async zeigeNeuesKontoDialog() {
        const username = await Popup.prompt('Neuen Benutzernamen eingeben:', {
            title: 'Konto erstellen',
            inputLabel: 'Benutzername',
            value: 'Nutzer' + Math.floor(Math.random() * 1000),
            confirmLabel: 'Erstellen'
        });
        
        if (username && username.trim()) {
            this.erstelleNeuesKonto(username.trim());
        }
    },

    /**
     * Erstellt ein neues Konto
     * @param {string} username - Benutzername
     */
    async erstelleNeuesKonto(username) {
        if (typeof Nutzerspeicher === 'undefined') {
            console.error('[Nutzerkonto] Nutzerspeicher nicht verfügbar');
            return;
        }

        const neuesKonto = Nutzerspeicher.erstelleKonto(username);
        
        if (neuesKonto) {
            // Wechsle zum neuen Konto
            Nutzerspeicher.wechsleKonto(neuesKonto.id);
            
            // UI aktualisieren
            this.aktualisiereKontoDashboard();
            this.ladeUndZeigeBenutzerdaten();
            
            // Benutzercenter öffnen
            if (typeof openNutzer_custom === 'function') {
                openNutzer_custom();
            }
            
            console.log('[Nutzerkonto] Neues Konto erstellt:', username);
            Popup.toast(`Neues Konto „${username}“ erstellt.`, { title: 'Konto erstellt', type: 'success' });
        } else {
            await Popup.alert('Der Benutzername ist bereits vergeben oder ungültig.', { title: 'Konto nicht erstellt', type: 'error' });
        }
    },

    /**
     * Wechselt zu einem anderen Konto
     * @param {string} kontoId - ID des Kontos
     */
    wechsleKonto(kontoId) {
        if (typeof Nutzerspeicher === 'undefined') {
            console.error('[Nutzerkonto] Nutzerspeicher nicht verfügbar');
            return;
        }

        if (Nutzerspeicher.wechsleKonto(kontoId)) {
            this.aktualisiereKontoDashboard();
            this.ladeUndZeigeBenutzerdaten();
            console.log('[Nutzerkonto] Zu Konto gewechselt:', kontoId);
        }
    },

    /**
     * Registriert alle Event-Handler
     */
    setupEventHandlers() {
        if (!this.userCenterElement) return;

        // PFP Upload
        const pfpUpload = this.userCenterElement.querySelector('.Custom-pfp-upload');
        if (pfpUpload) {
            pfpUpload.onclick = (e) => {
                e.stopPropagation();
                this.uploadProfilbild();
            };
        }

        // PFP Bild klickbar
        const pfpImg = this.userCenterElement.querySelector('.Custom-pfp');
        if (pfpImg) {
            pfpImg.onclick = (e) => {
                e.stopPropagation();
                this.uploadProfilbild();
            };
            pfpImg.style.cursor = 'pointer';
        }

        // Banner Upload
        const bannerUpload = this.userCenterElement.querySelector('.nutzerbanner');
        if (bannerUpload) {
            bannerUpload.onclick = (e) => {
                e.stopPropagation();
                this.uploadBanner();
            };
        }

        // Banner Bild klickbar
        const bannerImg = this.userCenterElement.querySelector('.banner-bg');
        if (bannerImg) {
            bannerImg.onclick = (e) => {
                e.stopPropagation();
                this.uploadBanner();
            };
            bannerImg.style.cursor = 'pointer';
        }

        // Konto speichern
        const speichernBtn = this.userCenterElement.querySelector('.nutzerspeicher');
        if (speichernBtn) {
            speichernBtn.onclick = (e) => {
                e.stopPropagation();
                this.speichereBenutzerdaten();
            };
        }

        // Konto löschen
        const loeschenBtn = this.userCenterElement.querySelector('.nutzerwegwerfen');
        if (loeschenBtn) {
            loeschenBtn.onclick = (e) => {
                e.stopPropagation();
                this.loescheAktivesKonto();
            };
        }

        // Buttons im Flex-Button Bereich
        const buttons = this.userCenterElement.querySelectorAll('.Placeholder-flex-button .Placeholder-btn');
        if (buttons.length >= 3) {
            buttons[0].onclick = (e) => {
                e.stopPropagation();
                this.zeigeNeuesKontoDialog();
            }; // Neues Konto erstellen
            buttons[1].onclick = (e) => {
                e.stopPropagation();
                if (typeof openNutzer_custom === 'function') {
                    openNutzer_custom();
                }
            }; // Konto konfigurieren
            buttons[2].onclick = (e) => {
                e.stopPropagation();
                this.loescheAktivesKonto();
            }; // Konto löschen
        }

        // Close Button
        const closeBtn = this.userCenterElement.querySelector('.Placeholder-close');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                if (typeof placeholder_user === 'function') {
                    placeholder_user();
                }
            };
        }
    },

    /**
     * Öffnet das Nutzercenter
     */
    oeffneNutzercenter() {
        if (typeof placeholder_user === 'function') {
            placeholder_user();
        }
    },

    /**
     * Öffnet den Custom-Bereich für Konto-Konfiguration
     */
    openNutzer_custom() {
        if (typeof openNutzer_custom === 'function') {
            openNutzer_custom();
        }
        
        // Benutzerdaten neu laden
        this.ladeUndZeigeBenutzerdaten();
    },

    /**
     * Lädt eine Profilbild-Datei hoch
     */
    uploadProfilbild() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // Sofort im UI anzeigen
                const pfpImg = this.userCenterElement.querySelector('.Custom-pfp');
                const topbarPfp = document.getElementById('userpfp');
                
                const tempUrl = URL.createObjectURL(file);
                
                if (pfpImg) pfpImg.src = tempUrl;
                if (topbarPfp) topbarPfp.src = tempUrl;
                
                // Aktualisiere Dashboard PFP für aktives Konto
                this.aktualisiereKontoDashboard();
                
                // Speichere die Datei
                if (typeof Nutzerspeicher !== 'undefined') {
                    Nutzerspeicher.speichereDateiAlsProfilbild(file);
                }
            }
        };
        input.click();
    },

    /**
     * Lädt eine Banner-Datei hoch
     */
    uploadBanner() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // Sofort im UI anzeigen
                const bannerImg = this.userCenterElement.querySelector('.banner-bg');
                
                const tempUrl = URL.createObjectURL(file);
                
                if (bannerImg) bannerImg.src = tempUrl;
                
                // Speichere die Datei
                if (typeof Nutzerspeicher !== 'undefined') {
                    Nutzerspeicher.speichereDateiAlsBanner(file);
                }
            }
        };
        input.click();
    },

    /**
     * Speichert die Benutzerdaten (Benutzername) für das aktive Konto
     */
    async speichereBenutzerdaten() {
        const usernameInput = this.userCenterElement.querySelector('.custom-username');
        const passwordInput = this.userCenterElement.querySelector('.custom-passwort');
        const removePassword = this.userCenterElement.querySelector('.custom-passwort-entfernen');
        const username = usernameInput ? usernameInput.value.trim() : 'Gast!';

        // Lade aktuelle Benutzerdaten
        if (typeof Nutzerspeicher !== 'undefined') {
            const aktivesKonto = Nutzerspeicher.getAktivesKonto();
            
            if (aktivesKonto && aktivesKonto.username !== username) {
                // Prüfe ob Benutzername bereits existiert
                const konten = Nutzerspeicher.getAlleKonten();
                const nameExists = konten.some(k => k.username === username && k.id !== aktivesKonto.id);
                
                if (nameExists) {
                    await Popup.alert('Dieser Benutzername ist bereits vergeben.', { title: 'Name schon vergeben', type: 'warning' });
                    return;
                }
            }
            
            Nutzerspeicher.aktualisiereKonto(Nutzerspeicher.getAktiveKontoId(), {
                username: username
            });

            const password = passwordInput?.value || '';
            if (removePassword?.checked || password) {
                try {
                    await Nutzerspeicher.setKontoPasswort(aktivesKonto.id, removePassword.checked ? '' : password);
                    if (passwordInput) passwordInput.value = '';
                    if (removePassword) removePassword.checked = false;
                } catch (error) {
                    await Popup.alert(error.message || 'Das Passwort konnte nicht gespeichert werden.', { title: 'Passwort nicht gespeichert', type: 'error' });
                    return;
                }
            }
            
            // Aktualisiere UI
            this.aktualisiereKontoDashboard();
            this.ladeUndZeigeBenutzerdaten();
            
            console.log('[Nutzerkonto] Benutzername gespeichert:', username);
        }
    },

    /**
     * Löscht das aktive Konto
     */
    async loescheAktivesKonto() {
        if (typeof Nutzerspeicher === 'undefined') {
            console.error('[Nutzerkonto] Nutzerspeicher nicht verfügbar');
            return;
        }

        const konten = Nutzerspeicher.getAlleKonten();
        const aktivesKonto = Nutzerspeicher.getAktivesKonto();

        if (!aktivesKonto) {
            await Popup.alert('Kein aktives Konto zum Löschen gefunden.', { title: 'Kein aktives Konto', type: 'warning' });
            return;
        }

        // Warnung wenn nur Gast-Konto existiert
        if (konten.length <= 1) {
            await Popup.alert('Das letzte Konto kann nicht gelöscht werden.', { title: 'Konto bleibt erhalten', type: 'warning' });
            return;
        }

        const bestätigt = await Popup.confirm(`Möchtest du das Konto „${aktivesKonto.username}“ wirklich löschen?\n\nDie Kontodaten gehen dabei verloren.`, {
            title: 'Konto löschen',
            type: 'warning',
            confirmLabel: 'Konto löschen'
        });
        
        if (bestätigt) {
            if (Nutzerspeicher.loescheKonto(aktivesKonto.id)) {
                // UI aktualisieren
                this.aktualisiereKontoDashboard();
                this.ladeUndZeigeBenutzerdaten();
                
                // Schließe Custom-Bereich
                if (this.userCustomElement) {
                    this.userCustomElement.style.display = 'none';
                }
                
                console.log('[Nutzerkonto] Aktives Konto gelöscht:', aktivesKonto.username);
                Popup.toast(`Konto „${aktivesKonto.username}“ wurde gelöscht.`, { title: 'Konto gelöscht', type: 'success' });
            }
        }
    },

    /**
     * Lädt Benutzerdaten und zeigt sie im UI an
     */
    ladeUndZeigeBenutzerdaten() {
        if (typeof Nutzerspeicher === 'undefined') {
            console.warn('[Nutzerkonto] Nutzerspeicher nicht verfügbar');
            return;
        }

        const aktivesKonto = Nutzerspeicher.getAktivesKonto();

        if (!aktivesKonto) {
            console.warn('[Nutzerkonto] Kein aktives Konto');
            return;
        }

        // Dashboard Benutzername (falls vorhanden)
        const dashboardUsername = this.userCenterElement.querySelector('#Placeholder-username');
        if (dashboardUsername) {
            dashboardUsername.textContent = aktivesKonto.username;
        }

        // Topbar Benutzername
        const topbarUsername = document.getElementById('username');
        if (topbarUsername) {
            topbarUsername.textContent = aktivesKonto.username;
        }

        // Custom Input
        const usernameInput = this.userCenterElement.querySelector('.custom-username');
        if (usernameInput) {
            usernameInput.value = aktivesKonto.username;
            usernameInput.placeholder = 'Benutzername eingeben...';
        }
        const passwordInput = this.userCenterElement.querySelector('.custom-passwort');
        if (passwordInput) passwordInput.value = '';
        const removePassword = this.userCenterElement.querySelector('.custom-passwort-entfernen');
        if (removePassword) removePassword.checked = false;

        // PFP - Custom-Bereich und Topbar
        const pfpImg = this.userCenterElement.querySelector('.Custom-pfp');
        const topbarPfp = document.getElementById('userpfp');
        
        if (pfpImg) pfpImg.src = aktivesKonto.profilbildUrl;
        if (topbarPfp) topbarPfp.src = aktivesKonto.profilbildUrl;

        // Banner
        const bannerImg = this.userCenterElement.querySelector('.banner-bg');
        if (bannerImg) {
            bannerImg.src = aktivesKonto.bannerUrl;
        }
    }
};

// ========== INITIALISIERUNG ==========

// Initialisiere wenn Nutzerspeicher bereit ist
function initNutzerkonto() {
    if (typeof Nutzerspeicher !== 'undefined') {
        Nutzerkonto.init();
    } else {
        // Warte auf Nutzerspeicher
        setTimeout(initNutzerkonto, 100);
    }
}

// Starte Initialisierung
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNutzerkonto);
} else {
    initNutzerkonto();
}

// Mache Nutzerkonto global verfügbar
window.Nutzerkonto = Nutzerkonto;
