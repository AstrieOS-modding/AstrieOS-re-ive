const Popup = {
    ready: null,
    root: null,
    backdrop: null,
    dialog: null,
    actions: null,
    isOpen: false,
    activeMode: 'alert',
    previousFocus: null,
    resolveActive: null,
    promptKeyHandler: null,
    modalQueue: Promise.resolve(),
    toastSequence: 0,

    init() {
        if (this.ready) return this.ready;

        this.ready = fetch('/ui/popup.html')
            .then(response => {
                if (!response.ok) throw new Error(`Popup-Vorlage konnte nicht geladen werden (${response.status}).`);
                return response.text();
            })
            .then(markup => {
                const documentTemplate = new DOMParser().parseFromString(markup, 'text/html');
                const template = documentTemplate.querySelector('#popup-ui');
                if (!template) throw new Error('Popup-Vorlage fehlt.');
                this.root = template.content.cloneNode(true);
                document.body.appendChild(this.root);
                this.root = document.querySelector('.popup-system');
                this.backdrop = this.root.querySelector('[data-popup-backdrop]');
                this.dialog = this.root.querySelector('.popup-dialog');
                this.actions = this.root.querySelector('[data-popup-actions]');

                const css = document.createElement('link');
                css.rel = 'stylesheet';
                css.href = '/ui/Ui_css/popup.css';
                document.head.appendChild(css);

                this.root.querySelector('[data-popup-cancel]').addEventListener('click', () => this._dismiss());
                this.backdrop.addEventListener('click', event => {
                    if (event.target === this.backdrop) this._dismiss();
                });
                document.addEventListener('keydown', event => this._handleKeydown(event));
                return true;
            })
            .catch(error => {
                console.error('[Popup] Initialisierung fehlgeschlagen:', error);
                return false;
            });

        return this.ready;
    },

    alert(message, options = {}) {
        return this._queueModal({ ...options, message, mode: 'alert' });
    },

    confirm(message, options = {}) {
        return this._queueModal({ ...options, message, mode: 'confirm' });
    },

    prompt(message, options = {}) {
        return this._queueModal({ ...options, message, mode: 'prompt' });
    },

    _queueModal(options) {
        const result = this.modalQueue.then(() => this._showModal(options));
        this.modalQueue = result.then(() => undefined, () => undefined);
        return result;
    },

    async _showModal(options) {
        const initialized = await this.init();
        if (!initialized) return this._fallback(options);

        this.previousFocus = document.activeElement;
        this.isOpen = true;
        this.activeMode = options.mode;
        const type = ['info', 'success', 'warning', 'error'].includes(options.type) ? options.type : 'info';
        const labels = { info: 'Hinweis', success: 'Erledigt', warning: 'Achtung', error: 'Fehler' };
        const marks = { info: 'i', success: '✓', warning: '!', error: '×' };
        this.dialog.dataset.type = type;
        this.root.querySelector('[data-popup-mark]').textContent = marks[type];
        this.root.querySelector('[data-popup-eyebrow]').textContent = options.eyebrow || 'AstrieOS';
        this.root.querySelector('[data-popup-title]').textContent = options.title || labels[type];
        this.root.querySelector('[data-popup-message]').textContent = String(options.message ?? '');
        this.backdrop.hidden = false;
        this.actions.replaceChildren();

        const inputLabel = this.root.querySelector('[data-popup-input-label]');
        const input = this.root.querySelector('[data-popup-input]');
        const isPrompt = options.mode === 'prompt';
        inputLabel.hidden = !isPrompt;
        input.value = isPrompt ? String(options.value ?? '') : '';
        input.type = options.inputType === 'password' ? 'password' : 'text';
        this.root.querySelector('[data-popup-input-caption]').textContent = options.inputLabel || 'Eingabe';

        return new Promise(resolve => {
            this.resolveActive = resolve;
            if (options.mode !== 'alert') {
                this.actions.appendChild(this._makeAction(options.cancelLabel || 'Abbrechen', false));
            }
            this.actions.appendChild(this._makeAction(options.confirmLabel || (isPrompt ? 'Übernehmen' : 'OK'), true));
            if (isPrompt) {
                this.promptKeyHandler = event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        this._settle(input.value);
                    }
                };
                input.addEventListener('keydown', this.promptKeyHandler);
            }
            requestAnimationFrame(() => {
                if (isPrompt) input.focus();
                else this.actions.querySelector('.popup-action-primary')?.focus();
            });
        });
    },

    _makeAction(label, primary) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `popup-action${primary ? ' popup-action-primary' : ''}`;
        button.textContent = label;
        button.addEventListener('click', () => {
            if (primary) {
                const input = this.root.querySelector('[data-popup-input]');
                const isPrompt = !this.root.querySelector('[data-popup-input-label]').hidden;
                this._settle(isPrompt ? input.value : true);
            } else {
                this._settle(this.activeMode === 'prompt' ? null : false);
            }
        });
        return button;
    },

    _dismiss() {
        if (this.activeMode === 'prompt') this._settle(null);
        else this._settle(this.activeMode === 'alert');
    },

    _settle(value) {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.backdrop.hidden = true;
        const input = this.root.querySelector('[data-popup-input]');
        if (this.promptKeyHandler) input.removeEventListener('keydown', this.promptKeyHandler);
        this.promptKeyHandler = null;
        this.resolveActive?.(value);
        this.resolveActive = null;
        if (this.previousFocus?.isConnected) this.previousFocus.focus();
    },

    _handleKeydown(event) {
        if (!this.isOpen) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            this._dismiss();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [...this.dialog.querySelectorAll('button:not(:disabled), input:not([hidden])')]
            .filter(element => element.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    },

    async _fallback(options) {
        if (options.mode === 'confirm') return window.confirm(String(options.message ?? ''));
        if (options.mode === 'prompt') return window.prompt(String(options.message ?? ''), options.value || '');
        window.alert(String(options.message ?? ''));
        return true;
    },

    async toast(message, options = {}) {
        const initialized = await this.init();
        if (!initialized) {
            console.info(`[${options.title || 'AstrieOS'}] ${message}`);
            return null;
        }

        const id = `popup-toast-${++this.toastSequence}`;
        const toast = document.createElement('article');
        toast.className = 'popup-toast';
        toast.dataset.type = ['success', 'warning', 'error'].includes(options.type) ? options.type : 'info';
        toast.id = id;
        const copy = document.createElement('div');
        copy.className = 'popup-toast-copy';
        const title = document.createElement('p');
        title.className = 'popup-toast-title';
        title.textContent = options.title || 'AstrieOS';
        const text = document.createElement('p');
        text.className = 'popup-toast-message';
        text.textContent = String(message ?? '');
        copy.append(title, text);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'popup-toast-close';
        close.setAttribute('aria-label', 'Mitteilung schließen');
        close.textContent = '×';
        close.addEventListener('click', () => this._removeToast(toast));
        toast.append(copy, close);
        this.root.querySelector('[data-popup-toasts]').appendChild(toast);

        const duration = Number.isFinite(options.duration) ? options.duration : 4200;
        if (duration > 0) window.setTimeout(() => this._removeToast(toast), duration);
        return id;
    },

    _removeToast(toast) {
        if (!toast?.isConnected) return;
        toast.classList.add('is-leaving');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
        window.setTimeout(() => toast.remove(), 250);
    }
};

window.Popup = Popup;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Popup.init(), { once: true });
} else {
    Popup.init();
}
