/**
 * Snipping Tool — Background Service Worker
 * タブキャプチャ、画像一時保持、ダウンロード処理を担当
 */

let pendingScreenshot = null;

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

        case 'screenshotCaptured':
            return screenshotCaptured(message);

        case 'getPendingScreenshot':
            return getPendingScreenshot();

        case 'downloadImage':
            return await downloadImage(message);

        case 'clearScreenshot':
            return clearScreenshot();

        default:
            return { success: false, error: `Unknown action: ${message.action}` };
    }
}

// --- タブキャプチャ ---
async function captureTab(message, sender) {
    try {
        // content scriptからの場合はsender.tabを使用
        // popupからの場合はアクティブタブのwindowIdを使用
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

// --- キャプチャ済み画像を一時保持 ---
function screenshotCaptured(message) {
    pendingScreenshot = message.imageData;
    return { success: true };
}

// --- ポップアップから画像を取得 ---
function getPendingScreenshot() {
    return { success: true, imageData: pendingScreenshot };
}

// --- 画像をダウンロード ---
async function downloadImage(message) {
    const { imageData, folder, filename } = message;

    try {
        // data:image/png;base64,... → Blob URL
        const response = await fetch(imageData);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const savePath = folder ? `${folder}/${filename}` : filename;

        const downloadId = await chrome.downloads.download({
            url: blobUrl,
            filename: savePath,
            saveAs: false,
            conflictAction: 'uniquify'
        });

        return { success: true, downloadId: downloadId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- 画像をクリア ---
function clearScreenshot() {
    pendingScreenshot = null;
    return { success: true };
}
