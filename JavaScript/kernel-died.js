(() => {
    const dialogSets = [
        { mood: 'surprise', lines: ['Äh… das war jetzt nicht der geplante Neustart.', 'Warte, du hast wirklich auf „Alle Daten löschen“ gedrückt?!', 'Okay, Überraschung gelungen. Ich war kurz selbst überrascht.'] },
        { mood: 'shocked', lines: ['SYSTEMFEHLER: Meine Fassung bewahren.dll wurde nicht gefunden.', 'Was ist gerade passiert? Warum ist hier plötzlich alles so schwarz?', 'Ich brauche kurz… einen Moment. Das war ein ziemlicher Schreck.'] },
        { mood: 'chill', lines: ['Na ja. Ein kleiner Systemabsturz gehört wohl zum Charakter.', 'Alles entspannt. Wir sitzen hier nur in einer Kernel Panic fest.', 'Atme durch. Gleich ist das dramatische Intro vorbei.'] },
        { mood: 'crashout', lines: ['WER HAT DEN LÖSCHKNOPF MIT DEM ABSTURZKNOPF VERKABELT?!', 'Ich hatte genau einen Job: nicht dramatisch abstürzen!', 'Okay, ich bin ruhig. NEIN, BIN ICH NICHT.'] },
        { mood: 'tsundere', lines: ['D-Denk jetzt bloß nicht, ich hätte mir Sorgen gemacht!', 'Das war kein Fehler. Ich wollte nur testen, ob du aufpasst.', 'Pah. Der kleine Absturz war sowieso nicht für dich gedacht.'] }
    ];

    const KernelDied = {
        startCrashSequence() {
            if (document.getElementById('kernel-crash-overlay')) return;
            const overlay = document.createElement('div');
            overlay.id = 'kernel-crash-overlay';
            overlay.setAttribute('aria-label', 'Systemabsturz-Sequenz');
            const canvas = document.createElement('canvas');
            const video = document.createElement('video');
            video.src = '/Res/video/videoplayback.mp4';
            video.autoplay = true;
            video.muted = false;
            video.playsInline = true;
            video.preload = 'auto';
            canvas.setAttribute('aria-hidden', 'true');
            overlay.append(canvas, video);
            document.body.appendChild(overlay);

            const audio = new Audio('/Res/Audio/Soundeffekt/system%20selfboom/vine-boom.mp3');
            audio.volume = 1;
            audio.play().catch(() => {});

            const context = canvas.getContext('2d', { willReadFrequently: true });
            let animationFrame = 0;
            const render = () => {
                if (video.readyState >= 2 && video.videoWidth) {
                    const scale = Math.min(1, 960 / video.videoWidth);
                    const frameWidth = Math.round(video.videoWidth * scale);
                    const frameHeight = Math.round(video.videoHeight * scale);
                    if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
                        canvas.width = frameWidth;
                        canvas.height = frameHeight;
                    }
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
                    const pixels = frame.data;
                    for (let i = 0; i < pixels.length; i += 4) {
                        const green = pixels[i + 1];
                        if (green > 75 && green > pixels[i] * 1.28 && green > pixels[i + 2] * 1.2) {
                            const strength = Math.min(1, (green - Math.max(pixels[i], pixels[i + 2])) / 90);
                            pixels[i + 3] = Math.round(pixels[i + 3] * (1 - strength));
                        }
                    }
                    context.putImageData(frame, 0, 0);
                }
                animationFrame = requestAnimationFrame(render);
            };
            render();

            const redirect = () => {
                cancelAnimationFrame(animationFrame);
                window.location.href = '/ripiguess.html';
            };
            video.addEventListener('ended', redirect, { once: true });
            window.setTimeout(redirect, 5200);
            video.play().catch(() => {});
        },

        async showDialog() {
            const root = document.querySelector('.kernel-died-lol');
            const stream = document.querySelector('.kernel-dialog');
            if (!root || !stream) return;
            const scene = dialogSets[Math.floor(Math.random() * dialogSets.length)];
            root.dataset.mood = scene.mood;
            const shuffled = [...scene.lines].sort(() => Math.random() - 0.5);
            await new Promise(resolve => window.setTimeout(resolve, 900 + Math.random() * 1300));
            for (const line of shuffled) {
                const bubble = document.createElement('p');
                bubble.className = 'kernel-line';
                bubble.setAttribute('aria-live', 'polite');
                stream.appendChild(bubble);
                for (const character of line) {
                    bubble.textContent += character;
                    await new Promise(resolve => window.setTimeout(resolve, 22 + Math.random() * 34));
                }
                await new Promise(resolve => window.setTimeout(resolve, 500 + Math.random() * 1200));
            }
        }
    };

    window.KernelDied = KernelDied;
    if (document.querySelector('.kernel-died-lol')) {
        KernelDied.showDialog();
        window.setTimeout(() => window.location.replace('/index.html'), 12000);
    }
})();
