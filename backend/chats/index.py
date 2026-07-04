import json
import os
from datetime import datetime

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
        'body': json.dumps(body, default=str),
    }


def _db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def _auth_user(cur, headers):
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    if not token:
        return None
    cur.execute(
        "SELECT user_id FROM sessions WHERE token=%s AND expires_at > %s",
        (token, datetime.utcnow()),
    )
    row = cur.fetchone()
    return row[0] if row else None


def handler(event: dict, context) -> dict:
    '''Чаты и сообщения Кенко: список диалогов, история сообщений, отправка, создание чата.'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return _resp(200, {})

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    headers = event.get('headers') or {}

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except (ValueError, TypeError):
            body = {}

    conn = _db()
    conn.autocommit = True
    cur = conn.cursor()

    try:
        user_id = _auth_user(cur, headers)
        if not user_id:
            return _resp(401, {'error': 'Не авторизован'})

        if action == 'list' and method == 'GET':
            cur.execute(
                """
                SELECT c.id, c.type, c.name, c.avatar_url,
                       m.id, m.text, m.type, m.created_at, m.sender_id,
                       cp.last_read_message_id
                FROM chats c
                JOIN chat_participants cp ON cp.chat_id = c.id AND cp.user_id = %s
                LEFT JOIN LATERAL (
                    SELECT id, text, type, created_at, sender_id
                    FROM messages WHERE chat_id = c.id
                    ORDER BY id DESC LIMIT 1
                ) m ON TRUE
                ORDER BY COALESCE(m.created_at, c.created_at) DESC
                """,
                (user_id,),
            )
            rows = cur.fetchall()
            chats = []
            for r in rows:
                chat_id = r[0]
                unread = 0
                cur.execute(
                    "SELECT COUNT(*) FROM messages WHERE chat_id=%s AND id > %s AND sender_id != %s",
                    (chat_id, r[9] or 0, user_id),
                )
                unread = cur.fetchone()[0]

                other_name, other_avatar = r[2], r[3]
                if r[1] == 'private':
                    cur.execute(
                        """
                        SELECT u.name, u.avatar_url, u.phone, u.status FROM users u
                        JOIN chat_participants cp ON cp.user_id = u.id
                        WHERE cp.chat_id=%s AND u.id != %s LIMIT 1
                        """,
                        (chat_id, user_id),
                    )
                    other = cur.fetchone()
                    if other:
                        other_name = other[0] or other[2]
                        other_avatar = other[1]

                chats.append({
                    'id': chat_id,
                    'type': r[1],
                    'name': other_name,
                    'avatar_url': other_avatar,
                    'last_message': r[5],
                    'last_type': r[6],
                    'last_time': r[7],
                    'last_sender_id': r[8],
                    'unread': unread,
                })
            return _resp(200, {'chats': chats})

        if action == 'messages' and method == 'GET':
            chat_id = params.get('chat_id')
            after_id = int(params.get('after_id', 0))
            cur.execute(
                "SELECT 1 FROM chat_participants WHERE chat_id=%s AND user_id=%s",
                (chat_id, user_id),
            )
            if not cur.fetchone():
                return _resp(403, {'error': 'Нет доступа к чату'})

            cur.execute(
                """
                SELECT m.id, m.sender_id, m.text, m.type, m.media_url, m.created_at, u.name
                FROM messages m JOIN users u ON u.id = m.sender_id
                WHERE m.chat_id=%s AND m.id > %s ORDER BY m.id ASC LIMIT 200
                """,
                (chat_id, after_id),
            )
            msgs = [{
                'id': m[0], 'sender_id': m[1], 'text': m[2], 'type': m[3],
                'media_url': m[4], 'created_at': m[5], 'sender_name': m[6],
            } for m in cur.fetchall()]

            cur.execute(
                "UPDATE chat_participants SET last_read_message_id = "
                "GREATEST(last_read_message_id, (SELECT COALESCE(MAX(id),0) FROM messages WHERE chat_id=%s)) "
                "WHERE chat_id=%s AND user_id=%s",
                (chat_id, chat_id, user_id),
            )
            return _resp(200, {'messages': msgs})

        if action == 'send' and method == 'POST':
            chat_id = body.get('chat_id')
            text = (body.get('text') or '').strip()
            msg_type = body.get('type', 'text')
            media_url = body.get('media_url')
            if not text and not media_url:
                return _resp(400, {'error': 'Пустое сообщение'})

            cur.execute(
                "SELECT 1 FROM chat_participants WHERE chat_id=%s AND user_id=%s",
                (chat_id, user_id),
            )
            if not cur.fetchone():
                return _resp(403, {'error': 'Нет доступа к чату'})

            cur.execute(
                "INSERT INTO messages (chat_id, sender_id, text, type, media_url) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at",
                (chat_id, user_id, text, msg_type, media_url),
            )
            new_id, created_at = cur.fetchone()
            return _resp(200, {'ok': True, 'id': new_id, 'created_at': created_at})

        if action == 'create_private' and method == 'POST':
            other_phone = body.get('phone', '').strip()
            cur.execute("SELECT id FROM users WHERE phone=%s", (other_phone,))
            other = cur.fetchone()
            if not other:
                return _resp(404, {'error': 'Пользователь не найден'})
            other_id = other[0]
            if other_id == user_id:
                return _resp(400, {'error': 'Нельзя создать чат с самим собой'})

            cur.execute(
                """
                SELECT cp1.chat_id FROM chat_participants cp1
                JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
                JOIN chats c ON c.id = cp1.chat_id
                WHERE cp1.user_id=%s AND cp2.user_id=%s AND c.type='private'
                """,
                (user_id, other_id),
            )
            existing = cur.fetchone()
            if existing:
                return _resp(200, {'chat_id': existing[0], 'existing': True})

            cur.execute(
                "INSERT INTO chats (type, created_by) VALUES ('private', %s) RETURNING id",
                (user_id,),
            )
            chat_id = cur.fetchone()[0]
            cur.execute(
                "INSERT INTO chat_participants (chat_id, user_id) VALUES (%s,%s), (%s,%s)",
                (chat_id, user_id, chat_id, other_id),
            )
            return _resp(200, {'chat_id': chat_id, 'existing': False})

        if action == 'create_group' and method == 'POST':
            name = (body.get('name') or '').strip()
            phones = body.get('phones') or []
            if not name:
                return _resp(400, {'error': 'Укажите название группы'})

            cur.execute(
                "INSERT INTO chats (type, name, created_by) VALUES ('group', %s, %s) RETURNING id",
                (name, user_id),
            )
            chat_id = cur.fetchone()[0]
            cur.execute(
                "INSERT INTO chat_participants (chat_id, user_id, is_admin) VALUES (%s,%s,TRUE)",
                (chat_id, user_id),
            )
            for phone in phones:
                cur.execute("SELECT id FROM users WHERE phone=%s", (phone,))
                u = cur.fetchone()
                if u:
                    cur.execute(
                        "INSERT INTO chat_participants (chat_id, user_id) VALUES (%s,%s) "
                        "ON CONFLICT DO NOTHING",
                        (chat_id, u[0]),
                    )
            return _resp(200, {'chat_id': chat_id})

        return _resp(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()
