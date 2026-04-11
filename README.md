# ランキングなし文化祭スタンプラリー — 導入・運用ガイド

---

## ファイル構成

```
stamp-rally/
├── index.html   ← メインHTML（触らなくてOK）
├── style.css    ← デザイン（色などを変えたいときだけ）
├── app.js       ← アプリの動作（触らなくてOK）
├── sw.js        ← オフライン対応（触らなくてOK）
├── manifest.json← PWA設定（アプリ名などを変えるときだけ）
└── README.md    ← このファイル
```

---

## 1. GitHub Pages へのデプロイ（公開）手順

### 手順
1. **GitHubにアカウントを作成**（まだの場合）  
   https://github.com からサインアップ

2. **新しいリポジトリを作成**  
   - 右上の「+」→「New repository」  
   - Repository name: `stamp-rally`（なんでもOK）  
   - Public を選択  
   - 「Create repository」をクリック

3. **ファイルをアップロード**  
   - 作成したリポジトリのページで「Add file」→「Upload files」  
   - `index.html` `style.css` `app.js` `sw.js` `manifest.json` を全部ドラッグ&ドロップ  
   - 「Commit changes」をクリック

4. **GitHub Pages を有効化**  
   - リポジトリの「Settings」タブ  
   - 左メニューの「Pages」  
   - Source: 「Deploy from a branch」  
   - Branch: `main` / `/ (root)` を選択  
   - 「Save」をクリック

5. **URLを確認**  
   - 数分後に `https://ユーザー名.github.io/stamp-rally/` でアクセスできるようになります  
   - このURLを来場者に共有します（QRコードにしてポスターに貼ると便利）

---

## 2. 管理者パネルの使い方

1. タイトル画面右上の **⚙ ボタン** をタップ  
2. パスワードを入力（初期値: `admin`）  
3. 3つのタブで設定できます

| タブ | できること |
|------|-----------|
| **スタンプ** | スタンプの追加・編集・削除・並び替え、.mindファイルの登録 |
| **表示文字** | すべての文言（タイトル・ボタン・クーポンなど）の変更 |
| **システム** | 年度更新、Google Sheets連携、データの保存・読込 |

### 管理者パスワードの変更
「表示文字」タブには現在パスワード変更機能はありません。  
`app.js` の最初の方にある `adminPassword:'admin'` を変更してください。

---

## 3. スタンプの追加・編集

1. 管理者パネル →「スタンプ」タブ  
2. 「＋ スタンプを追加」をタップ  
3. 以下を入力します

| 項目 | 説明 |
|------|------|
| スタンプ名 | マップに表示される名前（例: 科学部の秘密実験） |
| 場所 | 場所の説明（例: 3階 理科室） |
| メッセージ | スタンプ取得時に表示されるメッセージ |
| 絵文字 | スタンプのアイコン（例: 🔬） |
| 合言葉 | 4〜6桁の数字（ARが使えない端末向けの代替手段） |
| バーコードID | 印刷するバーコードの番号（0〜63の整数） |
| .mindファイル | 画像マーカーを使う場合のファイル（通常は空白でOK） |

### 並び替え
スタンプ一覧の左端の **☰** マークをドラッグすると順番を変えられます。  
スマホの場合は長押し→ドラッグです。

---

## 4. バーコードマーカーの作成と印刷

バーコード方式（Barcode 3x3 Hamming 6.3）を使います。  
画像認識より**暗い場所でも動きやすく**、マーカーの自作が簡単です。

### マーカーの作成
以下のURLでマーカー画像を生成できます:  
👉 https://nicktomkins.github.io/ar-barcodes/

- Type: **3x3 Hamming 6.3** を選択  
- ID番号（0〜63）を入力して生成  
- ダウンロードして印刷

### 印刷のコツ
- **A4サイズ**以上に印刷すると認識しやすい（小さいと検出しにくい）  
- ラミネート加工すると耐久性が上がります  
- 廊下の壁など、**カメラと正面から向き合える場所**に貼る

---

## 5. Google Sheets連携（設定の外部管理）

