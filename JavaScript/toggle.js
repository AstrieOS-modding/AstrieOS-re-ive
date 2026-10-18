function placeholder_user() {
    const el = document.querySelector('.PLaceholder-nutzercenter')
    if (el) {
        el.classList.contains('Open') ? Sound.play('menu-close') : Sound.play('menu-open');
        el.classList.toggle('Open')
    }
}

function placeholder_setting() {
    const el = document.querySelector('.Einstellungen-placeholder')
    if (el) {
        el.classList.contains('Open') ? Sound.play('menu-close') : Sound.play('menu-open');
        el.classList.toggle('Open')
    }
}

function User_Wallpapier() {
    const el = document.querySelector('.Einstellungen-hintergrund-display')
    if (el) {
        el.classList.contains('Open') ? Sound.play('menu-close') : Sound.play('menu-open');
        el.classList.toggle('Open')
        
        // Stelle sicher, dass Event-Listener gebunden sind
        if (el.classList.contains('Open') && typeof EinstellungenHintergrund !== 'undefined') {
            EinstellungenHintergrund.init();
        }
    }
}

function openNutzer_custom() {
    const el = document.querySelector('.Placeholder-usercustom')
    if (el) {
        el.classList.contains('Open') ? Sound.play('menu-close') : Sound.play('menu-open');
        el.classList.toggle('Open')
    }
}

function placeholder_notifield() {
    const el = document.querySelector('.Benachrichtigung-content')
    if (el) {
        el.classList.contains('Open') ? Sound.play('menu-close') : Sound.play('menu-open');
        el.classList.toggle('Open')
    }
}