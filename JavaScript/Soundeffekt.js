const Sound = {
    volume: 0.24,
    sounds: {},

    init() {
        const names = [
            'cursor-tap', 'default-hover', 'default-select', 'menu-close', 'menu-open',
            'notification-default', 'notification-done', 'notification-error', 'notification-cancel' ,'.tada-meme'
        ];
        const basePath = '/Res/Audio/Soundeffekt/System/';

        names.forEach(name => {
            const audio = new Audio();
            audio.preload = 'auto';
            audio.src = basePath + name + '.wav';
            this.sounds[name] = audio;
        });

        names.forEach(name => {
            const audio = new Audio();
            audio.preload = 'auto';
            audio.src = basePath + name + '.mp3';
            this.sounds[name] = audio;
        })
    },

    play(name) {
        const audio = this.sounds[name];
        if (!audio) return;

        const clone = audio.cloneNode();
        clone.volume = this.volume;
        clone.play().catch(() => {});
    },

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
    },

    getVolume() {
        return this.volume;
    }
};

Sound.init();

document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('button, .Topbar-btn, .Taskbar-app, .Placeholder-btn, a, .Benachricht-btn, .Benachricht-clear-btn, .Benachricht-clear');
    if (el) Sound.play('default-hover');
});

document.addEventListener('click', (e) => {
    const el = e.target.closest('button, .Topbar-btn, .Taskbar-app, .Placeholder-btn, a, .Benachricht-clear-btn, .Benachricht-clear');
    if (el) Sound.play('default-select');
});
