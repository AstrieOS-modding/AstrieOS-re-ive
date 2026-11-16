window.BackgroundTracking = {
    amount: 18,
    setAmount(value) {
        this.amount = Math.max(0, Math.min(100, Number(value) || 0));
    }
};

let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;

document.addEventListener('mousemove', event => {
    const centerX = window.innerWidth / 2 || 1;
    const centerY = window.innerHeight / 2 || 1;
    targetX = -((event.clientX - centerX) / centerX) * BackgroundTracking.amount;
    targetY = -((event.clientY - centerY) / centerY) * BackgroundTracking.amount;
});

function animateBackgroundTracking() {
    const wallpaper = document.querySelector('.Desktop-wallpaper');
    if (wallpaper) {
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;
        const scale = 1 + BackgroundTracking.amount / 1000;
        wallpaper.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
    }
    requestAnimationFrame(animateBackgroundTracking);
}

animateBackgroundTracking();
