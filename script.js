let currentSongData = null;

const audio = document.getElementById("audio");
const playBtn = document.getElementById("play");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const title = document.getElementById("title");
const cover = document.getElementById("cover");
const playlist = document.getElementById("playlist");
const progress = document.getElementById("progress");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");
const volumeSlider = document.getElementById("volume");
const themeToggleBtn = document.getElementById("theme-toggle");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");

// Playlist Management Elements
const newPlaylistNameInput = document.getElementById("new-playlist-name");
const createPlaylistBtn = document.getElementById("create-playlist-btn");
const savePlaylistBtn = document.getElementById("save-playlist-btn");
const savedPlaylistsSelect = document.getElementById("saved-playlists");
const loadPlaylistBtn = document.getElementById("load-playlist-btn");
const deletePlaylistBtn = document.getElementById("delete-playlist-btn");

// User Authentication Elements
const authUsernameInput = document.getElementById("auth-username");
const authPasswordInput = document.getElementById("auth-password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const logoutBtn = document.getElementById("logout-btn");
const loggedOutView = document.getElementById("logged-out-view");
const loggedInView = document.getElementById("logged-in-view");
const welcomeMessage = document.getElementById("welcome-message");
const mainPlayerContent = document.getElementById("main-player-content");

// Visualizer Elements
const visualizerCanvas = document.getElementById("visualizer");
const canvasCtx = visualizerCanvas.getContext("2d");

// Set initial canvas dimensions based on CSS
visualizerCanvas.width = 280; // Match CSS max-width
visualizerCanvas.height = 80; // Match CSS height

// Lyrics Elements
const lyricsContainer = document.getElementById("lyrics-container");
const lyricsText = document.getElementById("lyrics-text");


let currentPlaylist = []; // To store search results or loaded playlist
let currentSongIndex = -1; // To track the index of the currently playing song in the playlist
let savedPlaylists = JSON.parse(localStorage.getItem("savedPlaylists")) || {}; // Stores all saved playlists
let users = JSON.parse(localStorage.getItem("users")) || {}; // Stores registered users
let currentUser = sessionStorage.getItem("currentUser"); // Stores the currently logged-in user
let currentLoadedPlaylistName = null; // To track the name of the currently loaded saved playlist

// Audio Context for Visualizer
let audioContext = null; // Initialize as null
let analyser;
let source;
let bufferLength;
let dataArray;


// Theme switching logic
function applyTheme(theme) {
    document.body.classList.toggle("light-mode", theme === "light");
    localStorage.setItem("theme", theme);
}

// Load saved theme or default to dark
const savedTheme = localStorage.getItem("theme") || "dark";
applyTheme(savedTheme);

themeToggleBtn.addEventListener("click", () => {
    const currentTheme = localStorage.getItem("theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(newTheme);
});

// Fetch songs from iTunes API
async function fetchSongs(query) {
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=50`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.results.map(song => ({
            title: song.trackName,
            artist: song.artistName,
            src: song.previewUrl,
            cover: song.artworkUrl100 ? song.artworkUrl100.replace("100x100","300x300") : ''
        }));
    } catch (error) {
        console.error("Error fetching songs:", error);
        return [];
    }
}

// Initialize AudioContext for visualizer (called on first user interaction)
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        source = audioContext.createMediaElementSource(audio);
        analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 256;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        drawVisualizer(); // Start visualizer loop once context is initialized
    }
}

// Draw visualizer
function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);

    if (!analyser || audio.paused) {
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        return;
    }

    analyser.getByteFrequencyData(dataArray);

    canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    const barWidth = visualizerCanvas.width / bufferLength; // Adjust bar width to fit
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        canvasCtx.fillStyle = `rgb(${barHeight + 100},50,50)`;
        canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);

        x += barWidth; // Remove +1 to ensure precise fitting
    }
}

// Fetch lyrics from Lyrics.ovh API
async function fetchLyrics(artist, title) {
    try {
        const response = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`);
        if (!response.ok) {
            throw new Error(`Lyrics not found for ${title} by ${artist}`);
        }
        const data = await response.json();
        return data.lyrics;
    } catch (error) {
        console.warn("Error fetching lyrics:", error.message);
        return "Lyrics not found.";
    }
}


