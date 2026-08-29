const WindowManager = {
    windows: {},
    zIndexCounter: 10000000,
    template: null,
    headerHeight: 44,
    _dragState: null,
    _resizeState: null,
    _dragListenersInit: false,

    init(templateContent) {
        this.template = templateContent;
        this._initGlobalDragListeners();
    },

    _initGlobalDragListeners() {
        if (this._dragListenersInit) return;
        this._dragListenersInit = true;

        document.addEventListener('mousemove', (e) => {
            if (this._dragState) {
                const { id, startX, startY, startLeft, startTop } = this._dragState;
                const w = this.windows[id];
                if (!w) { this._dragState = null; return; }

                const newLeft = startLeft + e.clientX - startX;
                const newTop = startTop + e.clientY - startY;

                w.outline.style.left = newLeft + 'px';
                w.outline.style.top = newTop + 'px';
                w.content.style.left = newLeft + 'px';
                w.content.style.top = (newTop + this.headerHeight) + 'px';
                w.pos.x = newLeft;
                w.pos.y = newTop;
            }

            if (this._resizeState) {
                const { id, startX, startY, startWidth, startHeight } = this._resizeState;
                const w = this.windows[id];
                if (!w) { this._resizeState = null; return; }

                const maxWidth = Math.max(280, window.innerWidth - w.pos.x);
                const maxHeight = Math.max(180, window.innerHeight - w.pos.y - this.headerHeight);
                const newWidth = Math.min(Math.max(280, startWidth + e.clientX - startX), maxWidth);
                const newHeight = Math.min(Math.max(180, startHeight + e.clientY - startY), maxHeight);

                w.outline.style.width = newWidth + 'px';
                w.content.style.width = newWidth + 'px';
                w.content.style.height = newHeight + 'px';
                w.size = { w: newWidth, h: newHeight };
            }
        });

        document.addEventListener('mouseup', () => {
            if (this._dragState || this._resizeState) {
                this._dragState = null;
                this._resizeState = null;
                document.body.style.userSelect = '';
            }
        });
    },

    createWindow({ id, title, icon, content, width, height }) {
        if (!id || !this.template) return null;

        if (this.windows[id]) {
            const w = this.windows[id];
            if (w.minimized) {
                this.restoreWindow(id);
            } else {
                this.focusWindow(id);
            }
            return w;
        }

        const clone = this.template.cloneNode(true);
        const outline = clone.querySelector('.Window-outline');
        const windowContent = clone.querySelector('.Window-content');
        const header = clone.querySelector('.Window-header');
        const titleSpan = clone.querySelector('#Window-name');
        const iconImg = clone.querySelector('.Window-icon');
        const btnMinimize = clone.querySelector('.Window-hidden');
        const btnMaximize = clone.querySelector('.Window-fullscreen');
        const btnClose = clone.querySelector('.Window-schließen');

        if (titleSpan) titleSpan.textContent = title || 'Window';
        if (iconImg && icon) iconImg.src = icon;

        header.removeAttribute('id');
        outline.removeAttribute('id');
        windowContent.removeAttribute('id');

        const windowNumber = Object.keys(this.windows).length;
        const maxWidth = Math.max(280, window.innerWidth - 32);
        const maxHeight = Math.max(180, window.innerHeight - this.headerHeight - 32);
        const offsetX = Math.min(80 + (windowNumber * 30) % 200, Math.max(16, window.innerWidth - maxWidth - 16));
        const offsetY = Math.min(60 + (windowNumber * 30) % 150, Math.max(16, window.innerHeight - maxHeight - this.headerHeight - 16));

        const winWidth = Math.min(width || 600, maxWidth);
        const winHeight = Math.min(height || 400, maxHeight);

        outline.style.left = offsetX + 'px';
        outline.style.top = offsetY + 'px';
        outline.style.width = winWidth + 'px';
        outline.style.zIndex = this.zIndexCounter;

        windowContent.style.left = offsetX + 'px';
        windowContent.style.top = (offsetY + this.headerHeight) + 'px';
        windowContent.style.width = winWidth + 'px';
        windowContent.style.height = winHeight + 'px';
        windowContent.style.zIndex = this.zIndexCounter;

        outline.classList.add('Open');
        windowContent.classList.add('Open');

        if (content) {
            const contentBody = document.createElement('div');
            contentBody.style.width = '100%';
            contentBody.style.height = '100%';
            contentBody.style.overflow = 'hidden';
            contentBody.appendChild(content);
            windowContent.appendChild(contentBody);
        }

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'Window-resize-handle';
        resizeHandle.setAttribute('aria-label', 'Fenstergröße ändern');
        windowContent.appendChild(resizeHandle);

        document.body.appendChild(outline);
        document.body.appendChild(windowContent);

        this.windows[id] = {
            outline,
            content: windowContent,
            state: 'normal',
            minimized: false,
            pos: { x: offsetX, y: offsetY },
            size: { w: winWidth, h: winHeight },
            prevPos: null,
            prevSize: null
        };

        this.zIndexCounter++;
        this._initDrag(outline, id);
        this._initResize(resizeHandle, id);

        outline.addEventListener('mousedown', () => this.focusWindow(id));
        windowContent.addEventListener('mousedown', () => this.focusWindow(id));

        btnMinimize.addEventListener('click', (e) => {
            e.stopPropagation();
            this.minimizeWindow(id);
        });

        btnMaximize.addEventListener('click', (e) => {
            e.stopPropagation();
            this.maximizeWindow(id);
        });

        btnClose.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeWindow(id);
        });

        if (typeof Sound !== 'undefined') Sound.play('menu-open');
        return this.windows[id];
    },

    closeWindow(id) {
        const w = this.windows[id];
        if (!w) return;

        w.outline.remove();
        w.content.remove();
        delete this.windows[id];

        if (this._dragState && this._dragState.id === id) {
            this._dragState = null;
            document.body.style.userSelect = '';
        }
        if (this._resizeState && this._resizeState.id === id) {
            this._resizeState = null;
            document.body.style.userSelect = '';
        }

        if (typeof Sound !== 'undefined') Sound.play('menu-close');
    },

    minimizeWindow(id) {
        const w = this.windows[id];
        if (!w) return;

        w.minimized = true;
        w.outline.classList.add('minimized');
        w.content.classList.add('minimized');

        if (typeof Sound !== 'undefined') Sound.play('menu-close');
    },

    restoreWindow(id) {
        const w = this.windows[id];
        if (!w || !w.minimized) return;

        w.minimized = false;
        w.outline.classList.remove('minimized');
        w.content.classList.remove('minimized');
        this.focusWindow(id);
    },

    maximizeWindow(id) {
        const w = this.windows[id];
        if (!w) return;

        if (w.state === 'maximized') {
            w.state = 'normal';
            w.outline.classList.remove('maximized');
            w.content.classList.remove('maximized');

            if (w.prevPos) {
                w.outline.style.left = w.prevPos.x + 'px';
                w.outline.style.top = w.prevPos.y + 'px';
                w.outline.style.width = w.prevSize.w + 'px';
                w.outline.style.height = '';
                w.content.style.left = w.prevPos.x + 'px';
                w.content.style.top = (w.prevPos.y + this.headerHeight) + 'px';
                w.content.style.width = w.prevSize.w + 'px';
                w.content.style.height = w.prevSize.h + 'px';
            }
        } else {
            w.prevPos = { ...w.pos };
            w.prevSize = { w: w.size.w, h: w.size.h };
            w.state = 'maximized';
            w.outline.classList.add('maximized');
            w.content.classList.add('maximized');
        }
    },

    focusWindow(id) {
        const w = this.windows[id];
        if (!w) return;

        this.zIndexCounter++;
        w.outline.style.zIndex = this.zIndexCounter;
        w.content.style.zIndex = this.zIndexCounter;
    },

    _initDrag(outline, id) {
        const header = outline.querySelector('.Window-header');

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.Window-button')) return;

            const w = this.windows[id];
            if (!w || w.state === 'maximized') return;

            this._dragState = {
                id,
                startX: e.clientX,
                startY: e.clientY,
                startLeft: outline.offsetLeft,
                startTop: outline.offsetTop
            };

            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
    },

    _initResize(resizeHandle, id) {
        resizeHandle.addEventListener('mousedown', (e) => {
            const w = this.windows[id];
            if (!w || w.state === 'maximized') return;

            this.focusWindow(id);
            this._resizeState = {
                id,
                startX: e.clientX,
                startY: e.clientY,
                startWidth: w.content.offsetWidth,
                startHeight: w.content.offsetHeight
            };

            document.body.style.userSelect = 'none';
            e.preventDefault();
            e.stopPropagation();
        });
    }
};
