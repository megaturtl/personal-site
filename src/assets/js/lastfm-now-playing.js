const LASTFM_API_KEY = "7db421fc6880c777f75ba5ed8604c196"
const username = "megaturtl"
const url = "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&format=json&extended=true&api_key=" + LASTFM_API_KEY + "&limit=1&user=" + username

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

// Initialise DOM elements once
const trackLinkElem = document.createElement('a');
trackLinkElem.id = "track";
trackLinkElem.target = "_blank";

const artistLinkElem = document.createElement('a');
artistLinkElem.id = 'artist';
artistLinkElem.target = "_blank";

const albumLinkElem = document.createElement('a');
albumLinkElem.id = 'album';
albumLinkElem.target = "_blank";

const heartSpan = document.createElement('span');
heartSpan.id = 'heart';

const userLinkElem = document.createElement('a');
userLinkElem.target = "_blank";
userLinkElem.href = "https://www.last.fm/user/" + username;

// Append elements once
if (elements.track) elements.track.appendChild(trackLinkElem);
if (elements.track) elements.track.appendChild(heartSpan);
if (elements.separator) elements.separator.appendChild(document.createTextNode("-"));
if (elements.artist) elements.artist.appendChild(artistLinkElem);
if (elements.date) elements.date.appendChild(userLinkElem);

if (elements.albumCover) {
    elements.albumCover.parentNode.insertBefore(albumLinkElem, elements.albumCover);
    albumLinkElem.appendChild(elements.albumCover);
}

// Optimised API call
async function httpGet(url) {
    const response = await fetch(url);
    return await response.text();
}

// converts unix time to relative time text (eg. 2 hours ago)
function relativeTime(time, time_text) {
    var time_now = Math.round(Date.now() / 1000)
    var time_diff = time_now - time

    let SEC_IN_MIN = 60
    let SEC_IN_HOUR = SEC_IN_MIN * 60
    let SEC_IN_DAY = SEC_IN_HOUR * 24

    if (time_diff < SEC_IN_HOUR) {
        let minutes = Math.round(time_diff / SEC_IN_MIN)
        return minutes + " min" +
            ((minutes != 1) ? "s" : "") + " ago"
    }
    if (time_diff >= SEC_IN_HOUR && time_diff < SEC_IN_DAY) {
        let hours = Math.round(time_diff / SEC_IN_HOUR)
        return hours + " hr" +
            ((hours != 1) ? "s" : "") + " ago"
    }
    if (time_diff >= SEC_IN_DAY)
        return time_text
}

// Get artist play count
async function getArtistPlayCount(artistName) {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&username=${username}&api_key=${LASTFM_API_KEY}&format=json`;
    const response = await httpGet(url);
    if (!response) return null;
    
    const json = JSON.parse(response);
    const playCount = parseInt(json.artist?.stats?.userplaycount) || 0;
    return playCount;
}

// Get track play count
async function getTrackPlayCount(artistName, trackName) {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&username=${username}&api_key=${LASTFM_API_KEY}&format=json`;
    const response = await httpGet(url);
    if (!response) return null;
    
    const json = JSON.parse(response);
    const playCount = parseInt(json.track?.userplaycount) || 0;
    return playCount;
}

// Update current track
async function updateNowPlaying() {
    const response = await httpGet(url);
    if (!response) return;

    const json = JSON.parse(response);
    const last_track = json.recenttracks.track[0];
    
    const currentTrack = {
        name: last_track.name,
        artist: last_track.artist.name,
        loved: last_track.loved == "1",
        nowplaying: last_track["@attr"]?.nowplaying === "true"
    };
    
    // Always update the turtle state and now playing status
    requestAnimationFrame(() => {
        if (window.turtlControls) {
            const desiredState = currentTrack.nowplaying ? 'BOP' : 'IDLE';
            if (window.turtlControls.getCurrentState() !== desiredState) {
                window.turtlControls.setTurtlState(desiredState);
            }
        }
    });
    
    // Update track info immediately if changed
    if (!window.lastTrackInfo || 
        JSON.stringify(currentTrack) !== JSON.stringify(window.lastTrackInfo)) {
        
        const relative_time = last_track.date ? 
            relativeTime(last_track.date.uts, last_track.date["#text"]) : null;

        // Hide tooltips while we fetch new data
        if (elements.artistTooltip) {
            elements.artistTooltip.parentElement.style.display = 'none';
        }
        if (elements.trackTooltip) {
            elements.trackTooltip.parentElement.style.display = 'none';
        }

        // Update all immediate information right away
        requestAnimationFrame(() => {
            trackLinkElem.href = last_track.url;
            trackLinkElem.textContent = last_track.name;
            artistLinkElem.href = last_track.artist.url;
            artistLinkElem.textContent = last_track.artist.name;
            albumLinkElem.href = last_track.url;
            heartSpan.textContent = last_track.loved == "1" ? " ❤️" : "";
            userLinkElem.textContent = relative_time ? `(${relative_time})` : "(now)";
            elements.albumCover.src = last_track.image[1]["#text"];
            elements.nowPlaying?.classList.add('fade-in');
        });

        // Update our track info cache immediately
        window.lastTrackInfo = currentTrack;

        // Fetch and update tooltips asynchronously in the background
        Promise.all([
            getArtistPlayCount(currentTrack.artist),
            getTrackPlayCount(currentTrack.artist, currentTrack.name)
        ]).then(([artistPlayCount, trackPlayCount]) => {
            // Update tooltips whenever they're ready
            if (elements.artistTooltip) {
                if (artistPlayCount === 0) {
                    elements.artistTooltip.textContent = "This is my first time listening to this artist!";
                } else if (artistPlayCount === 1) {
                    elements.artistTooltip.textContent = "I've listened to this artist once!";
                } else {
                    elements.artistTooltip.textContent = `I've listened to this artist ${artistPlayCount} times!`;
                }
                elements.artistTooltip.parentElement.style.display = 'block';
            }

            if (elements.trackTooltip) {
                if (last_track.loved == "1") {
                    elements.trackTooltip.textContent = `I've listened to this song ${trackPlayCount} times and it's one of my favourites!`;
                } else if (trackPlayCount === 0) {
                    elements.trackTooltip.textContent = "This is my first time listening to this song!";
                } else if (trackPlayCount === 1) {
                    elements.trackTooltip.textContent = "I've listened to this song once!";
                } else {
                    elements.trackTooltip.textContent = `I've listened to this song ${trackPlayCount} times!`;
                }
                elements.trackTooltip.parentElement.style.display = 'block';
            }
        }).catch(e => {
            console.warn('Failed to load play counts:', e);
            // Show tooltips with fallback message on error
            if (elements.artistTooltip) {
                elements.artistTooltip.textContent = "Couldn't load artist play count";
                elements.artistTooltip.parentElement.style.display = 'block';
            }
            if (elements.trackTooltip) {
                elements.trackTooltip.textContent = "Couldn't load track play count";
                elements.trackTooltip.parentElement.style.display = 'block';
            }
        });
    }
}

// Update on page load
updateNowPlaying();

// Check for updates every 3 seconds
setInterval(updateNowPlaying, 3000);
