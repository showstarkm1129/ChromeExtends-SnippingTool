/**
 * Snipping Tool — Content Script（オンデマンド注入）
 * ウェブページ上で範囲選択オーバーレイとキャプチャ処理を提供
 */

(() => {
    // 既存のオーバーレイを削除（連打対策）
    function removeExistingOverlay() {
        const ids = ['snip-capture-overlay', 'snip-selection-box', 'snip-instruction-label'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }

    // 二重注入防止
    if (window.__snippingToolInjected) {
        // 再注入の場合は前のものをクリーンアップして再開
        removeExistingOverlay();
    }
    window.__snippingToolInjected = true;

    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let overlay = null;
    let selectionBox = null;
    let instructionLabel = null;

    // --- 範囲選択の開始 ---
    function beginSelection() {
        removeExistingOverlay();

        // オーバーレイ（背景暗転）
        overlay = document.createElement('div');
        overlay.id = 'snip-capture-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.35);
            cursor: crosshair;
            z-index: 2147483647;
            user-select: none;
        `;

        // 選択ボックス
        selectionBox = document.createElement('div');
        selectionBox.id = 'snip-selection-box';
        selectionBox.style.cssText = `
            position: fixed;
            border: 2px dashed #00e676;
            background: rgba(0, 230, 118, 0.08);
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
            display: none;
            z-index: 2147483647;
            pointer-events: none;
            border-radius: 2px;
        `;

        // 操作説明ラベル
        instructionLabel = document.createElement('div');
        instructionLabel.id = 'snip-instruction-label';
        instructionLabel.textContent = '✂️ 範囲をドラッグで選択 ｜ Escでキャンセル';
        instructionLabel.style.cssText = `
            position: fixed;
            top: 16px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #1b5e20, #00c853);
            color: white;
            padding: 10px 24px;
            border-radius: 10px;
            font-size: 14px;
            font-family: 'Segoe UI', 'Meiryo', sans-serif;
            font-weight: 600;
            z-index: 2147483647;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
            pointer-events: none;
            white-space: nowrap;
            letter-spacing: 0.5px;
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(selectionBox);
        document.body.appendChild(instructionLabel);

        overlay.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onKeyDown);
        isSelecting = true;
    }

    // --- マウス操作 ---
    function onMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();

        startX = e.clientX;
        startY = e.clientY;

        selectionBox.style.display = 'block';
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
        e.preventDefault();
        const currentX = e.clientX;
        const currentY = e.clientY;
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    }

    function onMouseUp(e) {
        e.preventDefault();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const currentX = e.clientX;
        const currentY = e.clientY;

        const rect = {
            left: Math.min(startX, currentX),
            top: Math.min(startY, currentY),
            width: Math.abs(currentX - startX),
            height: Math.abs(currentY - startY)
        };

        // 小さすぎる選択は無視
        if (rect.width < 10 || rect.height < 10) {
            cleanup();
            return;
        }

        captureRegion(rect);
    }

    // --- キャプチャ + トリミング処理 ---
    async function captureRegion(rect) {
        // オーバーレイを非表示
        overlay.style.display = 'none';
        selectionBox.style.display = 'none';
        instructionLabel.style.display = 'none';

        // オーバーレイが消えるのを待つ
        await new Promise(resolve => setTimeout(resolve, 150));

        try {
            // Background Worker にフルスクリーンキャプチャを依頼
            // (background側でsender.tabからwindowIdを取得)
            const response = await chrome.runtime.sendMessage({
                action: 'captureTab'
            });

            if (!response.success) {
                console.error('Capture failed:', response.error);
                cleanup();
                return;
            }

            // Canvas でトリミング
            const dpr = window.devicePixelRatio || 1;
            const croppedDataUrl = await cropWithCanvas(response.dataUrl, rect, dpr);

            // トリミング済み画像を Background に送信
            await chrome.runtime.sendMessage({
                action: 'screenshotCaptured',
                imageData: croppedDataUrl
            });

        } catch (error) {
            console.error('Capture error:', error);
        }

        cleanup();
    }

    // --- Canvas でトリミング ---
    function cropWithCanvas(dataUrl, rect, dpr) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // DPR 考慮した座標
                    const sx = Math.round(rect.left * dpr);
                    const sy = Math.round(rect.top * dpr);
                    const sw = Math.round(rect.width * dpr);
                    const sh = Math.round(rect.height * dpr);

                    canvas.width = sw;
                    canvas.height = sh;

                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

                    resolve(canvas.toDataURL('image/png'));
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
            img.src = dataUrl;
        });
    }

    // --- キーボード操作 ---
    function onKeyDown(e) {
        if (e.key === 'Escape') {
            cleanup();
        }
    }

    // --- クリーンアップ ---
    function cleanup() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('keydown', onKeyDown);

        if (overlay) { overlay.remove(); overlay = null; }
        if (selectionBox) { selectionBox.remove(); selectionBox = null; }
        if (instructionLabel) { instructionLabel.remove(); instructionLabel = null; }

        isSelecting = false;
    }

    // --- 起動 ---
    beginSelection();
})();
