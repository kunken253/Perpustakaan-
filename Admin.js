// ============================================================
//  PerpusKu — admin.js (Admin Panel)
//  Firebase Firestore CRUD + Borrow Request Management
// ============================================================

import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
         query, where, orderBy, serverTimestamp }
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

const app             = initializeApp(firebaseConfig);
const db              = getFirestore(app);
const booksCollection = collection(db, "books");
const requestsCol     = collection(db, "borrowRequests");

// ── State ─────────────────────────────────────────────────────
let books    = [];
let requests = [];
let activeFilter = 'pending';

// ── DOM refs ──────────────────────────────────────────────────
const addBookForm   = document.getElementById('addBookForm');
const adminBookList = document.getElementById('adminBookList');
const adminCount    = document.getElementById('adminCount');
const requestsList  = document.getElementById('requestsList');
const pendingBadge  = document.getElementById('pendingBadge');

// Edit modal refs
const editOverlay  = document.getElementById('editOverlay');
const closeEditBtn = document.getElementById('closeEditModal');
const saveEditBtn  = document.getElementById('saveEditBtn');

// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' toast-error' : ''}`;
    toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            ${type === 'error'
                ? '<circle cx="12" cy="12" r="10" stroke="#b84040" stroke-width="1.5"/><path d="M15 9l-6 6M9 9l6 6" stroke="#b84040" stroke-width="2" stroke-linecap="round"/>'
                : '<circle cx="12" cy="12" r="10" stroke="#c9963a" stroke-width="1.5"/><path d="M8 12l3 3 5-5" stroke="#c9963a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
            }
        </svg>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-hide');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
}