// Load and play a song
async function playSong(songData, index) {
    try {
        if (songData) {
            currentSongData = songData;
            currentSongIndex = index;
            audio.src = currentSongData.src;
            title.textContent = `${currentSongData.title} - ${currentSongData.artist}`;
            cover.src = currentSongData.cover;
            playBtn.textContent = "⏸️";
            
            console.log("Attempting to play song:", currentSongData.title);
            console.log("Audio source:", audio.src);
            console.log("Audio paused state before play:", audio.paused);
            console.log("Audio volume before play:", audio.volume);

            // Ensure audio context is initialized and resumed on play
            if (!audioContext) {
                initAudioContext();
            }
            console.log("AudioContext state before resume:", audioContext.state);
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log("AudioContext resumed successfully.");
                }).catch(e => console.error("Error resuming AudioContext:", e));
            }
            
            audio.play().then(() => {
                console.log("Audio play initiated successfully.");
            }).catch(e => console.error("Error initiating audio play:", e));
            
            updatePlaylistUI();

            // Fetch and display lyrics
            lyricsContainer.style.display = "block";
            lyricsText.textContent = "Fetching lyrics...";
            const lyrics = await fetchLyrics(currentSongData.artist, currentSongData.title);
            lyricsText.textContent = lyrics;
            if (lyrics === "Lyrics not found.") { // Hide container if lyrics not found
                lyricsContainer.style.display = "none";
            }

        } else {
            title.textContent = "No song available";
            cover.src = "";
            playBtn.textContent = "▶️";
            lyricsContainer.style.display = "none"; // Hide lyrics if no song
            console.log("Could not play song: No song data available.");
        }
    } catch (error) {
        console.error("Error playing song:", error);
        title.textContent = "Error loading song";
        cover.src = "";
        playBtn.textContent = "▶️";
        lyricsContainer.style.display = "none"; // Hide lyrics on error
    }
}

// Play next song in the current playlist
function playNext() {
    if (currentPlaylist.length > 0) {
        currentSongIndex = (currentSongIndex + 1) % currentPlaylist.length;
        playSong(currentPlaylist[currentSongIndex], currentSongIndex);
    } else {
        console.log("Playlist is empty, cannot play next song.");
    }
}

// Play previous song in the current playlist
function playPrev() {
    if (currentPlaylist.length > 0) {
        currentSongIndex = (currentSongIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        playSong(currentPlaylist[currentSongIndex], currentSongIndex);
    } else {
        console.log("Playlist is empty, cannot play previous song.");
    }
}

// Initial load: fetch a random song
async function loadInitialRandomSong() {
    const keywords = ["love","party","rock","pop","instrumental","bollywood","ed sheeran","arijit singh","shakira"];
    const randomQuery = keywords[Math.floor(Math.random() * keywords.length)];
    const results = await fetchSongs(randomQuery);
    if (results.length > 0) {
        currentPlaylist = results;
        playSong(currentPlaylist[0], 0);
    } else {
        title.textContent = "No songs found for initial load.";
        cover.src = "";
        playBtn.textContent = "▶️";
        updatePlaylistUI();
        lyricsContainer.style.display = "none"; // Hide lyrics if no initial song
    }
}

// Update playlist UI
function updatePlaylistUI() {
    playlist.innerHTML = "";
    if (currentPlaylist.length === 0) {
        playlist.innerHTML = "<li>Playlist is empty.</li>";
        return;
    }
    currentPlaylist.forEach((song, index) => {
        const li = document.createElement("li");
        li.textContent = `${song.title} - ${song.artist}`;
        li.setAttribute('draggable', true); // Make playlist items draggable
        li.dataset.index = index; // Store original index

        if (index === currentSongIndex) {
            li.classList.add("active");
        }
        li.addEventListener("click", () => playSong(song, index));
        playlist.appendChild(li);
    });

    addDragAndDropListeners();
}

let draggedItem = null;

function addDragAndDropListeners() {
    const listItems = playlist.querySelectorAll('li');
    listItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow drop
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedItem && this.classList.contains('active')) {
        // Prevent dropping on the currently playing song if it's not the dragged item
        return;
    }
    if (this !== draggedItem && this.compareDocumentPosition(draggedItem) & Node.DOCUMENT_POSITION_FOLLOWING) {
        this.parentNode.insertBefore(draggedItem, this);
    } else if (this !== draggedItem) {
        this.parentNode.insertBefore(draggedItem, this.nextSibling);
    }
}

function handleDragLeave() {
    // No specific action needed on drag leave for this implementation
}

function handleDrop(e) {
    e.preventDefault();
    if (draggedItem !== this) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = parseInt(this.dataset.index);

        const [movedSong] = currentPlaylist.splice(fromIndex, 1);
        currentPlaylist.splice(toIndex, 0, movedSong);

        // Re-evaluate currentSongIndex based on the currentSongData
        if (currentSongData) {
            currentSongIndex = currentPlaylist.findIndex(song => song.title === currentSongData.title && song.artist === currentSongData.artist);
        } else {
            currentSongIndex = -1;
        }
        
        updatePlaylistUI(); // Re-render the playlist with new order
        // No need to save savedPlaylists here, as this is a temporary reorder of currentPlaylist
        // Saved playlists are handled by savePlaylistBtn
    }
}

