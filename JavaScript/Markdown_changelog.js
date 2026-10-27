const Changelog = {
    initialized: false,
    templatePromise: null,
    entries: [],
    releases: null,
    activeIndex: 0,

    init() {
        if (this.initialized) return;
        this.initialized = true;
        window.addEventListener('astrie-session-started', () => {
            window.setTimeout(() => window.AppUpdater?.showPendingChangelog(), 300);
        });
    },

    async open(version = '') {
        await this._loadTemplate();
        await this._loadEntries();
        const overlay = document.querySelector('.Changelogmd_overlay');
        if (!overlay) return;
        overlay.hidden = false;
        requestAnimationFrame(() => overlay.classList.add('is-visible'));
        document.body.classList.add('changelog-open');
        this.activeIndex = Math.max(0, this.entries.findIndex(entry => entry.version === version));
        this._render();
    },

    close() {
        const overlay = document.querySelector('.Changelogmd_overlay');
        if (overlay && !overlay.hidden) {
            overlay.classList.remove('is-visible');
            window.setTimeout(() => { overlay.hidden = true; }, 180);
        }
        document.body.classList.remove('changelog-open');
    },

    async _loadTemplate() {
        if (!this.templatePromise) {
            this.templatePromise = (async () => {
                if (!document.querySelector('link[data-changelog-styles]')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = '/ui/Ui_css/changelog.css';
                    link.dataset.changelogStyles = 'true';
                    document.head.append(link);
                }
                const response = await fetch('/ui/changelog.html', { cache: 'no-cache' });
                if (!response.ok) throw new Error(`Changelog-Ansicht konnte nicht geladen werden (${response.status}).`);
                const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
                const template = doc.querySelector('#Changelog_md_ui');
                if (!template) throw new Error('Changelog-Template fehlt.');
                document.body.append(template.content.cloneNode(true));
                document.querySelector('[data-changelog-close]')?.addEventListener('click', () => this.close());
                document.querySelector('.Changelogmd_backwards')?.addEventListener('click', () => this._select(this.activeIndex + 1));
                document.querySelector('.Changelogmd_forwards')?.addEventListener('click', () => this._select(this.activeIndex - 1));
                document.querySelector('.Changelogmd_overlay')?.addEventListener('click', event => {
                    if (event.target.classList.contains('Changelogmd_overlay')) this.close();
                });
                document.addEventListener('keydown', event => {
                    if (event.key === 'Escape') this.close();
                });
            })();
        }
        return this.templatePromise;
    },

    async _loadEntries() {
        if (this.entries.length) return;
        const response = await fetch('/changelogs/index.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error('Changelog-Liste konnte nicht geladen werden.');
        const files = await response.json();
        this.entries = await Promise.all(files.map(async item => {
            const result = await fetch(`/changelogs/${encodeURIComponent(item.file)}`, { cache: 'no-cache' });
            if (!result.ok) return null;
            return { ...item, markdown: await result.text() };
        }));
        this.entries = this.entries.filter(Boolean).sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
    },

    async _loadReleases() {
        if (this.releases) return this.releases;
        try {
            const response = await fetch('https://api.github.com/repos/AstrieOS-modding/AstrieOS-re-ive/releases?per_page=100', {
                headers: { Accept: 'application/vnd.github+json' },
                cache: 'no-cache'
            });
            if (!response.ok) throw new Error(`GitHub antwortet mit ${response.status}`);
            const releases = await response.json();
            this.releases = new Map(releases.filter(release => !release.draft).map(release => [
                this._normalizeVersion(release.tag_name), release
            ]));
        } catch (error) {
            console.warn('[Changelog] GitHub-Releases konnten nicht geladen werden.', error);
            this.releases = new Map();
        }
        return this.releases;
    },

    _normalizeVersion(version) {
        return String(version || '').replace(/^v/i, '').toLowerCase();
    },

    _select(index) {
        if (!this.entries.length) return;
        this.activeIndex = Math.max(0, Math.min(index, this.entries.length - 1));
        this._render();
    },

    _render() {
        const entry = this.entries[this.activeIndex];
        if (!entry) return;
        const title = document.querySelector('.md_titel');
        const date = document.querySelector('.mdb_topbar_v');
        const content = document.querySelector('.Changelogmd-main-content');
        const older = document.querySelector('.mdb_version');
        const newer = document.querySelector('.mdb_f_version');
        if (title) title.textContent = entry.title;
        if (date) date.textContent = entry.version;
        if (older) older.textContent = this.entries[this.activeIndex + 1]?.version || '';
        if (newer) newer.textContent = this.entries[this.activeIndex - 1]?.version || '';
        this._renderReleaseInfo(entry);
        if (!content) return;
        content.replaceChildren();
        entry.markdown.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || /^<!--/.test(trimmed)) return;
            const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
            const list = trimmed.match(/^[-*]\s+(.+)$/);
            const element = document.createElement(heading ? `h${heading[1].length + 2}` : list ? 'li' : 'p');
            element.textContent = heading?.[2] || list?.[1] || trimmed;
            content.append(element);
        });
    },

    async _renderReleaseInfo(entry) {
        const tag = document.querySelector('[data-changelog-release-tag]');
        const date = document.querySelector('[data-changelog-release-date]');
        if (!tag || !date) return;
        tag.hidden = true;
        date.hidden = true;
        const releases = await this._loadReleases();
        if (this.entries[this.activeIndex] !== entry) return;
        const release = releases.get(this._normalizeVersion(entry.version));
        if (!release) return;
        tag.textContent = release.prerelease ? 'Pre-release' : 'Release';
        tag.classList.toggle('is-prerelease', Boolean(release.prerelease));
        tag.hidden = false;
        if (release.published_at) {
            const published = new Date(release.published_at);
            date.dateTime = release.published_at;
            date.textContent = `Veröffentlicht am ${new Intl.DateTimeFormat('de-DE', {
                dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Berlin'
            }).format(published)}`;
            date.hidden = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Changelog.init());
if (document.readyState !== 'loading') Changelog.init();
window.Changelog = Changelog;