スタンプ情報や文言をスプレッドシートで管理すると、  
**コードを触らずに非エンジニアでも設定変更**できます。

### 仕組み
```
スプレッドシート → GAS（Google Apps Script）→ アプリが起動時に1回取得 → IndexedDBにキャッシュ
```
アクセスは起動時に1回だけなので、5,000人が同時アクセスしても問題ありません。

### 手順

#### ① スプレッドシートを作成する

Googleスプレッドシートを新規作成し、以下のシートを作ります。

**シート名「設定」**（A列がキー、B列が値）

| A列（キー） | B列（値） |
|-------------|-----------|
| versionId | 2026_Ver1 |
| eventYear | 2026 |
| eventTitle | 文化祭スタンプラリー |
| eventSubtitle | 全スタンプを集めて特典をゲットしよう！ |
| couponTitle | 🎁 特典クーポン |
| couponBody | 文化祭グッズ引換券！本部で見せてください |
| couponCode | FES-2026-COMP |

**シート名「スタンプ」**（1行目がヘッダー）

| id | name | location | message | emoji | code | barcodeId |
|----|------|----------|---------|-------|------|-----------|
| s01 | 科学部の秘密実験 | 3階 理科室 | サイエンスの世界へ！ | 🔬 | 1234 | 0 |
| s02 | 美術部ギャラリー | 2階 美術室 | 芸術に触れよう！ | 🎨 | 2345 | 1 |

**シート名「遊び方」**（1行目はヘッダー `title` `desc`）

| title | desc |
|-------|------|
| アプリを開く | ホーム画面に追加しておくと便利です。 |
| スタンプ場所へ行く | マップから場所を確認しましょう！ |

#### ② GASスクリプトを作成する

スプレッドシートのメニューから **「拡張機能」→「Apps Script」** を開き、  
以下のコードをすべて貼り付けて保存します。

```javascript
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 設定シート
  var configSheet = ss.getSheetByName('設定');
  var configData = configSheet.getDataRange().getValues();
  var config = {};
  configData.forEach(function(row) {
    if (row[0]) config[row[0]] = row[1];
  });

  // スタンプシート
  var stampSheet = ss.getSheetByName('スタンプ');
  var stampData = stampSheet.getDataRange().getValues();
  var headers = stampData[0];
  var stamps = stampData.slice(1)
    .filter(function(row) { return row[0]; }) // 空行を除外
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      // barcodeId は数値に変換
      if (obj.barcodeId !== undefined) obj.barcodeId = Number(obj.barcodeId);
      obj.modelUrl = obj.modelUrl || '';
      obj.mindFile = obj.mindFile || '';
      return obj;
    });

  // 遊び方シート
  var howtoSheet = ss.getSheetByName('遊び方');
  var howtoData = howtoSheet.getDataRange().getValues();
  var howtoSteps = howtoData.slice(1)
    .filter(function(row) { return row[0]; })
    .map(function(row) {
      return { title: row[0], desc: row[1] };
    });

  // JSON形式で返す
  var result = {
    versionId:     config['versionId']     || '2026_Ver1',
    eventYear:     config['eventYear']     || '2026',
    eventTitle:    config['eventTitle']    || '文化祭スタンプラリー',
    eventSubtitle: config['eventSubtitle'] || '全スタンプを集めよう！',
    coupon: {
      title: config['couponTitle'] || '🎁 特典クーポン',
      body:  config['couponBody']  || '特典内容',
      code:  config['couponCode']  || 'FES-2026',
    },
    stamps:     stamps,
    howtoSteps: howtoSteps,
  };

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
```

#### ③ GASをウェブアプリとして公開する

1. Apps Script の画面で右上の **「デプロイ」→「新しいデプロイ」**  
2. 種類: **「ウェブアプリ」**  
3. 次のユーザーとして実行: **「自分」**  
4. アクセスできるユーザー: **「全員」**  
5. 「デプロイ」をクリック  
6. 表示される **「ウェブアプリのURL」**（`https://script.google.com/macros/s/xxx/exec` 形式）をコピー

