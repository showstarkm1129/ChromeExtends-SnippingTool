// Snipping Tool — Background Service Worker
// タブキャプチャを担当し、保存はオフスクリーンドキュメント経由で実行

// --- メッセージハンドラ ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // offscreen document からのメッセージは無視
    if (message.action === 'writeFile') return false;

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

// --- オフスクリーンドキュメントの作成 ---
async function ensureOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (existingContexts.length > 0) return;

    await chrome.offscreen.createDocument({
        url: 'saver/saver.html',
        reasons: ['BLOBS'],
        justification: 'ユーザーが選択したフォルダにスクリーンショットを書き込むため'
    });
}

// --- 画像をダウンロード ---
async function downloadImage(message) {
    const { imageData, filename } = message;

    try {
        // ユーザーがフォルダを選択済みか確認
        const settings = await chrome.storage.local.get(['useDirectoryHandle']);

        if (settings.useDirectoryHandle) {
            // Offscreen document を使用してファイルシステムに直接書き込み
            await ensureOffscreenDocument();

            const result = await chrome.runtime.sendMessage({
                action: 'writeFile',
                imageData: imageData,
                filename: filename
            });

            if (result && result.success) {
                return result;
            }

            // ファイルシステム書き込みが失敗した場合、エラーを返す（フォールバックしない）
            console.error('Offscreen write failed:', result?.error);
        }

        // フォルダ未選択時のフォールバック: chrome.downloads （ダウンロードフォルダ/Pictures）
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
