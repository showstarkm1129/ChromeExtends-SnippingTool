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
    const fallbackPreview = document.getElementById('fallbackPreview');
    const fallbackPreviewImage = document.getElementById('fallbackPreviewImage');
    const fallbackSaveBtn = document.getElementById('fallbackSaveBtn');
    const fallbackDiscardBtn = document.getElementById('fallbackDiscardBtn');

    const DEFAULT_FOLDER = 'Pictures';

    // キャプチャもスクリプト注入も不可能なURL
    const BLOCKED_PREFIXES = [
        'chrome://', 'edge://', 'chrome-extension://',
        'devtools://', 'view-source:', 'about:'
    ];

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
        fallbackPreview.classList.add('hidden');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                showStatus('アクティブなタブが見つかりません', 'error');
                return;
            }

            // 完全ブロック対象のページ判定
            if (BLOCKED_PREFIXES.some(prefix => tab.url.startsWith(prefix))) {
                showStatus('このページではキャプチャできません（ブラウザの制限ページ）', 'error');
                return;
            }

            // コンテンツスクリプト注入を試行
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content/content.js']
                });
                window.close();
            } catch (injectionError) {
                // スクリプト注入失敗 → ページ全体キャプチャにフォールバック
                console.warn('Script injection failed, falling back to full-tab capture:', injectionError);
                showStatus('範囲指定が使えないページです。ページ全体をキャプチャします...', 'info');
                await captureFullTab();
            }

        } catch (error) {
            console.error('Failed to start capture:', error);
            showStatus('キャプチャの開始に失敗しました', 'error');
        }
    });

    // --- フォールバック: ページ全体キャプチャ ---
    async function captureFullTab() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'captureTab' });

            if (!response || !response.success) {
                showStatus('キャプチャに失敗しました: ' + (response?.error || '不明なエラー'), 'error');
                return;
            }

            // プレビュー表示
            fallbackPreviewImage.src = response.dataUrl;
            fallbackPreview.classList.remove('hidden');
            hideStatus();

            // 一時的にキャプチャデータを保持
            fallbackPreview.dataset.imageData = response.dataUrl;
        } catch (error) {
            console.error('Full-tab capture failed:', error);
            showStatus('キャプチャに失敗しました', 'error');
        }
    }

    // --- フォールバック: 保存ボタン ---
    fallbackSaveBtn.addEventListener('click', async () => {
        const imageData = fallbackPreview.dataset.imageData;
        if (!imageData) return;

        fallbackSaveBtn.disabled = true;
        fallbackSaveBtn.textContent = '⌛ 保存中...';

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
        const filename = `screenshot_${timestamp}.png`;

        chrome.runtime.sendMessage({
            action: 'downloadImage',
            imageData: imageData,
            filename: filename
        }, (response) => {
            if (response && response.success) {
                fallbackSaveBtn.textContent = '✅ 完了';
                showStatus('保存しました', 'success');
                setTimeout(() => {
                    fallbackPreview.classList.add('hidden');
                    fallbackSaveBtn.disabled = false;
                    fallbackSaveBtn.textContent = '💾 保存する';
                    delete fallbackPreview.dataset.imageData;
                }, 1000);
            } else {
                fallbackSaveBtn.disabled = false;
                fallbackSaveBtn.textContent = '💾 保存する';
                showStatus('保存に失敗しました: ' + (response?.error || '不明なエラー'), 'error');
            }
        });
    });

    // --- フォールバック: 破棄ボタン ---
    fallbackDiscardBtn.addEventListener('click', () => {
        fallbackPreview.classList.add('hidden');
        fallbackPreviewImage.src = '';
        delete fallbackPreview.dataset.imageData;
        hideStatus();
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
