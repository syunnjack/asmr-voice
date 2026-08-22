# asmr-voice（asmr-voice.jp）

FANZA同人でASMR・音声作品を出しているサークルを、作品数と評価つきでまとめたサイト。

- 本番URL: https://asmr-voice.jp
- 配信: GitHub Pages（`public/CNAME` に `asmr-voice.jp`）
- **GitHub の Settings → Pages でも Custom domain の設定が要る。**
  CNAME ファイルだけでは足りない

**Xserver には置けない。** アダルトを禁止しているため。

## 軸はサークル。作品ではない

作品そのものを並べるサイトにはしていない。**作品のタイトルに露骨な語を含むものが
多く、そのまま載せられない**ため。サークルごとの実数（作品数・評価・発売期間・
収録時間）を集計し、詳細はFANZAへ案内する形にしている。

## なぜ DUGA ではなく FANZA同人か

**DUGA にはASMR・音声のカテゴリが無い**（86カテゴリを確認済み。「ドラマ」が
いちばん近いが音声作品ではない）。FANZA同人にはジャンルとして存在する。

| ジャンル | genre_id | 作品数 |
|---|---|---|
| ASMR | 160004 | 9,392 |
| バイノーラル | 160006 | 7,600 |
| KU100 | 160103 | 3,688 |
| 耳かき | 155020 | 1,497 |

API は `site=FANZA` `service=doujin` `floor=digital_doujin` `article=genre`。
認証は darekore.jp と同じ `FANZA_API_ID` / `FANZA_AFFILIATE_ID`。

## 露骨な語を除いている

`scripts/fetch-circles.py` の `EXPLICIT` で、次を除外している。

- **ジャンル名**（表示しない）
- **サークル名**（そのサークルごと載せない。名前は伏せられないため）

除外後は 12,963作品・1,547サークル。除外前は 14,662作品・1,603サークル。
**実際にFANZAで扱われている数より少ない件数を表示している**ことになるので、
`/about/` にその旨を書いてある。

## 声優は載せられない

**FANZA同人のAPIには声優（CV）の欄が無い。** `iteminfo` に入るのは
`genre` `maker` `series` の3つだけ。サークル名は取れるが、CV名は構造化されていない。

## 数値の出どころ

評価・レビュー件数・収録時間は**FANZAが公表している数値**。当サイトの集計ではない。
収録時間は「約120分」のような表記から読み取れたものだけの合計なので、
実際より少なく出る。

## データの作り直し

```
FANZA_API_ID=xxx FANZA_AFFILIATE_ID=yyy python scripts/fetch-circles.py public/data/circles.json
node scripts/build-site.mjs
```

- 生成したページは `.gitignore` に入れてある。commit するのは
  `public/data/circles.json` だけ
- 取り直しは `refresh-data.yml`（週1回）

## 削除依頼

`info@asmr-voice.jp`。画面にも表示している。
