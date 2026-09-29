#!/usr/bin/env python3
"""
In-place learner-locale --fill (pilot: lq-balkan croatian/de).

Translates ONLY learner-facing strings that are still English in an existing
locale file; keeps everything else byte-identical (target-language words,
pronunciation, contrastiveNote, english.meaning, ids, audio, structure).
Mirrors the filled content into public/data/lessons/<locale>/<lang>/ (whose
`content` is byte-equal to source lessons[0].content) without running
generate-lesson-files.ts (which would wipe the disabled de tree).

Usage: fill_locale.py --root=<app> --lang=croatian --locale=de [--chapter=N] [--dry-run]
Env: MINIMAX_API_KEY (primary, MiniMax-M3), GLM_API_KEY (fallback glm-5.3-flash).
"""
import json, os, re, sys, glob, time, copy, datetime, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor

ARGS = {a.split('=', 1)[0][2:]: (a.split('=', 1)[1] if '=' in a else True) for a in sys.argv[1:]}
ROOT = ARGS['root']; LANG = ARGS['lang']; LOCALE = ARGS['locale']
CHAPTER = ARGS.get('chapter'); DRY = bool(ARGS.get('dry-run'))
LANG_NAMES = {'de': 'German', 'es': 'Spanish', 'fr': 'French'}
TARGET = LANG_NAMES[LOCALE]; TAUGHT = LANG.capitalize()
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
SCRIPT = 'fill-locale-pilot/0.1'

PROSE_KEYS = {'title', 'intro', 'body', 'heading', 'description', 'hint', 'prompt', 'question',
              'explanation', 'role', 'feedback', 'tips', 'objectives', 'funFacts', 'examples'}
GLOSS_KEYS = {'meaning', 'translation'}
SKIP_SUBTREES = {'english', 'enrichmentMeta', 'aiDraft', 'translationMeta', 'targetLocale'}
PRESERVED = {'word', 'text', 'pronunciation', 'transliteration', 'answer', 'correctAnswer',
             'correctSentence', 'contrastiveNote', 'nativePronunciation', 'id', 'type', 'next',
             'speakerId', 'characterRef', 'sceneRef', 'gender', 'name', 'image', 'audioUrl',
             'slot', 'mode', 'startNode', 'drillType', 'difficulty', 'chapterId', 'status',
             'position', 'tags', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
             'lastChangeType', 'xpReward', 'estimatedTime', 'order'}

EN_STOP = set('the a an is are was were of to and what does do you your this that with for how which '
              'it its it\'s i\'m i am be have has will would can not don\'t word words mean means meaning '
              'when where who they we our my me he she his her from by at on as or but if there their '
              'english good day thank thanks please'.split())
HR_STOP = set('je i u na što se za sam su riječ znači može od s koji koja kako li ili npr da ne to '
              'mi ti vi smo ste ja on ona ono ovo taj ta'.split())
DE_STOP = set('der die das und ist nicht ein eine ich du sie wir mit auf für von zu im wie was den dem '
              'des sich auch bedeutet wort'.split())
HR_DIAC = re.compile(r'[čćžšđČĆŽŠĐ]')
TOK = re.compile(r"[A-Za-zÀ-žß']+")

def toks(s): return [t.lower().strip("'") for t in TOK.findall(s) if t.strip("'")]

# ---------- lexicon of the taught language (to recognise untouchable strings)
LEX = set()
def build_lex(node):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ('text', 'word', 'correctSentence') and isinstance(v, str):
                LEX.update(toks(v))
            else: build_lex(v)
    elif isinstance(node, list):
        for x in node: build_lex(x)

def is_taught_lang(s):
    t = toks(s)
    if not t: return True
    hr = sum(x in HR_STOP for x in t); en = sum(x in EN_STOP for x in t)
    if len(t) >= 3:
        if hr or en: return hr > en
        return sum(x in LEX for x in t) / len(t) >= 0.6
    if HR_DIAC.search(s): return True
    return all(x in LEX for x in t) and not any(x in EN_STOP for x in t)

def looks_target(s):
    t = toks(s)
    de = sum(x in DE_STOP for x in t) + len(re.findall(r'[äöüßÄÖÜ]', s))
    en = sum(x in EN_STOP for x in t)
    return de >= 1 and de > en

