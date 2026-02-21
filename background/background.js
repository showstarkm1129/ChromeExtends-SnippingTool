// タブキャプチャとダウンロード処理を担当

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

// --- 画像をダウンロード ---
async function downloadImage(message) {
    const { imageData, filename } = message;

    try {
        // data:image/png;base64,... → Blob URL
        const response = await fetch(imageData);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const downloadId = await chrome.downloads.download({
            url: blobUrl,
            filename: filename,
            saveAs: true, // ここを true にすることで、エクスプローラーの保存ダイアログが出る
            conflictAction: 'uniquify'
        });

        return { success: true, downloadId: downloadId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
