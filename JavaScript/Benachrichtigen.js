/* Tracks published GitHub releases only — never commits, issues or pull requests. */
const ReleaseNotifications = {
    repository: 'AstrieOS-modding/AstrieOS-re-ive',
    pollInterval: 10 * 60 * 1000,
    storageKey: 'astrieos-release-notifications',
    seenReleaseKey: 'astrieos-last-seen-release',
    notifications: [],
    started: false,
    panelBound: false,
    latestRelease: null,

    init() {
        if (this.started) return;
        this.started = true;
        this.notifications = this._readNotifications();
        this._bindPanel();
        this.render();
        this.checkForRelease();
        window.setInterval(() => this.checkForRelease(), this.pollInterval);
    },

    async checkForRelease() {
        try {
            const response = await fetch(`https://api.github.com/repos/${this.repository}/releases/latest`, {
                headers: { Accept: 'application/vnd.github+json' }
            });
            if (response.status === 404) return; // The repository has no published release yet.
            if (!response.ok) throw new Error(`GitHub antwortet mit ${response.status}`);

            const release = await response.json();
            if (!release?.id || release.draft) return;
            this.latestRelease = release;
            this._renderVersionStatus();
            const releaseId = String(release.id);
            const previousId = localStorage.getItem(this.seenReleaseKey);

            // The first check establishes a baseline. Visitors are not greeted by an old release.
            if (!previousId) {
                localStorage.setItem(this.seenReleaseKey, releaseId);
                return;
            }
            if (previousId === releaseId) return;

            localStorage.setItem(this.seenReleaseKey, releaseId);
            this.addRelease(release);
        } catch (error) {
            console.warn('Release-Tracking ist gerade nicht verfügbar.', error);
        }
    },

    addRelease(release) {
        const notification = {
            id: `release-${release.id}`,
            title: 'Neues Update verfügbar!',
            detail: release.name || release.tag_name || 'Neue AstrieOS-Version',
            url: release.html_url,
            downloadUrl: this._downloadUrl(release),
            isFictional: Boolean(release.isFictional),
            createdAt: new Date().toISOString()
        };
        this.notifications = [notification, ...this.notifications.filter(item => item.id !== notification.id)].slice(0, 30);
        this._saveNotifications();
        this.render();
        this.showToast(notification);
        if (typeof Sound !== 'undefined') Sound.play('notification-default');
    },

    showFictionalUpdate() {
        const release = {
            id: `fiction-${Date.now()}`,
            tag_name: 'v0.1.1-test',
            name: 'Fiction Update 0.1.1',
            html_url: '',
            isFictional: true
        };
        this.latestRelease = release;
        this.addRelease(release);
        this._renderVersionStatus();
    },

    showToast(notification) {
        let stack = document.querySelector('.Release-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'Release-toast-stack';
            stack.setAttribute('aria-live', 'polite');
            document.body.append(stack);
        }
        const toast = document.createElement('article');
        toast.className = 'Release-toast';
        toast.innerHTML = `
            <img src="/Res/Bild/Icon/Benachrichtige/update_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg" alt="">
            <div class="Release-toast-content"><p class="Release-toast-title"></p><p class="Release-toast-body"></p><div class="Release-toast-actions"><button class="Release-toast-action" type="button">Herunterladen</button><button class="Release-toast-later" type="button">Später</button></div></div>
            <button class="Release-toast-close" type="button" aria-label="Benachrichtigung schließen">×</button>`;
        toast.querySelector('.Release-toast-title').textContent = notification.title;
        toast.querySelector('.Release-toast-body').textContent = notification.detail;
        const dismiss = () => {
            toast.classList.add('is-leaving');
            window.setTimeout(() => toast.remove(), 220);
        };
        toast.querySelector('.Release-toast-close').addEventListener('click', dismiss);
        toast.querySelector('.Release-toast-later').addEventListener('click', dismiss);
        toast.querySelector('.Release-toast-action').addEventListener('click', () => {
            this.downloadRelease(notification);
            dismiss();
        });
        toast.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            if (notification.url) window.open(notification.url, '_blank', 'noopener');
        });
        stack.append(toast);
        window.setTimeout(dismiss, 9000);
    },

    _bindPanel() {
        const attach = () => {
            if (this.panelBound || !document.querySelector('[data-notification-list]')) return;
            this.panelBound = true;
            document.querySelector('[data-notification-clear]')?.addEventListener('click', () => {
                this.notifications = [];
                this._saveNotifications();
                this.render();
            });
            this.render();
        };
        attach();
        document.addEventListener('notifications-template-ready', attach, { once: true });
    },

    _renderVersionStatus() {
        if (!this.latestRelease) return;
        const current = this._currentVersion();
        const latest = this.latestRelease.tag_name || this.latestRelease.name || 'unbekannt';
        const newer = this._isNewer(latest, current);
        this._setVersionStatus(newer
            ? `Version ${latest} ist verfügbar. Installiert: ${current}.`
            : `Du nutzt die neueste Version (${current}).`);
        const card = document.querySelector('[data-update-card]');
        if (!card) return;
        card.hidden = !newer;
        if (newer) {
            card.querySelector('[data-update-title]').textContent = `Version ${latest} ist verfügbar`;
            card.querySelector('[data-update-detail]').textContent = this.latestRelease.name || 'Möchtest du das Update jetzt herunterladen?';
        }
    },

    _setVersionStatus(message) {
        const status = document.querySelector('[data-version-status]');
        if (status) status.textContent = message;
    },

    downloadRelease(releaseOrNotification) {
        if (!releaseOrNotification) return;
        if (releaseOrNotification.isFictional) {
            const file = new Blob(['AstrieOS Fiction Update\n\nDies ist nur eine Debug-Testdatei.'], { type: 'text/plain' });
            const url = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'AstrieOS-fiction-update.txt';
            link.click();
            URL.revokeObjectURL(url);
            return;
        }
        const updateRequest = new CustomEvent('app-update-request', {
            detail: { release: releaseOrNotification },
            cancelable: true
        });
        if (!document.dispatchEvent(updateRequest)) return;
        const url = releaseOrNotification.downloadUrl || this._downloadUrl(releaseOrNotification) || releaseOrNotification.html_url || releaseOrNotification.url;
        if (url) window.open(url, '_blank', 'noopener');
    },

    _downloadUrl(release) {
        return release.assets?.[0]?.browser_download_url || release.html_url;
    },

    _currentVersion() {
        return document.querySelector('meta[name="astrieos-version"]')?.content || '0.1.0';
    },

    _isNewer(candidate, current) {
        const parse = (value) => String(value).replace(/^v/i, '').match(/\d+/g)?.slice(0, 3).map(Number) || [];
        const next = parse(candidate);
        const installed = parse(current);
        if (!next.length || !installed.length) return candidate !== current;
        for (let index = 0; index < Math.max(next.length, installed.length, 3); index += 1) {
            const difference = (next[index] || 0) - (installed[index] || 0);
            if (difference) return difference > 0;
        }
        return false;
    },

    render() {
        const list = document.querySelector('[data-notification-list]');
        const counter = document.querySelector('[data-notification-count]');
        if (counter) counter.textContent = String(this.notifications.length);
        if (!list) return;
        list.replaceChildren();
        if (!this.notifications.length) {
            list.innerHTML = '<div class="Benachricht-leer"><p>Ganz leise sein...(╭ರ_•́)</p></div>';
            return;
        }
        this.notifications.forEach((notification) => {
            const item = document.createElement(notification.url ? 'a' : 'article');
            item.className = 'Benachricht-item';
            if (notification.url) {
                item.href = notification.url;
                item.target = '_blank';
                item.rel = 'noopener';
            }
            item.innerHTML = '<img src="/Res/Bild/Icon/Benachrichtige/update_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg" alt=""><div class="Benachricht-item-text"><p class="Benachricht-item-title"></p><p class="Benachricht-item-detail"></p><time></time></div>';
            item.querySelector('.Benachricht-item-title').textContent = notification.title;
            item.querySelector('.Benachricht-item-detail').textContent = notification.detail;
            item.querySelector('time').textContent = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.createdAt));
            list.append(item);
        });
    },

    _readNotifications() {
        try { return JSON.parse(localStorage.getItem(this.storageKey)) || []; } catch { return []; }
    },
    _saveNotifications() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.notifications)); } catch { /* Storage can be disabled. */ }
    }
};

ReleaseNotifications.init();