def needs_translation(s, gloss):
    if not s.strip() or not re.search(r'[A-Za-z]', s): return False
    if looks_target(s): return False
    if gloss: return True  # glosses are English by construction in this tree
    return not is_taught_lang(s)

# ---------- options that are learner-language (graded via correctAnswer)
OPT_Q = re.compile(r'\bmean(s|ing)?\b|translat', re.I)
OPT_NOT = re.compile(r'\b(in|into) ' + TAUGHT + r'\b|' + TAUGHT + r' (word|for|translation|phrase)', re.I)
def opt_is_taught(o):
    t = toks(o)
    return bool(HR_DIAC.search(o)) or (bool(t) and all(x in LEX for x in t) and not any(x in EN_STOP for x in t))

def options_learner_lang(q, opts, correct):
    """Options are in the learner's language when none of them is Croatian, the question
    itself is not Croatian, and the graded answer is one of them (so it can follow)."""
    if not opts or not all(isinstance(o, str) for o in opts): return False
    if not any(re.search(r'[A-Za-z]', o) for o in opts): return False
    if q and is_taught_lang(q): return False
    if q and OPT_NOT.search(q) and not re.search(r'\bEnglish\b', q) and not OPT_Q.search(q): return False
    if any(opt_is_taught(o) for o in opts): return False
    return correct is None or correct in opts

def retarget_prompt(q):
    q = re.sub(r'\bin English\b', 'in ' + TARGET, q)
    return re.sub(r'\bEnglish (translation|word|meaning|equivalent)\b', TARGET + r' \1', q)

# ---------- collect
def collect(lesson, baseline=None):
    """-> list of dict(path, src, send, kind, ctx). With a baseline (the pre-fill origin/main
    lesson), only strings still byte-equal to the baseline are candidates -> resumable."""
    out = []
    def unchanged(path, s):
        if baseline is None: return True
        try: return get_at(baseline, path) == s
        except (KeyError, IndexError, TypeError): return False
    def add(path, s, kind, ctx=None, send=None):
        if unchanged(path, s) and needs_translation(s, kind == 'gloss'):
            key = next((k for k in reversed(path) if isinstance(k, str)), '')
            out.append(dict(path=path, src=s, send=send or s, kind=kind, ctx=ctx, key=key))
    def walk(n, path, parentkey, inherited_ctx=None):
        if isinstance(n, list):
            for i, x in enumerate(n): walk(x, path + [i], parentkey, inherited_ctx)
            return
        if not isinstance(n, dict): return
        q = n.get('prompt') if isinstance(n.get('prompt'), str) else n.get('question') if isinstance(n.get('question'), str) else None
        opts = n.get('options')
        learner_opts = isinstance(opts, list) and options_learner_lang(q, opts, n.get('correctAnswer'))
        word_ctx = None
        tl = n.get('targetLocale')
        if isinstance(tl, dict) and isinstance(tl.get('text'), str): word_ctx = tl['text']
        elif isinstance(n.get('word'), str): word_ctx = n['word']
        elif isinstance(n.get('text'), str): word_ctx = n['text']
        word_ctx = word_ctx or inherited_ctx
        for k, v in n.items():
            p = path + [k]
            if k in SKIP_SUBTREES: continue
            if k == 'name' and parentkey == 'progressiveStages' and isinstance(v, str):
                add(p, v, 'prose'); continue
            if k in PRESERVED: continue
            if k == 'options' and isinstance(v, list):
                if learner_opts:
                    qword = re.findall(r'["\'“]([^"\'”]+)["\'”]', q or '')
                    for i, o in enumerate(v): add(p + [i], o, 'gloss', ctx=(qword[0] if qword else None))
                else:
                    for i, o in enumerate(v):
                        if isinstance(o, dict): walk(o, p + [i], 'options')
                continue
            if k in ('prompt', 'question', 'explanation') and isinstance(v, str) and learner_opts:
                add(p, v, 'prose', send=retarget_prompt(v)); continue
            if isinstance(v, str):
                if k in GLOSS_KEYS: add(p, v, 'gloss', ctx=word_ctx)
                elif k in PROSE_KEYS: add(p, v, 'prose')
                continue
            if isinstance(v, list) and k in PROSE_KEYS and all(isinstance(x, str) for x in v):
                for i, x in enumerate(v): add(p + [i], x, 'prose')
                continue
            walk(v, p, k, word_ctx if k == 'learnerLocale' else None)
    walk(lesson, [], None)
    return out

