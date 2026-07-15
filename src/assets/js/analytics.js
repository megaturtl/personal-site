// Immediately target this count so the number appears to load instantly
const FALLBACK_VISITOR_COUNT = 1010;

// Pad to at least this many digits
const MIN_DIGITS = 5;

// Portion of the remaining distance to target to cover per frame.
const EASING_FACTOR = 0.05;

// Stop animating once within this many units of the target (basically makes sure it stops on a round number).
const SNAP_THRESHOLD = 0.5;

class DigitCounter {
    constructor(container) {
        this.container = container;
        this.current = 0;
        this.target = 0;
        this.frameHandle = null;
    }

    // Point the counter at a new target. If it's already animating,
    // this just redirects the existing loop without restarting.
    setTarget(target) {
        this.target = target;
        if (this.frameHandle === null) {
            this.tick();
        }
    }

    tick() {
        const distance = this.target - this.current;

        if (Math.abs(distance) < SNAP_THRESHOLD) {
            this.current = this.target;
            this.render();
            this.frameHandle = null;
            return;
        }

        this.current += distance * EASING_FACTOR;
        this.render();
        this.frameHandle = requestAnimationFrame(() => this.tick());
    }

    render() {
        const padded = Math.floor(this.current).toString().padStart(MIN_DIGITS, '0');

        this.container.innerHTML = '';
        for (const digit of padded) {
            const span = document.createElement('span');
            span.className = 'digit';
            span.textContent = digit;
            this.container.appendChild(span);
        }
    }
}

async function updateUserCount() {
    const container = document.getElementById('visitor-number');
    const counter = new DigitCounter(container);

    // Start ticking toward the fallback straight away
    counter.setTarget(FALLBACK_VISITOR_COUNT);

    try {
        const response = await fetch('https://api.turtl.cc/umami/');
        const data = await response.json();
        const numericValue = parseInt(data.visitorsAllTime, 10);

        if (!Number.isNaN(numericValue)) {
            // Redirects the in-flight animation to the real value
            counter.setTarget(numericValue);
        }
    } catch (error) {
        console.error('Failed to fetch visitor count, keeping fallback value', error);
    }
}

// Run when page loads
updateUserCount();