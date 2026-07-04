import json
import os
import random
import secrets
from datetime import datetime, timedelta

import psycopg2


def _resp(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
        },
        'isBase64Encoded': False,
        'body': json.dumps(body),
    }


def _db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def _normalize_phone(phone):
    digits = ''.join(ch for ch in str(phone) if ch.isdigit())
    if digits.startswith('8') and len(digits) == 11:
        digits = '7' + digits[1:]
    return '+' + digits


def handler(event: dict, context) -> dict:
    '''Авторизация в Кенко: отправка SMS-кода, проверка, профиль, сессии, выход.'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return _resp(200, {})

    action = (event.get('queryStringParameters') or {}).get('action', '')
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except (ValueError, TypeError):
            body = {}

    headers = event.get('headers') or {}
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')

    conn = _db()
    conn.autocommit = True
    cur = conn.cursor()

    try:
        if action == 'send_code':
            phone = _normalize_phone(body.get('phone', ''))
            if len(phone) < 11:
                return _resp(400, {'error': 'Некорректный номер телефона'})
            code = f'{random.randint(0, 999999):06d}'
            expires = datetime.utcnow() + timedelta(minutes=5)
            cur.execute(
                "INSERT INTO auth_codes (phone, code, expires_at) VALUES (%s, %s, %s)",
                (phone, code, expires),
            )
            # В демо-режиме код возвращается в ответе. Для реальной SMS подключается провайдер.
            return _resp(200, {'ok': True, 'phone': phone, 'demo_code': code})

        if action == 'verify_code':
            phone = _normalize_phone(body.get('phone', ''))
            code = str(body.get('code', '')).strip()
            cur.execute(
                "SELECT id FROM auth_codes WHERE phone=%s AND code=%s AND used=FALSE "
                "AND expires_at > %s ORDER BY id DESC LIMIT 1",
                (phone, code, datetime.utcnow()),
            )
            row = cur.fetchone()
            if not row:
                return _resp(400, {'error': 'Неверный или устаревший код'})
            cur.execute("UPDATE auth_codes SET used=TRUE WHERE id=%s", (row[0],))

            cur.execute(
                "SELECT id, phone, name, status, avatar_url FROM users WHERE phone=%s",
                (phone,),
            )
            user = cur.fetchone()
            is_new = False
            if not user:
                cur.execute(
                    "INSERT INTO users (phone) VALUES (%s) RETURNING id, phone, name, status, avatar_url",
                    (phone,),
                )
                user = cur.fetchone()
                is_new = True

            sess_token = secrets.token_hex(32)
            sess_exp = datetime.utcnow() + timedelta(days=90)
            cur.execute(
                "INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, %s)",
                (user[0], sess_token, sess_exp),
            )
            return _resp(200, {
                'ok': True,
                'token': sess_token,
                'is_new': is_new or not user[2],
                'user': {
                    'id': user[0], 'phone': user[1], 'name': user[2],
                    'status': user[3], 'avatar_url': user[4],
                },
            })

        # actions below require a valid session
        user_id = None
        if token:
            cur.execute(
                "SELECT user_id FROM sessions WHERE token=%s AND expires_at > %s",
                (token, datetime.utcnow()),
            )
            r = cur.fetchone()
            user_id = r[0] if r else None

        if action == 'me':
            if not user_id:
                return _resp(401, {'error': 'Не авторизован'})
            cur.execute(
                "SELECT id, phone, name, status, avatar_url FROM users WHERE id=%s",
                (user_id,),
            )
            u = cur.fetchone()
            return _resp(200, {'user': {
                'id': u[0], 'phone': u[1], 'name': u[2], 'status': u[3], 'avatar_url': u[4],
            }})

        if action == 'update_profile':
            if not user_id:
                return _resp(401, {'error': 'Не авторизован'})
            name = (body.get('name') or '').strip()
            status = (body.get('status') or 'в сети').strip()
            avatar = body.get('avatar_url')
            if not name:
                return _resp(400, {'error': 'Укажите имя'})
            cur.execute(
                "UPDATE users SET name=%s, status=%s, avatar_url=COALESCE(%s, avatar_url) WHERE id=%s "
                "RETURNING id, phone, name, status, avatar_url",
                (name, status, avatar, user_id),
            )
            u = cur.fetchone()
            return _resp(200, {'ok': True, 'user': {
                'id': u[0], 'phone': u[1], 'name': u[2], 'status': u[3], 'avatar_url': u[4],
            }})

        if action == 'logout':
            if token:
                cur.execute("UPDATE sessions SET expires_at=%s WHERE token=%s",
                            (datetime.utcnow(), token))
            return _resp(200, {'ok': True})

        return _resp(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()
