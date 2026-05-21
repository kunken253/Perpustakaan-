// ============================================================
//  PerpusKu — script.js (Catalog Page)
//  Firebase Firestore + Borrow Request System
// ============================================================

import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc, query, where, serverTimestamp }
                             from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── Firebase Config ───────────────────────────────────────────
const firebaseConfig = {
    apiKey:            "AIzaSyAScBz6SkLgwE8lGQ76DCNHAxN5kCn77sk",
    authDomain:        "pusper-a873c.firebaseapp.com",
    projectId:         "pusper-a873c",
    storageBucket:     "pusper-a873c.firebasestorage.app",
    messagingSenderId: "314221884994",
    appId:             "1:314221884994:web:89258fecc21d984dc3dfdb"
};

const app              = initializeApp(firebaseConfig);
const db               = getFirestore(app);
const booksCollection  = collection(db, "books");
const requestsCol      = collection(db, "borrowRequests");

// ── State ─────────────────────────────────────────────────────
let books = [];
let pendingBookIds = new Set();
let currentBorrowBookId = null;

// ── DOM refs ──────────────────────────────────────────────────
const bookGrid       = document.getElementById('bookGrid');
const searchInput    = document.getElementById('searchInput');
const categorySelect = document.getElementById('categorySelect');
const bookCount      = document.getElementById('bookCount');

// Synopsis / Info modal
const modalOverlay   = document.getElementById('modalOverlay');
const closeModal     = document.getElementById('closeModal');
const modalCover     = document.getElementById('modalCover');
const modalTitle     = document.getElementById('modalTitle');
const modalAuthor    = document.getElementById('modalAuthor');
const modalSynopsis  = document.getElementById('modalSynopsis');

// Borrow modal
const borrowOverlay     = document.getElementById('borrowOverlay');
const closeBorrowModal  = document.getElementById('closeBorrowModal');
const borrowModalCover  = document.getElementById('borrowModalCover');
const borrowCoverPH     = document.getElementById('borrowCoverPlaceholder');
const borrowModalTitle  = document.getElementById('borrowModalTitle');
const borrowModalAuthor = document.getElementById('borrowModalAuthor');
const borrowerNameInput = document.getElementById('borrowerName');
const borrowNoteInput   = document.getElementById('borrowNote');
const submitBorrowBtn   = document.getElementById('submitBorrowBtn');

// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' toast-error' : type === 'info' ? ' toast-info' : ''}`;
    toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            ${type === 'error'
                ? '<circle cx="12" cy="12" r="10" stroke="#b84040" stroke-width="1.5"/><path d="M15 9l-6 6M9 9l6 6" stroke="#b84040" stroke-width="2" stroke-linecap="round"/>'
                : type === 'info'
                ? '<circle cx="12" cy="12" r="10" stroke="#4a7c9e" stroke-width="1.5"/><path d="M12 16v-4M12 8h.01" stroke="#4a7c9e" stroke-width="2" stroke-linecap="round"/>'
                : '<circle cx="12" cy="12" r="10" stroke="#c9963a" stroke-width="1.5"/><path d="M8 12l3 3 5-5" stroke="#c9963a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
            }
        </svg>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-hide');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

