# Snipping Tool Chrome Extension

ウェブページ上の任意の範囲をドラッグ選択し、PNG 画像として保存する Chrome 拡張機能です。

## 機能

- ✂️ ウェブページ上でドラッグ選択して範囲をキャプチャ
- 💾 保存 / 🗑️ 破棄 を選択してワークフローを管理
- 📁 保存先フォルダを自由に設定（デフォルト: `Pictures`）
- 設定は `chrome.storage.local` に自動保存

## インストール方法

1. このリポジトリをクローン または ZIPダウンロード
2. Chrome で `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」をオン
4. 「パッケージ化されていない拡張機能を読み込む」→ このフォルダを選択

## 使い方

1. 対象のウェブページを開く
2. 拡張機能アイコンをクリック → ポップアップが表示
3. 保存先フォルダを確認・変更（デフォルト: `Pictures`）
4. **「📷 キャプチャ開始」** をクリック → ページ上でオーバーレイ表示
5. ドラッグで範囲を選択
6. ポップアップが自動再表示 → **「💾 保存する」** または **「🗑️ 破棄する」** を選択
7. 繰り返し使用可能

## 保存先について

`chrome.downloads.download()` を使用するため、実際の保存先は：
```
<ブラウザのデフォルトダウンロードフォルダ>/<指定したフォルダ名>/screenshot_YYYY-MM-DD_HH-MM-SS.png
```

例：`C:\Users\name\Downloads\Pictures\screenshot_2026-02-21_12-00-00.png`

> **Note:** ブラウザ設定で「ダウンロード前に保存場所を確認する」がONの場合は毎回ダイアログが表示されます。

## プロジェクト構成

```
SnippingTool/
├── manifest.json          # Manifest V3
├── background/
│   └── background.js      # タブキャプチャ・ダウンロード処理
├── content/
│   └── content.js         # 範囲選択オーバーレイ（オンデマンド注入）
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Contribute
LLM > 99%
showstarkm1129 < 1%