def get_at(doc, path):
    for k in path: doc = doc[k]
    return doc
def set_at(doc, path, v):
    for k in path[:-1]: doc = doc[k]
    doc[path[-1]] = v

# ---------- model calls
USAGE = {'minimax': [0, 0, 0], 'glm': [0, 0, 0], 'backoffs': 0}  # in, out, calls
LOCK = threading.Lock()

def http(url, body, headers, timeout=180):
    for wait in (5, 15, 30, 60, None):
        req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                     headers={'content-type': 'application/json', **headers})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 529) and wait:
                with LOCK: USAGE.setdefault('backoffs', 0); USAGE['backoffs'] += 1
                time.sleep(wait); continue
            raise

def extract_json(text):
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.S)
    m = re.search(r'\{.*\}', text, re.S)
    return json.loads(m.group(0))

def call_minimax(prompt):
    d = http('https://api.minimax.io/anthropic/v1/messages',
             {'model': 'MiniMax-M3', 'max_tokens': 8192, 'temperature': 0.2,
              'messages': [{'role': 'user', 'content': prompt}]},
             {'x-api-key': os.environ['MINIMAX_API_KEY'], 'anthropic-version': '2023-06-01'})
    u = d.get('usage', {})
    with LOCK:
        USAGE['minimax'][0] += u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0)
        USAGE['minimax'][1] += u.get('output_tokens', 0); USAGE['minimax'][2] += 1
    return extract_json(''.join(c.get('text', '') for c in d['content'] if c.get('type') == 'text'))

def call_glm(prompt):
    # thinking:{type:disabled} is rejected by glm-5.3-flash ("always engages in thinking") -> low effort
    d = http('https://api.z.ai/api/paas/v4/chat/completions',
             {'model': 'glm-5.3-flash', 'max_tokens': 12000, 'reasoning_effort': 'low',
              'messages': [{'role': 'user', 'content': prompt}]},
             {'authorization': 'Bearer ' + os.environ['GLM_API_KEY']})
    u = d.get('usage', {})
    with LOCK:
        USAGE['glm'][0] += u.get('prompt_tokens', 0); USAGE['glm'][1] += u.get('completion_tokens', 0); USAGE['glm'][2] += 1
    return extract_json(d['choices'][0]['message']['content'])

def build_prompt(items):
    payload = {}
    for i, it in enumerate(items):
        if it['kind'] == 'gloss':
            payload[str(i)] = {'en': it['send'], **({'hr': it['ctx']} if it['ctx'] else {})}
        elif it['key'] == 'role':
            payload[str(i)] = {'speaker_role_label': it['send']}
        else:
            payload[str(i)] = it['send']
    return '\n'.join([
        f'You are translating an English-medium course that teaches {TAUGHT} into {TARGET}, for adult {TARGET}-speaking learners.',
        f'Translate every entry from English into natural, correct {TARGET}.',
        '',
        'Rules:',
        f'- ALL English text must become {TARGET}, including English words inside quotes. Example: "What is the {TAUGHT} word for \'one\'?" -> "Was ist das kroatische Wort für ‚eins‘?" and "\'pet\' means \'five\'" -> "‚pet‘ bedeutet ‚fünf‘".',
        f'- {TAUGHT} words and phrases (e.g. hvala, Dobar dan, žao mi je) stay exactly as written, never translated.',
        '- Only exception: English example words that illustrate English spelling or pronunciation (e.g. "\'c\' in \'cat\'", "as in \'father\'") stay English.',
        '- Pronunciation respellings in parentheses such as (DOH-bar DAHN) stay exactly as written. Curly placeholders like {name} stay unchanged. Bracketed English placeholders like [Your Name] are translated ([dein Name] / [Ihr Name]).',
        f'- Entries shaped {{"en": ..., "hr": ...}} are glosses: "hr" is the {TAUGHT} word or sentence being taught (context only, NEVER return it); return the {TARGET} translation of "en" in the sense that fits "hr". Keep it as short as the English, same form and punctuation style.',
        f'- Formality: instructions addressed to the learner use "du". Translations of {TAUGHT} sentences mirror the {TAUGHT} formality: vi / ste / Vaše / Vas (formal) -> Sie / Ihnen / Ihr; ti / tvoj -> du / dein.',
        '- Entries shaped {"speaker_role_label": ...} are role labels of dialogue speakers (e.g. Local -> Einheimische(r), Learner -> Lernende(r), Waiter -> Kellner(in)). Return just the label.',
        f'- Translate faithfully; do not adapt content. If the text compares {TAUGHT} with English (e.g. "just like English"), keep the comparison to English.',
        f'- If an entry is not English at all (e.g. already {TAUGHT}), return it unchanged.',
        '- Return ONLY a JSON object {"0": "...", "1": "..."} mapping every input id to a plain string. No commentary.',
        '',
        json.dumps(payload, ensure_ascii=False, indent=1),
    ])

