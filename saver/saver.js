/**
 * Snipping Tool — Offscreen Saver
 * IndexedDB から FileSystemDirectoryHandle を読み、ファイルを直接書き込む
 */

// --- IndexedDB ヘルパー ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SnippingToolDB', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getDirectoryHandle() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('settings', 'readonly');
            const request = tx.objectStore('settings').get('directoryHandle');
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        return null;
    }
}

// --- data URL → Blob 変換 ---
function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const binaryString = atob(parts[1]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
}

// --- メッセージハンドラ ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'writeFile') {
        writeFile(message.imageData, message.filename)
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // 非同期レスポンス
    }
});

// --- ファイル書き込み ---
async function writeFile(imageDataUrl, filename) {
    const handle = await getDirectoryHandle();
    if (!handle) {
        throw new Error('保存先フォルダが設定されていません');
    }

    // パーミッション確認（offscreen document 内ではgrantedになるはず）
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
        // ユーザーのアクティベーションなしでリクエストを試みる
        permission = await handle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
            throw new Error('フォルダへのアクセス権限がありません');
        }
    }

    // Blob 変換 → ファイル書き込み
    const blob = dataUrlToBlob(imageDataUrl);
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return { success: true, method: 'filesystem' };
}
