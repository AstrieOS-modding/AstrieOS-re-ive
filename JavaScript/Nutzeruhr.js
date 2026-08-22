function updateUserTime() {
    const now = new Date();
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    document.getElementById('User-timezone').textContent =
        now.toLocaleTimeString('de-DE', options);
}

updateUserTime();
setInterval(updateUserTime, 1000);