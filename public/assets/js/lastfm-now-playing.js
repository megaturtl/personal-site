(() => {
  // src/assets/js/lastfm-now-playing.js
  var LASTFM_API_KEY = "7db421fc6880c777f75ba5ed8604c196";
  var username = "megaturtl";
  var url = "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&format=json&extended=true&api_key=" + LASTFM_API_KEY + "&limit=1&user=" + username;
  var elements = {
    track: document.getElementById("track"),
    artist: document.getElementById("artist"),
    date: document.getElementById("date"),
    nowPlaying: document.getElementById("now-playing"),
    albumCover: document.getElementById("album-cover"),
    separator: document.getElementById("separator")
  };
  var trackLinkElem = document.createElement("a");
  trackLinkElem.id = "track";
  trackLinkElem.target = "_blank";
  var artistLinkElem = document.createElement("a");
  artistLinkElem.id = "artist";
  artistLinkElem.target = "_blank";
  var albumLinkElem = document.createElement("a");
  albumLinkElem.id = "album";
  albumLinkElem.target = "_blank";
  var heartSpan = document.createElement("span");
  heartSpan.id = "heart";
  var userLinkElem = document.createElement("a");
  userLinkElem.target = "_blank";
  userLinkElem.href = "https://www.last.fm/user/" + username;
  if (elements.track)
    elements.track.appendChild(trackLinkElem);
  if (elements.track)
    elements.track.appendChild(heartSpan);
  if (elements.separator)
    elements.separator.appendChild(document.createTextNode("-"));
  if (elements.artist)
    elements.artist.appendChild(artistLinkElem);
  if (elements.date)
    elements.date.appendChild(userLinkElem);
  if (elements.albumCover) {
    elements.albumCover.parentNode.insertBefore(albumLinkElem, elements.albumCover);
    albumLinkElem.appendChild(elements.albumCover);
  }
  async function httpGet(url2) {
    try {
      const response = await fetch(url2);
      return await response.text();
    } catch (error) {
      console.error("Failed to fetch:", error);
      return null;
    }
  }
  function relativeTime(time, time_text) {
    var time_now = Math.round(Date.now() / 1e3);
    var time_diff = time_now - time;
    let SEC_IN_MIN = 60;
    let SEC_IN_HOUR = SEC_IN_MIN * 60;
    let SEC_IN_DAY = SEC_IN_HOUR * 24;
    if (time_diff < SEC_IN_HOUR) {
      let minutes = Math.round(time_diff / SEC_IN_MIN);
      return minutes + " min" + (minutes != 1 ? "s" : "") + " ago";
    }
    if (time_diff >= SEC_IN_HOUR && time_diff < SEC_IN_DAY) {
      let hours = Math.round(time_diff / SEC_IN_HOUR);
      return hours + " hr" + (hours != 1 ? "s" : "") + " ago";
    }
    if (time_diff >= SEC_IN_DAY)
      return time_text;
  }
  async function updateNowPlaying() {
    const response = await httpGet(url);
    if (!response)
      return;
    const json = JSON.parse(response);
    const last_track = json.recenttracks.track[0];
    const currentTrack = {
      name: last_track.name,
      artist: last_track.artist.name,
      loved: last_track.loved == "1",
      nowplaying: last_track["@attr"]?.nowplaying === "true"
    };
    if (window.turtlControls) {
      const desiredState = currentTrack.nowplaying ? "BOP" : "IDLE";
      if (window.turtlControls.getCurrentState() !== desiredState) {
        window.turtlControls.setTurtlState(desiredState);
      }
    }
    if (!window.lastTrackInfo || JSON.stringify(currentTrack) !== JSON.stringify(window.lastTrackInfo)) {
      const relative_time = last_track.date ? relativeTime(last_track.date.uts, last_track.date["#text"]) : null;
      requestAnimationFrame(() => {
        trackLinkElem.href = last_track.url;
        trackLinkElem.textContent = last_track.name;
        artistLinkElem.href = last_track.artist.url;
        artistLinkElem.textContent = last_track.artist.name;
        albumLinkElem.href = last_track.url;
        heartSpan.textContent = last_track.loved == "1" ? "\u2764\uFE0F" : "";
        userLinkElem.textContent = relative_time ? `(${relative_time})` : "(now)";
        elements.albumCover.src = last_track.image[1]["#text"];
        elements.nowPlaying?.classList.add("fade-in");
      });
      window.lastTrackInfo = currentTrack;
    }
  }
  updateNowPlaying();
  setInterval(updateNowPlaying, 3e3);
})();
//# sourceMappingURL=lastfm-now-playing.js.map