// ── Relative time formatter ───────────────────────────────────
function relativeTime(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const diff  = (Date.now() - date.getTime()) / 1000;
    if (diff < 60)    return 'Baru saja';
    if (diff < 3600)  return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hari lalu`;
}

// ── Render Requests ───────────────────────────────────────────
function renderRequests() {
    const filtered     = requests.filter(r => r.status === activeFilter);
    const pendingCount = requests.filter(r => r.status === 'pending').length;

    if (pendingCount > 0) {
        pendingBadge.textContent = pendingCount;
        pendingBadge.style.display = 'inline-flex';
    } else {
        pendingBadge.style.display = 'none';
    }

    requestsList.innerHTML = '';

    if (filtered.length === 0) {
        const messages = {
            pending:  'Tidak ada permintaan yang menunggu konfirmasi.',
            approved: 'Belum ada permintaan yang disetujui.',
            rejected: 'Belum ada permintaan yang ditolak.'
        };
        requestsList.innerHTML = `
            <div class="request-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" opacity=".3">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#8a7e6e" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <p>${messages[activeFilter]}</p>
            </div>`;
        return;
    }

    filtered.forEach(req => {
        const item = document.createElement('div');
        item.className = `request-item request-${req.status}`;
        item.innerHTML = `
            <div class="request-cover">
                ${req.bookCoverUrl
                    ? `<img src="${req.bookCoverUrl}" alt="" onerror="this.style.display='none'">`
                    : `<svg viewBox="0 0 48 48" fill="none" width="32" height="32" opacity=".4">
                         <rect x="6" y="4" width="6" height="40" rx="2" fill="#c9963a"/>
                         <rect x="10" y="5" width="32" height="38" rx="3" fill="#2f4235"/>
                       </svg>`
                }
            </div>
            <div class="request-info">
                <div class="request-title">${req.bookTitle}</div>
                <div class="request-meta">
                    <span class="request-borrower">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="vertical-align:-.1em">
                            <circle cx="12" cy="8" r="4" stroke="#8a7e6e" stroke-width="1.8"/>
                            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#8a7e6e" stroke-width="1.8" stroke-linecap="round"/>
                        </svg>
                        ${req.borrowerName}
                    </span>
                    ${req.note ? `<span class="request-note">"${req.note}"</span>` : ''}
                    <span class="request-time">${relativeTime(req.createdAt)}</span>
                </div>
            </div>
            <div class="request-actions">
                ${req.status === 'pending' ? `
                    <button class="btn-approve" onclick="approveRequest('${req.id}', '${req.bookId}', '${req.bookTitle.replace(/'/g,"\\'")}', '${req.borrowerName.replace(/'/g,"\\'")}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Setujui
                    </button>
                    <button class="btn-reject" onclick="rejectRequest('${req.id}', '${req.bookTitle.replace(/'/g,"\\'")}', '${req.borrowerName.replace(/'/g,"\\'")}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                        </svg>
                        Tolak
                    </button>
                ` : `
                    <span class="request-status-label ${req.status === 'approved' ? 'label-approved' : 'label-rejected'}">
                        ${req.status === 'approved' ? '✓ Disetujui' : '✕ Ditolak'}
                    </span>
                `}
            </div>`;
        requestsList.appendChild(item);
    });
}

// ── Fetch Requests ────────────────────────────────────────────
async function fetchRequests() {
    try {
        const snap = await getDocs(requestsCol);
        requests = [];
        snap.forEach(d => requests.push({ id: d.id, ...d.data() }));
        requests.sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() || 0;
            const tb = b.createdAt?.toMillis?.() || 0;
            return tb - ta;
        });
        renderRequests();
    } catch (err) {
        console.error("Gagal memuat permintaan:", err);
        requestsList.innerHTML = `<div class="loading-state"><p>⚠️ Gagal memuat permintaan.</p></div>`;
    }
}

// ── Approve Request ───────────────────────────────────────────
window.approveRequest = async function(reqId, bookId, bookTitle, borrowerName) {
    if (!confirm(`Setujui permintaan peminjaman "${bookTitle}" oleh ${borrowerName}?`)) return;

    try {
        await updateDoc(doc(db, "borrowRequests", reqId), {
            status: 'approved',
            resolvedAt: serverTimestamp()
        });
        await updateDoc(doc(db, "books", bookId), { isBorrowed: true });

        const reqIdx = requests.findIndex(r => r.id === reqId);
        if (reqIdx !== -1) requests[reqIdx].status = 'approved';
        const bookIdx = books.findIndex(b => b.id === bookId);
        if (bookIdx !== -1) books[bookIdx].isBorrowed = true;

        renderRequests();
        renderAdminList();
        showToast(`Peminjaman "${bookTitle}" oleh ${borrowerName} telah disetujui.`);
    } catch (err) {
        console.error("Gagal menyetujui:", err);
        showToast('Gagal menyetujui permintaan. Coba lagi.', 'error');
    }
};

// ── Reject Request ────────────────────────────────────────────
window.rejectRequest = async function(reqId, bookTitle, borrowerName) {
    if (!confirm(`Tolak permintaan peminjaman "${bookTitle}" oleh ${borrowerName}?`)) return;

    try {
        await updateDoc(doc(db, "borrowRequests", reqId), {
            status: 'rejected',
            resolvedAt: serverTimestamp()
        });

        const idx = requests.findIndex(r => r.id === reqId);
        if (idx !== -1) requests[idx].status = 'rejected';

        renderRequests();
        showToast(`Permintaan "${bookTitle}" telah ditolak.`);
    } catch (err) {
        console.error("Gagal menolak:", err);
        showToast('Gagal menolak permintaan. Coba lagi.', 'error');
    }
};

// ── Filter Tabs ───────────────────────────────────────────────
document.querySelectorAll('.req-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.req-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeFilter = tab.dataset.filter;
        renderRequests();
    });
});

document.getElementById('refreshRequests').addEventListener('click', () => {
    requestsList.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Memuat…</p></div>';
    fetchRequests();
});

// ── Render Admin Book List ────────────────────────────────────
function renderAdminList() {
    adminBookList.innerHTML = '';
    if (adminCount) adminCount.textContent = `(${books.length} buku)`;

    if (books.length === 0) {
        adminBookList.innerHTML = `
          <div class="loading-state">
            <p style="color:var(--muted);font-family:'Lora',serif;font-style:italic">
              Belum ada buku dalam koleksi.
            </p>
          </div>`;
        return;
    }

    books.forEach(book => {
        const item = document.createElement('div');
        item.className = 'admin-item';
        item.innerHTML = `
            ${book.coverUrl
                ? `<img class="admin-item-cover" src="${book.coverUrl}" alt="" loading="lazy" onerror="this.style.display='none'">`
                : `<div class="admin-item-cover" style="background:var(--cream-3);display:flex;align-items:center;justify-content:center">
                     <svg width="18" height="18" viewBox="0 0 48 48" fill="none" opacity=".4">
                       <rect x="6" y="4" width="6" height="40" rx="2" fill="#c9963a"/>
                       <rect x="10" y="5" width="32" height="38" rx="3" fill="#2f4235"/>
                     </svg>
                   </div>`
            }
            <div class="admin-item-info">
                <div class="admin-item-title">${book.title}</div>
                <div class="admin-item-meta">
                    <span>${book.category || 'Umum'}</span>
                    ${book.author || 'Anonim'}
                    ${book.tahunTerbit ? ` · ${book.tahunTerbit}` : ''}
                    ${book.isBorrowed ? ' · <em style="color:var(--danger);font-style:normal;font-size:.7rem">Dipinjam</em>' : ''}
                </div>
            </div>
            <div class="admin-item-actions">
                ${book.isBorrowed ? `
                    <button class="btn-return" onclick="returnBook('${book.id}', '${book.title.replace(/'/g, "\\'")}')" title="Tandai sudah dikembalikan">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M1 4v6h6M3.51 15a9 9 0 102.13-9.36L1 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Kembalikan
                    </button>
                ` : ''}
                <button class="btn-edit" onclick="openEditModal('${book.id}')" title="Edit buku">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                </button>
                <button class="btn-delete" onclick="deleteBook('${book.id}', '${book.title.replace(/'/g, "\\'")}')" title="Hapus buku">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>`;
        adminBookList.appendChild(item);
    });
}

