/* Read-only browser and source inspector with an extension point for mods. */
const DebugMenu = {
    template: null,
    styleLoaded: false,
    initialized: false,
    opening: null,
    enabled: false,
    root: null,
    previousFocus: null,
    errors: [],
    modules: [],
    activeFile: '',
    frameSamples: [],
    delaySamples: [],
    performanceTimer: null,
    scripts: [
        'Benachrichtigen.js', 'Debug-menu.js', 'Einstellungen.js', 'Erfolgen.js', 'Gretter.js',
        'Hintergrund-tracking.js', 'Ladenoverlay.js', 'Nutzerkonto.js', 'Nutzerspeicher.js',
        'Nutzeruhr.js', 'Soundeffekt.js', 'toggle.js', 'ui.js', 'untertitlel_system.js',
        'Update_hernterladen.js', 'Window_system.js', 'popup.js'
    ].map((name) => `/JavaScript/${name}`),

    init() {
        const attach = () => {
            const button = document.querySelector('[data-debug-mode]');
            if (!button || button.dataset.bound) return;
            button.dataset.bound = 'true';
            button.addEventListener('click', () => {
                const enabled = button.getAttribute('aria-pressed') !== 'true';
                button.setAttribute('aria-pressed', String(enabled));
                button.classList.toggle('is-enabled', enabled);
                if (enabled) this.open();
                else this.close();
            });
        };
        attach();
        document.addEventListener('settings-template-ready', attach);
        window.addEventListener('error', (event) => this._recordError(event.message || 'Unbekannter JavaScript-Fehler', event.filename));
        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            this._recordError(reason?.message || String(reason || 'Unbehandelte Promise-Ablehnung'));
        });
        ['resize', 'online', 'offline'].forEach((eventName) => window.addEventListener(eventName, () => this._refreshOpenWindow()));
        document.addEventListener('visibilitychange', () => this._refreshOpenWindow());
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        connection?.addEventListener?.('change', () => this._refreshOpenWindow());
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.root) this.close();
        });
        this.initialized = true;
    },

    async open() {
        this.enabled = true;
        if (this.opening) return this.opening;
        this.opening = (async () => {
            try {
                if (!this.template) {
                    const response = await fetch('/ui/Debug-menu.html');
                    if (!response.ok) throw new Error(`Debug-Menü konnte nicht geladen werden (${response.status}).`);
                    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
                    const template = doc.querySelector('#Debug-menu-ui');
                    if (!template) throw new Error('Debug-Menü-Template fehlt.');
                    this.template = template.content;
                }
                if (!this.enabled) return;
                if (this.root?.isConnected) return;
                if (!this.styleLoaded) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = '/ui/Ui_css/Debug-menu.css';
                    link.dataset.debugMenuStyles = 'true';
                    document.head.appendChild(link);
                    this.styleLoaded = true;
                }
                const content = this.template.cloneNode(true);
                this.root = content.querySelector('[data-debug-root]');
                if (!this.root) throw new Error('Debug-Menü-Inhalt fehlt.');
                this.previousFocus = document.activeElement;
                document.body.append(content);
                this._bind(this.root);
                this.root.querySelector('[data-debug-close]')?.focus();
                this.refresh(this.root);
                this._renderFileList(this.root);
                this._renderModules(this.root);
                this._startPerformanceTracking();
                this._syncToggle(true);
            } catch (error) {
                console.error('[DebugMenu]', error);
                this._syncToggle(false);
            } finally {
                this.opening = null;
            }
        })();
        return this.opening;
    },

    close() {
        this.enabled = false;
        if (this.performanceTimer) clearInterval(this.performanceTimer);
        this.performanceTimer = null;
        this.root?.remove();
        this.root = null;
        this._syncToggle(false);
        this.previousFocus?.focus?.();
        this.previousFocus = null;
    },

    _bind(root) {
        root.querySelectorAll('[data-debug-tab]').forEach((button) => button.addEventListener('click', () => {
            const selected = button.dataset.debugTab;
            root.querySelectorAll('[data-debug-tab]').forEach((tab) => tab.classList.toggle('is-active', tab === button));
            root.querySelectorAll('[data-debug-panel]').forEach((panel) => {
                const active = panel.dataset.debugPanel === selected;
                panel.hidden = !active;
                panel.classList.toggle('is-active', active);
            });
        }));
        root.querySelector('[data-debug-refresh]')?.addEventListener('click', () => this.refresh(root));
        root.querySelector('[data-debug-close]')?.addEventListener('click', () => this.close());
        root.addEventListener('click', (event) => { if (event.target === root) this.close(); });
        root.querySelector('[data-debug-search]')?.addEventListener('input', (event) => this._renderFileList(root, event.target.value));
        root.querySelector('[data-debug-copy]')?.addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const source = root.querySelector('[data-debug-source]')?.textContent || '';
            try {
                await navigator.clipboard.writeText(source);
                button.textContent = 'Kopiert';
                setTimeout(() => { button.textContent = 'Kopieren'; }, 1200);
            } catch {
                button.textContent = 'Nicht möglich';
            }
        });
    },

    registerModule(module) {
        if (!module || typeof module.id !== 'string' || typeof module.name !== 'string') return false;
        const record = {
            id: module.id,
            name: module.name,
            version: typeof module.version === 'string' ? module.version : '—',
            status: typeof module.status === 'string' ? module.status : 'Registriert',
            description: typeof module.description === 'string' ? module.description : 'Keine Beschreibung angegeben.'
        };
        const index = this.modules.findIndex((item) => item.id === record.id);
        if (index >= 0) this.modules[index] = record;
        else this.modules.push(record);
        if (this.root) this._renderModules(this.root);
        return true;
    },

    unregisterModule(id) {
        this.modules = this.modules.filter((module) => module.id !== id);
        if (this.root) this._renderModules(this.root);
    },

    _renderModules(root) {
        const list = root.querySelector('[data-debug-modules]');
        if (!list) return;
        const count = root.querySelector('[data-module-count]');
        if (count) count.textContent = String(this.modules.length);
        if (!this.modules.length) {
            const empty = document.createElement('article');
            empty.className = 'Debug-module Debug-module-empty';
            const title = document.createElement('h3');
            const description = document.createElement('p');
            title.textContent = 'Noch keine Modding-Erweiterungen';
            description.textContent = 'Registrierte Mods können hier künftig Versions- und Statusinformationen anzeigen.';
            empty.append(title, description);
            list.replaceChildren(empty);
            return;
        }
        list.replaceChildren(...this.modules.map((module) => {
            const card = document.createElement('article');
            card.className = 'Debug-module';
            const title = document.createElement('h3');
            const description = document.createElement('p');
            const meta = document.createElement('div');
            const version = document.createElement('span');
            const status = document.createElement('span');
            title.textContent = module.name;
            description.textContent = module.description;
            version.textContent = `v${module.version}`;
            status.textContent = module.status;
            meta.className = 'Debug-module-meta';
            meta.append(version, status);
            card.append(title, description, meta);
            return card;
        }));
    },

    _startPerformanceTracking() {
        this.frameSamples = [];
        this.delaySamples = [];
        let previousFrame = performance.now();
        const trackFrame = (now) => {
            if (!this.enabled) return;
            const interval = now - previousFrame;
            previousFrame = now;
            if (interval > 0 && interval < 1000) {
                this.frameSamples.push(interval);
                this.frameSamples = this.frameSamples.slice(-80);
            }
            requestAnimationFrame(trackFrame);
        };
        requestAnimationFrame(trackFrame);

        let previousTimer = performance.now();
        this.performanceTimer = setInterval(() => {
            const now = performance.now();
            this.delaySamples.push(Math.max(0, now - previousTimer - 100));
            this.delaySamples = this.delaySamples.slice(-80);
            previousTimer = now;
            if (this.root?.isConnected) this._renderPerformance(this.root);
        }, 100);
    },

    _renderPerformance(root) {
        const frameAverage = this.frameSamples.length
            ? this.frameSamples.reduce((total, value) => total + value, 0) / this.frameSamples.length
            : 0;
        const delayAverage = this.delaySamples.length
            ? this.delaySamples.reduce((total, value) => total + value, 0) / this.delaySamples.length
            : 0;
        const delayMaximum = this.delaySamples.length ? Math.max(...this.delaySamples) : 0;
        const fps = frameAverage ? Math.round(1000 / frameAverage) : 0;
        const fpsValue = root.querySelector('[data-debug-fps]');
        const frameRange = root.querySelector('[data-debug-frame-range]');
        const delayValue = root.querySelector('[data-debug-delay]');
        const delayRange = root.querySelector('[data-debug-delay-range]');
        if (fpsValue) fpsValue.textContent = `${fps} FPS`;
        if (frameRange) frameRange.textContent = `${frameAverage.toFixed(1)} ms avg`;
        if (delayValue) delayValue.textContent = `${delayAverage.toFixed(1)} ms`;
        if (delayRange) delayRange.textContent = `${delayMaximum.toFixed(1)} ms max`;
        this._paintChart(root.querySelector('[data-debug-frame-chart]'), this.frameSamples, 33);
        this._paintChart(root.querySelector('[data-debug-delay-chart]'), this.delaySamples, 50);
    },

    _paintChart(container, values, ceiling) {
        if (!container) return;
        const samples = values.slice(-48);
        const bars = samples.map((value) => {
            const bar = document.createElement('span');
            bar.style.setProperty('--bar-height', `${Math.max(4, Math.min(100, value / ceiling * 100))}%`);
            return bar;
        });
        container.replaceChildren(...bars);
    },

    _syncToggle(enabled) {
        const button = document.querySelector('[data-debug-mode]');
        if (!button) return;
        button.setAttribute('aria-pressed', String(enabled));
        button.classList.toggle('is-enabled', enabled);
    },

    _set(root, key, value) {
        const element = root.querySelector(`[data-debug-value="${key}"]`);
        if (element) element.textContent = value;
    },

    _detailRows(root, key, rows) {
        const list = root.querySelector(`[data-debug-details="${key}"]`);
        if (!list) return;
        list.replaceChildren(...rows.map(([label, value]) => {
            const row = document.createElement('div');
            row.className = 'Debug-detail-row';
            const term = document.createElement('dt');
            const detail = document.createElement('dd');
            term.textContent = label;
            detail.textContent = value;
            row.append(term, detail);
            return row;
        }));
    },

    refresh(root) {
        const nav = navigator;
        const screenValue = `${screen.width} × ${screen.height}`;
        const viewportValue = `${window.innerWidth} × ${window.innerHeight}`;
        const memory = nav.deviceMemory ? `${nav.deviceMemory} GB` : 'Nicht verfügbar';
        const cores = nav.hardwareConcurrency ? `${nav.hardwareConcurrency} logische Kerne` : 'Nicht verfügbar';
        const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
        const connectionName = connection?.effectiveType ? connection.effectiveType.toUpperCase() : 'Nicht verfügbar';
        const browser = this._browserName(nav.userAgent);
        const online = nav.onLine ? 'Online' : 'Offline';
        this._set(root, 'browser', browser);
        this._set(root, 'platform', nav.userAgentData?.platform || nav.platform || 'Nicht verfügbar');
        this._set(root, 'viewport', viewportValue);
        this._set(root, 'screen', `Bildschirm ${screenValue} · ${window.devicePixelRatio || 1}×`);
        this._set(root, 'connection', connectionName);
        this._set(root, 'online', `${online}${connection?.downlink ? ` · ${connection.downlink} Mbit/s` : ''}`);
        this._set(root, 'scriptTotal', `${this.scripts.length} Dateien`);
        this._detailRows(root, 'device', [
            ['Plattform', nav.userAgentData?.platform || nav.platform || 'Nicht verfügbar'],
            ['Prozessoren', cores], ['Arbeitsspeicher', memory],
            ['Touch-Eingabe', nav.maxTouchPoints ? `Ja · ${nav.maxTouchPoints} Punkte` : 'Nein / nicht verfügbar'],
            ['Bildschirm', `${screenValue} · ${window.devicePixelRatio || 1}×`],
            ['Fenstergröße', viewportValue]
        ]);
        this._detailRows(root, 'browser', [
            ['Browser', browser], ['Sprache', nav.language || 'Nicht verfügbar'],
            ['Zeitzone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Nicht verfügbar'],
            ['Verbindung', connectionName], ['Status', online],
            ['Seitentitel', document.title || 'Nicht verfügbar'], ['Sichtbarkeit', document.visibilityState]
        ]);
        const runtime = root.querySelector('[data-debug-runtime]');
        if (runtime) {
            const rows = [
                ['User-Agent', nav.userAgent || 'Nicht verfügbar'], ['Browser-Plattform', nav.platform || 'Nicht verfügbar'],
                ['Spracheinstellungen', nav.languages?.join(', ') || nav.language || 'Nicht verfügbar'],
                ['Hardwarethreads', cores], ['Gerätespeicher', memory], ['Touchpunkte', String(nav.maxTouchPoints ?? 'Nicht verfügbar')],
                ['Bildschirmauflösung', screenValue], ['Viewport', viewportValue],
                ['Farbtiefe', `${screen.colorDepth || '—'} Bit`], ['Pixelverhältnis', `${window.devicePixelRatio || 1}×`],
                ['Verbindungstyp', connectionName], ['Verbindungsstatus', online],
                ['Zeitzone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Nicht verfügbar'],
                ['Seitenstatus', document.visibilityState], ['Geladene Scripts', String(document.scripts.length)]
            ];
            runtime.replaceChildren(...rows.map(([label, value]) => {
                const item = document.createElement('article');
                item.className = 'Debug-runtime-item';
                const title = document.createElement('span');
                const data = document.createElement('strong');
                title.textContent = label;
                data.textContent = value;
                item.append(title, data);
                return item;
            }));
        }
        const updated = root.querySelector('[data-debug-updated]');
        if (updated) updated.textContent = `Aktualisiert ${new Date().toLocaleTimeString('de-DE')}`;
        const errorCount = root.querySelector('[data-debug-error-count]');
        const errorList = root.querySelector('[data-debug-errors]');
        if (errorCount) errorCount.textContent = String(this.errors.length);
        if (errorList) {
            errorList.replaceChildren();
            if (!this.errors.length) {
                const empty = document.createElement('p');
                empty.textContent = 'Noch keine erfassten Fehler.';
                errorList.append(empty);
            } else this.errors.slice(-20).reverse().forEach((entry) => {
                const item = document.createElement('div');
                item.className = 'Debug-error-entry';
                item.textContent = entry.message;
                if (entry.source) {
                    const source = document.createElement('small');
                    source.textContent = entry.source;
                    item.append(source);
                }
                errorList.append(item);
            });
        }
    },

    _browserName(userAgent = '') {
        if (/Edg\//.test(userAgent)) return 'Microsoft Edge';
        if (/Firefox\//.test(userAgent)) return 'Mozilla Firefox';
        if (/Chrome\//.test(userAgent) && !/Chromium/.test(userAgent)) return 'Google Chrome';
        if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Apple Safari';
        if (/Chromium/.test(userAgent)) return 'Chromium';
        return 'Unbekannter Browser';
    },

    _recordError(message, source = '') {
        this.errors.push({ message: String(message).slice(0, 500), source: String(source || '').slice(0, 240) });
        this.errors = this.errors.slice(-50);
        if (this.root?.isConnected) this.refresh(this.root);
    },

    _refreshOpenWindow() {
        if (this.root?.isConnected) this.refresh(this.root);
    },

    _renderFileList(root, query = '') {
        const list = root.querySelector('[data-debug-files]');
        if (!list) return;
        const normalized = query.trim().toLowerCase();
        const files = this.scripts.filter((path) => path.toLowerCase().includes(normalized));
        const count = root.querySelector('[data-script-count]');
        if (count) count.textContent = String(this.scripts.length);
        list.replaceChildren(...files.map((path) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `Debug-file-button${this.activeFile === path ? ' is-active' : ''}`;
            button.textContent = path.replace('/JavaScript/', '');
            button.title = path;
            button.addEventListener('click', () => this._loadFile(root, path, button));
            return button;
        }));
    },

    async _loadFile(root, path, button) {
        this.activeFile = path;
        root.querySelectorAll('.Debug-file-button').forEach((item) => item.classList.toggle('is-active', item === button));
        const filename = root.querySelector('[data-debug-filename]');
        const source = root.querySelector('[data-debug-source]');
        const copy = root.querySelector('[data-debug-copy]');
        if (filename) filename.textContent = path;
        if (source) source.textContent = 'Lade Quelltext …';
        if (copy) copy.disabled = true;
        try {
            const response = await fetch(path, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Datei nicht erreichbar (${response.status}).`);
            const text = await response.text();
            if (source) source.textContent = text;
            if (copy) copy.disabled = false;
        } catch (error) {
            if (source) source.textContent = `Konnte die Datei nicht laden. ${error.message}`;
        }
    }
};

DebugMenu.init();
