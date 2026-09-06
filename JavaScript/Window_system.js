/* AstrieOS window manager — public API remains compatible with the old one. */
const WindowManager = {
    windows: Object.create(null),
    template: null,
    zIndexCounter: 100000,
    minWidth: 280,
    minHeight: 180,
    edgePadding: 12,
    _interaction: null,
    _listenersInstalled: false,

    init(templateContent) {
        this.template = templateContent;
        this._installGlobalListeners();
    },

    createWindow({ id, title = 'Fenster', icon = '', content, width = 600, height = 400 } = {}) {
        if (!id) throw new Error('Für ein Fenster wird eine eindeutige ID benötigt.');
        if (!this.template) {
            console.warn('WindowManager ist noch nicht initialisiert.');
            return null;
        }

        const existing = this.windows[id];
        if (existing) {
            existing.minimized ? this.restoreWindow(id) : this.focusWindow(id);
            return existing;
        }

        const fragment = this.template.cloneNode(true);
        const outline = fragment.querySelector('.Window-outline');
        const windowContent = fragment.querySelector('.Window-content');
        const header = fragment.querySelector('.Window-header');
        if (!outline || !windowContent || !header) throw new Error('Ungültiges Fenster-Template.');

        const titleElement = fragment.querySelector('#Window-name');
        const iconElement = fragment.querySelector('.Window-icon');
        const minimizeButton = fragment.querySelector('.Window-hidden');
        const maximizeButton = fragment.querySelector('.Window-fullscreen');
        const closeButton = fragment.querySelector('.Window-schließen');
        titleElement?.removeAttribute('id');
        if (titleElement) titleElement.textContent = title;
        if (iconElement && icon) iconElement.src = icon;
        outline.removeAttribute('id');
        windowContent.removeAttribute('id');
        outline.dataset.windowId = id;
        windowContent.dataset.windowId = id;

        document.body.append(fragment);
        // The outline owns the header padding, so its rendered height is the
        // actual offset at which the content layer must begin.
        const headerHeight = Math.ceil(outline.getBoundingClientRect().height) || 44;
        const position = this._nextPosition();
        const size = this._fitSize(width, height, position, headerHeight);
        const win = {
            id, outline, content: windowContent, header, headerHeight,
            state: 'normal', minimized: false, pos: position, size, previous: null
        };
        this.windows[id] = win;

        if (content) {
            const body = document.createElement('div');
            body.className = 'Window-body';
            body.style.cssText = 'width:100%;height:100%;overflow:auto;';
            body.append(content);
            windowContent.prepend(body);
        }
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'Window-resize-handle';
        resizeHandle.setAttribute('role', 'separator');
        resizeHandle.setAttribute('aria-label', 'Fenstergröße ändern');
        windowContent.append(resizeHandle);

        this._setGeometry(win, position, size);
        outline.classList.add('Open');
        windowContent.classList.add('Open');
        this._wireWindow(win, {
            minimizeButton,
            maximizeButton,
            closeButton,
            resizeHandle
        });
        this.focusWindow(id);
        this._playSound('menu-open');
        return win;
    },

    closeWindow(id) {
        const win = this.windows[id];
        if (!win) return false;
        if (this._interaction?.id === id) this._stopInteraction();
        win.outline.remove();
        win.content.remove();
        delete this.windows[id];
        this._playSound('menu-close');
        return true;
    },

    minimizeWindow(id) {
        const win = this.windows[id];
        if (!win || win.minimized) return false;
        this._stopInteraction();
        win.minimized = true;
        win.outline.classList.add('minimized');
        win.content.classList.add('minimized');
        this._playSound('menu-close');
        return true;
    },

    restoreWindow(id) {
        const win = this.windows[id];
        if (!win || !win.minimized) return false;
        win.minimized = false;
        win.outline.classList.remove('minimized');
        win.content.classList.remove('minimized');
        this.focusWindow(id);
        this._playSound('menu-open');
        return true;
    },

    maximizeWindow(id) {
        const win = this.windows[id];
        if (!win || win.minimized) return false;
        this._stopInteraction();
        if (win.state === 'maximized') {
            win.state = 'normal';
            win.outline.classList.remove('maximized');
            win.content.classList.remove('maximized');
            const previous = win.previous || { pos: this._nextPosition(), size: { w: 600, h: 400 } };
            this._clearImportantGeometry(win);
            this._setGeometry(win, previous.pos, this._fitSize(previous.size.w, previous.size.h, previous.pos, win.headerHeight));
        } else {
            win.previous = { pos: { ...win.pos }, size: { ...win.size } };
            win.state = 'maximized';
            win.outline.classList.add('maximized');
            win.content.classList.add('maximized');
            this._setMaximizedGeometry(win);
        }
        this.focusWindow(id);
        return true;
    },

    focusWindow(id) {
        const win = this.windows[id];
        if (!win || win.minimized) return false;
        const zIndex = ++this.zIndexCounter;
        win.outline.style.zIndex = zIndex;
        win.content.style.zIndex = zIndex;
        Object.values(this.windows).forEach((item) => {
            item.outline.classList.toggle('is-focused', item === win);
            item.content.classList.toggle('is-focused', item === win);
        });
        return true;
    },

    _wireWindow(win, controls) {
        const { minimizeButton, maximizeButton, closeButton, resizeHandle } = controls;
        const activate = () => this.focusWindow(win.id);
        win.header.style.touchAction = 'none';
        resizeHandle.style.touchAction = 'none';
        win.outline.addEventListener('pointerdown', activate);
        win.content.addEventListener('pointerdown', activate);
        win.header.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || event.target.closest('.Window-button') || win.state === 'maximized') return;
            this._beginInteraction(event, win, 'move');
        });
        win.header.addEventListener('dblclick', (event) => {
            if (!event.target.closest('.Window-button')) this.maximizeWindow(win.id);
        });
        resizeHandle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || win.state === 'maximized') return;
            event.stopPropagation();
            this._beginInteraction(event, win, 'resize');
        });
        this._makeButton(minimizeButton, 'Fenster minimieren', () => this.minimizeWindow(win.id));
        this._makeButton(maximizeButton, 'Fenster maximieren oder wiederherstellen', () => this.maximizeWindow(win.id));
        this._makeButton(closeButton, 'Fenster schließen', () => this.closeWindow(win.id));
    },

    _makeButton(element, label, action) {
        if (!element) return;
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
        element.setAttribute('aria-label', label);
        element.addEventListener('click', (event) => { event.stopPropagation(); action(); });
        element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                action();
            }
        });
    },

    _beginInteraction(event, win, type) {
        this.focusWindow(win.id);
        this._interaction = {
            id: win.id, type, pointerId: event.pointerId,
            startX: event.clientX, startY: event.clientY,
            pos: { ...win.pos }, size: { ...win.size }
        };
        document.body.classList.add('Window-interacting');
        event.preventDefault();
    },

    _installGlobalListeners() {
        if (this._listenersInstalled) return;
        this._listenersInstalled = true;
        document.addEventListener('pointermove', (event) => this._updateInteraction(event));
        document.addEventListener('pointerup', (event) => this._finishInteraction(event));
        document.addEventListener('pointercancel', (event) => this._finishInteraction(event));
        window.addEventListener('resize', () => this._fitAllWindows());
        window.addEventListener('blur', () => this._stopInteraction());
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this._interaction) this._stopInteraction();
        });
    },

    _updateInteraction(event) {
        const action = this._interaction;
        if (!action || action.pointerId !== event.pointerId) return;
        const win = this.windows[action.id];
        if (!win) return this._stopInteraction();
        const dx = event.clientX - action.startX;
        const dy = event.clientY - action.startY;
        const bounds = this._availableBounds();
        if (action.type === 'move') {
            const pos = {
                x: this._clamp(action.pos.x + dx, this.edgePadding - win.size.w + 80, bounds.width - 80),
                y: this._clamp(action.pos.y + dy, 0, bounds.height - win.headerHeight)
            };
            this._setGeometry(win, pos, win.size);
        } else {
            const maxWidth = Math.max(this.minWidth, bounds.width - win.pos.x);
            const maxHeight = Math.max(this.minHeight, bounds.height - win.pos.y - win.headerHeight);
            this._setGeometry(win, win.pos, {
                w: this._clamp(action.size.w + dx, this.minWidth, maxWidth),
                h: this._clamp(action.size.h + dy, this.minHeight, maxHeight)
            });
        }
    },

    _finishInteraction(event) {
        if (this._interaction?.pointerId === event.pointerId) this._stopInteraction();
    },

    _stopInteraction() {
        this._interaction = null;
        document.body.classList.remove('Window-interacting');
    },

    _fitAllWindows() {
        Object.values(this.windows).forEach((win) => {
            if (win.state === 'maximized') return this._setMaximizedGeometry(win);
            const bounds = this._availableBounds();
            const pos = {
                x: this._clamp(win.pos.x, this.edgePadding - win.size.w + 80, bounds.width - 80),
                y: this._clamp(win.pos.y, 0, Math.max(0, bounds.height - win.headerHeight))
            };
            this._setGeometry(win, pos, this._fitSize(win.size.w, win.size.h, pos, win.headerHeight));
        });
    },

    _setGeometry(win, pos, size) {
        win.pos = { ...pos };
        win.size = { ...size };
        this._setStyle(win.outline, { left: `${pos.x}px`, top: `${pos.y}px`, width: `${size.w}px`, height: `${win.headerHeight}px` });
        this._setStyle(win.content, { left: `${pos.x}px`, top: `${pos.y + win.headerHeight}px`, width: `${size.w}px`, height: `${size.h}px` });
    },

    _setMaximizedGeometry(win) {
        const bounds = this._availableBounds();
        this._setStyle(win.outline, { left: '0px', top: '0px', width: `${bounds.width}px`, height: `${win.headerHeight}px` }, true);
        this._setStyle(win.content, { left: '0px', top: `${win.headerHeight}px`, width: `${bounds.width}px`, height: `${Math.max(0, bounds.height - win.headerHeight)}px` }, true);
    },

    _clearImportantGeometry(win) {
        ['left', 'top', 'width', 'height'].forEach((property) => {
            win.outline.style.removeProperty(property);
            win.content.style.removeProperty(property);
        });
    },

    _setStyle(element, properties, important = false) {
        Object.entries(properties).forEach(([name, value]) => element.style.setProperty(name, value, important ? 'important' : ''));
    },

    _fitSize(width, height, pos, headerHeight) {
        const bounds = this._availableBounds();
        return {
            w: this._clamp(Number(width) || 600, Math.min(this.minWidth, bounds.width), Math.max(this.minWidth, bounds.width - Math.max(pos.x, 0))),
            h: this._clamp(Number(height) || 400, Math.min(this.minHeight, bounds.height - headerHeight), Math.max(this.minHeight, bounds.height - pos.y - headerHeight))
        };
    },

    _nextPosition() {
        const index = Object.keys(this.windows).length;
        const bounds = this._availableBounds();
        return {
            x: this._clamp(72 + (index * 28) % 196, this.edgePadding, Math.max(this.edgePadding, bounds.width - 160)),
            y: this._clamp(58 + (index * 28) % 140, 0, Math.max(0, bounds.height - 100))
        };
    },

    _availableBounds() { return { width: window.innerWidth, height: window.innerHeight }; },
    _clamp(value, min, max) { return Math.min(Math.max(value, min), Math.max(min, max)); },
    _playSound(name) {
        if (typeof Sound !== 'undefined' && typeof Sound.play === 'function') Sound.play(name);
    }
};
