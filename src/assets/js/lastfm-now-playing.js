const username = "megaturtl"
const WORKER_URL = "https://api.turtl.cc/music/"

// Cache DOM elements
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

// Hide tooltips initially
if (elements.artistTooltip) {
    elements.artistTooltip.parentElement.style.display = 'none';
}
if (elements.trackTooltip) {
    elements.trackTooltip.parentElement.style.display = 'none';
}

// Initialise DOM elements
const trackLinkElem = document.createElement('a');
trackLinkElem.target = "_blank";

const artistLinkElem = document.createElement('a');
artistLinkElem.target = "_blank";

const albumLinkElem = document.createElement('a');
albumLinkElem.target = "_blank";

const userLinkElem = document.createElement('a');
userLinkElem.target = "_blank";
userLinkElem.href = "https://www.last.fm/user/" + username;

// Append elements
if (elements.track) elements.track.appendChild(trackLinkElem);
if (elements.separator) elements.separator.appendChild(document.createTextNode("-"));
if (elements.artist) elements.artist.appendChild(artistLinkElem);
if (elements.date) elements.date.appendChild(userLinkElem);

if (elements.albumCover) {
    elements.albumCover.parentNode.insertBefore(albumLinkElem, elements.albumCover);
    albumLinkElem.appendChild(elements.albumCover);
}

async function getArtistPlayCount(artistName) {
    const response = await fetch(`${WORKER_URL}/artist-info?artist=${encodeURIComponent(artistName)}`);
    const data = await response.json();
    return parseInt(data.playcount) || 0;
}

async function getTrackPlayCount(artistName, trackName) {
    const response = await fetch(`${WORKER_URL}/track-info?artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}`);
    const data = await response.json();
    return parseInt(data.playcount) || 0;
}

async function updateTooltips(artistName, trackName) {
    // Hide tooltips while we fetch new data
    if (elements.artistTooltip) {
        elements.artistTooltip.parentElement.style.display = 'none';
    }
    if (elements.trackTooltip) {
        elements.trackTooltip.parentElement.style.display = 'none';
    }

    const [artistPlayCount, trackPlayCount] = await Promise.all([
        getArtistPlayCount(artistName),
        getTrackPlayCount(artistName, trackName)
    ]);

    // Update artist tooltip
    if (elements.artistTooltip) {
        if (artistPlayCount === null) {
            elements.artistTooltip.textContent = "Couldn't load artist play count";
        } else if (artistPlayCount === 0) {
            elements.artistTooltip.textContent = "This is my first time listening to this artist!";
        } else if (artistPlayCount === 1) {
            elements.artistTooltip.textContent = "I've listened to this artist once!";
        } else {
            elements.artistTooltip.textContent = `I've listened to this artist ${artistPlayCount} times!`;
        }
        elements.artistTooltip.parentElement.style.display = 'block';
    }

    // Update track tooltip
    if (elements.trackTooltip) {
        if (trackPlayCount === null) {
            elements.trackTooltip.textContent = "Couldn't load track play count";
        } else if (trackPlayCount === 0) {
            elements.trackTooltip.textContent = "This is my first time listening to this song!";
        } else if (trackPlayCount === 1) {
            elements.trackTooltip.textContent = "I've listened to this song once!";
        } else {
            elements.trackTooltip.textContent = `I've listened to this song ${trackPlayCount} times!`;
        }
        elements.trackTooltip.parentElement.style.display = 'block';
    }
}

// Update current track
async function updateNowPlaying() {
    const data = await fetch(`${WORKER_URL}/now-playing`).then(r => r.json());
    if (!data) return;

    requestAnimationFrame(() => {
        // Update track info
        trackLinkElem.href = data.track.url;
        trackLinkElem.textContent = data.track.name;

        // Update artist info
        artistLinkElem.href = data.artist.url;
        artistLinkElem.textContent = data.artist.name;

        // Update album cover and link
        if (data.album) {
            albumLinkElem.href = data.album.url;
        }
        elements.albumCover.src = data.track['image-medium'];

        // Update date/now playing status
        userLinkElem.textContent = data.nowplaying ? "(now)" : `(${data.date})`;

        // Update turtle state if available
        if (window.turtlControls) {
            const desiredState = data.nowplaying ? 'BOP' : 'IDLE';
            if (window.turtlControls.getCurrentState() !== desiredState) {
                window.turtlControls.setTurtlState(desiredState);
            }
        }

        elements.nowPlaying?.classList.add('fade-in');

        // Update tooltips with play counts
        updateTooltips(data.artist.name, data.track.name);
    });
}

// Update on page load
updateNowPlaying();

// Check for updates every 3 seconds
setInterval(updateNowPlaying, 3000);
