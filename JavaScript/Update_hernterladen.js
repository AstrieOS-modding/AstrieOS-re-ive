/* Checks the deployed app version and installs updates through the service worker. */
const AppUpdater = {
    registration: null,
    pendingVersion: '',
    greeted: false,
    checking: false,
    reloadRequested: false,
    seenVersionKey: 'astrieos-changelog-seen-version',

    init() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (this.reloadRequested) window.location.reload();
        });
        navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
            .then(async registration => {
                this.registration = registration;
                registration.addEventListener('updatefound', () => this._watchInstallingWorker(registration));
                await this.checkVersion();
                window.setInterval(() => this.checkVersion(), 10 * 60 * 1000);
                document.addEventListener('app-update-request', event => {
                    event.preventDefault();
                    this.checkVersion(true);
                });
            })
            .catch(error => console.warn('Update-Service ist nicht verfügbar.', error));
        window.addEventListener('astrie-session-started', () => {
            this.greeted = true;
            this.showPendingChangelog();
        });
    },

    async checkVersion(manual = false) {
        if (this.checking) return;
        this.checking = true;
        try {
            const response = await fetch(`/version.json?check=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`version.json antwortet mit ${response.status}`);
            const { version } = await response.json();
            if (!version) throw new Error('Version fehlt in version.json');
            const seen = localStorage.getItem(this.seenVersionKey)
                || document.querySelector('meta[name="astrieos-version"]')?.content
                || version;
            if (this._isNewer(version, seen)) this.pendingVersion = version;
            if (this.greeted) this.showPendingChangelog();

            if (this.registration) {
                await this.registration.update();
                if (this.registration.waiting && navigator.serviceWorker.controller) {
                    this._activateAndReload(this.registration.waiting);
                }
            }
            if (manual) this._showInfo(this.pendingVersion
                ? `Version ${this.pendingVersion} ist verfügbar. Die Seite wird mit dem neuen Build aktualisiert.`
                : `Du verwendest Version ${version}.`);
        } catch (error) {
            console.warn('Versionsprüfung fehlgeschlagen.', error);
            if (manual) this._showInfo('Die Versionsprüfung ist gerade nicht verfügbar.');
        } finally {
            this.checking = false;
        }
    },

    showPendingChangelog() {
        if (!this.greeted || !this.pendingVersion) return;
        const version = this.pendingVersion;
        this.pendingVersion = '';
        localStorage.setItem(this.seenVersionKey, version);
        if (window.Changelog) window.Changelog.open(version).catch(error => console.warn('[Changelog]', error));
        else window.setTimeout(() => window.Changelog?.open(version), 500);
    },

    _watchInstallingWorker(registration) {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                if (registration.waiting) this._activateAndReload(registration.waiting);
            }
        });
    },

    _activateAndReload(worker) {
        this.reloadRequested = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
    },

    _showInfo(message) {
        let stack = document.querySelector('.Release-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'Release-toast-stack';
            stack.setAttribute('aria-live', 'polite');
            document.body.append(stack);
        }
        const toast = document.createElement('article');
        toast.className = 'Release-toast';
        const body = document.createElement('p');
        body.className = 'Release-toast-body';
        body.textContent = message;
        const close = document.createElement('button');
        close.className = 'Release-toast-close';
        close.type = 'button';
        close.setAttribute('aria-label', 'Schließen');
        close.textContent = '×';
        close.addEventListener('click', () => toast.remove());
        toast.append(body, close);
        stack.append(toast);
    },

    _isNewer(candidate, current) {
        const parse = value => String(value).replace(/^v/i, '').match(/\d+/g)?.map(Number) || [];
        const next = parse(candidate);
        const previous = parse(current);
        if (!next.length || !previous.length) return false;
        for (let index = 0; index < Math.max(next.length, previous.length); index += 1) {
            const difference = (next[index] || 0) - (previous[index] || 0);
            if (difference) return difference > 0;
        }
        return false;
    }
};

AppUpdater.init();
window.AppUpdater = AppUpdater;
