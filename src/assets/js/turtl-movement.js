const turtlControls = (() => {
    const config = {
        POKE_TRIGGER: 'click', // Trigger type (click, mouseover, etc.)
        STATES: {
            IDLE: '/assets/images/turtl-sleep.gif',
            JUMP: '/assets/images/turtl-jump.gif',
            BOP: '/assets/images/turtl-bop.gif'
        },
        ANIMATION_DURATIONS: {
            JUMP: (48 / 12) * 1000, // Duration of jump animation before reverting (frames/fps)
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
        activeTurtl = null,
        pokeSound = null,
        preloadedStates = {};

    const preloadState = (state) => {
        const img = document.createElement('img');
        img.className = 'turtl';
        img.id = state.toLowerCase(); // ID matches the state name
        img.style.display = 'none';
        img.src = `${config.STATES[state]}?t=${Date.now()}`;
        
        // Copy styles from active element if it exists
        if (activeTurtl) {
            img.style.position = activeTurtl.style.position;
            img.style.width = activeTurtl.style.width;
            img.style.height = activeTurtl.style.height;
        }
        
        return img;
    };

    const ensureStatePreloaded = (state) => {
        if (!preloadedStates[state]) {
            preloadedStates[state] = preloadState(state);
            activeTurtl.parentNode.insertBefore(preloadedStates[state], activeTurtl.nextSibling);
        }
    };

    const setTurtlState = (state, remember = true) => {
        if (!activeTurtl) return;
        const now = Date.now();

        // Prevent state changes during active animations
        if (now < blockUntil) return;
        if (state !== 'JUMP' && state === currentState) return;

        if (remember && state !== 'JUMP') {
            prevState = state;
        }
        currentState = state;

        // Ensure we have a preloaded version of the target state
        ensureStatePreloaded(state);

        // Get the preloaded version
        const nextTurtl = preloadedStates[state];
        if (!nextTurtl) return;

        // Show the preloaded version and set it as active
        nextTurtl.style.display = 'block';
        nextTurtl.id = 'active-turtl';

        // Move the click handler to the new element
        nextTurtl.addEventListener(config.POKE_TRIGGER, handlePoke);

        // Hide and remove the old active version
        activeTurtl.removeEventListener(config.POKE_TRIGGER, handlePoke);
        activeTurtl.remove();
        
        // Update active reference
        activeTurtl = nextTurtl;
        
        // Remove this state from preloaded (since it's now active)
        delete preloadedStates[state];
        
        // Preload a new version of this state
        const newPreload = preloadState(state);
        preloadedStates[state] = newPreload;
        activeTurtl.parentNode.insertBefore(newPreload, activeTurtl.nextSibling);

        // Ensure we have preloaded versions of other states
        Object.keys(config.STATES).forEach(ensureStatePreloaded);

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
        if (!activeTurtl) return;
        
        if (pokeSound) {
            pokeSound.currentTime = 0;
            pokeSound.playbackRate = 0.8 + (Math.random() * 0.4);
            
            // Use requestAnimationFrame to sync the visual and audio
            requestAnimationFrame(() => {
                setTurtlState('JUMP', false);
                pokeSound.play().catch(e => console.warn('Failed to play poke sound:', e));
            });
        }
    };

    const init = () => {
        activeTurtl = document.getElementById('active-turtl');
        if (!activeTurtl) return;
        
        // Ensure main element has turtl class
        activeTurtl.className = 'turtl';
        
        // Preload all states
        Object.keys(config.STATES).forEach(ensureStatePreloaded);
        
        pokeSound = new Audio(config.SOUNDS.POKE);
        pokeSound.preservesPitch = false;
        
        setTurtlState('IDLE');
        activeTurtl.addEventListener(config.POKE_TRIGGER, handlePoke);
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
