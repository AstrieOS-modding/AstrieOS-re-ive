/*
 * A browser cannot replace files on the server. Netlify deploys the new source;
 * this module downloads that deployed app shell into a waiting service worker.
 */
const AppUpdater = {
    registration: null,
    reloadRequested: false,

    init() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
            .then((registration) => {
                this.registration = registration;
                if (registration.waiting) this._showReady(registration.waiting);
                registration.addEventListener('updatefound', () => this._watchInstallingWorker(registration));
            })
            .catch((error) => console.warn('Update-Service ist nicht verfügbar.', error));

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (this.reloadRequested) window.location.reload();
        });
        document.addEventListener('app-update-request', (event) => {
            event.preventDefault();
            this.downloadUpdate(event.detail.release);
        });
        if (sessionStorage.getItem('astrieos-update-reloaded') === 'true') {
            sessionStorage.removeItem('astrieos-update-reloaded');
            this._announceCurrentVersion();
        }
    },

    async downloadUpdate(release) {
        if (!this.registration) {
            this._showInfo('Das Update-System wird noch gestartet. Bitte versuche es gleich noch einmal.');
            return;
        }
        this._showInfo('Update wird vorbereitet …');
        try {
            const remoteVersion = await this._fetchDeployedVersion();
            const currentVersion = document.querySelector('meta[name="astrieos-version"]')?.content || '0.0.0';
            if (!this._isNewer(remoteVersion, currentVersion)) {
                this._showInfo(`Release ${release?.tag_name || ''} gefunden, aber der neue Netlify-Build ist noch nicht bereit.`);
                return;
            }
            await this.registration.update();
            if (this.registration.waiting) {
                this._showReady(this.registration.waiting, remoteVersion);
            } else {
                this._showInfo('Der neue Build wird noch geladen. Die Benachrichtigung erscheint gleich, sobald er bereit ist.');
            }
        } catch (error) {
            console.warn('Update konnte nicht vorbereitet werden.', error);
            this._showInfo('Update konnte gerade nicht vorbereitet werden.');
        }
    },

    _watchInstallingWorker(registration) {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                this._showReady(worker);
            }
        });
    },

    async _fetchDeployedVersion() {
        const response = await fetch(`/version.json?check=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('version.json konnte nicht geladen werden');
        const data = await response.json();
        if (!data.version) throw new Error('Version fehlt');
        return data.version;
    },

    _showReady(worker, version = '') {
        this._showToast('Hey! Update ist fertig', `Version ${version || 'neu'} ist bereit. Aktuelle Version behalten oder Seite neu laden?`, [
            { label: 'Seite neu laden', primary: true, action: () => this._activateAndReload(worker) },
            { label: 'Später', action: () => {} }
        ]);
        if (typeof Sound !== 'undefined') Sound.play('notification-done');
    },

    _activateAndReload(worker) {
        this.reloadRequested = true;
        sessionStorage.setItem('astrieos-update-reloaded', 'true');
        worker.postMessage({ type: 'SKIP_WAITING' });
    },

    async _announceCurrentVersion() {
        try {
            const version = await this._fetchDeployedVersion();
            this._showToast('Update fertig!', `Du verwendest jetzt die neueste Version (${version}).`, [{ label: 'Super', action: () => {} }]);
            if (typeof Sound !== 'undefined') Sound.play('notification-done');
        } catch {
            this._showToast('Update fertig!', 'Du verwendest jetzt die neueste Version.', [{ label: 'Super', action: () => {} }]);
        }
    },

    _showInfo(message) {
        this._showToast('Update', message, [{ label: 'OK', action: () => {} }]);
    },

    _showToast(title, body, actions) {
        let stack = document.querySelector('.Release-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'Release-toast-stack';
            stack.setAttribute('aria-live', 'polite');
            document.body.append(stack);
        }
        const toast = document.createElement('article');
        toast.className = 'Release-toast';
        toast.innerHTML = '<img src="/Res/Bild/Icon/Benachrichtige/update_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg" alt=""><div class="Release-toast-content"><p class="Release-toast-title"></p><p class="Release-toast-body"></p><div class="Release-toast-actions"></div></div><button class="Release-toast-close" type="button" aria-label="Benachrichtigung schließen">×</button>';
        toast.querySelector('.Release-toast-title').textContent = title;
        toast.querySelector('.Release-toast-body').textContent = body;
        const close = () => { toast.classList.add('is-leaving'); window.setTimeout(() => toast.remove(), 220); };
        toast.querySelector('.Release-toast-close').addEventListener('click', close);
        actions.forEach((item) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = item.primary ? 'Release-toast-action' : 'Release-toast-later';
            button.textContent = item.label;
            button.addEventListener('click', () => { item.action(); close(); });
            toast.querySelector('.Release-toast-actions').append(button);
        });
        stack.append(toast);
    },

    _isNewer(candidate, current) {
        const parse = (value) => String(value).replace(/^v/i, '').match(/\d+/g)?.slice(0, 3).map(Number) || [];
        const next = parse(candidate);
        const installed = parse(current);
        for (let index = 0; index < Math.max(next.length, installed.length, 3); index += 1) {
            const difference = (next[index] || 0) - (installed[index] || 0);
            if (difference) return difference > 0;
        }
        return false;
    }
};

AppUpdater.init();
