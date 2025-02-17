const turtlControls = (() => {
    const config = {
        POKE_TRIGGER: 'click', // Trigger type (click, mouseover, etc.)
        STATES: {
            IDLE: '/assets/images/turtl-sleep.gif',
            JUMP: '/assets/images/turtl-jump.gif',
            BOP: '/assets/images/turtl-bop.gif'
        },
        ANIMATION_DURATIONS: {
            JUMP: (52 / 12) * 1000, // Duration of jump animation before reverting (frames/fps)
            BOP: 0                // Bop continues until something else happens
        },
        SOUNDS: {
            POKE: '/assets/sounds/hit.ogg'
        }
    };

    let idleTimeout,
        currentState = 'IDLE',
        prevState = 'IDLE',
        blockUntil = 0,
        turtlElement = null,
        pokeSound = null;

    const setTurtlState = (state, remember = true) => {
        if (!turtlElement) return;
        const now = Date.now();

        // Prevent state changes during active animations
        if (now < blockUntil) return;
        if (state !== 'JUMP' && state === currentState) return;

        if (remember && state !== 'JUMP') {
            prevState = state;
        }
        currentState = state;

        // Force a GIF reload by appending a timestamp. This sucks but I have to because of Firefox
        turtlElement.src = `${config.STATES[state]}?t=${now}`;
        clearTimeout(idleTimeout);

        // If a jump was triggered, schedule a return to the previous state
        if (state === 'JUMP') {
            blockUntil = now + config.ANIMATION_DURATIONS.JUMP;
            idleTimeout = setTimeout(() => {
                blockUntil = 0;
                setTurtlState(prevState);
            }, config.ANIMATION_DURATIONS.JUMP);
        }
    };

    const getCurrentState = () => currentState;

    const handlePoke = () => {
        if (!turtlElement) return;
        setTurtlState('JUMP', false);
        if (pokeSound) {
            pokeSound.currentTime = 0; // Reset sound to start so pitch gets affected each click
            pokeSound.playbackRate = 0.8 + (Math.random() * 0.4); // Random between 0.8 and 1.2 for the pitch
            pokeSound.play().catch(e => console.warn('Failed to play poke sound:', e));
        }
    };

    const init = () => {
        turtlElement = document.getElementById('turtl');
        if (!turtlElement) return;
        
        pokeSound = new Audio(config.SOUNDS.POKE);
        pokeSound.preservesPitch = false;
        
        setTurtlState('IDLE');
        turtlElement.addEventListener(config.POKE_TRIGGER, handlePoke);
    };

    // Initialise on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        setTurtlState,
        getCurrentState
    };
})();

window.turtlControls = turtlControls;