function handleDragEnd() {
    this.classList.remove('dragging');
    draggedItem = null;
    // data-index attributes are re-assigned by updatePlaylistUI, so no need to do it here.
}

// Play/pause
playBtn.addEventListener("click", () => {
    if(audio.paused) {
        console.log("Play button clicked. Audio paused state:", audio.paused);
        if (!audioContext) {
            initAudioContext();
        }
        console.log("AudioContext state before resume (play button):", audioContext.state);
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log("AudioContext resumed successfully (play button).");
            }).catch(e => console.error("Error resuming AudioContext (play button):", e));
        }
        audio.play().then(() => {
            console.log("Audio play initiated successfully (play button).");
        }).catch(e => console.error("Error initiating audio play (play button):", e));
        playBtn.textContent = "⏸️";
    } else {
        audio.pause();
        playBtn.textContent = "▶️";
        console.log("Audio paused.");
    }
});

// Next / Previous buttons
nextBtn.addEventListener("click", playNext);
prevBtn.addEventListener("click", playPrev);

// Progress bar
audio.addEventListener("timeupdate", () => {
    const percent = (audio.currentTime / audio.duration) * 100;
    progress.value = percent || 0;
    currentTimeEl.textContent = formatTime(audio.currentTime);
    durationEl.textContent = formatTime(audio.duration);
});

progress.addEventListener("input", () => {
    audio.currentTime = (progress.value / 100) * audio.duration;
});

// Volume control
volumeSlider.addEventListener("input", () => {
    audio.volume = volumeSlider.value;
});

// Auto next song when current ends
audio.addEventListener("ended", playNext);

// Format time mm:ss
function formatTime(time){
    if(isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0"+seconds : seconds}`;
}

// Search functionality
searchButton.addEventListener("click", async () => {
    const query = searchInput.value.trim();
    if (query) {
        const results = await fetchSongs(query);
        if (results.length > 0) {
            currentPlaylist = results;
            playSong(currentPlaylist[0], 0);
        } else {
            playlist.innerHTML = "<li>No results found.</li>";
            title.textContent = "No results found";
            cover.src = "";
            audio.pause();
            playBtn.textContent = "▶️";
            lyricsContainer.style.display = "none"; // Hide lyrics if no search results
        }
    }
});

searchInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
        searchButton.click();
    }
});

// Playlist Management Functions
function renderSavedPlaylists() {
    savedPlaylistsSelect.innerHTML = '<option value="">Load Playlist</option>';
    const userPlaylists = savedPlaylists[currentUser] || {};
    for (const name in userPlaylists) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        savedPlaylistsSelect.appendChild(option);
    }
}

createPlaylistBtn.addEventListener("click", () => {
    if (!currentUser) {
        alert("Please log in to create playlists.");
        return;
    }
    const name = newPlaylistNameInput.value.trim();
    if (name) {
        if (!savedPlaylists[currentUser]) {
            savedPlaylists[currentUser] = {};
        }
        if (!savedPlaylists[currentUser][name]) {
            savedPlaylists[currentUser][name] = [];
            localStorage.setItem("savedPlaylists", JSON.stringify(savedPlaylists));
            newPlaylistNameInput.value = "";
            renderSavedPlaylists();
            alert(`Playlist "${name}" created!`);
        } else {
            alert(`Playlist "${name}" already exists.`);
        }
    } else {
        alert("Please enter a valid playlist name.");
    }
});

savePlaylistBtn.addEventListener("click", () => {
    if (!currentUser) {
        alert("Please log in to save playlists.");
        return;
    }
    const name = newPlaylistNameInput.value.trim();
    if (name) {
        if (!savedPlaylists[currentUser]) {
            savedPlaylists[currentUser] = {};
        }
        savedPlaylists[currentUser][name] = [...currentPlaylist]; // Save a copy of the current playing playlist
        localStorage.setItem("savedPlaylists", JSON.stringify(savedPlaylists));
        newPlaylistNameInput.value = "";
        renderSavedPlaylists();
        alert(`Current playlist saved as "${name}"!`);
    } else {
        alert("Please enter a name to save the current playlist.");
    }
});

loadPlaylistBtn.addEventListener("click", () => {
    if (!currentUser) {
        alert("Please log in to load playlists.");
        return;
    }
    const name = savedPlaylistsSelect.value;
    if (name && savedPlaylists[currentUser] && savedPlaylists[currentUser][name]) {
        currentPlaylist = [...savedPlaylists[currentUser][name]];
        if (currentPlaylist.length > 0) {
            playSong(currentPlaylist[0], 0);
        } else {
            title.textContent = "Playlist is empty.";
            cover.src = "";
            audio.pause();
            playBtn.textContent = "▶️";
            updatePlaylistUI();
            lyricsContainer.style.display = "none"; // Hide lyrics if loaded playlist is empty
        }
        currentLoadedPlaylistName = name; // Track the loaded playlist
        alert(`Playlist "${name}" loaded!`);
    } else {
        alert("Please select a playlist to load.");
    }
});

