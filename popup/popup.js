/**
 * Snipping Tool — Popup Script
 * 保存先設定、キャプチャ開始のUIロジック
 */

// --- IndexedDB ヘルパー（FileSystemDirectoryHandle の永続化） ---
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

async function saveDirectoryHandle(handle) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(handle, 'directoryHandle');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// --- メインロジック ---
document.addEventListener('DOMContentLoaded', () => {
    const saveFolderInput = document.getElementById('saveFolderInput');
    const browseFolderBtn = document.getElementById('browseFolderBtn');
    const resetFolderBtn = document.getElementById('resetFolderBtn');
    const captureBtn = document.getElementById('captureBtn');
    const statusMessage = document.getElementById('statusMessage');

    const DEFAULT_FOLDER = 'Pictures';

    // --- 初期化 ---
    init();

    async function init() {
        const data = await chrome.storage.local.get(['saveFolderDisplay']);
        saveFolderInput.value = data.saveFolderDisplay || DEFAULT_FOLDER;
    }

    // --- フォルダ参照ボタン（エクスプローラーで選択） ---
    browseFolderBtn.addEventListener('click', async () => {
        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

            // IndexedDB にハンドルを保存（バックグラウンドと共有）
            await saveDirectoryHandle(dirHandle);

            // 表示名をストレージに保存
            const displayName = dirHandle.name;
            await chrome.storage.local.set({
                saveFolderDisplay: displayName,
                useDirectoryHandle: true
            });

            saveFolderInput.value = displayName;
            showStatus(`📁 保存先を「${displayName}」に設定しました`, 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                showStatus('フォルダの選択に失敗しました', 'error');
            }
        }
    });

    // --- デフォルトに戻すボタン ---
    resetFolderBtn.addEventListener('click', async () => {
        saveFolderInput.value = DEFAULT_FOLDER;
        await chrome.storage.local.set({
            saveFolderDisplay: DEFAULT_FOLDER,
            useDirectoryHandle: false
        });
        showStatus('保存先をデフォルト（ダウンロード/Pictures）に戻しました', 'info');
    });

    // --- キャプチャ開始 ---
    captureBtn.addEventListener('click', async () => {
        hideStatus();

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                showStatus('アクティブなタブが見つかりません', 'error');
                return;
            }

            if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
                showStatus('このページではキャプチャできません', 'error');
                return;
            }

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content/content.js']
            });

            window.close();

        } catch (error) {
            console.error('Failed to start capture:', error);
            showStatus('キャプチャの開始に失敗しました', 'error');
        }
    });

    // --- ステータス表示 ---
    function showStatus(text, type = 'info') {
        statusMessage.textContent = text;
        statusMessage.className = `status-message ${type}`;
        statusMessage.classList.remove('hidden');
    }

    function hideStatus() {
        statusMessage.classList.add('hidden');
    }
});