// ── Fetch Books ───────────────────────────────────────────────
async function fetchBooks() {
    try {
        const snapshot = await getDocs(booksCollection);
        books = [];
        snapshot.forEach(d => books.push({ id: d.id, ...d.data() }));
        books.sort((a, b) => a.title.localeCompare(b.title));
        renderAdminList();
    } catch (err) {
        console.error("Gagal memuat buku:", err);
        adminBookList.innerHTML = `<div class="loading-state"><p>⚠️ Gagal memuat data Firebase.</p></div>`;
    }
}

// ── Add Book ──────────────────────────────────────────────────
addBookForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title       = document.getElementById('judul').value.trim();
    const author      = document.getElementById('penulis').value.trim();
    const category    = document.getElementById('kategori').value;
    const coverUrl    = document.getElementById('sampulUrl').value.trim();
    const synopsis    = document.getElementById('sinopsis').value.trim();
    const tahunRaw    = document.getElementById('tahunTerbit').value;
    const tahunTerbit = tahunRaw ? parseInt(tahunRaw) : null;

    if (!title || !author || !category || !synopsis) {
        showToast('Harap isi semua field yang wajib.', 'error');
        return;
    }

    const submitBtn = addBookForm.querySelector('.btn-primary');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="btn-spinner"></span> Menyimpan…`;

    try {
        const newBook = {
            title, author, category, synopsis,
            coverUrl:    coverUrl || '',
            tahunTerbit,
            isBorrowed:  false,
            createdAt:   serverTimestamp()
        };
        const docRef = await addDoc(booksCollection, newBook);
        books.unshift({ id: docRef.id, ...newBook });
        books.sort((a, b) => a.title.localeCompare(b.title));
        renderAdminList();
        addBookForm.reset();
        showToast(`"${title}" berhasil ditambahkan!`);
    } catch (err) {
        console.error("Gagal menambah buku:", err);
        showToast('Gagal menambah buku. Coba lagi.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="vertical-align:-.2em;margin-right:.4rem">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            Tambahkan ke Koleksi`;
    }
});

