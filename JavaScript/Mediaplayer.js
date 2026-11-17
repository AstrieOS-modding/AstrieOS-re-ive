const Mediaplayer = {
    DB_NAME: 'astrieos_mediaplayer',
    DB_STORE: 'tracks',
    dbPromise: null,
    tracks: [],
    currentIndex: -1,
    audio: document.createElement('video'),
    objectUrls: new Map(),
    bound: false,
    seekDragging: false,
    beatmapHitTimes: [],
    nextHitIndex: 0,
    fadingPlayers: new Set(),
    audioContext: null,
    analyser: null,
    gainNode: null,
    visualizerFrame: 0,
    titleResizeObserver: null,

    init() {
        const attach = () => {
            if (this.bound || !document.querySelector('.Mediaplayer-placeholder')) return;
            this.bound = true;
            this.audio.preload = 'metadata';
            this.audio.dataset.musicPlayer = 'true';
            this.audio.hidden = true;
            this.audio.playsInline = true;
            this.updateVolume();
            document.body.appendChild(this.audio);
            this.bindPlayerControls();
            this.attachSettingsControls();
            this.watchTitleSize();
            this.loadLibrary();
        };
        attach();
        document.addEventListener('mediaplayer-template-ready', attach);
        document.addEventListener('settings-template-ready', () => this.attachSettingsControls());
    },

    openDB() {
        if (this.dbPromise) return this.dbPromise;
        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(this.DB_STORE, { keyPath: 'id' });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return this.dbPromise;
    },

    async storeTrack(track) {
        const db = await this.openDB();
        await new Promise((resolve, reject) => {
            const request = db.transaction(this.DB_STORE, 'readwrite').objectStore(this.DB_STORE).put(track);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
    },

    async loadLibrary() {
        try {
            const db = await this.openDB();
            this.tracks = await new Promise((resolve, reject) => {
                const request = db.transaction(this.DB_STORE).objectStore(this.DB_STORE).getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
            this.tracks.sort((a, b) => a.addedAt - b.addedAt);
            this.renderPlaylist();
            const lastId = Nutzerspeicher.getSetting('mediaplayerCurrentTrack');
            const index = this.tracks.findIndex(track => track.id === lastId);
            if (index >= 0) this.select(index, false);
        } catch (error) {
            console.error('[Mediaplayer] Musikbibliothek konnte nicht geladen werden:', error);
            this.setStatus('Lokaler Musik-Speicher ist nicht verfügbar.');
        }
    },

    bindPlayerControls() {
        const root = document.querySelector('.Mediaplayer-placeholder');
        root.querySelector('[data-player-upload]')?.addEventListener('change', event => this.importFiles([...event.target.files]));
        root.querySelector('[data-player-previous]')?.addEventListener('click', () => this.step(-1));
        root.querySelector('[data-player-next]')?.addEventListener('click', () => this.step(1));
        root.querySelector('[data-player-toggle]')?.addEventListener('click', () => this.togglePlayback());
        root.querySelector('[data-player-shuffle]')?.addEventListener('click', event => {
            const enabled = event.currentTarget.getAttribute('aria-pressed') !== 'true';
            event.currentTarget.setAttribute('aria-pressed', String(enabled));
            Nutzerspeicher.setSetting('mediaplayerShuffle', enabled);
        });
        const seek = root.querySelector('[data-player-seek]');
        seek?.addEventListener('input', () => {
            this.seekDragging = true;
            if (Number.isFinite(this.audio.duration)) this.audio.currentTime = this.audio.duration * Number(seek.value) / 1000;
            this.renderTime();
            this.syncCoverPlayback(!this.audio.paused);
        });
        seek?.addEventListener('change', () => { this.seekDragging = false; });
        this.audio.addEventListener('timeupdate', () => {
            if (!this.seekDragging && Number.isFinite(this.audio.duration)) {
                seek.value = String(Math.round(this.audio.currentTime / this.audio.duration * 1000));
            }
            this.renderTime();
            this.playBeatmapHits();
            this.syncCoverPlayback(!this.audio.paused);
            this.drawVisualizer();
        });
        this.audio.addEventListener('ended', () => this.step(1));
        this.audio.addEventListener('play', () => {
            this.renderPlayButton(true);
            this.syncCoverPlayback(true);
            if (Nutzerspeicher.getSetting('visualizerEnabled', false)) {
                this.ensureAudioGraph().then(() => this.drawVisualizer()).catch(error => console.warn('[Mediaplayer] Visualizer nicht verfügbar:', error));
            }
        });
        this.audio.addEventListener('pause', () => {
            this.renderPlayButton(false);
            this.syncCoverPlayback(false);
        });
        this.audio.addEventListener('error', () => this.setStatus('Diese Audiodatei kann der Browser nicht abspielen.'));
    },

    async importFiles(files) {
        const input = document.querySelector('[data-player-upload]');
        if (input) input.value = '';
        if (!files.length) return;
        const fileMap = new Map(files.map(file => [file.name.toLowerCase(), file]));
        const beatmaps = files.filter(file => file.name.toLowerCase().endsWith('.osu'));
        const archives = files.filter(file => file.name.toLowerCase().endsWith('.osz'));
        const beatmapAudioNames = new Set();
        const coverFiles = files.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/') || /\.(png|jpe?g|webp|gif|apng|mp4|webm|mov)$/i.test(file.name));
        let added = 0;

        for (const mapFile of beatmaps) {
            try {
                const metadata = this.parseBeatmap(await mapFile.text());
                if (metadata.audioFilename) beatmapAudioNames.add(metadata.audioFilename.split('/').pop().toLowerCase());
                const audioFile = fileMap.get(metadata.audioFilename.toLowerCase()) || files.find(file => file.name.toLowerCase().split('/').pop() === metadata.audioFilename.split('/').pop().toLowerCase());
                if (audioFile) {
                    await this.addTrack(audioFile, { title: metadata.title || audioFile.name, artist: metadata.artist, beatmap: metadata, files });
                    added++;
                } else this.setStatus(`Beatmap-Audio nicht mit ausgewählt: ${metadata.audioFilename}`);
            } catch (error) {
                console.warn('[Mediaplayer] Beatmap konnte nicht gelesen werden:', error);
            }
        }

        for (const archive of archives) {
            try {
                const entries = await this.extractZip(archive);
                const mapEntry = entries.find(entry => entry.name.toLowerCase().endsWith('.osu'));
                if (!mapEntry) continue;
                const metadata = this.parseBeatmap(await mapEntry.blob.text());
                if (metadata.audioFilename) beatmapAudioNames.add(metadata.audioFilename.split('/').pop().toLowerCase());
                const audioEntry = entries.find(entry => entry.name.toLowerCase().split('/').pop() === metadata.audioFilename.toLowerCase());
                if (audioEntry) {
                    await this.addTrack(audioEntry.blob, { title: metadata.title || metadata.audioFilename, artist: metadata.artist, beatmap: metadata, files: entries.map(entry => entry.file) });
                    added++;
                }
            } catch (error) {
                console.error('[Mediaplayer] .osz konnte nicht entpackt werden:', error);
                this.setStatus('Diese .osz-Datei konnte nicht entpackt werden.');
            }
        }

        for (const file of files.filter(file => file.type.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|aac|flac|opus)$/i.test(file.name))) {
            if (beatmapAudioNames.has(file.name.toLowerCase())) continue;
            await this.addTrack(file, { title: file.name.replace(/\.[^.]+$/, ''), artist: 'Lokale Datei', files: coverFiles });
            added++;
        }
        const containsAudio = files.some(file => file.type.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|aac|flac|opus)$/i.test(file.name));
        if (!containsAudio && !beatmaps.length && !archives.length) {
            for (const file of files.filter(file => file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name))) {
                await this.addTrack(file, { title: file.name.replace(/\.[^.]+$/, ''), artist: 'Lokales Video', type: 'video', files: [file] });
                added++;
            }
        }
        this.renderPlaylist();
        this.setStatus(added ? `${added} Titel zur Bibliothek hinzugefügt.` : 'Keine unterstützten Audiodateien gefunden.');
        if (added && this.currentIndex < 0) this.select(0, true);
    },

    parseBeatmap(text) {
        const section = text.match(/\[General\]([\s\S]*?)(?:\r?\n\[|$)/i)?.[1] || '';
        const metadata = text.match(/\[Metadata\]([\s\S]*?)(?:\r?\n\[|$)/i)?.[1] || '';
        const events = text.match(/\[Events\]([\s\S]*?)(?:\r?\n\[|$)/i)?.[1] || '';
        const hitObjects = text.match(/\[HitObjects\]([\s\S]*?)(?:\r?\n\[|$)/i)?.[1] || '';
        const value = (source, key) => source.match(new RegExp(`^${key}:(.*)$`, 'mi'))?.[1]?.trim() || '';
        const videoLine = events.match(/^Video,\s*([^,]+),\s*"([^"]+)"/mi);
        const backgroundLine = events.match(/^0,\s*0,\s*"([^"]+)"/mi);
        return {
            audioFilename: value(section, 'AudioFilename'),
            title: value(metadata, 'TitleUnicode') || value(metadata, 'Title'),
            artist: value(metadata, 'ArtistUnicode') || value(metadata, 'Artist'),
            videoFilename: videoLine?.[2] || '',
            videoOffset: Number(videoLine?.[1]) || 0,
            backgroundFilename: backgroundLine?.[1] || '',
            hitTimes: hitObjects.split(/\r?\n/).map(line => Number(line.split(',')[2])).filter(Number.isFinite).sort((a, b) => a - b)
        };
    },

    async extractZip(file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const view = new DataView(bytes.buffer);
        let end = -1;
        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
            if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
        }
        if (end < 0) throw new Error('ZIP directory not found');
        const count = view.getUint16(end + 10, true);
        let cursor = view.getUint32(end + 16, true);
        const entries = [];
        for (let i = 0; i < count; i++) {
            if (view.getUint32(cursor, true) !== 0x02014b50) break;
            const method = view.getUint16(cursor + 10, true);
            const compressedSize = view.getUint32(cursor + 20, true);
            const nameLength = view.getUint16(cursor + 28, true);
            const extraLength = view.getUint16(cursor + 30, true);
            const commentLength = view.getUint16(cursor + 32, true);
            const localOffset = view.getUint32(cursor + 42, true);
            const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
            const localNameLength = view.getUint16(localOffset + 26, true);
            const localExtraLength = view.getUint16(localOffset + 28, true);
            const dataStart = localOffset + 30 + localNameLength + localExtraLength;
            let data = bytes.slice(dataStart, dataStart + compressedSize);
            if (method === 8) {
                if (typeof DecompressionStream === 'undefined') throw new Error('Deflate decompression unavailable');
                const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
                data = new Uint8Array(await new Response(stream).arrayBuffer());
            } else if (method !== 0) {
                cursor += 46 + nameLength + extraLength + commentLength;
                continue;
            }
            const blob = new Blob([data]);
            entries.push({ name, blob, file: new File([blob], name.split('/').pop()) });
            cursor += 46 + nameLength + extraLength + commentLength;
        }
        return entries;
    },

    async addTrack(file, details = {}) {
        const assets = details.files ? details.files.map(asset => ({ name: asset.name, type: asset.type || '', blob: asset })) : [];
        if (!assets.some(asset => /\.(png|jpe?g|webp|gif|apng)$/i.test(asset.name))) {
            const embeddedCover = await this.extractEmbeddedCover(file);
            if (embeddedCover) assets.push(embeddedCover);
        }
        const track = {
            id: crypto.randomUUID(),
            title: details.title || file.name,
            artist: details.artist || 'Unbekannt',
            type: details.beatmap ? 'osu' : (details.type || 'audio'),
            beatmap: details.beatmap || null,
            blob: file,
            files: assets,
            addedAt: Date.now()
        };
        await this.storeTrack(track);
        this.tracks.push(track);
    },

    async extractEmbeddedCover(file) {
        if (!/\.mp3$/i.test(file.name)) return null;
        const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
        if (header.length < 10 || String.fromCharCode(...header.slice(0, 3)) !== 'ID3') return null;
        const version = header[3];
        const tagSize = (header[6] & 0x7f) * 0x200000 + (header[7] & 0x7f) * 0x4000 + (header[8] & 0x7f) * 0x80 + (header[9] & 0x7f);
        const bytes = new Uint8Array(await file.slice(10, 10 + tagSize).arrayBuffer());
        for (let offset = 0; offset + 10 < bytes.length;) {
            const id = String.fromCharCode(...bytes.slice(offset, offset + 4));
            if (!/^[A-Z0-9]{4}$/.test(id)) break;
            const sizeBytes = bytes.slice(offset + 4, offset + 8);
            const size = version >= 4
                ? ((sizeBytes[0] & 0x7f) << 21) | ((sizeBytes[1] & 0x7f) << 14) | ((sizeBytes[2] & 0x7f) << 7) | (sizeBytes[3] & 0x7f)
                : new DataView(sizeBytes.buffer, sizeBytes.byteOffset, 4).getUint32(0, false);
            const start = offset + 10;
            const frame = bytes.slice(start, start + size);
            if (id === 'APIC' && frame.length > 5) {
                const encoding = frame[0];
                let cursor = 1;
                while (cursor < frame.length && frame[cursor] !== 0) cursor++;
                const mime = new TextDecoder().decode(frame.slice(1, cursor)) || 'image/jpeg';
                cursor += 2; // MIME terminator plus picture type.
                if (encoding === 1 || encoding === 2) {
                    while (cursor + 1 < frame.length && (frame[cursor] !== 0 || frame[cursor + 1] !== 0)) cursor += 2;
                    cursor += 2;
                } else {
                    while (cursor < frame.length && frame[cursor] !== 0) cursor++;
                    cursor++;
                }
                const image = new Blob([frame.slice(cursor)], { type: mime });
                if (image.size) return { name: `embedded-cover.${mime.split('/')[1] || 'jpg'}`, type: mime, blob: image };
            }
            if (!size) break;
            offset = start + size;
        }
        return null;
    },

    renderPlaylist() {
        const list = document.querySelector('.Mediaplayer-box-scroll');
        if (!list) return;
        list.replaceChildren();
        this.tracks.forEach((track, index) => {
            const row = document.createElement('div');
            row.className = 'Mediaplayer-btn';
            row.setAttribute('aria-current', String(index === this.currentIndex));
            const title = document.createElement('span');
            title.className = 'Mediaplayer-btn-title';
            title.textContent = track.title;
            const artist = document.createElement('span');
            artist.className = 'Mediaplayer-btn-artour';
            artist.textContent = `${track.artist || 'Unbekannt'}${track.type === 'osu' ? ' · osu!' : ''}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'Mediaplayer-btn-nuke';
            remove.setAttribute('aria-label', `„${track.title}“ aus der Bibliothek löschen`);
            const removeIcon = document.createElement('img');
            removeIcon.src = '/Res/Bild/Icon/Mediaplayer/delete_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg';
            removeIcon.alt = '';
            remove.appendChild(removeIcon);
            remove.addEventListener('click', event => {
                event.stopPropagation();
                this.removeTrack(track.id);
            });
            row.append(title, artist, remove);
            row.addEventListener('click', () => this.select(index, true));
            list.appendChild(row);
        });
    },

    select(index, play = false) {
        if (!this.tracks.length) return;
        const wasPlaying = !this.audio.paused;
        const crossfadeSeconds = Nutzerspeicher.getSetting('crossfadeEnabled', false)
            ? Number(Nutzerspeicher.getSetting('crossfadeSeconds', 0))
            : 0;
        this.stopFadeOutPlayers();
        if (play && wasPlaying && crossfadeSeconds > 0) this.fadePreviousAudio(crossfadeSeconds);
        this.currentIndex = (index + this.tracks.length) % this.tracks.length;
        const track = this.tracks[this.currentIndex];
        let url = this.objectUrls.get(track.id);
        if (!url) {
            url = URL.createObjectURL(track.blob);
            this.objectUrls.set(track.id, url);
        }
        this.audio.src = url;
        this.updateVolume();
        document.querySelector('.Mediaplayer-title').textContent = track.title;
        this.updateTitleScroll();
        document.getElementById('Mediaplayer-arthur-id').textContent = track.artist || 'Unbekannt';
        Nutzerspeicher.setSetting('mediaplayerCurrentTrack', track.id);
        this.renderPlaylist();
        this.renderCover(track);
        if (track.type === 'osu' && Nutzerspeicher.getSetting('osuOptions', {}).enabled) {
            this.beatmapHitTimes = track.beatmap?.hitTimes || [];
            this.nextHitIndex = this.beatmapHitTimes.findIndex(time => time >= this.audio.currentTime * 1000);
            if (this.nextHitIndex < 0) this.nextHitIndex = this.beatmapHitTimes.length;
        } else {
            this.beatmapHitTimes = [];
            this.nextHitIndex = 0;
        }
        if (play) {
            if (this.gainNode) {
                this.audio.volume = 1;
                this.gainNode.gain.value = crossfadeSeconds > 0 ? 0 : this.targetVolume();
            } else this.audio.volume = crossfadeSeconds > 0 ? 0 : this.targetVolume();
            this.audio.play().then(() => {
                if (crossfadeSeconds > 0) this.fadeAudio(this.audio, this.targetVolume(), crossfadeSeconds);
            }).catch(error => this.setStatus(`Wiedergabe konnte nicht gestartet werden: ${error.message}`));
        }
    },

    applyBeatmap(track) {
        const options = Nutzerspeicher.getSetting('osuOptions', {});
        const master = options.enabled === true;
        const auto = master && options.autoEffects === true;
        const files = track.files || [];
        const videoFilename = track.beatmap?.videoFilename;
        const cover = document.querySelector('.cover-overlay');
        document.querySelector('.Mediaplayer-beatmap-video')?.remove();
        if (!master) return;
        if ((options.video || auto) && videoFilename) {
            const file = files.find(item => item.name.toLowerCase().split('/').pop() === videoFilename.split('/').pop().toLowerCase());
            if (file && cover) {
                const video = document.createElement('video');
                video.className = 'Mediaplayer-beatmap-video';
                video.src = this.assetUrl(track, file);
                video.autoplay = true;
                video.loop = true;
                video.muted = true;
                video.playsInline = true;
                cover.prepend(video);
                this.syncCoverPlayback(!this.audio.paused);
            }
        }
        if ((options.storyboard || auto) && track.beatmap?.backgroundFilename) {
            const file = files.find(item => item.name.toLowerCase().split('/').pop() === track.beatmap.backgroundFilename.split('/').pop().toLowerCase());
            const image = document.querySelector('.cover-center');
            if (file && image) image.src = this.assetUrl(track, file);
        }
    },

    assetUrl(track, asset) {
        const key = `${track.id}:${asset.name}`;
        if (!this.objectUrls.has(key)) this.objectUrls.set(key, URL.createObjectURL(asset.blob || asset));
        return this.objectUrls.get(key);
    },

    renderCover(track) {
        this.clearBeatmapVisuals();
        const image = document.querySelector('.cover-center');
        const files = track.files || [];
        let cover = null;
        if (track.type === 'osu' && track.beatmap?.backgroundFilename) {
            cover = files.find(asset => asset.name.toLowerCase().split('/').pop() === track.beatmap.backgroundFilename.split('/').pop().toLowerCase());
        }
        if (!cover) cover = files.find(asset => /\.(png|jpe?g|webp|gif|apng)$/i.test(asset.name));
        const videoCover = track.type !== 'osu' && files.find(asset => /\.(mp4|webm|mov)$/i.test(asset.name));
        if (cover && image) image.src = this.assetUrl(track, cover);
        if (videoCover) {
            const video = document.createElement('video');
            video.className = 'Mediaplayer-beatmap-video';
            video.src = this.assetUrl(track, videoCover);
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            document.querySelector('.cover-overlay')?.prepend(video);
            this.syncCoverPlayback(!this.audio.paused);
        } else if (track.type === 'osu') this.applyBeatmap(track);
    },

    syncCoverPlayback(playing) {
        const cover = document.querySelector('.Mediaplayer-cover');
        cover?.classList.toggle('is-playing', playing);
        const video = cover?.querySelector('.Mediaplayer-beatmap-video');
        if (!video) return;
        if (video.readyState >= 1) {
            const track = this.tracks[this.currentIndex];
            const offset = track?.type === 'osu' ? (track.beatmap?.videoOffset || 0) / 1000 : 0;
            const wantedTime = Math.max(0, this.audio.currentTime - offset);
            if (!playing || Math.abs(video.currentTime - wantedTime) > 0.25) {
                try { video.currentTime = wantedTime; } catch {}
            }
        }
        if (playing) video.play().catch(() => {});
        else video.pause();
    },

    clearBeatmapVisuals() {
        document.querySelector('.Mediaplayer-beatmap-video')?.remove();
        const image = document.querySelector('.cover-center');
        if (image) image.src = '/Res/Bild/Hintergrund/Default-Banner.png';
    },

    async removeTrack(id) {
        const index = this.tracks.findIndex(track => track.id === id);
        if (index < 0) return;
        if (!window.confirm(`„${this.tracks[index].title}“ aus der Mediathek löschen?`)) return;
        const wasCurrent = index === this.currentIndex;
        if (wasCurrent) this.audio.pause();
        const db = await this.openDB();
        await new Promise((resolve, reject) => {
            const request = db.transaction(this.DB_STORE, 'readwrite').objectStore(this.DB_STORE).delete(id);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
        for (const [key, url] of this.objectUrls) {
            if (key === id || key.startsWith(`${id}:`)) {
                URL.revokeObjectURL(url);
                this.objectUrls.delete(key);
            }
        }
        this.tracks.splice(index, 1);
        if (wasCurrent) {
            this.audio.removeAttribute('src');
            this.audio.load();
            this.currentIndex = -1;
            Nutzerspeicher.setSetting('mediaplayerCurrentTrack', null);
            this.clearBeatmapVisuals();
            if (this.tracks.length) this.select(Math.min(index, this.tracks.length - 1), false);
            else {
                document.querySelector('.Mediaplayer-title').textContent = 'Keine Musik ausgewählt';
                document.getElementById('Mediaplayer-arthur-id').textContent = '—';
            }
        } else if (index < this.currentIndex) this.currentIndex--;
        this.renderPlaylist();
        this.setStatus('Titel aus der Mediathek gelöscht.');
    },

    targetVolume() {
        const master = Math.max(0, Math.min(100, Number(Nutzerspeicher.getSetting('musicVolume', 24))));
        const player = Math.max(0, Math.min(100, Number(Nutzerspeicher.getSetting('playerVolume', 12))));
        return master * player / 10000;
    },

    fadeAudio(audio, target, seconds) {
        const gain = audio === this.audio && this.gainNode ? this.gainNode.gain : null;
        const start = gain ? gain.value : audio.volume;
        const started = performance.now();
        const tick = now => {
            if (audio.paused) return;
            const progress = Math.min(1, (now - started) / (seconds * 1000));
            if (gain) gain.value = start + (target - start) * progress;
            else audio.volume = start + (target - start) * progress;
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    },

    fadePreviousAudio(seconds) {
        const previous = this.audio.cloneNode();
        const previousTime = this.audio.currentTime;
        previous.hidden = true;
        previous.volume = this.audio.volume;
        document.body.appendChild(previous);
        this.fadingPlayers.add(previous);
        const startFade = () => {
            try { previous.currentTime = previousTime; } catch {}
            previous.play().then(() => {
                this.fadeAudio(previous, 0, seconds);
                window.setTimeout(() => this.stopFadeOutPlayer(previous), seconds * 1000 + 80);
            }).catch(() => this.stopFadeOutPlayer(previous));
        };
        if (previous.readyState >= 1) startFade();
        else previous.addEventListener('loadedmetadata', startFade, { once: true });
        previous.load();
    },

    stopFadeOutPlayer(player) {
        player.pause();
        player.removeAttribute('src');
        player.load();
        player.remove();
        this.fadingPlayers.delete(player);
    },

    stopFadeOutPlayers() {
        [...this.fadingPlayers].forEach(player => this.stopFadeOutPlayer(player));
    },

    playBeatmapHits() {
        if (!this.beatmapHitTimes.length || !Nutzerspeicher.getSetting('osuOptions', {}).enabled) return;
        const now = this.audio.currentTime * 1000;
        while (this.nextHitIndex < this.beatmapHitTimes.length && this.beatmapHitTimes[this.nextHitIndex] <= now + 35) {
            if (this.beatmapHitTimes[this.nextHitIndex] >= now - 100) {
                const volume = Math.max(0, Math.min(100, Number(Nutzerspeicher.getSetting('osuHitsoundVolume', 24)))) / 100;
                if (typeof Sound !== 'undefined') Sound.play('cursor-tap', 1, volume);
                if (Nutzerspeicher.getSetting('osuOptions', {}).starFountains) this.spawnHitStar();
            }
            this.nextHitIndex++;
        }
    },

    spawnHitStar() {
        const cover = document.querySelector('.Mediaplayer-cover');
        if (!cover) return;
        const star = document.createElement('span');
        star.className = 'Mediaplayer-hit-star';
        star.textContent = '✦';
        star.style.left = `${15 + Math.random() * 70}%`;
        cover.appendChild(star);
        star.addEventListener('animationend', () => star.remove(), { once: true });
    },

    step(direction) {
        if (!this.tracks.length) return;
        if (Nutzerspeicher.getSetting('mediaplayerShuffle', false) && direction > 0) {
            let index = this.currentIndex;
            if (this.tracks.length > 1) while (index === this.currentIndex) index = Math.floor(Math.random() * this.tracks.length);
            this.select(index, true);
            return;
        }
        this.select(this.currentIndex + direction, true);
    },

    togglePlayback() {
        if (this.audio.paused) {
            if (this.currentIndex < 0 && this.tracks.length) this.select(0, true);
            else this.audio.play().catch(() => {});
        } else {
            this.audio.pause();
            this.stopFadeOutPlayers();
        }
    },

    renderPlayButton(playing) {
        const button = document.querySelector('[data-player-toggle]');
        const icon = document.querySelector('[data-player-toggle-icon]');
        if (!button || !icon) return;
        button.setAttribute('aria-label', playing ? 'Pause' : 'Abspielen');
        icon.src = playing ? '/Res/Bild/Icon/Mediaplayer/pause_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg' : '/Res/Bild/Icon/Mediaplayer/play_arrow_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg';
    },

    renderTime() {
        const format = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';
        const counter = document.getElementById('playing-counter');
        if (counter) counter.textContent = `${format(this.audio.currentTime)} | ${format(this.audio.duration)}`;
    },

    setStatus(message) {
        const title = document.querySelector('.Mediaplayer-title');
        if (title && !this.tracks.length) {
            title.textContent = message;
            this.updateTitleScroll();
        }
    },

    updateTitleScroll() {
        const title = document.querySelector('.Mediaplayer-title');
        if (!title) return;
        title.classList.remove('is-overflowing');
        title.style.removeProperty('--title-scroll-distance');
        requestAnimationFrame(() => {
            const clipWidth = title.parentElement?.clientWidth ?? title.clientWidth;
            const distance = title.scrollWidth - clipWidth;
            if (distance <= 4) return;
            title.style.setProperty('--title-scroll-distance', `${distance}px`);
            title.style.setProperty('--title-scroll-duration', `${Math.max(5, distance / 28)}s`);
            title.classList.add('is-overflowing');
        });
    },

    watchTitleSize() {
        const title = document.querySelector('.Mediaplayer-title');
        if (!title || typeof ResizeObserver === 'undefined') return;
        this.titleResizeObserver?.disconnect();
        this.titleResizeObserver = new ResizeObserver(() => this.updateTitleScroll());
        this.titleResizeObserver.observe(title);
        if (title.parentElement) this.titleResizeObserver.observe(title.parentElement);
    },

    async ensureAudioGraph() {
        if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) throw new Error('Web Audio wird von diesem Browser nicht unterstützt.');
            this.audioContext = new AudioContextClass();
            const source = this.audioContext.createMediaElementSource(this.audio);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.gainNode = this.audioContext.createGain();
            source.connect(this.analyser);
            this.analyser.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
            this.audio.volume = 1;
            this.updateVolume();
        }
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    },

    applyVisualizerSettings() {
        const enabled = Boolean(Nutzerspeicher.getSetting('visualizerEnabled', false));
        const placement = Nutzerspeicher.getSetting('visualizerPlacement', 'player');
        const player = document.querySelector('[data-visualizer-player]');
        const desktop = document.querySelector('[data-visualizer-desktop]');
        if (player) player.hidden = !enabled || placement !== 'player';
        if (desktop) desktop.hidden = !enabled || placement !== 'desktop';
        const button = document.querySelector('[data-visualizer-toggle]');
        if (button) {
            button.setAttribute('aria-pressed', String(enabled));
            const label = button.querySelector('span');
            if (label) label.textContent = enabled ? 'An' : 'Aus';
        }
        const select = document.querySelector('[data-visualizer-placement]');
        if (select) select.value = placement;
        if (enabled) {
            this.ensureAudioGraph().then(() => this.drawVisualizer()).catch(error => console.warn('[Mediaplayer] Visualizer wartet auf Wiedergabe:', error));
        } else if (this.visualizerFrame) {
            cancelAnimationFrame(this.visualizerFrame);
            this.visualizerFrame = 0;
            document.querySelectorAll('[data-visualizer-player] canvas, [data-visualizer-desktop] canvas').forEach(canvas => {
                canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
            });
        }
    },

    drawVisualizer() {
        if (!Nutzerspeicher.getSetting('visualizerEnabled', false) || !this.analyser) return;
        if (this.visualizerFrame) return;
        const render = () => {
            this.visualizerFrame = 0;
            if (!Nutzerspeicher.getSetting('visualizerEnabled', false)) return;
            const canvas = document.querySelector('[data-visualizer-player]:not([hidden]) canvas, [data-visualizer-desktop]:not([hidden]) canvas');
            if (!canvas) return;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
            if (this.audio.paused) return;
            const values = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(values);
            const barWidth = canvas.width / values.length;
            values.forEach((value, index) => {
                const height = value / 255 * canvas.height;
                context.fillStyle = `hsl(${260 + index / values.length * 80} 85% 78%)`;
                context.fillRect(index * barWidth, canvas.height - height, Math.max(1, barWidth - 2), height);
            });
            this.visualizerFrame = requestAnimationFrame(render);
        };
        this.visualizerFrame = requestAnimationFrame(render);
    },

    attachSettingsControls() {
        const optionButtons = document.querySelectorAll('[data-osu-setting]');
        const renderOptions = () => {
            const options = Nutzerspeicher.getSetting('osuOptions', {});
            optionButtons.forEach(button => {
                const key = button.dataset.osuSetting;
                const enabled = Boolean(options[key]);
                const master = key === 'enabled';
                button.disabled = !master && !options.enabled;
                button.setAttribute('aria-pressed', String(enabled));
                const label = button.querySelector('span');
                if (label) label.textContent = enabled ? 'An' : 'Aus';
            });
            if (this.currentIndex >= 0 && this.tracks[this.currentIndex].type === 'osu') this.applyBeatmap(this.tracks[this.currentIndex]);
        };
        optionButtons.forEach(button => {
            if (button.dataset.bound) return;
            button.dataset.bound = 'true';
            button.addEventListener('click', () => {
                const options = Nutzerspeicher.getSetting('osuOptions', {});
                const key = button.dataset.osuSetting;
                options[key] = !options[key];
                if (key === 'enabled' && !options.enabled) {
                    options.autoEffects = false;
                    options.video = false;
                    options.storyboard = false;
                    options.starFountains = false;
                }
                Nutzerspeicher.setSetting('osuOptions', options);
                renderOptions();
            });
        });
        renderOptions();

        const crossfadeToggle = document.querySelector('[data-crossfade-toggle]');
        const crossfadeSlider = document.getElementById('crossfaded-id');
        const crossfadeOutput = document.getElementById('crossfaded-nummer');
        if (crossfadeToggle && !crossfadeToggle.dataset.bound) {
            crossfadeToggle.dataset.bound = 'true';
            const renderCrossfade = () => {
                const enabled = Boolean(Nutzerspeicher.getSetting('crossfadeEnabled', false));
                crossfadeToggle.setAttribute('aria-pressed', String(enabled));
                const status = crossfadeToggle.querySelector('span');
                if (status) status.textContent = enabled ? 'An' : 'Aus';
                if (crossfadeSlider) crossfadeSlider.disabled = !enabled;
            };
            crossfadeToggle.addEventListener('click', () => {
                Nutzerspeicher.setSetting('crossfadeEnabled', !Nutzerspeicher.getSetting('crossfadeEnabled', false));
                renderCrossfade();
            });
            renderCrossfade();
        }

        const visualizerToggle = document.querySelector('[data-visualizer-toggle]');
        const visualizerPlacement = document.querySelector('[data-visualizer-placement]');
        if (visualizerToggle && !visualizerToggle.dataset.bound) {
            visualizerToggle.dataset.bound = 'true';
            visualizerToggle.addEventListener('click', async () => {
                const enabled = !Nutzerspeicher.getSetting('visualizerEnabled', false);
                Nutzerspeicher.setSetting('visualizerEnabled', enabled);
                this.applyVisualizerSettings();
                if (enabled) {
                    try { await this.ensureAudioGraph(); this.drawVisualizer(); }
                    catch (error) { console.warn('[Mediaplayer] Visualizer konnte nicht gestartet werden:', error); }
                }
            });
        }
        if (visualizerPlacement && !visualizerPlacement.dataset.bound) {
            visualizerPlacement.dataset.bound = 'true';
            visualizerPlacement.addEventListener('change', () => {
                Nutzerspeicher.setSetting('visualizerPlacement', visualizerPlacement.value);
                this.applyVisualizerSettings();
                this.drawVisualizer();
            });
        }
        this.applyVisualizerSettings();

        const sliders = [
            ['Audio-slider-id', 'playerVolume', 'Audio-nummer', 12, () => this.updateVolume()],
            ['crossfaded-id', 'crossfadeSeconds', 'crossfaded-nummer', 0, value => {}],
            ['osu-betamap-hitsound-id', 'osuHitsoundVolume', 'osu-beatmap-hitsounds-nummer', 24, value => {}]
        ];
        sliders.forEach(([id, key, outputId, fallback, apply]) => {
            const slider = document.getElementById(id);
            const output = document.getElementById(outputId);
            if (!slider || slider.dataset.bound) return;
            slider.dataset.bound = 'true';
            const value = Math.max(Number(slider.min) || 0, Math.min(Number(slider.max) || 100, Number(Nutzerspeicher.getSetting(key, fallback))));
            slider.value = String(value);
            if (output) output.textContent = key === 'crossfadeSeconds' ? `${value} Sekunden` : `${value}%`;
            apply(value);
            slider.addEventListener('input', () => {
                const next = Number(slider.value);
                if (output) output.textContent = key === 'crossfadeSeconds' ? `${next} Sekunden` : `${next}%`;
                apply(next);
                Nutzerspeicher.setSetting(key, next);
            });
        });
    },

    updateVolume() {
        const master = Math.max(0, Math.min(100, Number(Nutzerspeicher.getSetting('musicVolume', 24))));
        const player = Math.max(0, Math.min(100, Number(Nutzerspeicher.getSetting('playerVolume', 12))));
        const volume = master * player / 10000;
        if (this.gainNode) {
            this.audio.volume = 1;
            this.gainNode.gain.value = volume;
        }
        else this.audio.volume = volume;
    }
};

Mediaplayer.init();