QUOTED = re.compile(r'["\'“‘„‚]([^"\'”’“‘]{1,60})["\'”’“‘]')
PRON = re.compile(r'\(([A-Z][A-Za-z]*-[A-Za-z-]+(?:\s[A-Za-z-]+)*!?)\)')
PH = re.compile(r'\{[a-zA-Z_]+\}')

def validate(it, out):
    if not isinstance(out, str) or not out.strip(): return 'empty'
    src = it['src']
    if sorted(PH.findall(src)) != sorted(PH.findall(out)): return 'placeholder'
    for seg in PRON.findall(src):
        if seg not in out: return f'pronunciation lost: {seg}'
    for seg in QUOTED.findall(src):
        if (HR_DIAC.search(seg) or (toks(seg) and all(t in LEX for t in toks(seg)))) and not any(t in EN_STOP for t in toks(seg)):
            if seg.lower() not in out.lower(): return f'{TAUGHT} lost: {seg}'
    # English leak: >=2 English-only stopwords outside quotes/parens
    stripped = QUOTED.sub('', re.sub(r'\([^)]*\)', '', out))
    en_only = [t for t in toks(stripped) if t in EN_STOP and t not in DE_STOP and t not in HR_STOP
               and t not in ('a', 'an', 'am', 'was', 'will', 'so', 'die', 'me')]
    if len(en_only) >= 2: return f'english leak: {en_only[:4]}'
    t = toks(src)
    if len(t) >= 3 and out.strip().lower() == src.strip().lower(): return 'echo'
    if it['kind'] == 'gloss' and it['ctx'] and len(toks(it['ctx'])) >= 2 and out.strip().lower() == it['ctx'].strip().lower() \
            and src.strip().lower() != it['ctx'].strip().lower():
        return 'returned the taught-language context instead of a gloss'
    if it['key'] in ('prompt', 'question', 'explanation', 'hint'):
        for seg in QUOTED.findall(src):
            st = toks(seg)
            if st and not HR_DIAC.search(seg) and all(x in EN_DICT for x in st) and not all(x in LEX for x in st) and re.search(r'[A-Za-z]{2}', seg):
                if re.search(r'["\'“‘„‚]' + re.escape(seg) + r'["\'”’“‘]', out) and seg.lower() not in COGNATES:
                    return f'quoted English kept: {seg}'
    return None

EN_DICT = set(w.strip().lower() for w in open('/usr/share/dict/words')) | EN_STOP | {'thanks','sorry','hi','ok'}
COGNATES = set('taxi hotel radio name park bus auto pizza restaurant film kino tennis golf sport ok hallo'.split())

