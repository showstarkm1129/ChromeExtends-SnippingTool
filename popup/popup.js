/**
 * Snipping Tool — Popup Script
 * キャプチャ開始、プレビュー表示、保存/破棄のUIロジック
 */

document.addEventListener('DOMContentLoaded', () => {
    const saveFolderInput = document.getElementById('saveFolderInput');
    const resetFolderBtn = document.getElementById('resetFolderBtn');
    const captureBtn = document.getElementById('captureBtn');
    const previewSection = document.getElementById('previewSection');
    const previewImage = document.getElementById('previewImage');
    const saveBtn = document.getElementById('saveBtn');
    const discardBtn = document.getElementById('discardBtn');
    const statusMessage = document.getElementById('statusMessage');

    const DEFAULT_FOLDER = 'Pictures';

    // --- 初期化 ---
    init();

    async function init() {
        // 保存先フォルダを復元
        const data = await chrome.storage.local.get('saveFolder');
        saveFolderInput.value = data.saveFolder || DEFAULT_FOLDER;

        // 既にキャプチャ済みの画像があればプレビュー表示
        const response = await chrome.runtime.sendMessage({ action: 'getPendingScreenshot' });
        if (response.success && response.imageData) {
            showPreview(response.imageData);
        }
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
        hidePreview();

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

            // 既存の画像をクリア
            await chrome.runtime.sendMessage({ action: 'clearScreenshot' });

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

    // --- 保存ボタン ---
    saveBtn.addEventListener('click', async () => {
        const imageData = previewImage.src;
        if (!imageData || imageData === '') return;

        const folder = saveFolderInput.value.trim() || DEFAULT_FOLDER;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
        const filename = `screenshot_${timestamp}.png`;

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'downloadImage',
                imageData: imageData,
                folder: folder,
                filename: filename
            });

            if (response.success) {
                showStatus('✅ 画像を保存しました', 'success');
            } else {
                showStatus(`保存に失敗: ${response.error}`, 'error');
            }
        } catch (error) {
            showStatus(`保存に失敗: ${error.message}`, 'error');
        }

        // 画像をクリアして次のキャプチャを待機
        await chrome.runtime.sendMessage({ action: 'clearScreenshot' });
        setTimeout(() => {
            hidePreview();
            hideStatus();
        }, 1500);
    });

    // --- 破棄ボタン ---
    discardBtn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'clearScreenshot' });
        hidePreview();
        showStatus('🗑️ 画像を破棄しました', 'info');
        setTimeout(hideStatus, 1500);
    });

    // --- プレビュー表示 ---
    function showPreview(imageData) {
        previewImage.src = imageData;
        previewSection.classList.remove('hidden');
    }

    // --- プレビュー非表示 ---
    function hidePreview() {
        previewImage.src = '';
        previewSection.classList.add('hidden');
    }

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
