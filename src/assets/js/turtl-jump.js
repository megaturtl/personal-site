const TURTL_STATES = {
    SLEEP: './assets/images/turtl-sleep-slow.gif',
    JUMP: './assets/images/turtl-jump.gif'
};

// Preload images so no janky stuff
const preloadedImages = {};
Object.values(TURTL_STATES).forEach(src => {
    const img = new Image();
    img.src = src;
    preloadedImages[src] = img;
});

let isInTimeout = false;

function handleTurtlClick() {
    const turtl = document.getElementById('turtl');
    if (!turtl || turtl.src.includes(TURTL_STATES.JUMP) || isInTimeout) return;

    turtl.src = preloadedImages[TURTL_STATES.JUMP].src;

    // Calculate duration of jump gif (52 frames at 12fps)
    const jumpDuration = (52 / 12) * 1000;
    const jumpTimeout = (4/12) * 1000;

    isInTimeout = true;
    
    setTimeout(() => {
        isInTimeout = false;
    }, jumpTimeout);

    setTimeout(() => {
        turtl.src = preloadedImages[TURTL_STATES.SLEEP].src;
    }, jumpDuration);
}

// turtl click handler
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const turtl = document.getElementById('turtl');
        if (turtl) {
            turtl.src = preloadedImages[TURTL_STATES.SLEEP].src;
            turtl.addEventListener('click', handleTurtlClick);
        }
    });
} else {
    const turtl = document.getElementById('turtl');
    if (turtl) {
        turtl.src = preloadedImages[TURTL_STATES.SLEEP].src;
        turtl.addEventListener('click', handleTurtlClick);
    }
} 