// ── Open Edit Modal ───────────────────────────────────────────
window.openEditModal = function(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;

    document.getElementById('editBookId').value      = book.id;
    document.getElementById('editJudul').value       = book.title || '';
    document.getElementById('editPenulis').value     = book.author || '';
    document.getElementById('editKategori').value    = book.category || '';
    document.getElementById('editTahunTerbit').value = book.tahunTerbit || '';
    document.getElementById('editSampulUrl').value   = book.coverUrl || '';
    document.getElementById('editSinopsis').value    = book.synopsis || '';

    editOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('editJudul').focus(), 100);
};

function closeEditModalFn() {
    editOverlay.style.display = 'none';
    document.body.style.overflow = '';
}

closeEditBtn.addEventListener('click', closeEditModalFn);
editOverlay.addEventListener('click', e => { if (e.target === editOverlay) closeEditModalFn(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEditModalFn(); });

// ── Save Edit ─────────────────────────────────────────────────
saveEditBtn.addEventListener('click', async () => {
    const id       = document.getElementById('editBookId').value;
    const title    = document.getElementById('editJudul').value.trim();
    const author   = document.getElementById('editPenulis').value.trim();
    const category = document.getElementById('editKategori').value;
    const coverUrl = document.getElementById('editSampulUrl').value.trim();
    const synopsis = document.getElementById('editSinopsis').value.trim();
    const tahunRaw = document.getElementById('editTahunTerbit').value;
    const tahunTerbit = tahunRaw ? parseInt(tahunRaw) : null;

    if (!title || !author || !category || !synopsis) {
        showToast('Harap isi semua field yang wajib.', 'error');
        return;
    }

    saveEditBtn.disabled = true;
    saveEditBtn.innerHTML = `<span class="btn-spinner"></span> Menyimpan…`;

    try {
        const updated = {
            title, author, category, synopsis,
            coverUrl:    coverUrl || '',
            tahunTerbit
        };
        await updateDoc(doc(db, "books", id), updated);

        const idx = books.findIndex(b => b.id === id);
        if (idx !== -1) books[idx] = { ...books[idx], ...updated };
        books.sort((a, b) => a.title.localeCompare(b.title));

        renderAdminList();
        closeEditModalFn();
        showToast(`"${title}" berhasil diperbarui!`);
    } catch (err) {
        console.error("Gagal mengedit:", err);
        showToast('Gagal menyimpan perubahan. Coba lagi.', 'error');
    } finally {
        saveEditBtn.disabled = false;
        saveEditBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="vertical-align:-.2em;margin-right:.4rem">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Simpan Perubahan`;
    }
});

// ── Return Book ───────────────────────────────────────────────
window.returnBook = async function(id, title) {
    if (!confirm(`Tandai "${title}" sudah dikembalikan?`)) return;

    try {
        await updateDoc(doc(db, "books", id), { isBorrowed: false });
        const idx = books.findIndex(b => b.id === id);
        if (idx !== -1) books[idx].isBorrowed = false;
        renderAdminList();
        showToast(`"${title}" telah ditandai sebagai dikembalikan.`);
    } catch (err) {
        console.error("Gagal mengembalikan:", err);
        showToast('Gagal memperbarui status buku. Coba lagi.', 'error');
    }
};

// ── Delete Book ───────────────────────────────────────────────
window.deleteBook = async function(id, title) {
    if (!confirm(`Hapus "${title}" dari koleksi secara permanen?`)) return;

    try {
        await deleteDoc(doc(db, "books", id));
        books = books.filter(b => b.id !== id);
        renderAdminList();
        showToast(`"${title}" berhasil dihapus.`);
    } catch (err) {
        console.error("Gagal menghapus:", err);
        showToast('Gagal menghapus buku. Coba lagi.', 'error');
    }
};

// ── Init ──────────────────────────────────────────────────────
Promise.all([fetchBooks(), fetchRequests()]);
