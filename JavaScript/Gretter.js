const GretterManager = {
    initialized: false,
    selectedAccountId: null,
    selectedDesktop: 're-ive',

    async init() {
        if (this.initialized) return;
        const root = document.querySelector('.Gretter-ui');
        if (!root || typeof Nutzerspeicher === 'undefined') return;
        this.initialized = true;
        this.root = root;
        if (!Nutzerspeicher._wallpaperStorageReady && document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
        }
        await Nutzerspeicher._wallpaperStorageReady;
        this.selectedAccountId = Nutzerspeicher.getAktiveKontoId();

        root.querySelector('[data-gretter-login-form]')?.addEventListener('submit', event => {
            event.preventDefault();
            this.startSession();
        });
        root.querySelector('[data-desktop-manager="re-ive"]')?.addEventListener('click', () => {
            this.selectedDesktop = 're-ive';
            root.querySelector('.Desktop-manager').textContent = 'Re-ive!';
            root.querySelector('[data-gretter-menu="desktop"]')?.classList.remove('Open');
        });
        window.addEventListener('astrie-background-changed', () => this.syncBackground());
        window.addEventListener('astrie-account-changed', () => this.renderAccounts());

        this.renderAccounts();
        this.syncBackground();
        this.updateClock();
        this.clockInterval = window.setInterval(() => this.updateClock(), 1000);
    },

    updateClock() {
        if (!this.root) return;
        const now = new Date();
        const clock = this.root.querySelector('.Uhr-zeigen');
        const date = this.root.querySelector('.Datum-zeigen');
        if (clock) clock.textContent = `${now.toLocaleTimeString('de-DE')} Uhr`;
        if (date) date.textContent = new Intl.DateTimeFormat('de-DE', {
            weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
        }).format(now);
    },

    renderAccounts() {
        if (!this.root || typeof Nutzerspeicher === 'undefined') return;
        const accounts = Nutzerspeicher.getAlleKonten();
        const activeId = Nutzerspeicher.getAktiveKontoId();
        if (!accounts.some(account => account.id === this.selectedAccountId)) {
            this.selectedAccountId = activeId || accounts[0]?.id || null;
        }
        const selected = accounts.find(account => account.id === this.selectedAccountId) || accounts[0];
        const selectedButton = this.root.querySelector('[data-gretter-selected-account]');
        if (selectedButton && selected) {
            const image = selectedButton.querySelector('img');
            const name = selectedButton.querySelector('.username');
            if (image) image.src = selected.profilbildUrl || '/Res/Bild/Logo/AddText_07-03-07.27.32.png';
            if (name) name.textContent = selected.username || 'Gast!';
            selectedButton.title = selected.id === activeId ? 'Aktives Konto' : 'Konto für diese Sitzung ausgewählt';
        }

        const menu = this.root.querySelector('[data-gretter-menu="accounts"]');
        if (!menu) return;
        menu.replaceChildren();
        accounts.forEach(account => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'Gretter-dropdown-btn';
            button.classList.toggle('aktiv', account.id === this.selectedAccountId);
            button.setAttribute('aria-pressed', String(account.id === this.selectedAccountId));
            const avatar = document.createElement('img');
            avatar.className = 'Gretter-user-pfp';
            avatar.width = 40;
            avatar.height = 40;
            avatar.src = account.profilbildUrl || '/Res/Bild/Logo/AddText_07-03-07.27.32.png';
            const label = document.createElement('span');
            label.textContent = account.username || 'Gast!';
            const active = document.createElement('small');
            active.textContent = account.id === activeId ? 'Aktiv' : '';
            button.append(avatar, label, active);
            button.addEventListener('click', () => {
                this.selectedAccountId = account.id;
                this.root.querySelector('[data-gretter-menu="accounts"]')?.classList.remove('Open');
                this.root.querySelector('[data-gretter-error]').textContent = '';
                this.root.querySelector('.Input-passwort').value = '';
                this.renderAccounts();
            });
            menu.appendChild(button);
        });
    },

    async syncBackground() {
        if (!this.root || typeof Nutzerspeicher === 'undefined') return;
        try {
            await Nutzerspeicher._wallpaperStorageReady;
            const saved = Nutzerspeicher.hintergrundLaden();
            const source = saved.url || '/Res/Bild/Hintergrund/dylan-taylor-833xr3nsO64-unsplash.jpg';
            const resolved = await Nutzerspeicher.resolveWallpaperUrl(source);
            const holder = this.root.querySelector('.Gretter-bg-effekt');
            if (!holder) return;
            if (saved.type === 'video') {
                let video = holder.querySelector('video');
                if (!video) {
                    video = document.createElement('video');
                    video.className = 'Gretter-bg Gretter-bg-video';
                    video.autoplay = true;
                    video.loop = true;
                    video.muted = true;
                    video.playsInline = true;
                    holder.appendChild(video);
                }
                video.src = resolved;
                video.play().catch(() => {});
                holder.querySelector('img.Gretter-bg')?.remove();
            } else {
                let image = holder.querySelector('img.Gretter-bg');
                if (!image) {
                    image = document.createElement('img');
                    image.className = 'Gretter-bg';
                    holder.replaceChildren(image);
                }
                image.src = resolved;
                holder.querySelector('video.Gretter-bg')?.remove();
            }
        } catch (error) {
            console.error('[Greeter] Hintergrund konnte nicht synchronisiert werden:', error);
        }
    },

    async startSession() {
        const account = Nutzerspeicher.getAlleKonten().find(item => item.id === this.selectedAccountId);
        if (!account) return;
        const input = this.root.querySelector('.Input-passwort');
        const error = this.root.querySelector('[data-gretter-error]');
        const button = this.root.querySelector('.Gretter-login');
        button.disabled = true;
        error.textContent = '';
        try {
            const accepted = await Nutzerspeicher.verifiziereKontoPasswort(account.id, input.value);
            if (!accepted) {
                error.textContent = 'Das Passwort stimmt nicht.';
                input.focus();
                return;
            }
            if (!Nutzerspeicher.wechsleKonto(account.id)) {
                error.textContent = 'Das Konto konnte nicht gewechselt werden.';
                return;
            }
            this.root.classList.add('fertig');
            input.value = '';
            window.dispatchEvent(new CustomEvent('astrie-session-started', { detail: { accountId: account.id, desktop: this.selectedDesktop } }));
        } catch (cause) {
            console.error('[Greeter] Anmeldung fehlgeschlagen:', cause);
            error.textContent = 'Anmeldung momentan nicht möglich.';
        } finally {
            button.disabled = false;
        }
    }
};

function initGretterManager() {
    const start = () => {
        if (typeof Nutzerspeicher === 'undefined') {
            window.setTimeout(start, 100);
            return;
        }
        GretterManager.init();
    };
    start();
}

document.addEventListener('gretter-template-ready', initGretterManager);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGretterManager, { once: true });
} else {
    initGretterManager();
}

window.GretterManager = GretterManager;
