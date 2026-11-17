const Sound = {
    volume: 0.24,
    sounds: {},

    init() {
        const names = [
            'cursor-tap', 'default-hover', 'default-select', 'menu-close', 'menu-open',
            'notification-default', 'notification-done', 'notification-error', 'notification-cancel',
            'noclick-hover', 'noclick-select', 'notch-tick'
        ];
        const basePath = '/Res/Audio/Soundeffekt/System/';

        names.forEach(name => {
            const audio = new Audio();
            audio.preload = 'auto';
            audio.src = basePath + name + '.wav';
            this.sounds[name] = audio;
        });
    },

    play(name, playbackRate = 1, volume = this.volume) {
        const audio = this.sounds[name];
        if (!audio) return;

        const clone = audio.cloneNode();
        clone.volume = Math.max(0, Math.min(1, volume));
        clone.playbackRate = Math.max(0.75, Math.min(1.25, playbackRate));
        clone.play().catch(() => {});
    },

    playSliderTick(value, min, max) {
        const progress = max > min ? (value - min) / (max - min) : 0.5;
        // Keep the pitch range subtle while still following the slider position.
        this.play('notch-tick', 0.88 + Math.max(0, Math.min(1, progress)) * 0.24);
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
    const el = e.target.closest('button, .Topbar-btn, .Taskbar-app, .Placeholder-btn, a, .Benachricht-btn, .Benachricht-clear-btn, .Benachricht-clear, .Hintergrund-nutzer-upload, .Hintergrund-nutzer-wallhaven, .Hintergrund-audio-erlauben, .Mediaplayer-maincore-btn');
    if (el) Sound.play('default-hover');
});

document.addEventListener('click', (e) => {
    const el = e.target.closest('button, .Topbar-btn, .Taskbar-app, .Placeholder-btn, a, .Benachricht-clear-btn, .Benachricht-clear, .Hintergrund-nutzer-upload, .Hintergrund-nutzer-wallhaven, .Hintergrund-audio-erlauben, .Mediaplayer-maincore-btn');
    if (el) Sound.play('default-select');
});
