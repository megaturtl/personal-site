async function updateUserCount() {
    // Fetch JSON from Cloudflare Worker endpoint
    const response = await fetch('https://api.turtl.cc/analytics/');
    const data = await response.json();

    const rawValue = data.totalUsers;
    const numericValue = parseInt(rawValue, 10);
    const container = document.getElementById('visitor-number');
    const animationDuration = Math.min(8000, Math.max(1000, 2000 + Math.log10(numericValue) * 1500)); // Logarithmic number scaling

    animateCountUp(container, 0, numericValue, animationDuration);
}

function animateCountUp(container, start, end, duration) {
    const frameRate = 30;
    const totalFrames = Math.round(duration / (1000 / frameRate));
    let frame = 0;

    function update() {
        frame++;
        const progress = Math.min(frame / totalFrames, 1);
        const currentCount = Math.floor(start + (end - start) * progress);

        // Convert to a zero-padded string at least 5 digits
        const padded = currentCount.toString().padStart(5, '0');

        // Clear and update spans
        container.innerHTML = '';
        for (const digit of padded) {
            const span = document.createElement('span');
            span.className = 'digit';
            span.textContent = digit;
            container.appendChild(span);
        }

        // Continue animation if not yet complete
        if (frame < totalFrames) {
            requestAnimationFrame(update);
        }
    }

    update(); // Start the animation loop
}

// Run when page loads
updateUserCount();
