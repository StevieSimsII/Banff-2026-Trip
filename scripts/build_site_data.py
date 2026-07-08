#!/usr/bin/env python3
"""Build assets/site-data.js from photos.json + GPX track stats.

Corrects day/location metadata (verified against GPX ground truth),
assigns photos to named stops by capture time, merges out-and-back
track pairs, and emits a single data file the site consumes.
"""
import json, math, os, re, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

from PIL import Image

# ---------------------------------------------------------------- tracks
def parse_gpx(path):
    g = open(path).read()
    tracks = {}
    for tm in re.finditer(r'<trk>(.*?)</trk>', g, re.S):
        body = tm.group(1)
        name = re.search(r'<name>(.*?)</name>', body).group(1)
        pts = []
        for pm in re.finditer(r'<trkpt lat="([-\d.]+)" lon="([-\d.]+)">(?:<ele>([-\d.]+)</ele>)?(?:<time>([^<]+)</time>)?', body):
            lat, lon, ele, t = pm.groups()
            pts.append((float(lat), float(lon), float(ele) if ele else None, t))
        tracks[name] = pts
    return tracks

R = 6371000
def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(h))

def track_stats(pts):
    eles = [p[2] for p in pts]
    sm = []
    for i in range(len(eles)):
        w = [e for e in eles[max(0, i-2):i+3] if e is not None]
        sm.append(sum(w)/len(w) if w else None)
    dist = gain = loss = 0.0
    cum = 0.0
    cums = [0.0]
    for i in range(1, len(pts)):
        cum += hav(pts[i-1], pts[i])
        cums.append(cum)
        if sm[i] is not None and sm[i-1] is not None:
            de = sm[i] - sm[i-1]
            if de > 0.5: gain += de
            elif de < -0.5: loss += -de
    n = len(pts)
    step = max(1, n // 70)
    prof = [[round(cums[i]/1000, 3), round(sm[i], 1)] for i in range(0, n, step) if sm[i] is not None]
    if sm[-1] is not None and (not prof or prof[-1][0] != round(cums[-1]/1000, 3)):
        prof.append([round(cums[-1]/1000, 3), round(sm[-1], 1)])
    step2 = max(1, n // 160)
    coords = [[round(pts[i][0], 5), round(pts[i][1], 5)] for i in range(0, n, step2)]
    if coords[-1] != [round(pts[-1][0], 5), round(pts[-1][1], 5)]:
        coords.append([round(pts[-1][0], 5), round(pts[-1][1], 5)])
    elev = [e for e in sm if e is not None]
    return {
        'distanceKm': round(cum/1000, 2), 'gainM': round(gain), 'lossM': round(loss),
        'minEleM': round(min(elev)), 'maxEleM': round(max(elev)),
        'profile': prof, 'coords': coords,
    }

raw_tracks = parse_gpx('trails/gpx/onx-markups-07012026.gpx')

# merge out-and-back pairs into single hikes
MERGES = {
    'Ink Pots': ['Ink Pots', 'Return from Ink Pots'],
    'Wapta Falls': ['Wapta Falls Return', 'Wapta Falls'],  # chronological: out then back
}
consumed = {n for group in MERGES.values() for n in group}

HIKE_META = {
    'Moraine Lake Shoreline': dict(day=2, blurb='A slow wander along the Rockpile and shoreline, ten peaks stacked above impossibly blue water.', kind='Lakeshore walk'),
    'Lake Agnes Tea House':   dict(day=2, blurb='Switchbacks through old spruce forest above Lake Louise, ending at the 1901 teahouse perched beside Lake Agnes.', kind='Classic climb'),
    'Peyto Lake':             dict(day=3, blurb='A short, punchy overlook track to the wolf-head lake — the most saturated blue of the whole trip.', kind='Overlook'),
    'Mistaya River':          dict(day=3, blurb='Fast water carving smooth curves through the limestone slot of Mistaya Canyon.', kind='Canyon stop'),
    'Ink Pots':               dict(day=4, blurb='Up and over the canyon rim to a quiet meadow where six mineral pools bubble in shades of jade.', kind='Out & back'),
    'Johnston Canyon':        dict(day=4, blurb='Catwalks bolted to the canyon wall, close enough to the falls to feel the spray.', kind='Canyon catwalks'),
    'Quarry Lake':            dict(day=4, blurb='An easy evening loop in Canmore with Ha Ling and the Three Sisters standing guard.', kind='Evening loop'),
    'Hamilton Falls':         dict(day=5, blurb='A forest ramble from Emerald Lake to a tall ribbon of falls tucked into the trees.', kind='Forest ramble'),
    'Natural Bridge':         dict(day=5, blurb='The Kicking Horse River punching straight through a wall of rock.', kind='Quick stop'),
    'Wapta Falls':            dict(day=5, blurb="Out and back through lodgepole forest to Yoho's widest waterfall — 150 metres of thunder.", kind='Out & back'),
    'Takakkaw Falls':         dict(day=5, blurb='A paved wander to the base of one of the tallest waterfalls in Canada, fed by the Daly Glacier.', kind='Falls approach'),
}

def local_start(pts):
    ts = [p[3] for p in pts if p[3]]
    if not ts: return None
    t = datetime.datetime.fromisoformat(ts[0].replace('Z', '+00:00')) - datetime.timedelta(hours=6)
    return t.strftime('%H:%M')

hikes = []
for name, meta in HIKE_META.items():
    if name in MERGES:
        parts = [raw_tracks[n] for n in MERGES[name]]
        # chronological order by first timestamp
        parts.sort(key=lambda pts: min(p[3] for p in pts if p[3]))
        s1, s2 = track_stats(parts[0]), track_stats(parts[1])
        off = s1['distanceKm']
        stats = {
            'distanceKm': round(s1['distanceKm'] + s2['distanceKm'], 2),
            'gainM': s1['gainM'] + s2['gainM'], 'lossM': s1['lossM'] + s2['lossM'],
            'minEleM': min(s1['minEleM'], s2['minEleM']), 'maxEleM': max(s1['maxEleM'], s2['maxEleM']),
            'profile': s1['profile'] + [[round(d+off, 3), e] for d, e in s2['profile']],
            'coords': s1['coords'] + s2['coords'],
        }
        start = local_start(parts[0])
    else:
        stats = track_stats(raw_tracks[name])
        start = local_start(raw_tracks[name])
    hikes.append({'id': re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'), 'name': name,
                  'day': meta['day'], 'kind': meta['kind'], 'blurb': meta['blurb'],
                  'startLocal': start, **stats})

# ---------------------------------------------------------------- days
DAYS = [
    dict(n=1, date='June 24', iso='2026-06-24', title='Arrival in Banff',
         sub='Mountain town under Cascade',
         opener='img-0455',
         narrative="After a full day of travel we stepped out onto Banff Avenue and there it was — Cascade Mountain filling the end of the street like a painted backdrop. A short evening wander, a first taste of mountain air, and early to bed. The real work started at dawn."),
    dict(n=2, date='June 25', iso='2026-06-25', title='Moraine Lake & Lake Louise',
         sub='Two of the bluest lakes on Earth, one day',
         opener='img-0525',
         narrative="An alpine start put us at Moraine Lake for the morning light, when the Valley of the Ten Peaks glows and the water turns that impossible glacier-flour turquoise. From there to Lake Louise, and up: 3.8 km and nearly 400 vertical metres of forest switchbacks to the Lake Agnes Tea House, where tea has been served on the same porch since 1901."),
    dict(n=3, date='June 26', iso='2026-06-26', title='The Icefields Parkway',
         sub='Bow Lake, Peyto Lake & Mistaya Canyon',
         opener='img-0550',
         narrative="Two hundred kilometres of the most scenic drive in North America. We pulled off for Bow Lake's mirror-still water, climbed to the Peyto Lake overlook — that wolf-head of pure colour — and rolled north past glaciers hanging off the Continental Divide. On the way back, Mistaya Canyon: a whole river folded into a slot of carved limestone."),
    dict(n=4, date='June 27', iso='2026-06-27', title='Johnston Canyon & Canmore',
         sub='Catwalks, Ink Pots and an evening at Quarry Lake',
         opener='img-0628',
         narrative="The biggest hiking day of the trip — 11.7 km all told. Into Johnston Canyon on steel catwalks bolted over the rushing creek, past the Lower and Upper Falls, then up and out of the canyon to the Ink Pots: six spring-fed pools bubbling jade and blue in an open meadow. We finished the day in Canmore, looping Quarry Lake as the light went gold on the Three Sisters."),
    dict(n=5, date='June 28', iso='2026-06-28', title='Yoho National Park',
         sub='Emerald Lake, Wapta Falls & Takakkaw Falls',
         opener='img-0672',
         narrative="Across the Divide into British Columbia for waterfall day. A quiet morning ramble from Emerald Lake to Hamilton Falls, the Kicking Horse River blasting through the Natural Bridge, then the out-and-back to Wapta Falls — 150 metres wide and loud enough to feel. We ended at Takakkaw Falls, glacier meltwater free-falling 254 metres, mist drifting over the parking lot. A fitting finale."),
]

# stop assignment: (day, cutoff_local_time, stop_name)
STOPS = {
    1: [('23:59', 'Banff Avenue')],
    2: [('12:30', 'Moraine Lake'), ('14:20', 'Lake Louise Lakeshore'),
        ('16:45', 'Lake Agnes Trail & Tea House'), ('23:59', 'Lake Louise')],
    3: [('10:50', 'Bow Lake'), ('12:15', 'Peyto Lake Overlook'),
        ('17:00', 'Icefields Parkway'), ('17:50', 'Mistaya Canyon'), ('23:59', 'Icefields Parkway')],
    4: [('09:15', 'Johnston Canyon'), ('10:45', 'Ink Pots'), ('12:30', 'Johnston Canyon'),
        ('16:30', 'Quarry Lake, Canmore'), ('23:59', 'Canmore')],
    5: [('11:30', 'Emerald Lake & Hamilton Falls'), ('12:45', 'Natural Bridge'),
        ('15:30', 'Wapta Falls'), ('23:59', 'Takakkaw Falls')],
}

STOP_CAPTIONS = {
    'Banff Avenue': 'First evening on Banff Avenue, Cascade Mountain closing out the street.',
    'Moraine Lake': 'Morning at Moraine Lake — glacier flour turning the water turquoise beneath the Ten Peaks.',
    'Lake Louise Lakeshore': 'Along the Lake Louise shoreline, Victoria Glacier hanging at the far end.',
    'Lake Agnes Trail & Tea House': 'On the climb to Lake Agnes — switchbacks, spruce forest, and teahouse views.',
    'Lake Louise': 'Late-day light over Lake Louise.',
    'Bow Lake': 'Bow Lake, mirror-still under Crowfoot Mountain.',
    'Peyto Lake Overlook': 'The Peyto Lake overlook — the bluest water of the whole trip.',
    'Icefields Parkway': 'Pull-off along the Icefields Parkway, glaciers on the Divide.',
    'Mistaya Canyon': 'Mistaya Canyon, a whole river folded into carved limestone.',
    'Johnston Canyon': 'Steel catwalks over Johnston Creek, spray in the air.',
    'Ink Pots': 'The Ink Pots meadow — cold mineral springs bubbling jade and blue.',
    'Quarry Lake, Canmore': 'Evening loop at Quarry Lake, the Three Sisters above Canmore.',
    'Canmore': 'Golden hour above Canmore.',
    'Emerald Lake & Hamilton Falls': 'Emerald Lake morning, en route to Hamilton Falls.',
    'Natural Bridge': 'The Kicking Horse River punching through the Natural Bridge.',
    'Wapta Falls': "Wapta Falls — Yoho's widest curtain of water.",
    'Takakkaw Falls': 'Takakkaw Falls, glacier meltwater free-falling 254 metres.',
}

VIDEO_META = {  # id: (utc creation) -> local stop + caption
    'img-0466': (2, '09:36', 'Moraine Lake', 'The Moraine Lake shoreline in motion.'),
    'img-0501': (2, '14:36', 'Lake Agnes Trail & Tea House', 'Climbing through the switchbacks toward Lake Agnes.'),
    'img-0508': (2, '14:51', 'Lake Agnes Trail & Tea House', 'The falls below Lake Agnes.'),
    'img-0511': (2, '15:53', 'Lake Agnes Trail & Tea House', 'Lake Agnes from the teahouse porch.'),
    'img-0544': (3, '10:35', 'Bow Lake', 'Wind on Bow Lake.'),
    'img-0548': (3, '11:09', 'Peyto Lake Overlook', 'Panning across Peyto Lake from the overlook.'),
    'img-0555': (3, '16:33', 'Icefields Parkway', 'Glacial rivers along the Parkway.'),
    'img-0570': (3, '17:42', 'Mistaya Canyon', 'Mistaya River funnelling into the canyon.'),
    'img-0572': (3, '18:18', 'Mistaya Canyon', 'Standing over the slot at Mistaya Canyon.'),
    'img-0599': (4, '08:41', 'Johnston Canyon', 'Johnston Canyon falls from the catwalk.'),
    'img-0653': (5, '14:30', 'Wapta Falls', 'The full width of Wapta Falls.'),
    'img-0670': (5, '16:54', 'Takakkaw Falls', 'Takakkaw Falls, top to bottom.'),
}

OPENERS = {d['opener'] for d in DAYS}
HERO = 'img-0467'
FINALE = 'img-0529'

photos = json.load(open('data/photos.json'))
out_photos = []
for p in photos:
    if p['type'] == 'video':
        vid = p['id']
        if vid not in VIDEO_META:  # skip unknown
            continue
        day, hhmm, stop, cap = VIDEO_META[vid]
        iso = DAYS[day-1]['iso']
        out_photos.append({
            'id': vid, 'type': 'video', 'day': day, 'stop': stop,
            'capturedAt': f'{iso} {hhmm}',
            'src': f'media/video-web/{vid}.mp4',
            'poster': f'media/video-posters/{vid}.jpg',
            'caption': cap, 'w': 1920, 'h': 1080,
        })
        continue
    m = re.match(r'Day (\d)', p['day'])
    day = int(m.group(1))
    t = p.get('capturedAt', '')
    hhmm = t[11:16] if len(t) >= 16 else '12:00'
    stop = STOPS[day][-1][1]
    for cutoff, name in STOPS[day]:
        if hhmm <= cutoff:
            stop = name
            break
    with Image.open(p['src']) as im:
        w, h = im.size
    out_photos.append({
        'id': p['id'], 'type': 'image', 'day': day, 'stop': stop,
        'capturedAt': t, 'src': p['src'], 'thumb': p['thumb'],
        'caption': STOP_CAPTIONS[stop], 'w': w, 'h': h,
        'role': ('hero' if p['id'] == HERO else 'opener' if p['id'] in OPENERS else 'finale' if p['id'] == FINALE else None),
    })

out_photos.sort(key=lambda p: (p['day'], p['capturedAt']))

totals = {
    'photos': sum(1 for p in out_photos if p['type'] == 'image'),
    'videos': sum(1 for p in out_photos if p['type'] == 'video'),
    'hikes': len(hikes),
    'distanceKm': round(sum(h['distanceKm'] for h in hikes), 1),
    'gainM': sum(h['gainM'] for h in hikes),
    'maxEleM': max(h['maxEleM'] for h in hikes),
    'days': len(DAYS),
}

site = {'hero': HERO, 'finale': FINALE, 'totals': totals,
        'days': DAYS, 'hikes': hikes, 'media': out_photos}

with open('assets/site-data.js', 'w') as f:
    f.write('window.SITE_DATA = ')
    json.dump(site, f, separators=(',', ':'))
    f.write(';\n')

json.dump(out_photos, open('data/photos.json', 'w'), indent=2)
json.dump(hikes, open('data/trails.json', 'w'), indent=2)
size = os.path.getsize('assets/site-data.js')
print(f'site-data.js {size/1024:.0f}KB | {totals}')
