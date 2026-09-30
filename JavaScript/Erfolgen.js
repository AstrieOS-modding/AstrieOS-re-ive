/* Local user status and achievement progress. No data leaves the browser. */
const UserStatus = {
    storageKey: 'astrieos-user-status-v1',
    idleAfter: 60_000,
    data: null,
    listeners: new Set(),
    lastTick: 0,
    lastActivity: 0,
    notificationsReady: false,

    init() {
        const now = Date.now();
        this.data = this._load();
        this.data.visits += 1;
        this.data.firstSeen ||= now;
        this.data.lastVisit = now;
        this.lastTick = now;
        this.lastActivity = now;
        this._updateAchievements(false);
        this._save();

        ['pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach((eventName) => {
            document.addEventListener(eventName, (event) => this._recordActivity(event), { passive: true });
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.lastActivity = Date.now();
            this._save();
        });
        window.addEventListener('error', () => {
            this.data.errors += 1;
            this._updateAchievements();
            this._saveAndNotify();
        });
        window.addEventListener('pagehide', () => this._save());
        window.setInterval(() => this._tick(), 1000);
        this.notificationsReady = true;
        this._notify();
    },

    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.snapshot());
        return () => this.listeners.delete(listener);
    },

    snapshot() {
        const unlocked = Object.keys(this.data.achievements).filter((id) => this.data.achievements[id]);
        return { ...this.data, activeSession: this._activeSession(Date.now()), unlocked, unlockedCount: unlocked.length };
    },

    _recordActivity(event) {
        this.lastActivity = Date.now();
        if (event.type === 'pointerdown' && event.button !== undefined && event.button !== 0) return;
        if (event.type === 'pointerdown') {
            this.data.clicks += 1;
            this._updateAchievements();
        }
    },

    _tick() {
        const now = Date.now();
        const elapsed = Math.max(0, Math.min(now - this.lastTick, 10_000));
        this.lastTick = now;
        if (!document.hidden) {
            if (now - this.lastActivity < this.idleAfter) this.data.activeMilliseconds += elapsed;
            else this.data.afkMilliseconds += elapsed;
        }
        this.data.longestSessionMilliseconds = Math.max(this.data.longestSessionMilliseconds, this._activeSession(now));
        this._updateAchievements();
        this._saveAndNotify();
    },

    _activeSession(now) {
        return this.data.activeMilliseconds - this.data.sessionStartActiveMilliseconds +
            (!document.hidden && now - this.lastActivity < this.idleAfter ? Math.max(0, now - this.lastTick) : 0);
    },

    _updateAchievements(announce = this.notificationsReady) {
        this._unlock('first_visit', true, announce);
        this._unlock('return_visit', this.data.visits >= 2, announce);
        this._unlock('afk', this.data.afkMilliseconds >= 60_000, announce);
        this._unlock('clicker', this.data.clicks >= 100, announce);
        this._unlock('first_day', this.data.activeMilliseconds >= 86_400_000, announce);
        this._unlock('mod_collector', false, announce); // Reserved until the mod loader exists.
        this._unlock('controller_gerate', false, announce);
        this._unlock('music_jammer', false, announce);
        this._unlock('october', new Date().getMonth() === 9, announce);
        this._unlock('error', this.data.errors >= 1, announce);
    },

    _unlock(id, condition, announce) {
        if (!condition || this.data.achievements[id]) return;
        this.data.achievements[id] = true;
        if (announce) this._showAchievementNotification(id);
    },

    _showAchievementNotification(id) {
        const messages = {
            first_visit: ['Erfolg freigeschaltet', 'Willkommen bei AstrieOS!'],
            return_visit: ['Erfolg freigeschaltet', 'Du bist zurück'],
            afk: ['Erfolg freigeschaltet', 'Away from keyboard'],
            clicker: ['Erfolg freigeschaltet', 'Klicker Master'],
            first_day: ['Erfolg freigeschaltet', 'Erster Tag verschwinden'],
            mod_collector: ['Erfolg freigeschaltet', 'Ich brauche … mehr Mods'],
            october: ['Erfolg freigeschaltet', 'Sehr spooky … BOO!'],
            controller_gerate: ['Erfolg freigeschaltet', 'Extra geräten'],
            music_jammer: ['Erfolg freigeschaltet', 'Musik fans'],
            error: ['Erfolg freigeschaltet', 'Oops …']
        };
        const [heading, description] = messages[id] || ['Erfolg freigeschaltet', id];
        let region = document.querySelector('.Achievement-notifications');
        if (!region) {
            region = document.createElement('div');
            region.className = 'Achievement-notifications';
            region.setAttribute('aria-live', 'polite');
            document.body.append(region);
        }
        const notification = document.createElement('div');
        notification.className = 'Achievement-notification';
        notification.innerHTML = `<img src="/Res/Bild/Icon/Topbar/trophy_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg" alt=""><div><strong>${heading}</strong><span>${description}</span></div>`;
        region.append(notification);
        if (typeof Sound !== 'undefined') Sound.play('tada-meme');
        window.setTimeout(() => {
            notification.classList.add('is-leaving');
            window.setTimeout(() => notification.remove(), 220);
        }, 5_000);
    },

    // Console helpers: test popups without changing saved progress.
    testAchievement(...ids) {
        const requested = ids.flat().filter(Boolean);
        const valid = requested.filter((id) => Object.hasOwn(this.achievementNames, id));
        const invalid = requested.filter((id) => !Object.hasOwn(this.achievementNames, id));
        valid.forEach((id) => this._showAchievementNotification(id));
        if (invalid.length) console.warn('Unbekannte Erfolgs-IDs:', invalid.join(', '));
        return valid;
    },

    // Persistent variant for testing the progress counter and unlocked card state.
    unlockForTest(...ids) {
        const unlocked = this.testAchievement(...ids);
        unlocked.forEach((id) => { this.data.achievements[id] = true; });
        this._saveAndNotify();
        return unlocked;
    },

    achievementNames: {
        first_visit: 'Erster Fehler',
        return_visit: 'Du bist zurück',
        afk: 'Away from keyboard',
        clicker: 'Klicker Master',
        first_day: 'Erster Tag verschwinden',
        mod_collector: 'Ich brauche … mehr Mods',
        music_jammer: 'Musik fans',
        controller_gerate: 'Extra geräten',
        october: 'Sehr spooky … BOO!',
        error: 'Oops …'
    },

    _load() {
        const defaults = {
            visits: 0, firstSeen: null, lastVisit: null, clicks: 0, errors: 0,
            activeMilliseconds: 0, afkMilliseconds: 0, longestSessionMilliseconds: 0,
            sessionStartActiveMilliseconds: 0, achievements: {}
        };
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey));
            const data = { ...defaults, ...(saved || {}) };
            data.achievements = { ...defaults.achievements, ...(saved?.achievements || {}) };
            data.sessionStartActiveMilliseconds = data.activeMilliseconds;
            return data;
        } catch {
            return defaults;
        }
    },

    _saveAndNotify() { this._save(); this._notify(); },
    _save() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.data)); } catch { /* Storage is optional. */ }
    },
    _notify() { this.listeners.forEach((listener) => listener(this.snapshot())); }
};

function formatUserDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    const remainingSeconds = seconds % 60;
    return days > 0
        ? `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
        : `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

UserStatus.init();