def translate_items(items, stats):
    """Translate with MiniMax-M3; per-string retry; GLM fallback. Returns {idx: str}; leftovers get None."""
    result = {}
    pending = list(range(len(items)))
    for attempt, caller in enumerate([call_minimax, call_minimax, call_glm]):
        if not pending: break
        batch = [items[i] for i in pending]
        try:
            parsed = caller(build_prompt(batch))
        except Exception as e:
            stats['errors'].append(f'{caller.__name__}: {type(e).__name__} {str(e)[:120]}')
            continue
        still = []
        for j, i in enumerate(pending):
            out = parsed.get(str(j))
            if isinstance(out, dict):
                out = next((v for k, v in out.items() if k != 'hr' and isinstance(v, str)), None)
            err = validate(items[i], out)
            if err: still.append(i); stats['val_fail'].append((items[i]['src'][:80], str(out)[:80], err, caller.__name__))
            else:
                result[i] = out.strip()
                if caller is call_glm: stats['glm_used'] += 1
        # batch-level echo guard (MiniMax intermittently echoes a whole batch)
        done = [i for i in pending if i in result]
        echo = sum(1 for i in done if result[i].lower() == items[i]['src'].lower() and re.search('[a-z]', items[i]['src']))
        if len(done) >= 4 and echo / len(done) > 0.6:
            stats['val_fail'].append(('<batch>', f'{echo}/{len(done)} echoed', 'batch echo', caller.__name__))
            for i in done: del result[i]
            still = pending
        pending = still
    for i in pending: result[i] = None
    return result

# ---------- per file
def process(rel, stats):
    src_path = os.path.join(ROOT, 'languages', LANG, 'data', LOCALE, 'lessons', rel)
    raw = open(src_path, encoding='utf-8').read()
    doc = json.loads(raw)
    lesson = doc['lessons'][0]
    import subprocess
    relpath = os.path.relpath(src_path, ROOT)
    base_raw = subprocess.run(['git', '-C', ROOT, 'show', f'origin/main:{relpath}'], capture_output=True, text=True).stdout
    baseline = json.loads(base_raw)['lessons'][0] if base_raw else None
    items = collect(lesson, baseline)
    if not items: return rel, 0, 0, None
    if DRY: return rel, len(items), 0, None
    # dedupe identical (send, kind, ctx) within file
    keyed = {}
    for it in items: keyed.setdefault((it['send'], it['kind'], it['ctx']), it)
    uniq = list(keyed.values())
    res = {}
    for s in range(0, len(uniq), 40):
        chunk = uniq[s:s + 40]
        r = translate_items(chunk, stats)
        for j, it in enumerate(chunk): res[(it['send'], it['kind'], it['ctx'])] = r[j]
    new = copy.deepcopy(doc); nl = new['lessons'][0]
    filled = 0; left = []
    changed_paths = set()
    for it in items:
        out = res[(it['send'], it['kind'], it['ctx'])]
        if out is None: left.append('/'.join(map(str, it['path']))); continue
        set_at(nl, it['path'], out); filled += 1; changed_paths.add(tuple(it['path']))
    # keep graded answers consistent with translated options
    def fix_answers(n, path):
        if isinstance(n, list):
            for i, x in enumerate(n): fix_answers(x, path + [i])
        elif isinstance(n, dict):
            if isinstance(n.get('options'), list) and isinstance(n.get('correctAnswer'), str):
                old_opts = get_at(lesson, path + ['options'])
                if n['options'] != old_opts and n['correctAnswer'] in old_opts:
                    n['correctAnswer'] = n['options'][old_opts.index(n['correctAnswer'])]
                    changed_paths.add(tuple(path + ['correctAnswer']))
            for k, v in n.items(): fix_answers(v, path + [k])
    fix_answers(nl, [])
    # structural guard: every leaf not in changed_paths must be identical
    def leaves(n, path=()):
        if isinstance(n, dict):
            for k, v in n.items(): yield from leaves(v, path + (k,))
        elif isinstance(n, list):
            for i, v in enumerate(n): yield from leaves(v, path + (i,))
        else: yield path, n
    a = dict(leaves(lesson)); b = dict(leaves(nl))
    if a.keys() != b.keys(): return rel, len(items), 0, 'REJECT structure changed'
    bad = [p for p in a if a[p] != b[p] and p not in changed_paths]
    if bad: return rel, len(items), 0, f'REJECT preserved changed {bad[:3]}'
    if filled == 0: return rel, len(items), 0, f'nothing filled; leftovers {len(left)}'
    # stamps
    models = 'MiniMax-M3' if not stats.get('glm_file', {}).get(rel) else 'MiniMax-M3+glm-5.3-flash'
    nl['aiDraft'] = {'generatedBy': f'{SCRIPT} (learner-locale fill en->{LOCALE})', 'generatedAt': NOW,
                     'modelVersion': 'MiniMax-M3', 'requiresReview': True, 'reviewedBy': None, 'reviewedAt': None}
    nl['releaseStage'] = 'beta'
    prev = lesson.get('translationMeta') or {}
    nl['translationMeta'] = {'from': 'en', 'to': LOCALE, 'model': 'MiniMax-M3', 'fallbackModel': 'glm-5.3-flash',
                             'date': NOW, 'scriptVersion': SCRIPT, 'filled': prev.get('filled', 0) + filled, 'leftoverEnglish': left}
    if lesson.get('aiDraft'): nl['aiDraft'] = {**lesson['aiDraft'], 'generatedAt': NOW}
    with open(src_path, 'w', encoding='utf-8') as f: f.write(json.dumps(new, indent=2, ensure_ascii=False) + ('\n' if raw.endswith('\n') else ''))
    # mirror into public
    pub = os.path.join(ROOT, 'public', 'data', 'lessons', LOCALE, LANG, 'chapters', rel)
    if os.path.exists(pub):
        praw = open(pub, encoding='utf-8').read(); pd = json.loads(praw); pl = pd['lessons'][0]
        if pl.get('content') != lesson.get('content'):
            return rel, len(items), filled, 'WARN public content differed from source; public not mirrored'
        rebuilt = {}
        for k, v in pl.items():
            if k in ('aiDraft', 'releaseStage'): continue
            if k == 'content':
                rebuilt['aiDraft'] = nl['aiDraft']; rebuilt['releaseStage'] = 'beta'
                rebuilt['content'] = nl['content']
            else: rebuilt[k] = v
        pd['lessons'][0] = rebuilt
        with open(pub, 'w', encoding='utf-8') as f: f.write(json.dumps(pd, indent=2, ensure_ascii=False) + ('\n' if praw.endswith('\n') else ''))
    return rel, len(items), filled, (f'leftover {len(left)}' if left else None)