deletePlaylistBtn.addEventListener("click", () => {
    if (!currentUser) {
        alert("Please log in to delete playlists.");
        return;
    }
    const name = savedPlaylistsSelect.value;
    if (name && savedPlaylists[currentUser] && savedPlaylists[currentUser][name]) {
        if (confirm(`Are you sure you want to delete playlist "${name}"?`)) {
            // Check if the deleted playlist is the one currently loaded
            const wasCurrentPlaylist = (currentLoadedPlaylistName === name);

            delete savedPlaylists[currentUser][name];
            localStorage.setItem("savedPlaylists", JSON.stringify(savedPlaylists));
            renderSavedPlaylists();
            alert(`Playlist "${name}" deleted!`);

            if (wasCurrentPlaylist) {
                currentPlaylist = [];
                currentSongIndex = -1;
                currentLoadedPlaylistName = null; // Reset loaded playlist tracker
                title.textContent = "No song available";
                cover.src = "";
                audio.pause();
                playBtn.textContent = "▶️";
                updatePlaylistUI();
                lyricsContainer.style.display = "none"; // Hide lyrics if current playlist is deleted
            }
        }
    } else {
        alert("Please select a playlist to delete.");
    }
});

// User Authentication Functions
function updateAuthUI() {
    if (currentUser) {
        loggedOutView.style.display = "none";
        loggedInView.style.display = "flex";
        welcomeMessage.textContent = `Welcome, ${currentUser}!`;
        mainPlayerContent.style.display = "flex"; // Show main player content
        renderSavedPlaylists(); // Re-render playlists for the logged-in user
    } else {
        loggedOutView.style.display = "flex";
        loggedInView.style.display = "none";
        welcomeMessage.textContent = "Welcome, Guest!";
        mainPlayerContent.style.display = "none"; // Hide main player content
        currentPlaylist = []; // Clear current playlist if logged out
        currentSongIndex = -1;
        title.textContent = "No song available";
        cover.src = "";
        audio.pause();
        playBtn.textContent = "▶️";
        updatePlaylistUI();
        renderSavedPlaylists(); // Clear saved playlists dropdown
        lyricsContainer.style.display = "none"; // Hide lyrics if logged out
    }
}

registerBtn.addEventListener("click", () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    if (username && password) {
        if (users[username]) {
            alert("Username already exists. Please choose a different one.");
        } else {
            users[username] = password; // In a real app, hash passwords!
            localStorage.setItem("users", JSON.stringify(users));
            alert("Registration successful! You can now log in.");
            authUsernameInput.value = "";
            authPasswordInput.value = "";
        }
    } else {
        alert("Please enter both username and password.");
    }
});

loginBtn.addEventListener("click", () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    if (username && password) {
        if (users[username] && users[username] === password) {
            currentUser = username;
            sessionStorage.setItem("currentUser", username);
            alert(`Welcome back, ${currentUser}!`);
            authUsernameInput.value = "";
            authPasswordInput.value = "";
            updateAuthUI();
            loadInitialRandomSong(); // Load a song after login
        } else {
            alert("Invalid username or password.");
        }
    } else {
        alert("Please enter both username and password.");
    }
});

logoutBtn.addEventListener("click", () => {
    currentUser = null;
    sessionStorage.removeItem("currentUser");
    alert("Logged out successfully.");
    updateAuthUI();
});


// Add event listener for when audio can play through
audio.addEventListener('canplaythrough', () => {
    console.log("Audio can play through. Duration:", audio.duration);
});

audio.addEventListener('error', (e) => {
    console.error("Audio error:", e);
    switch (e.target.error.code) {
        case e.target.error.MEDIA_ERR_ABORTED:
            console.error('You aborted the audio playback.');
            break;
        case e.target.error.MEDIA_ERR_NETWORK:
            console.error('A network error caused the audio download to fail.');
            break;
        case e.target.error.MEDIA_ERR_DECODE:
            console.error('The audio playback was aborted due to a corruption problem or because the media used features your browser did not support.');
            break;
        case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            console.error('The audio could not be loaded, either because the server or network failed or because the format is not supported.');
            break;
        default:
            console.error('An unknown audio error occurred.');
            break;
    }
});

// Start playing first random song after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    updateAuthUI(); // Initialize auth UI
    if (currentUser) {
        // Autoplay is often blocked, so we'll just load the song and let user click play
        loadInitialRandomSong(); 
    } else {
        title.textContent = "Please log in or register.";
        cover.src = "";
        playBtn.textContent = "▶️";
        updatePlaylistUI();
    }
});
