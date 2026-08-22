"""FANZA同人から、ASMR・音声作品のサークルを集める。

出典: FANZA アフィリエイト Web サービス（ItemList API・同人）
      https://affiliate.dmm.com/api/

DUGA にはASMRのカテゴリが無いため、こちらを使う。

集めるのはサークル（maker）ごとの実数だけ。
  - 作品数
  - レビューの平均評価と件数
  - 発売日の範囲
  - 扱っているジャンル（露骨な語を含むものは除く）
  - 代表作（いちばん新しいもの）へのアフィリエイトリンク

**作品のタイトルは持たない。** 露骨な語を含むものが多いため。

API ID とアフィリエイトIDは環境変数から読む。リポジトリには置かない。
  FANZA_API_ID / FANZA_AFFILIATE_ID

API の offset 上限は50,000。ジャンルごとに取れば十分収まる。

使い方: FANZA_API_ID=xxx FANZA_AFFILIATE_ID=yyy python scripts/fetch-circles.py public/data/circles.json
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

API = 'https://api.dmm.com/affiliate/v3/ItemList'
HITS = 100
INTERVAL = 0.6

# 扱うジャンルと、画面に出すときの言い方。
GENRES = {
    'ASMR': {'id': 160004, 'slug': 'asmr', 'label': 'ASMR'},
    'バイノーラル': {'id': 160006, 'slug': 'binaural', 'label': 'バイノーラル'},
    'KU100': {'id': 160103, 'slug': 'ku100', 'label': 'KU100'},
    '耳かき': {'id': 155020, 'slug': 'mimikaki', 'label': '耳かき'},
}

# 画面に出すジャンル名から除くもの。露骨な語を含むものと、
# 販売上の区分（専売・独占配信など）で内容を表さないもの。
EXPLICIT = (
    '中出し', 'フェラ', 'パイズリ', '手コキ', '素股', 'アナル', '潮吹', '射精', '精液',
    'ハメ', '輪姦', 'レイプ', '強姦', '近親', '痴漢', '露出', '奴隷', '調教', 'スカトロ',
    '排泄', '浣腸', '放尿', 'おしっこ', '母乳', 'オホ声', 'アヘ', 'アへ', '寝取', 'NTR',
    '孕', '妊娠', '母娘', '姉弟', '兄妹', '義母', '義父', '女子○', 'ロリ', '幼',
    'オナニー', 'オナサポ', 'ごっくん', '処女', '童貞', '女性優位', '逆レ', '搾精',
    '乳首', '巨乳', 'おっぱい', '爆乳', '貧乳', '尻', '脚', '足', '下着', '着衣',
    '拘束', '緊縛', '羞恥', '強制', '快楽', '絶頂', '喘', '発情', '誘惑', '痴女',
    'えっち', 'エッチ', 'セックス', '性', '淫', '猥',
)
NOT_CONTENT = ('専売', '独占', 'キャンペーン', 'セール', '割引', 'ピックアップ',
               '大感謝祭', 'おすすめ', 'CP', '人気作品')


def explicit_name(name: str) -> bool:
    """サークル名そのものに露骨な語が入っているか。"""
    return any(word in str(name) for word in EXPLICIT)


def displayable(name: str) -> bool:
    if not name:
        return False
    if any(word in name for word in EXPLICIT):
        return False
    if any(word in name for word in NOT_CONTENT):
        return False
    return True


def call(credentials: dict, genre_id: int, offset: int) -> dict:
    params = dict(credentials, output='json', site='FANZA', service='doujin',
                  floor='digital_doujin', article='genre', article_id=genre_id,
                  hits=HITS, offset=offset, sort='date')
    query = urllib.parse.urlencode(params)

    for attempt in range(5):
        try:
            with urllib.request.urlopen(f'{API}?{query}', timeout=60) as response:
                return json.loads(response.read().decode())
        except Exception as error:
            if attempt == 4:
                raise
            print(f'    再試行 {attempt + 1}/4: {error}', file=sys.stderr)
            time.sleep(3 * (attempt + 1))

    return {}


def minutes(volume: str) -> int:
    """「95本(約1069分)+α」「約120分」から分数を取り出す。取れなければ0。"""
    matched = re.search(r'(\d+)\s*分', str(volume or ''))
    return int(matched.group(1)) if matched else 0


def main() -> None:
    output = Path(sys.argv[1])

    api_id = os.environ.get('FANZA_API_ID')
    affiliate_id = os.environ.get('FANZA_AFFILIATE_ID')

    if not api_id or not affiliate_id:
        raise SystemExit('環境変数 FANZA_API_ID と FANZA_AFFILIATE_ID が必要です。')

    credentials = {'api_id': api_id, 'affiliate_id': affiliate_id}

    circles: dict[str, dict] = {}
    genre_counts: dict[str, Counter] = defaultdict(Counter)
    seen = set()
    totals = {}

    for name, info in GENRES.items():
        offset = 1
        total = None

        while True:
            payload = call(credentials, info['id'], offset).get('result', {})
            items = payload.get('items') or []

            if total is None:
                total = int(payload.get('total_count') or 0)
                totals[name] = total
                print(f'  {name}: {total:,}件', flush=True)

            if not items:
                break

            for item in items:
                content_id = item.get('content_id')
                item_info = item.get('iteminfo') or {}
                makers = item_info.get('maker') or []

                if not makers:
                    continue

                maker = makers[0]
                circle_name = (maker.get('name') or '').strip()

                # サークル名そのものが露骨なものは載せない。
                # 名前は伏せられないので、載せない以外の選択肢がない。
                if not circle_name or explicit_name(circle_name):
                    continue

                circle = circles.setdefault(circle_name, {
                    'name': circle_name,
                    'makerId': str(maker.get('id') or ''),
                    'works': 0,
                    'ratingSum': 0.0,
                    'ratedWorks': 0,
                    'reviews': 0,
                    'minutes': 0,
                    'genres': {},
                    'firstDate': '',
                    'lastDate': '',
                    'newestId': '',
                    'newestUrl': '',
                    'newestDate': '',
                })

                # 同じ作品が複数のジャンルで出てくるので、数え方を分ける。
                # 作品数は1回だけ、ジャンル別の数はジャンルごとに数える。
                genre_counts[circle_name][name] += 1

                if content_id in seen:
                    continue
                seen.add(content_id)

                circle['works'] += 1

                review = item.get('review') or {}
                if review.get('average'):
                    circle['ratingSum'] += float(review['average'])
                    circle['ratedWorks'] += 1
                circle['reviews'] += int(review.get('count') or 0)

                circle['minutes'] += minutes(item.get('volume'))

                for genre in item_info.get('genre') or []:
                    label = (genre.get('name') or '').strip()
                    if displayable(label):
                        circle['genres'][label] = circle['genres'].get(label, 0) + 1

                released = str(item.get('date') or '')[:10]
                if released:
                    if not circle['firstDate'] or released < circle['firstDate']:
                        circle['firstDate'] = released
                    if released > circle['lastDate']:
                        circle['lastDate'] = released
                    if released >= circle['newestDate']:
                        circle['newestDate'] = released
                        circle['newestId'] = content_id
                        circle['newestUrl'] = item.get('affiliateURL') or item.get('URL') or ''

            offset += HITS

            if offset > min(total or 0, 50000):
                break

            time.sleep(INTERVAL)

    records = []
    for circle in circles.values():
        rated = circle.pop('ratedWorks')
        total_rating = circle.pop('ratingSum')
        circle['rating'] = round(total_rating / rated, 2) if rated else None
        circle['ratedWorks'] = rated
        circle['genreCounts'] = dict(genre_counts[circle['name']])
        top = sorted(circle['genres'].items(), key=lambda kv: (-kv[1], kv[0]))
        circle['genres'] = [name for name, _ in top[:6]]
        records.append(circle)

    records.sort(key=lambda r: (-r['works'], r['name']))

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        'confirmedOn': date.today().isoformat(),
        'sourceLabel': 'FANZA アフィリエイト Web サービス（同人）',
        'sourceUrl': 'https://affiliate.dmm.com/api/',
        'scannedWorks': len(seen),
        'genres': [{'name': n, **i, 'works': totals.get(n, 0)} for n, i in GENRES.items()],
        'circles': records,
    }, ensure_ascii=False), encoding='utf-8')

    with_rating = sum(1 for r in records if r['rating'])
    print()
    print(f'{len(seen):,}作品から、サークル {len(records):,}件を集めました → {output}')
    print(f'  評価があるサークル: {with_rating:,}件')
    for record in records[:5]:
        print(f"  {record['name']} {record['works']}作品（評価 {record['rating'] or '-'}）")


main()
