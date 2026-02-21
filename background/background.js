// Snipping Tool — Background Service Worker
// タブキャプチャとダウンロード処理を担当

// --- IndexedDB ヘルパー（FileSystemDirectoryHandle の取得） ---
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

// --- data URL → Blob 変換（Service Worker互換） ---
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
    handleMessage(message, sender)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
});

async function handleMessage(message, sender) {
    switch (message.action) {
        case 'captureTab':
            return await captureTab(message, sender);

        case 'downloadImage':
            return await downloadImage(message);

        default:
            return { success: false, error: `Unknown action: ${message.action}` };
    }
}

// --- タブキャプチャ ---
async function captureTab(message, sender) {
    try {
        let windowId;
        if (sender && sender.tab) {
            windowId = sender.tab.windowId;
        } else {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            windowId = tab.windowId;
        }
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
        return { success: true, dataUrl: dataUrl };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- 画像をダウンロード ---
async function downloadImage(message) {
    const { imageData, filename } = message;

    try {
        // ユーザーが選択したディレクトリハンドルの取得を試みる
        const settings = await chrome.storage.local.get(['useDirectoryHandle']);

        if (settings.useDirectoryHandle) {
            const dirHandle = await getDirectoryHandle();
            if (dirHandle) {
                // パーミッション確認
                const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    // File System Access API で直接書き込み
                    const blob = dataUrlToBlob(imageData);
                    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    return { success: true, method: 'filesystem' };
                }
            }
        }

        // フォールバック: chrome.downloads を使用（ダウンロードフォルダ/Pictures に保存）
        const folderData = await chrome.storage.local.get(['saveFolderDisplay']);
        const folder = folderData.saveFolderDisplay || 'Pictures';
        const savePath = `${folder}/${filename}`;

        const downloadId = await chrome.downloads.download({
            url: imageData,
            filename: savePath,
            saveAs: false,
            conflictAction: 'uniquify'
        });

        return { success: true, downloadId: downloadId, method: 'downloads' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
