# データの出典と利用条件

このディレクトリのJSONは、都知事杯オープンデータ・ハッカソン向けの江東区パイロット表示用に、公式データの代表レコードを抽出・整形したものです。確認日は2026年8月15日です。

## オープンデータ

### 江東区「スポーツ施設一覧」

- 提供者: 江東区
- ライセンス: クリエイティブ・コモンズ 表示 4.0 国際（CC BY 4.0）
- カタログ: https://catalog.data.metro.tokyo.lg.jp/dataset/t131083d3100000004
- 利用したCSV: https://www.opendata.metro.tokyo.lg.jp/koto/131083_102_kotoku_sportsfacilities.csv
- 更新頻度: 随時
- 抽出・整形した項目: 施設名、住所、緯度・経度、利用時間の概要、説明、実施可能な競技、設備、施設URL

### 江東区「クーリングシェルター（指定暑熱避難施設）一覧」

- 提供者: 江東区
- ライセンス: CC BY 4.0
- カタログ: https://catalog.data.metro.tokyo.lg.jp/dataset/t131083d3100000016
- 利用したCSV: https://www.opendata.metro.tokyo.lg.jp/koto/131083_202_cooling_shelter.csv
- 抽出・整形した項目: 施設名、住所、緯度・経度、開放時間、受入れ可能人数、対象場所、指定・登録状況、施設URL

### 江東区「公衆トイレ一覧」

- 提供者: 江東区
- ライセンス: CC BY 4.0
- カタログ: https://catalog.data.metro.tokyo.lg.jp/dataset/t131083d0000000019
- 利用したCSV: https://www.opendata.metro.tokyo.lg.jp/koto/131083_013_public_toilet.csv
- APIカタログ上のデータ最終更新: 2025年7月17日
- 抽出・整形した項目: 名称、住所、設置位置、緯度・経度、利用時間、車椅子使用者用・乳幼児用・オストメイト対応設備

### 江東区「AED設置箇所一覧」

- 提供者: 江東区
- ライセンス: CC BY 4.0
- カタログ: https://catalog.data.metro.tokyo.lg.jp/dataset/t131083d0000000027
- 利用したCSV: https://www.opendata.metro.tokyo.lg.jp/koto/131083_008_aed.csv
- APIカタログ上のデータ最終更新: 2025年8月19日
- 抽出・整形した項目: 施設名、住所、緯度・経度、設置位置、利用可能曜日・時間、利用条件

### 東京都水道局「Tokyowater Drinking Station」

- 提供者: 東京都水道局
- ライセンス: CC BY 4.0
- カタログ: https://catalog.data.metro.tokyo.lg.jp/dataset/t000019d0000000003
- 利用したCSV（2025年9月17日版）: https://www.opendata.metro.tokyo.lg.jp/suidou/R7/tokyowaterdrinkingstation_250917.csv
- 公式案内: https://www.waterworks.metro.tokyo.lg.jp/kurashi/drinking_station/
- 抽出・整形した項目: 施設名、住所、緯度・経度、設置階、給水器タイプ、料金欄

## 料金に使った公式ページ

スポーツ施設CSVには料金列がないため、個人利用料金は各施設の公式運営ページで別途確認しました。

- 江東区健康スポーツ公社「スポーツセンターの個人利用」: https://www.koto-hsc.or.jp/single/
- 江東区スポーツ会館: https://www.koto-hsc.or.jp/centerlist/sports_center1/
- 深川スポーツセンター: https://www.koto-hsc.or.jp/centerlist/sports_center2/
- 夢の島競技場: https://www.di-ksp.jp/facility/yumenoshima_k
- 夢の島スケートボードパーク: https://www.di-ksp.jp/facility/yumenoshima_s
- 夢の島野球場: https://www.di-ksp.jp/facility/yumenoshima_u

`costYen` は原則として一般料金です。高校生等、中学生以下、江東区内在住シニア、障害者、団体利用では料金が異なる場合があります。夢の島野球場は団体の施設料金しか確定できないため、1人当たりの `costYen` を `null` とし、総額を別項目に記録しています。

## アプリ側で加えたデモ値

`activities.json` の次の項目は、公的データそのものではなく、提案ロジックを試すためにこのアプリ側で設定した値です。各レコードの `demoFields` にも同じ情報を記録しています。

- `name` のうち「〜で泳ぐ」などの活動タイトル
- `durationMinutes`
- `minGroupSize` / `maxGroupSize`
- `moods`
- `setting`

施設、座標、実施可能競技、設備、料金そのものと混同しないでください。

## データの限界

- 空き状況、混雑、臨時休館、当日の個人利用枠はリアルタイムデータではありません。利用前に各公式サイトを確認してください。
- クーリングシェルターは指定期間、施設の開館日、貸切利用等によって使えない場合があります。受入れ可能人数も保証値ではありません。
- Drinking Stationの原典で料金欄が空欄の地点は、無料と断定せず `unknown` にしています。施設への入館条件や開館時間も別途確認が必要です。
- 公衆トイレは清掃・工事・故障等による一時利用不可を反映しません。
- AEDは施設内の設置場所です。施設閉館時などは利用できない場合があります。緊急時は119番通報と現地の案内を優先してください。
- 同じ施設でもデータセットごとに緯度・経度がわずかに異なる場合があります。各JSONレコードは、そのカテゴリの原典にある座標を保持しています。
- カタログの最終更新日時と、実ファイルの内容更新日は一致しないことがあります。

## 表示例

アプリ内では、少なくとも「データ提供: 江東区／東京都水道局」「CC BY 4.0」「各データセットURL」「確認日: 2026-08-15」を確認できる形で表示してください。データを編集・統合した旨も併記してください。
