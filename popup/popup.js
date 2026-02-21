/**
 * Snipping Tool — Popup Script
 * キャプチャ開始、プレビュー表示、保存/破棄のUIロジック
 */

document.addEventListener('DOMContentLoaded', () => {
    const saveFolderInput = document.getElementById('saveFolderInput');
    const resetFolderBtn = document.getElementById('resetFolderBtn');
    const captureBtn = document.getElementById('captureBtn');
    const statusMessage = document.getElementById('statusMessage');

    const DEFAULT_FOLDER = 'Pictures';

    // --- 初期化 ---
    init();

    async function init() {
        // 保存先フォルダを復元
        const data = await chrome.storage.local.get('saveFolder');
        saveFolderInput.value = data.saveFolder || DEFAULT_FOLDER;
    }

    // --- 保存先の変更を保存 ---
    saveFolderInput.addEventListener('change', () => {
        const folder = saveFolderInput.value.trim() || DEFAULT_FOLDER;
        saveFolderInput.value = folder;
        chrome.storage.local.set({ saveFolder: folder });
    });

    // フォーカス外れ時も保存
    saveFolderInput.addEventListener('blur', () => {
        const folder = saveFolderInput.value.trim() || DEFAULT_FOLDER;
        saveFolderInput.value = folder;
        chrome.storage.local.set({ saveFolder: folder });
    });

    // --- デフォルトに戻すボタン ---
    resetFolderBtn.addEventListener('click', () => {
        saveFolderInput.value = DEFAULT_FOLDER;
        chrome.storage.local.set({ saveFolder: DEFAULT_FOLDER });
        showStatus('保存先をデフォルトに戻しました', 'info');
    });

    // --- キャプチャ開始 ---
    captureBtn.addEventListener('click', async () => {
        hideStatus();

        try {
            // アクティブタブを取得
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                showStatus('アクティブなタブが見つかりません', 'error');
                return;
            }

            // chrome:// や edge:// などのシステムページはキャプチャ不可
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
                showStatus('このページではキャプチャできません', 'error');
                return;
            }

            // content.js を注入して範囲選択開始
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content/content.js']
            });

            // ポップアップを閉じる（範囲選択はウェブページ上で行うため）
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

    // --- ステータス非表示 ---
    function hideStatus() {
        statusMessage.classList.add('hidden');
    }
});
