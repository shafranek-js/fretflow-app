import { state } from './state';
import { Logger } from './logger';
import { loadSongToPractice } from './practice';
import type { Song } from './types';

function handleDeleteSong(songId: string) {
    const song = state.songs.find(s => s.id === songId);
    if (song) {
        Logger.info(`Deleting song: ${song.title}`, 'Library', { songId });
        state.songs = state.songs.filter(s => s.id !== songId);
        localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
        renderSongLibrary();
    }
}

function handleToggleFavorite(songId: string) {
    const songToFavorite = state.songs.find(s => s.id === songId);
    if (songToFavorite) {
        songToFavorite.isFavorite = !songToFavorite.isFavorite;
        Logger.info(`Toggled favorite for song: ${songToFavorite.title}`, 'Library', { isFavorite: songToFavorite.isFavorite });
        localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
        renderSongLibrary();
    }
}

export function handleSongClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    const favoriteBtn = target.closest('.favorite-btn');
    if (favoriteBtn) {
        const songId = favoriteBtn.getAttribute('data-song-id');
        if (songId) {
            handleToggleFavorite(songId);
        }
        return;
    }

    const deleteBtn = target.closest('.delete-song-btn');
    if (deleteBtn && deleteBtn.matches('.delete-song-btn')) {
        const songId = deleteBtn.getAttribute('data-song-id');
        if (songId) {
            handleDeleteSong(songId);
        }
        return;
    }
    
    const songItem = target.closest('.song-item');
    if (songItem instanceof HTMLElement && songItem.dataset.songId) {
        const songToLoad = state.songs.find(s => s.id === songItem.dataset.songId);
        if (songToLoad) {
            loadSongToPractice(songToLoad);
        }
    }
}


function createPlaceholderElement(id: string, name: string): HTMLElement {
    const placeholderLi = document.createElement('div');
    placeholderLi.id = id;
    placeholderLi.className = 'song-item-placeholder bg-gray-800/70 p-4 rounded-lg flex justify-between items-center ring-1 ring-blue-500/50';
    placeholderLi.innerHTML = `
        <div class="flex-grow">
            <h3 class="text-lg font-bold text-white truncate">${name}</h3>
            <p class="text-sm text-blue-400">Processing...</p>
        </div>
        <div class="spinner"></div>
    `;
    return placeholderLi;
}

function createSongElement(song: Song): HTMLElement {
    const songEl = document.createElement('div');
    songEl.className = 'song-item bg-gray-800/70 backdrop-blur-sm p-4 rounded-lg flex items-center gap-4 hover:bg-gray-700/80 transition-all duration-200 ring-1 ring-white/5 shadow-lg';
    songEl.dataset.songId = song.id;

    const isFavorited = !!song.isFavorite;

    let scoreLine = `High Score: ${song.highScore || 0}`;
    if (song.accuracy !== undefined) {
        scoreLine += ` &middot; Accuracy: ${song.accuracy}%`;
    }

    songEl.innerHTML = `
        <div class="flex-grow cursor-pointer">
            <h3 class="text-xl font-bold text-white truncate" title="${song.title}">${song.title}</h3>
            <p class="text-sm text-gray-400">${scoreLine}</p>
        </div>
        <div class="flex-shrink-0 flex items-center gap-1">
             <button class="favorite-btn p-2 rounded-full ${isFavorited ? 'favorited' : ''}" title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}" data-song-id="${song.id}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" style="pointer-events: none;"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
             </button>
             <button class="delete-song-btn p-2 rounded-full text-gray-500 hover:bg-red-900/50 hover:text-red-400 transition-colors" title="Delete song" data-song-id="${song.id}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" style="pointer-events: none;"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
            </button>
        </div>
    `;
    return songEl;
}

function createSection(title: string, elements: HTMLElement[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    if (title) {
        const header = document.createElement('h2');
        header.className = 'text-2xl font-bold text-gray-300';
        fragment.appendChild(header);
        header.textContent = title;
    }
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    elements.forEach(el => grid.appendChild(el));
    fragment.appendChild(grid);
    return fragment;
}

export function renderSongLibrary(placeholderId?: string, placeholderName?: string) {
    const songListContainer = state.ui.songList;
    const searchInput = state.ui.librarySearchInput as HTMLInputElement;
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    songListContainer.innerHTML = ''; // Clear everything first

    const filteredSongs = searchQuery 
        ? state.songs.filter(song => song.title.toLowerCase().includes(searchQuery))
        : state.songs;

    const placeholderEl = placeholderId && placeholderName ? createPlaceholderElement(placeholderId, placeholderName) : null;
    
    if (filteredSongs.length === 0 && !placeholderEl) {
        songListContainer.className = 'flex-grow overflow-y-auto px-4 sm:px-8 flex items-center justify-center';
        
        const noResultsHTML = `
            <div class="empty-state-container h-full flex flex-col items-center justify-center text-center">
              <svg class="w-16 h-16 mb-4 opacity-30 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              <h3 class="text-2xl font-semibold text-white mb-2">No Songs Found</h3>
              <p class="text-gray-400 mb-6">Your search for "${searchQuery}" did not match any songs.</p>
            </div>
        `;
        
        const emptyLibraryHTML = `
            <div class="empty-state-container h-full flex flex-col items-center justify-center text-center">
              <svg class="w-16 h-16 mb-4 opacity-30 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>
              <h3 class="text-2xl font-semibold text-white mb-2">Your Library is Empty</h3>
              <p class="text-gray-400 mb-6">Click the button below to add your first MIDI file.</p>
              <label for="midi-file-input" class="add-song-btn-large">
                  <svg class="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"></path></svg>
                  Add Songs
              </label>
            </div>
        `;
        
        songListContainer.innerHTML = searchQuery ? noResultsHTML : emptyLibraryHTML;
        return;
    }

    songListContainer.className = 'flex-grow overflow-y-auto px-4 sm:px-8 pb-8 space-y-8';
    const listFragment = document.createDocumentFragment();

    const favoriteSongs = filteredSongs.filter(s => s.isFavorite).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const otherSongs = filteredSongs.filter(s => !s.isFavorite).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (favoriteSongs.length > 0) {
        listFragment.appendChild(createSection('Favorites', favoriteSongs.map(createSongElement)));
    }

    const otherSongElements = otherSongs.map(createSongElement);
    if (placeholderEl) {
        otherSongElements.unshift(placeholderEl);
    }
    
    if (otherSongElements.length > 0) {
        const title = favoriteSongs.length > 0 ? 'All Songs' : '';
        listFragment.appendChild(createSection(title, otherSongElements));
    }

    songListContainer.appendChild(listFragment);
}