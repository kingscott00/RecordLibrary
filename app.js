// Vinyl Collection App
class VinylCollectionApp {
    constructor() {
        this.records = [];
        this.filteredRecords = [];
        this.selectedArtist = null;
        this.selectedAlbum = null;
        this.folders = new Set();
        this.currentFolder = 'all';

        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.populateFolderFilter();
        this.renderArtists();
        this.updateRecordCount();
    }

    async loadData() {
        try {
            const response = await fetch('scottking11-collection-20251121-1936.csv');
            const csvText = await response.text();
            this.records = this.parseCSV(csvText);
            this.filteredRecords = [...this.records];

            // Extract unique folders
            this.records.forEach(record => {
                if (record.CollectionFolder) {
                    this.folders.add(record.CollectionFolder);
                }
            });
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading vinyl collection data. Please check the console for details.');
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = this.parseCSVLine(lines[0]);
        const records = [];

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;

            const values = this.parseCSVLine(lines[i]);
            const record = {};

            headers.forEach((header, index) => {
                record[header] = values[index] || '';
            });

            records.push(record);
        }

        return records;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    setupEventListeners() {
        // Folder filter
        document.getElementById('folderFilter').addEventListener('change', (e) => {
            this.currentFolder = e.target.value;
            this.filterByFolder();
        });

        // Artist search
        document.getElementById('artistSearch').addEventListener('input', (e) => {
            this.filterArtists(e.target.value);
        });
    }

    populateFolderFilter() {
        const select = document.getElementById('folderFilter');
        const sortedFolders = Array.from(this.folders).sort();

        sortedFolders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder;
            select.appendChild(option);
        });
    }

    filterByFolder() {
        if (this.currentFolder === 'all') {
            this.filteredRecords = [...this.records];
        } else {
            this.filteredRecords = this.records.filter(
                record => record.CollectionFolder === this.currentFolder
            );
        }

        this.selectedArtist = null;
        this.selectedAlbum = null;
        this.renderArtists();
        this.renderAlbums([]);
        this.renderAlbumDetails(null);
        this.updateRecordCount();
    }

    filterArtists(searchTerm) {
        const artistList = document.getElementById('artistList');
        const items = artistList.querySelectorAll('.artist-item');

        items.forEach(item => {
            const artistName = item.querySelector('.artist-name').textContent.toLowerCase();
            if (artistName.includes(searchTerm.toLowerCase())) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    getArtists() {
        const artistMap = new Map();

        this.filteredRecords.forEach(record => {
            const artist = record.Artist;
            if (!artistMap.has(artist)) {
                artistMap.set(artist, []);
            }
            artistMap.get(artist).push(record);
        });

        return Array.from(artistMap.entries())
            .map(([artist, albums]) => ({ artist, albums }))
            .sort((a, b) => a.artist.localeCompare(b.artist));
    }

    renderArtists() {
        const artistList = document.getElementById('artistList');
        const artists = this.getArtists();

        if (artists.length === 0) {
            artistList.innerHTML = '<div class="empty-state"><p>No artists found</p></div>';
            return;
        }

        artistList.innerHTML = '';

        artists.forEach(({ artist, albums }) => {
            const li = document.createElement('li');
            li.className = 'artist-item';
            li.innerHTML = `
                <span class="artist-name">${this.escapeHtml(artist)}</span>
                <span class="artist-count">(${albums.length})</span>
            `;

            li.addEventListener('click', () => {
                this.selectArtist(artist, albums);
            });

            artistList.appendChild(li);
        });
    }

    selectArtist(artist, albums) {
        this.selectedArtist = artist;
        this.selectedAlbum = null;

        // Update active state
        document.querySelectorAll('.artist-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.closest('.artist-item').classList.add('active');

        this.renderAlbums(albums);
        this.renderAlbumDetails(null);
    }

    renderAlbums(albums) {
        const albumList = document.getElementById('albumList');

        if (albums.length === 0) {
            albumList.innerHTML = '<div class="empty-state"><p>Select an artist to view their albums</p></div>';
            return;
        }

        albumList.innerHTML = '';

        albums.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card';

            const year = album.Released || 'Unknown';
            const format = album.Format || 'N/A';

            card.innerHTML = `
                <div class="album-title">${this.escapeHtml(album.Title)}</div>
                <div class="album-meta">
                    <span class="album-year">${this.escapeHtml(year)}</span> •
                    ${this.escapeHtml(album.Label)}
                </div>
            `;

            card.addEventListener('click', () => {
                this.selectAlbum(album, card);
            });

            albumList.appendChild(card);
        });
    }

    selectAlbum(album, cardElement) {
        this.selectedAlbum = album;

        // Update active state
        document.querySelectorAll('.album-card').forEach(card => {
            card.classList.remove('active');
        });
        cardElement.classList.add('active');

        this.renderAlbumDetails(album);
    }

    async renderAlbumDetails(album) {
        const detailsPane = document.getElementById('albumDetails');

        if (!album) {
            detailsPane.innerHTML = '<div class="empty-state"><p>Select an album to view details</p></div>';
            return;
        }

        // Show loading state
        detailsPane.innerHTML = '<div class="empty-state loading"><p>Loading album details...</p></div>';

        // Fetch Wikipedia data
        const wikiData = await this.fetchWikipediaData(album.Artist, album.Title);

        const condition = this.getConditionClass(album['Collection Media Condition']);
        const sleeveCondition = this.getConditionClass(album['Collection Sleeve Condition']);

        let html = `
            <div class="details-header">
                <h2 class="details-title">${this.escapeHtml(album.Title)}</h2>
                <p class="details-artist">by ${this.escapeHtml(album.Artist)}</p>
            </div>

            <div class="album-cover-section">
        `;

        if (wikiData.imageUrl) {
            html += `<img src="${wikiData.imageUrl}" alt="${this.escapeHtml(album.Title)}" class="album-cover">`;
        } else {
            html += `<div class="cover-loading">No cover image found</div>`;
        }

        if (wikiData.pageUrl) {
            html += `<br><a href="${wikiData.pageUrl}" target="_blank" class="wikipedia-link">View on Wikipedia</a>`;
        }

        html += `</div>`;

        // Album Information
        html += `
            <div class="details-section">
                <h3>Album Information</h3>
                <div class="detail-row">
                    <span class="detail-label">Artist:</span>
                    <span class="detail-value">${this.escapeHtml(album.Artist)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Title:</span>
                    <span class="detail-value">${this.escapeHtml(album.Title)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Label:</span>
                    <span class="detail-value">${this.escapeHtml(album.Label)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Released:</span>
                    <span class="detail-value">${this.escapeHtml(album.Released || 'Unknown')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Format:</span>
                    <span class="detail-value">${this.escapeHtml(album.Format)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Catalog #:</span>
                    <span class="detail-value">${this.escapeHtml(album['Catalog#'])}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Folder:</span>
                    <span class="detail-value">${this.escapeHtml(album.CollectionFolder)}</span>
                </div>
            </div>
        `;

        // Collection Details
        html += `
            <div class="details-section">
                <h3>Collection Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Media Condition:</span>
                    <span class="detail-value">
                        <span class="condition-badge ${condition}">
                            ${this.escapeHtml(album['Collection Media Condition'] || 'Not specified')}
                        </span>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Sleeve Condition:</span>
                    <span class="detail-value">
                        <span class="condition-badge ${sleeveCondition}">
                            ${this.escapeHtml(album['Collection Sleeve Condition'] || 'Not specified')}
                        </span>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date Added:</span>
                    <span class="detail-value">${this.formatDate(album['Date Added'])}</span>
                </div>
                ${album['Collection Notes'] ? `
                <div class="detail-row">
                    <span class="detail-label">Notes:</span>
                    <span class="detail-value">${this.escapeHtml(album['Collection Notes'])}</span>
                </div>
                ` : ''}
            </div>
        `;

        // Discogs Link
        if (album.release_id) {
            html += `
                <div class="details-section">
                    <h3>External Links</h3>
                    <div class="detail-row">
                        <span class="detail-label">Discogs:</span>
                        <span class="detail-value">
                            <a href="https://www.discogs.com/release/${album.release_id}"
                               target="_blank"
                               style="color: var(--accent-warm);">
                                View on Discogs
                            </a>
                        </span>
                    </div>
                </div>
            `;
        }

        detailsPane.innerHTML = html;
    }

    async fetchWikipediaData(artist, album) {
        try {
            // Search for the album page
            const searchQuery = `${artist} ${album} album`;
            const searchUrl = `https://en.wikipedia.org/w/api.php?` +
                `action=query&` +
                `list=search&` +
                `srsearch=${encodeURIComponent(searchQuery)}&` +
                `format=json&` +
                `origin=*`;

            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();

            if (searchData.query.search.length === 0) {
                return { imageUrl: null, pageUrl: null };
            }

            const pageTitle = searchData.query.search[0].title;
            const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;

            // Get page images
            const imageUrl = `https://en.wikipedia.org/w/api.php?` +
                `action=query&` +
                `titles=${encodeURIComponent(pageTitle)}&` +
                `prop=pageimages&` +
                `pithumbsize=500&` +
                `format=json&` +
                `origin=*`;

            const imageResponse = await fetch(imageUrl);
            const imageData = await imageResponse.json();

            const pages = imageData.query.pages;
            const pageId = Object.keys(pages)[0];
            const thumbnail = pages[pageId].thumbnail;

            return {
                imageUrl: thumbnail ? thumbnail.source : null,
                pageUrl: pageUrl
            };
        } catch (error) {
            console.error('Error fetching Wikipedia data:', error);
            return { imageUrl: null, pageUrl: null };
        }
    }

    getConditionClass(condition) {
        if (!condition) return '';

        const conditionLower = condition.toLowerCase();
        if (conditionLower.includes('mint (m)')) return 'condition-mint';
        if (conditionLower.includes('near mint') || conditionLower.includes('nm')) return 'condition-nm';
        if (conditionLower.includes('very good plus') || conditionLower.includes('vg+')) return 'condition-vgp';
        if (conditionLower.includes('very good') && !conditionLower.includes('plus')) return 'condition-vg';
        if (conditionLower.includes('good plus') || conditionLower.includes('g+')) return 'condition-gp';
        if (conditionLower.includes('good (g)') || conditionLower === 'good') return 'condition-g';
        if (conditionLower.includes('fair') || conditionLower.includes('f')) return 'condition-f';

        return '';
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    updateRecordCount() {
        const count = this.filteredRecords.length;
        const total = this.records.length;
        const countElement = document.getElementById('recordCount');

        if (this.currentFolder === 'all') {
            countElement.textContent = `${total} records`;
        } else {
            countElement.textContent = `${count} of ${total} records`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new VinylCollectionApp();
});
