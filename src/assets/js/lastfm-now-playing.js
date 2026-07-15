const username = "megaturtl"
const API_URL = "https://api.turtl.cc/lastfm/"

// Cache DOM elements we will use
const elements = {
    track: document.getElementById('track'),
    artist: document.getElementById('artist'),
    date: document.getElementById('date'),
    nowPlaying: document.getElementById('now-playing'),
    albumCover: document.getElementById('album-cover'),
    separator: document.getElementById('separator'),
    artistTooltip: document.querySelector('#artist-tooltip p'),
    trackTooltip: document.querySelector('#track-tooltip p')
};

// Initialise and append link elements
const links = {
    track: Object.assign(document.createElement('a'), { target: "_blank" }),
    artist: Object.assign(document.createElement('a'), { target: "_blank" }),
    album: Object.assign(document.createElement('a'), { target: "_blank" }),
    user: Object.assign(document.createElement('a'), { target: "_blank", href: `https://www.last.fm/user/${username}` })
};

// Append elements to DOM
elements.track?.appendChild(links.track);
elements.separator?.appendChild(document.createTextNode("-"));
elements.artist?.appendChild(links.artist);
elements.date?.appendChild(links.user);

if (elements.albumCover) {
    elements.albumCover.parentNode.insertBefore(links.album, elements.albumCover);
    links.album.appendChild(elements.albumCover);
}

// Hide tooltips initially
[elements.artistTooltip, elements.trackTooltip].forEach(tooltip => {
    if (tooltip?.parentElement) {
        tooltip.parentElement.style.display = 'none';
    }
});

async function fetchWithCache(endpoint, params = {}) {
    const query = new URLSearchParams({ ...params, _: Date.now() }).toString();
    const response = await fetch(`${API_URL}${endpoint}?${query}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

function updateTrackTooltip(plays) {
    const element = elements.trackTooltip;
    if (!element) return;
    element.parentElement.style.display = 'block';
    element.textContent = plays === 0 ? "This is my first time listening to this track!" :
        plays === 1 ? "I've listened to this track once!" :
            `I've listened to this track ${plays} times!`;
}

async function updateNowPlaying() {
    try {
        const response = await fetchWithCache('now-playing');
        const data = response.now_playing;
        if (!data) return;

        requestAnimationFrame(() => {
            // Update links and text
            if (elements.track && links.track) {
                links.track.href = data.track.url;
                links.track.textContent = data.track.name;
            }

            if (elements.artist && links.artist) {
                links.artist.href = data.artist.url;
                links.artist.textContent = data.artist.name;
            }

            if (elements.albumCover && links.album) {
                links.album.href = data.album?.url || '';
                const newImageUrl = data.track.cover_url;
                if (elements.albumCover.src !== newImageUrl) {
                    elements.albumCover.src = newImageUrl;
                }
            }

            if (elements.date && links.user) {
                links.user.textContent = data.is_playing ? "(now)" : `(${data.time_since})`;
            }

            // Update turtle animation if available
            if (window.turtlControls) {
                const state = data.is_playing ? 'BOP' : 'IDLE';
                if (window.turtlControls.getCurrentState() !== state) {
                    window.turtlControls.setTurtlState(state);
                }
            }

            // Handle fade in
            if (elements.nowPlaying) {
                elements.nowPlaying.classList.remove('fade-in');
                void elements.nowPlaying.offsetWidth;
                elements.nowPlaying.classList.add('fade-in');
            }

            updateTrackTooltip(data.track.plays ?? 0);
        });
    } catch (error) {
        console.error('Error updating now playing:', error);
    }
}

// Initialise and start updates
let updateInterval;

function startUpdates() {
    updateNowPlaying();
    updateInterval = setInterval(updateNowPlaying, 6000);
}

function stopUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// Handle visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopUpdates();
    } else {
        startUpdates();
    }
});

// Initial start
if (!document.hidden) {
    startUpdates();
} else {
    // If page starts hidden, wait for it to become visible
    document.addEventListener('visibilitychange', function onFirstVisible() {
        if (!document.hidden) {
            startUpdates();
            document.removeEventListener('visibilitychange', onFirstVisible);
        }
    });
}