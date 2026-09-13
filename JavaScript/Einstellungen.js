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
                this._setDebugStatus('Fiction Update angezeigt. „Herunterladen“ erzeugt nur eine lokale Testdatei.');
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