#### ④ アプリに登録する

1. アプリの管理者パネル →「システム」タブ  
2. 「GAS公開URL」欄に貼り付け  
3. 「🔄 スプレッドシートから読み込む」をタップ  
4. 「✓ 取得成功」と表示されたら完了

以降、アプリを開くたびに自動でスプレッドシートの最新情報を取得します。

---

## 6. リーダーボード（ランキング機能）

コンプリートタイムを競うランキングを無料で実装できます。

### GASスクリプト（新しいスプレッドシートに別で作成を推奨）

```javascript
var SHEET_NAME = 'ランキング';

function doGet(e) {
  var version = e.parameter.version || '';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ entries: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  var entries = data
    .slice(1) // 1行目（ヘッダー）を除く
    .filter(function(row) { return row[0] && row[2] === version; }) // バージョン一致のみ
    .sort(function(a, b) { return a[1] - b[1]; }) // タイムで昇順（速い人が上）
    .slice(0, 10) // 上位10件
    .map(function(row) {
      return { name: row[0], time: row[1] };
    });

  return ContentService
    .createTextOutput(JSON.stringify({ entries: entries }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['名前', 'タイム(ms)', 'バージョン', '記録日時']);
  }
  
  sheet.appendRow([
    data.name    || 'ゲスト',
    data.time    || 0,
    data.version || '',
    new Date()
  ]);

  return ContentService
    .createTextOutput('OK')
    .setMimeType(ContentService.MimeType.TEXT);
}
```

このGASを同じ手順でデプロイし、管理者パネル →「システム」タブの  
「GASランキングURL」欄にURLを登録してください。

---

## 7. 年度更新の手順

来年の文化祭に向けて設定をリセットする手順です。

1. 管理者パネル →「システム」タブ  
2. バージョンIDを変更（例: `2026_Ver1` → `2027_Ver1`）  
3. 「更新」ボタンをタップ  
4. 確認ダイアログで「OK」

**→ 参加者全員が次回アプリを開いたとき、自動でスタンプ進捗がリセットされます。**

スプレッドシートを使っている場合は、「設定」シートの `versionId` も同じ値に変更してください。

---

## 8. デザインのカスタマイズ

`style.css` の冒頭の `:root` 部分を変更するだけでカラーテーマを変えられます。

```css
:root {
  --accent: #c840ff;  /* メインカラー（紫） */
  --cyan:   #00f0ff;  /* アクセント色（水色） */
  --gold:   #ffce00;  /* 強調色（金） */
  --green:  #00e87a;  /* 獲得済み色（緑） */
  --bg:     #0d0121;  /* 背景色（暗い紫） */
  --surf:   #1a0533;  /* パネル背景色 */
}
```

---

## 9. トラブルシューティング

| 症状 | 原因と対処 |
|------|-----------|
| カメラが起動しない | iOSはSafariのみ対応。設定→Safari→カメラのアクセスを「許可」に。Chromeは使用不可 |
| マーカーを読み取れない | 印刷サイズが小さい可能性。A4以上を推奨。照明が暗すぎる場合も検出が難しい |
| ARスキャン画面が真っ暗 | HTTPSでアクセスしているか確認。GitHub PagesはHTTPS自動対応 |
| スタンプが消えた | バージョンIDが変わった可能性。管理者パネルで確認 |
| GAS読み込みに失敗する | スプレッドシートのアクセス権を「全員」に設定しているか確認 |
| iOS でホーム画面追加後に動かない | iOS 16.4以上が必要。古いiOSはブラウザから直接アクセスを推奨 |

---

## 10. 合言葉機能（ARが使えない端末向け）

古いスマホやiOS以外のブラウザではARカメラが動かない場合があります。  
その場合は各スタンプ地点に **合言葉（数字4〜6桁）** を掲示しておき、  
ARスキャン画面右上の **⌨️ ボタン** から入力できます。

合言葉はスタンプ編集画面で設定できます。  
**来場者が見えない場所（係員が見せる、紙に書いて折りたたむなど）** に掲示することを推奨します。
