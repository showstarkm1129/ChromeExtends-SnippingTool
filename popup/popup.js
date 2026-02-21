/**
 * Snipping Tool — Popup Script
 * 保存先設定、キャプチャ開始のUIロジック
 */

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
        const data = await chrome.storage.local.get('saveFolder');
        saveFolderInput.value = data.saveFolder || DEFAULT_FOLDER;
    }

    // --- フォルダ参照ボタン（エクスプローラーで選択） ---
    browseFolderBtn.addEventListener('click', async () => {
        try {
            // showDirectoryPicker でフォルダ選択ダイアログを表示
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            // 選択されたフォルダ名をサブフォルダ名として使用
            const folderName = dirHandle.name;
            saveFolderInput.value = folderName;
            chrome.storage.local.set({ saveFolder: folderName });
            showStatus(`📁 保存先を「${folderName}」に設定しました`, 'success');
        } catch (err) {
            // ユーザーがキャンセルした場合
            if (err.name !== 'AbortError') {
                showStatus('フォルダの選択に失敗しました', 'error');
            }
        }
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
