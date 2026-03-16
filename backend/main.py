from datetime import datetime
from pathlib import Path
import random
import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = Path(__file__).resolve().parent / 'galaxy.db'
app = FastAPI(title='Galaxy Discovery API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db_conn()
    cur = conn.cursor()
    cur.executescript(
        '''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT,
            email TEXT,
            is_anonymous INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS stars (
            id TEXT PRIMARY KEY,
            x REAL NOT NULL,
            y REAL NOT NULL,
            brightness REAL NOT NULL,
            temperature INTEGER NOT NULL,
            radius REAL NOT NULL,
            has_planet INTEGER NOT NULL,
            period REAL,
            depth REAL NOT NULL,
            signal_strength INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS classifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            star_id TEXT NOT NULL,
            verdict TEXT NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(user_id, star_id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(star_id) REFERENCES stars(id)
        );

        CREATE TABLE IF NOT EXISTS discoveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            star_id TEXT NOT NULL UNIQUE,
            reason TEXT NOT NULL,
            confirmed_at TEXT NOT NULL,
            FOREIGN KEY(star_id) REFERENCES stars(id)
        );

        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        '''
    )

    star_count = cur.execute('SELECT COUNT(*) as c FROM stars').fetchone()['c']
    if star_count == 0:
        for i in range(100):
            sid = f'GD-{i+1:03d}'
            has_planet = 1 if (i % 17 == 0 or i % 29 == 0 or i % 31 == 0 or i % 43 == 0) else 0
            period = [3.8, 5.9, 7.4, 9.8][i % 4] if has_planet else None
            depth = [0.018, 0.026, 0.033, 0.041][i % 4] if has_planet else 0.002
            cur.execute(
                '''INSERT INTO stars (id, x, y, brightness, temperature, radius, has_planet, period, depth, signal_strength)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (
                    sid,
                    6 + ((i * 37) % 88),
                    8 + ((i * 19) % 82),
                    round(10.4 + (i % 18) * 0.18, 1),
                    4800 + (i % 9) * 180,
                    round(0.8 + (i % 7) * 0.12, 2),
                    has_planet,
                    period,
                    depth,
                    [72, 81, 88, 93][i % 4] if has_planet else [14, 21, 27, 33][i % 4],
                ),
            )
    conn.commit()
    conn.close()


@app.on_event('startup')
def startup_event():
    init_db()


class LoginPayload(BaseModel):
    nickname: str | None = None
    email: str | None = None


class ClassificationPayload(BaseModel):
    userId: int
    starId: str
    verdict: str
    notes: str | None = ''


class ReportPayload(BaseModel):
    userId: int


@app.post('/api/auth/anonymous')
def auth_anonymous():
    conn = db_conn()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    cur.execute('INSERT INTO users (nickname, email, is_anonymous, created_at) VALUES (?, ?, ?, ?)', ('匿名探索者', None, 1, now))
    uid = cur.lastrowid
    conn.commit()
    conn.close()
    return {'user': {'id': uid, 'nickname': f'匿名探索者#{uid}', 'isAnonymous': True}}


@app.post('/api/auth/login')
def auth_login(payload: LoginPayload):
    if not payload.nickname and not payload.email:
        raise HTTPException(status_code=400, detail='nickname or email is required')
    conn = db_conn()
    cur = conn.cursor()
    if payload.email:
        row = cur.execute('SELECT * FROM users WHERE email = ?', (payload.email,)).fetchone()
    else:
        row = cur.execute('SELECT * FROM users WHERE nickname = ?', (payload.nickname,)).fetchone()
    if row:
        conn.close()
        return {'user': {'id': row['id'], 'nickname': row['nickname'], 'email': row['email'], 'isAnonymous': bool(row['is_anonymous'])}}

    now = datetime.utcnow().isoformat()
    cur.execute(
        'INSERT INTO users (nickname, email, is_anonymous, created_at) VALUES (?, ?, ?, ?)',
        (payload.nickname or payload.email.split('@')[0], payload.email, 0, now),
    )
    uid = cur.lastrowid
    conn.commit()
    conn.close()
    return {'user': {'id': uid, 'nickname': payload.nickname or payload.email.split('@')[0], 'email': payload.email, 'isAnonymous': False}}


@app.get('/api/stars')
def get_stars():
    conn = db_conn()
    cur = conn.cursor()
    rows = cur.execute('SELECT * FROM stars ORDER BY id').fetchall()
    stars = []
    for row in rows:
        candidate_users = cur.execute(
            "SELECT COUNT(DISTINCT user_id) as c FROM classifications WHERE star_id = ? AND verdict = 'candidate'",
            (row['id'],),
        ).fetchone()['c']
        discovery = cur.execute('SELECT id FROM discoveries WHERE star_id = ?', (row['id'],)).fetchone()
        user_class = cur.execute(
            "SELECT verdict, notes FROM classifications WHERE star_id = ? ORDER BY created_at DESC LIMIT 1",
            (row['id'],),
        ).fetchone()
        stars.append(
            {
                'id': row['id'],
                'x': row['x'],
                'y': row['y'],
                'brightness': row['brightness'],
                'temperature': row['temperature'],
                'radius': row['radius'],
                'signalStrength': row['signal_strength'],
                'candidateUsers': candidate_users,
                'discoveryConfirmed': discovery is not None,
                'userClassification': user_class['verdict'] if user_class else None,
                'userNote': user_class['notes'] if user_class else '',
            }
        )
    conn.close()
    return {'stars': stars}


@app.get('/api/stars/{star_id}/light-curve')
def get_light_curve(star_id: str):
    conn = db_conn()
    row = conn.execute('SELECT * FROM stars WHERE id = ?', (star_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail='star not found')

    points = []
    for i in range(72):
        t = round(i * 0.45, 2)
        flux = 1 + 0.003 * random.uniform(-1, 1)
        if row['has_planet'] and row['period']:
            phase = t % row['period']
            if phase < 0.72:
                flux -= row['depth']
        else:
            flux += 0.003 * random.uniform(-1, 1)
        points.append({'t': t, 'flux': round(flux, 5)})
    return {'starId': star_id, 'points': points}


@app.post('/api/classifications')
def submit_classification(payload: ClassificationPayload):
    conn = db_conn()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    cur.execute(
        '''INSERT INTO classifications (user_id, star_id, verdict, notes, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id, star_id)
           DO UPDATE SET verdict = excluded.verdict, notes = excluded.notes, created_at = excluded.created_at''',
        (payload.userId, payload.starId, payload.verdict, payload.notes, now),
    )

    if payload.verdict == 'candidate':
        count_row = cur.execute(
            "SELECT COUNT(DISTINCT user_id) as c FROM classifications WHERE star_id = ? AND verdict = 'candidate'",
            (payload.starId,),
        ).fetchone()
        if count_row['c'] >= 3:
            cur.execute(
                '''INSERT INTO discoveries (star_id, reason, confirmed_at)
                   VALUES (?, ?, ?)
                   ON CONFLICT(star_id) DO NOTHING''',
                (payload.starId, '3个不同用户标记为可能存在行星', now),
            )

    conn.commit()
    conn.close()
    return {'ok': True}


@app.get('/api/stars/{star_id}/validation')
def get_validation(star_id: str):
    conn = db_conn()
    cur = conn.cursor()
    count_row = cur.execute(
        "SELECT COUNT(DISTINCT user_id) as c FROM classifications WHERE star_id = ? AND verdict = 'candidate'",
        (star_id,),
    ).fetchone()
    discovery = cur.execute('SELECT * FROM discoveries WHERE star_id = ?', (star_id,)).fetchone()
    conn.close()
    return {
        'star': {
            'id': star_id,
            'candidateUsers': count_row['c'],
            'discoveryConfirmed': discovery is not None,
            'discoveryReason': discovery['reason'] if discovery else None,
        }
    }


@app.post('/api/reports')
def generate_report(payload: ReportPayload):
    conn = db_conn()
    cur = conn.cursor()
    candidate_count = cur.execute(
        "SELECT COUNT(*) as c FROM classifications WHERE user_id = ? AND verdict = 'candidate'",
        (payload.userId,),
    ).fetchone()['c']
    explored_count = cur.execute(
        'SELECT COUNT(*) as c FROM classifications WHERE user_id = ?',
        (payload.userId,),
    ).fetchone()['c']
    collaborative_count = cur.execute(
        '''SELECT COUNT(*) as c FROM discoveries d
           JOIN classifications c ON d.star_id = c.star_id
           WHERE c.user_id = ? AND c.verdict = 'candidate' ''',
        (payload.userId,),
    ).fetchone()['c']

    now = datetime.utcnow().isoformat()
    title = f'Galaxy Discovery 报告 {now[:10]}'
    content = (
        f'本次探索共分析 {explored_count} 颗恒星，标记 {candidate_count} 个候选目标，'
        f'其中 {collaborative_count} 个进入协作发现。建议下一步继续复核高信号强度目标。'
    )
    cur.execute('INSERT INTO reports (user_id, title, content, created_at) VALUES (?, ?, ?, ?)', (payload.userId, title, content, now))
    report_id = cur.lastrowid
    conn.commit()
    conn.close()
    return {'report': {'id': report_id, 'title': title, 'content': content, 'createdAt': now}}


@app.get('/api/reports')
def get_reports(userId: int):
    conn = db_conn()
    rows = conn.execute('SELECT * FROM reports WHERE user_id = ? ORDER BY id DESC', (userId,)).fetchall()
    conn.close()
    return {'reports': [dict(r) for r in rows]}