// ── Render Books ──────────────────────────────────────────────
function renderBooks() {
    bookGrid.innerHTML = '';

    const searchTerm       = searchInput.value.toLowerCase().trim();
    const selectedCategory = categorySelect.value;

    const filtered = books.filter(book => {
        const matchSearch   = book.title.toLowerCase().includes(searchTerm)
                           || (book.author || '').toLowerCase().includes(searchTerm);
        const matchCategory = selectedCategory === 'Semua' || book.category === selectedCategory;
        return matchSearch && matchCategory;
    });

    if (bookCount) bookCount.textContent = `${filtered.length} judul`;

    if (filtered.length === 0) {
        bookGrid.innerHTML = `
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
              <rect x="6" y="4" width="6" height="40" rx="2" fill="#c9963a"/>
              <rect x="10" y="5" width="32" height="38" rx="3" fill="#2f4235"/>
              <rect x="13" y="7" width="28" height="34" rx="2" fill="#ede5d4"/>
              <path d="M20 28l4-8 4 8" stroke="#c9963a" stroke-width="2" stroke-linecap="round"/>
              <line x1="22" y1="25" x2="26" y2="25" stroke="#c9963a" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>Buku tidak ditemukan untuk kata kunci "<strong>${searchTerm || selectedCategory}</strong>"</p>
          </div>`;
        return;
    }

    filtered.forEach((book, i) => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.style.animationDelay = `${i * 0.04}s`;

        const coverHtml = `
            <div class="book-cover-placeholder">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="4" width="6" height="40" rx="2" fill="#c9963a" opacity=".5"/>
                <rect x="10" y="5" width="32" height="38" rx="3" fill="#2f4235" opacity=".4"/>
                <rect x="13" y="7" width="28" height="34" rx="2" fill="#ede5d4" opacity=".7"/>
                <line x1="18" y1="15" x2="35" y2="15" stroke="#c9963a" stroke-width="2" stroke-linecap="round" opacity=".5"/>
                <line x1="18" y1="20" x2="35" y2="20" stroke="#c9963a" stroke-width="1.5" stroke-linecap="round" opacity=".35"/>
                <line x1="18" y1="25" x2="28" y2="25" stroke="#c9963a" stroke-width="1.5" stroke-linecap="round" opacity=".35"/>
              </svg>
            </div>
            ${book.coverUrl
                ? `<img class="book-cover" src="${book.coverUrl}" alt="Sampul ${book.title}" loading="lazy" onerror="this.style.display='none'">`
                : ''}`;

        const isPending = pendingBookIds.has(book.id);

        let statusHtml = '';
        if (book.isBorrowed) {
            statusHtml = `<div class="status-badge status-borrowed">
                <span class="status-dot borrowed-dot"></span> Sedang Dipinjam
            </div>`;
        } else if (isPending) {
            statusHtml = `<div class="status-badge status-pending">
                <span class="status-dot pending-dot"></span> Menunggu Konfirmasi
            </div>`;
        }

        let borrowBtnHtml = '';
        if (book.isBorrowed) {
            borrowBtnHtml = `<button class="btn-pinjam disabled" disabled>Dipinjam</button>`;
        } else if (isPending) {
            borrowBtnHtml = `<button class="btn-pinjam pending-btn" disabled>Menunggu...</button>`;
        } else {
            borrowBtnHtml = `<button class="btn-pinjam" onclick="openBorrowModal('${book.id}')">Pinjam</button>`;
        }

        card.innerHTML = `
            <div class="card-cover-wrap">
                ${coverHtml}
                <span class="category-badge">${book.category || 'Umum'}</span>
            </div>
            <div class="card-body">
                <div class="book-title">${book.title}</div>
                <div class="book-author">oleh ${book.author || 'Anonim'}${book.tahunTerbit ? ` · ${book.tahunTerbit}` : ''}</div>
                ${statusHtml}
                <div class="btn-group">
                    <button class="btn-sinopsis" onclick="showSynopsis('${book.id}')">Info</button>
                    ${borrowBtnHtml}
                </div>
            </div>`;
        bookGrid.appendChild(card);
    });
}