def main():
    base = os.path.join(ROOT, 'languages', LANG, 'data', LOCALE, 'lessons')
    for f in glob.glob(os.path.join(ROOT, 'languages', LANG, 'data', '*', 'lessons', 'chapter-*', '*.json')):
        build_lex(json.load(open(f, encoding='utf-8')))
    pat = f'chapter-{CHAPTER}/*.json' if CHAPTER else 'chapter-*/*.json'
    files = sorted(os.path.relpath(p, base) for p in glob.glob(os.path.join(base, pat)))
    stats = {'errors': [], 'val_fail': [], 'glm_used': 0}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=1 if DRY else 4) as ex:
        results = list(ex.map(lambda r: process(r, stats), files))
    total_items = sum(r[1] for r in results); total_filled = sum(r[2] for r in results)
    for r in results: print(f'  {r[0]:55} candidates={r[1]:4} filled={r[2]:4} {r[3] or ""}')
    mm = USAGE['minimax']; gl = USAGE['glm']
    cost = mm[0] / 1e6 * 0.20 + mm[1] / 1e6 * 0.80
    report = {'app': os.path.basename(ROOT.rstrip('/')), 'lang': LANG, 'locale': LOCALE, 'chapter': CHAPTER,
              'dryRun': DRY, 'files': len(files), 'candidates': total_items, 'filled': total_filled,
              'seconds': round(time.time() - t0), 'usage': USAGE, 'minimaxListCostUSD': round(cost, 4),
              'glmStringsUsed': stats['glm_used'], 'errors': stats['errors'], 'validationFailures': stats['val_fail'],
              'files_detail': results}
    out = os.path.join(os.path.dirname(__file__), f'report-{LANG}-{LOCALE}-{CHAPTER or "all"}{"-dry" if DRY else ""}.json')
    json.dump(report, open(out, 'w'), ensure_ascii=False, indent=1)
    print(f'\nfiles {len(files)} candidates {total_items} filled {total_filled} | minimax calls {mm[2]} in {mm[0]} out {mm[1]} (list ${cost:.4f}) | glm calls {gl[2]} strings {stats["glm_used"]} | val-fails {len(stats["val_fail"])} errors {len(stats["errors"])} | {report["seconds"]}s\nreport: {out}')

main()
