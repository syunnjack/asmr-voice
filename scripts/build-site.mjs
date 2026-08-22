// FANZA同人のデータから、asmr-voice.jp のページを作る。
//
// 軸はサークル。作品そのものではない。
//
// 方針:
//   - FANZA が付けたジャンルだけを根拠にする。推測で分類しない
//   - 作品のタイトルは載せない（露骨な語を含むものが多いため）。
//     ジャンル名とサークル名も、露骨な語を含むものは取得の段階で除いてある
//   - 評価・レビュー数・収録時間は FANZA が公表している実数。当サイトの集計ではない
//
// 使い方: node scripts/build-site.mjs

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const publicDir = path.join(root, 'public')

const SITE_URL = 'https://asmr-voice.jp'
const SITE_NAME = 'ASMR音声作品サークル名鑑'
const CONTACT = 'info@asmr-voice.jp'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function slugify(name) {
  const base = String(name || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return base || 'unknown'
}

function monthLabel(iso) {
  if (!iso) return ''
  const [year, month] = String(iso).split('-')
  return `${Number(year)}年${Number(month)}月`
}

function hoursLabel(minutes) {
  if (!minutes) return ''
  if (minutes < 60) return `約${minutes}分`
  return `約${Math.round(minutes / 60).toLocaleString('ja-JP')}時間`
}

function shell({ title, description, canonical, crumbs, body }) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="rating" content="adult" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <link rel="stylesheet" href="/assets/site.css" />
  </head>
  <body>
    <div class="wrap">
      <nav class="crumbs"><a href="/">${escapeHtml(SITE_NAME)}</a>${crumbs ? ` ＞ ${crumbs}` : ''}</nav>
      ${body}
      <footer>
        <p class="adult">このサイトは18歳未満の方に向けたものではありません。</p>
        <p>掲載内容の訂正・削除のご依頼は <a href="mailto:${CONTACT}">${CONTACT}</a> へご連絡ください。確認のうえ対応します。</p>
        <p><a href="/">トップ</a> ・ <a href="/kana/">五十音索引</a> ・ <a href="/all/">サークル一覧</a> ・ <a href="/about/">このサイトについて</a></p>
      </footer>
    </div>
  </body>
</html>
`
}

function renderCircle(circle, genres) {
  const canonical = `${SITE_URL}/circle/${circle.slug}/`
  const title = `${circle.name}のASMR作品${circle.works}件｜${SITE_NAME}`
  const description = `${circle.name}が出しているASMR・音声作品${circle.works}件をまとめています。`
    + `${monthLabel(circle.firstDate)}から${monthLabel(circle.lastDate)}までの発売です。`

  const rows = [['作品数', `${circle.works.toLocaleString('ja-JP')}作品`]]

  const chips = genres
    .filter((g) => circle.genreCounts?.[g.name])
    .map((g) => `<a class="chip" href="/${g.slug}/">${escapeHtml(g.label)} ${circle.genreCounts[g.name]}件</a>`)
    .join('')
  if (chips) rows.push(['扱っているジャンル', chips])

  rows.push(['発売の範囲', `${monthLabel(circle.firstDate)} 〜 ${monthLabel(circle.lastDate)}`])

  if (circle.rating) {
    rows.push(['FANZAでの評価', `${circle.rating} / 5（${circle.ratedWorks}作品の平均・レビュー${circle.reviews.toLocaleString('ja-JP')}件）`])
  }
  if (circle.minutes) {
    rows.push(['収録時間の合計', hoursLabel(circle.minutes)])
  }
  if (circle.genres?.length) {
    rows.push(['よく付くタグ', escapeHtml(circle.genres.join('、'))])
  }

  const table = `<table class="profile"><tbody>${rows
    .map(([th, td]) => `<tr><th>${escapeHtml(th)}</th><td>${td}</td></tr>`)
    .join('')}</tbody></table>`

  const link = circle.newestUrl
    ? `<p class="works">
         <a class="button" href="${escapeHtml(circle.newestUrl)}" target="_blank" rel="nofollow sponsored noopener">FANZA で最新作を見る（${escapeHtml(monthLabel(circle.newestDate))}発売）</a>
         <span class="pr">広告</span>
       </p>`
    : ''

  return shell({
    title,
    description,
    canonical,
    crumbs: escapeHtml(circle.name),
    body: `
      <h1>${escapeHtml(circle.name)}</h1>
      <p class="lead">FANZA同人でASMR・音声作品として登録されている作品が${circle.works}件あります。</p>
      ${table}
      ${link}
      <section class="source-block">
        <h2>出典</h2>
        <ul class="sources"><li><a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener">FANZA アフィリエイト Web サービス（同人）</a></li></ul>
        <p class="confirmed">
          評価・レビュー件数・収録時間は FANZA が公表している数値です。当サイトの集計ではありません。
          作品のタイトルは、露骨な語を含むものが多いため掲載していません。
        </p>
      </section>`,
  })
}

function renderGenre(genre, circles) {
  const canonical = `${SITE_URL}/${genre.slug}/`
  const title = `${genre.label}のサークル${circles.length}件｜${SITE_NAME}`
  const description = `FANZA同人で${genre.label}に分類された作品${genre.works.toLocaleString('ja-JP')}件を出している`
    + `${circles.length}サークルを、作品数の多い順に並べています。`

  const list = circles
    .map((c, index) => `
      <li>
        <span class="rank">${index + 1}</span>
        <a href="/circle/${c.slug}/">${escapeHtml(c.name)}</a>
        <span class="count">${c.genreCounts[genre.name]}件${c.rating ? ` ・ ${c.rating}` : ''}</span>
      </li>`)
    .join('')

  return shell({
    title,
    description,
    canonical,
    crumbs: escapeHtml(genre.label),
    body: `
      <h1>${escapeHtml(genre.label)}のサークル</h1>
      <p class="lead">${escapeHtml(description)}</p>
      <ol class="rank-list">${list}</ol>`,
  })
}

function renderTop(genres, circles, confirmedOn) {
  const cards = genres
    .map((g) => `
      <a class="card" href="/${g.slug}/">
        <span class="card-title">${escapeHtml(g.label)}</span>
        <span class="card-note">${g.works.toLocaleString('ja-JP')}作品・${g.circles.toLocaleString('ja-JP')}サークル</span>
      </a>`)
    .join('')

  const byWorks = circles.slice(0, 30)
    .map((c, i) => `<li><span class="rank">${i + 1}</span><a href="/circle/${c.slug}/">${escapeHtml(c.name)}</a><span class="count">${c.works}件</span></li>`)
    .join('')

  const byRating = circles
    .filter((c) => c.rating && c.ratedWorks >= 5)
    .sort((a, b) => b.rating - a.rating || b.ratedWorks - a.ratedWorks)
    .slice(0, 30)
    .map((c, i) => `<li><span class="rank">${i + 1}</span><a href="/circle/${c.slug}/">${escapeHtml(c.name)}</a><span class="count">${c.rating} / 5</span></li>`)
    .join('')

  const description = `FANZA同人でASMR・音声作品を出している${circles.length.toLocaleString('ja-JP')}サークルを、`
    + '作品数と評価つきでまとめた一覧です。'

  return shell({
    title: `${SITE_NAME}｜ジャンルと評価で探す`,
    description,
    canonical: `${SITE_URL}/`,
    crumbs: '',
    body: `
      <h1>${escapeHtml(SITE_NAME)}</h1>
      <p class="lead">${escapeHtml(description)}${escapeHtml(confirmedOn)} 時点のデータです。</p>
      <div class="cards">${cards}</div>
      <h2>作品数の多いサークル</h2>
      <ol class="rank-list">${byWorks}</ol>
      <h2>評価の高いサークル</h2>
      <p class="note">FANZAのレビュー評価の平均です。5作品以上に評価が付いているサークルに限っています。</p>
      <ol class="rank-list">${byRating}</ol>
      <p class="more"><a href="/all/">すべてのサークルを見る</a></p>`,
  })
}

function renderAll(circles) {
  const list = circles
    .map((c) => `<li><a href="/circle/${c.slug}/">${escapeHtml(c.name)}</a><span class="count">${c.works}</span></li>`)
    .join('')

  return shell({
    title: `サークル一覧${circles.length}件｜${SITE_NAME}`,
    description: `ASMR・音声作品を出している${circles.length}サークルの一覧です。`,
    canonical: `${SITE_URL}/all/`,
    crumbs: 'サークル一覧',
    body: `
      <h1>サークル一覧</h1>
      <p class="lead">${circles.length.toLocaleString('ja-JP')}サークルを、作品数の多い順に並べています。</p>
      <ul class="name-list">${list}</ul>`,
  })
}

const KANA_ROWS = [
  ['あ', 'あいうえおぁぃぅぇぉ'], ['か', 'かきくけこがぎぐげご'],
  ['さ', 'さしすせそざじずぜぞ'], ['た', 'たちつてとだぢづでど'],
  ['な', 'なにぬねの'], ['は', 'はひふへほばびぶべぼぱぴぷぺぽ'],
  ['ま', 'まみむめも'], ['や', 'やゆよゃゅょ'],
  ['ら', 'らりるれろ'], ['わ', 'わをん'],
]

/** サークル名は日本語とは限らないので、英数字は「A-Z」「0-9」にまとめる。 */
function head(name) {
  const first = String(name || '').normalize('NFKC').charAt(0)

  for (const [row, members] of KANA_ROWS) {
    if (members.includes(first)) return row
  }
  if (/[ァ-ヶ]/.test(first)) {
    const hira = String.fromCharCode(first.charCodeAt(0) - 0x60)
    for (const [row, members] of KANA_ROWS) {
      if (members.includes(hira)) return row
    }
  }
  if (/[A-Za-z]/.test(first)) return 'A-Z'
  if (/[0-9]/.test(first)) return '0-9'
  return 'その他'
}

const HEADS = [...KANA_ROWS.map(([row]) => row), 'A-Z', '0-9', 'その他']

function renderKanaIndex(groups, total) {
  const links = HEADS
    .filter((h) => groups.get(h)?.length)
    .map((h) => `<a class="chip" href="/kana/${encodeURIComponent(h)}/">${escapeHtml(h)} ${groups.get(h).length}件</a>`)
    .join('')

  const description = `${total.toLocaleString('ja-JP')}サークルを、名前の頭文字ごとに並べています。`

  return shell({
    title: `五十音索引｜${SITE_NAME}`,
    description,
    canonical: `${SITE_URL}/kana/`,
    crumbs: '五十音索引',
    body: `
      <h1>五十音索引</h1>
      <p class="lead">${escapeHtml(description)}英数字で始まる名前は A-Z と 0-9 にまとめています。</p>
      <p>${links}</p>`,
  })
}

function renderKanaPage(current, members, groups) {
  const nav = HEADS
    .filter((h) => groups.get(h)?.length)
    .map((h) => h === current
      ? `<span class="chip current">${escapeHtml(h)}</span>`
      : `<a class="chip" href="/kana/${encodeURIComponent(h)}/">${escapeHtml(h)}</a>`)
    .join('')

  const list = members
    .map((c) => `<li><a href="/circle/${c.slug}/">${escapeHtml(c.name)}</a><span class="count">${c.works}</span></li>`)
    .join('')

  const description = `${current}で始まるサークル${members.length}件の一覧です。`

  return shell({
    title: `${current}で始まるサークル${members.length}件｜${SITE_NAME}`,
    description,
    canonical: `${SITE_URL}/kana/${encodeURIComponent(current)}/`,
    crumbs: `<a href="/kana/">五十音索引</a> ＞ ${escapeHtml(current)}`,
    body: `
      <h1>${escapeHtml(current)}で始まるサークル</h1>
      <p class="lead">${escapeHtml(description)}</p>
      <p>${nav}</p>
      <ul class="name-list">${list}</ul>`,
  })
}

function renderAbout(genres, circles, confirmedOn) {
  return shell({
    title: `このサイトについて｜${SITE_NAME}`,
    description: 'データの出典と、掲載の方針についてご案内します。',
    canonical: `${SITE_URL}/about/`,
    crumbs: 'このサイトについて',
    body: `
      <h1>このサイトについて</h1>

      <h2>載せているもの</h2>
      <p>
        FANZA同人でASMR・バイノーラル・KU100・耳かきに分類されている作品から、
        サークルごとの作品数・評価・発売期間をまとめています。
        ${escapeHtml(confirmedOn)} 時点で ${circles.length.toLocaleString('ja-JP')}サークルです。
      </p>

      <h2>作品のタイトルは載せていません</h2>
      <p>
        露骨な語を含むものが多いため、タイトルと紹介文は掲載していません。
        ジャンル名とサークル名も、露骨な語を含むものは除いています。
        そのため、実際にFANZAで扱われている作品より少ない件数を表示しています。
      </p>

      <h2>推測で分類していません</h2>
      <p>
        FANZA が作品に付けているジャンルだけを根拠にしています。
        タイトルや紹介文の語から推測して分類することはしていません。
      </p>

      <h2>数値について</h2>
      <p>
        評価・レビュー件数・収録時間は、<strong>FANZA が公表している数値</strong>です。
        当サイトが独自に集計・採点したものではありません。
        収録時間は「約120分」のような表記から読み取れたものだけを合計しているため、
        実際より少なく出ることがあります。
      </p>

      <h2>声優について</h2>
      <p>
        FANZA同人のデータには声優（CV）の欄がありません。
        そのため、声優ごとの一覧は作れていません。
      </p>

      <h2>訂正・削除のご依頼</h2>
      <p>
        サークルの方から掲載を希望しない旨のご連絡をいただいた場合、確認のうえ削除します。
        <a href="mailto:${CONTACT}">${CONTACT}</a>
      </p>

      <h2>出典</h2>
      <ul class="sources">
        <li><a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener">FANZA アフィリエイト Web サービス（ItemList API・同人）</a></li>
      </ul>`,
  })
}

const SITE_CSS = `:root { color-scheme: light dark; --bg:#f8f9fb; --panel:#fff; --text:#1b1d24; --muted:#5d616e; --rule:#e2e5ec; --accent:#3f5b8b; --warn:#b0453c; }
@media (prefers-color-scheme: dark) { :root { --bg:#141619; --panel:#1f232a; --text:#e9ecf2; --muted:#a2a8b6; --rule:#2f343d; --accent:#8fb0e6; --warn:#f0908a; } }
* { box-sizing:border-box; }
body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; background:var(--bg); color:var(--text); line-height:1.7; }
.wrap { max-width:820px; margin:0 auto; padding:24px 20px 64px; }
.crumbs { font-size:13px; color:var(--muted); margin-bottom:18px; }
a { color:var(--accent); }
.crumbs a, .name-list a, .rank-list a { text-decoration:none; }
h1 { font-size:clamp(24px,5vw,34px); margin:0 0 8px; }
h2 { font-size:18px; margin:30px 0 10px; }
.lead { color:var(--muted); font-size:15px; margin:0 0 20px; }
.cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; margin-bottom:8px; }
.card { display:block; padding:16px; border:1px solid var(--rule); border-radius:10px; background:var(--panel); text-decoration:none; color:inherit; }
.card:hover { border-color:var(--accent); }
.card-title { display:block; font-size:18px; font-weight:700; }
.card-note { display:block; font-size:13px; color:var(--muted); margin-top:4px; }
.profile { border-collapse:collapse; width:100%; background:var(--panel); border:1px solid var(--rule); border-radius:10px; overflow:hidden; }
.profile th, .profile td { text-align:left; padding:11px 14px; border-bottom:1px solid var(--rule); font-size:15px; }
.profile th { width:11em; color:var(--muted); font-weight:600; }
.profile tr:last-child th, .profile tr:last-child td { border-bottom:0; }
.chip { display:inline-block; border:1px solid var(--rule); border-radius:18px; padding:3px 12px; margin:2px 4px 2px 0; font-size:13px; text-decoration:none; background:var(--panel); }
.chip.current { background:var(--accent); color:#fff; border-color:var(--accent); }
.works { margin:20px 0; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.button { display:inline-block; background:var(--accent); color:#fff; text-decoration:none; padding:11px 20px; border-radius:8px; font-weight:700; font-size:15px; }
.pr { font-size:11px; color:var(--muted); border:1px solid var(--rule); border-radius:4px; padding:1px 6px; }
.rank-list { list-style:none; padding:0; margin:0; }
.rank-list li { display:flex; align-items:baseline; gap:10px; padding:6px 0; border-bottom:1px solid var(--rule); }
.rank { min-width:2.2em; color:var(--muted); font-size:13px; }
.count { margin-left:auto; font-size:13px; color:var(--muted); }
.name-list { list-style:none; padding:0; margin:0; display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:2px 14px; }
.name-list li { display:flex; gap:8px; padding:4px 0; font-size:14px; }
.sources { padding-left:1.2em; font-size:14px; color:var(--muted); }
.note, .confirmed { font-size:13px; color:var(--muted); }
.source-block { margin-top:30px; border-top:1px solid var(--rule); padding-top:8px; }
.more { margin-top:18px; font-size:15px; }
footer { margin-top:44px; border-top:1px solid var(--rule); padding-top:16px; font-size:13px; color:var(--muted); }
.adult { font-weight:700; color:var(--warn); }
`

async function main() {
  const data = JSON.parse(await readFile(path.join(publicDir, 'data/circles.json'), 'utf8'))
  const circles = data.circles
  const confirmedOn = data.confirmedOn

  const used = new Set()
  for (const circle of circles) {
    let slug = slugify(circle.name)
    let suffix = 2
    while (used.has(slug)) slug = `${slugify(circle.name)}-${suffix++}`
    used.add(slug)
    circle.slug = slug
  }

  const genres = data.genres.map((g) => ({
    ...g,
    circles: circles.filter((c) => c.genreCounts?.[g.name]).length,
  }))

  for (const dir of ['circle', 'all', 'about', 'kana', 'assets', ...genres.map((g) => g.slug)]) {
    await rm(path.join(publicDir, dir), { recursive: true, force: true })
  }

  await mkdir(path.join(publicDir, 'assets'), { recursive: true })
  await writeFile(path.join(publicDir, 'assets/site.css'), SITE_CSS, 'utf8')

  await writeFile(path.join(publicDir, 'index.html'), renderTop(genres, circles, confirmedOn), 'utf8')

  for (const [dir, html] of [
    ['all', renderAll(circles)],
    ['about', renderAbout(genres, circles, confirmedOn)],
  ]) {
    await mkdir(path.join(publicDir, dir), { recursive: true })
    await writeFile(path.join(publicDir, dir, 'index.html'), html, 'utf8')
  }

  for (const genre of genres) {
    const members = circles
      .filter((c) => c.genreCounts?.[genre.name])
      .sort((a, b) => b.genreCounts[genre.name] - a.genreCounts[genre.name] || a.name.localeCompare(b.name, 'ja'))

    await mkdir(path.join(publicDir, genre.slug), { recursive: true })
    await writeFile(path.join(publicDir, genre.slug, 'index.html'), renderGenre(genre, members), 'utf8')
  }

  const groups = new Map()
  for (const circle of circles) {
    const key = head(circle.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(circle)
  }
  for (const members of groups.values()) {
    members.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }

  await mkdir(path.join(publicDir, 'kana'), { recursive: true })
  await writeFile(path.join(publicDir, 'kana/index.html'), renderKanaIndex(groups, circles.length), 'utf8')

  for (const [key, members] of groups) {
    const dir = path.join(publicDir, 'kana', key)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), renderKanaPage(key, members, groups), 'utf8')
  }

  for (const circle of circles) {
    const dir = path.join(publicDir, 'circle', circle.slug)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), renderCircle(circle, genres), 'utf8')
  }

  const today = new Date().toISOString().slice(0, 10)
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/all/`,
    `${SITE_URL}/kana/`,
    `${SITE_URL}/about/`,
    ...genres.map((g) => `${SITE_URL}/${g.slug}/`),
    ...[...groups.keys()].map((h) => `${SITE_URL}/kana/${encodeURIComponent(h)}/`),
    ...circles.map((c) => `${SITE_URL}/circle/${encodeURI(c.slug)}/`),
  ]

  await writeFile(
    path.join(publicDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      urls.map((loc) => `  <url><loc>${loc}</loc><lastmod>${today}</lastmod></url>`).join('\n')
    }\n</urlset>\n`,
    'utf8'
  )

  await writeFile(path.join(publicDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8')

  await writeFile(path.join(publicDir, 'CNAME'), 'asmr-voice.jp\n', 'utf8')

  console.log(`サークル ${circles.length.toLocaleString('ja-JP')}件のページを作りました`)
  for (const g of genres) console.log(`  ${g.label}: ${g.works.toLocaleString('ja-JP')}作品 / ${g.circles.toLocaleString('ja-JP')}サークル`)
  console.log(`サイトマップ: ${urls.length.toLocaleString('ja-JP')}URL`)
}

main()