// ── Fetch from Firebase ───────────────────────────────────────
async function fetchBooks() {
    try {
        const [booksSnap, requestsSnap] = await Promise.all([
            getDocs(booksCollection),
            getDocs(query(requestsCol, where("status", "==", "pending")))
        ]);

        books = [];
        booksSnap.forEach(d => books.push({ id: d.id, ...d.data() }));
        books.sort((a, b) => a.title.localeCompare(b.title));

        pendingBookIds.clear();
        requestsSnap.forEach(d => pendingBookIds.add(d.data().bookId));

        renderBooks();
    } catch (err) {
        console.error("Gagal mengambil data:", err);
        bookGrid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <p>⚠️ Gagal memuat data. Periksa koneksi Anda.</p>
          </div>`;
    }
}

// ── Open Borrow Modal ─────────────────────────────────────────
window.openBorrowModal = function(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;

    currentBorrowBookId = id;
    borrowModalTitle.textContent  = book.title;
    borrowModalAuthor.textContent = `oleh ${book.author || 'Anonim'}`;
    borrowerNameInput.value = '';
    borrowNoteInput.value   = '';

    if (book.coverUrl) {
        borrowModalCover.src = book.coverUrl;
        borrowModalCover.style.display = 'block';
        borrowCoverPH.style.display    = 'none';
    } else {
        borrowModalCover.style.display = 'none';
        borrowCoverPH.style.display    = 'flex';
    }

    borrowOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => borrowerNameInput.focus(), 100);
};

// ── Submit Borrow Request ─────────────────────────────────────
submitBorrowBtn.addEventListener('click', async () => {
    const name = borrowerNameInput.value.trim();
    if (!name) {
        borrowerNameInput.focus();
        borrowerNameInput.classList.add('input-error');
        setTimeout(() => borrowerNameInput.classList.remove('input-error'), 1500);
        return;
    }

    const book = books.find(b => b.id === currentBorrowBookId);
    if (!book) return;

    submitBorrowBtn.disabled = true;
    submitBorrowBtn.innerHTML = `<span class="btn-spinner"></span> Mengirim…`;

    try {
        await addDoc(requestsCol, {
            bookId:       book.id,
            bookTitle:    book.title,
            bookAuthor:   book.author || 'Anonim',
            bookCoverUrl: book.coverUrl || '',
            borrowerName: name,
            note:         borrowNoteInput.value.trim(),
            status:       'pending',
            createdAt:    serverTimestamp()
        });

        pendingBookIds.add(book.id);
        closeBorrowModalFn();
        renderBooks();
        showToast(`Permintaan peminjaman "${book.title}" berhasil dikirim! Tunggu konfirmasi admin.`);
    } catch (err) {
        console.error("Gagal mengirim permintaan:", err);
        showToast('Gagal mengirim permintaan. Coba lagi.', 'error');
    } finally {
        submitBorrowBtn.disabled = false;
        submitBorrowBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="vertical-align:-.2em;margin-right:.45rem">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Kirim Permintaan Peminjaman`;
    }
});

// ── Show Info Modal ───────────────────────────────────────────
window.showSynopsis = function(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;

    modalTitle.textContent  = book.title;
    modalAuthor.textContent = `oleh ${book.author || 'Anonim'}${book.tahunTerbit ? ` · ${book.tahunTerbit}` : ''}`;
    modalSynopsis.textContent = book.synopsis || 'Sinopsis tidak tersedia.';

    if (book.coverUrl) {
        modalCover.src = book.coverUrl;
        modalCover.style.display = 'block';
    } else {
        modalCover.style.display = 'none';
    }

    modalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

// ── Close Modals ──────────────────────────────────────────────
function closeModalFn() {
    modalOverlay.style.display = 'none';
    document.body.style.overflow = '';
}

function closeBorrowModalFn() {
    borrowOverlay.style.display = 'none';
    document.body.style.overflow = '';
    currentBorrowBookId = null;
}

closeModal.addEventListener('click', closeModalFn);
closeBorrowModal.addEventListener('click', closeBorrowModalFn);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModalFn(); });
borrowOverlay.addEventListener('click', e => { if (e.target === borrowOverlay) closeBorrowModalFn(); });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModalFn();
        closeBorrowModalFn();
    }
});

// ── Search & Filter ───────────────────────────────────────────
searchInput.addEventListener('input', renderBooks);
categorySelect.addEventListener('change', renderBooks);

// ── Init ──────────────────────────────────────────────────────
fetchBooks();
