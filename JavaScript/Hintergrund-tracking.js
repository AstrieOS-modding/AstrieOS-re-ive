const wallpaper = document.querySelector('.Desktop-wallpaper');
const MAX_OFFSET = 18;

let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;

document.addEventListener('mousemove', (e) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const percentX = (e.clientX - centerX) / centerX;
    const percentY = (e.clientY - centerY) / centerY;

    targetX = -percentX * MAX_OFFSET;
    targetY = -percentY * MAX_OFFSET;
});

function animate() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;

    wallpaper.style.transform = `translate(${currentX}px, ${currentY}px) scale(1.05)`;

    requestAnimationFrame(animate);
}

animate();
