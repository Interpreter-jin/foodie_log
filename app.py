from flask import Flask, render_template, request, jsonify, redirect, url_for
import firebase_admin
from firebase_admin import credentials, firestore, auth, storage
import os
import uuid
from datetime import datetime
import base64

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'foodie-secret-key-2024')

# Firebase init
cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred, {
    'storageBucket': os.environ.get('FIREBASE_STORAGE_BUCKET', '')
})
db = firestore.client()

# ── Pages ──────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/feed')
def feed():
    return render_template('feed.html')

@app.route('/post/<post_id>')
def post_detail(post_id):
    return render_template('post_detail.html', post_id=post_id)

@app.route('/write')
def write():
    return render_template('write.html')

@app.route('/profile')
def profile():
    return render_template('profile.html')

# ── API: Auth ──────────────────────────────────────────────────────────────────

@app.route('/api/verify-token', methods=['POST'])
def verify_token():
    try:
        data = request.get_json()
        id_token = data.get('idToken')
        decoded = auth.verify_id_token(id_token)
        uid = decoded['uid']

        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            user_ref.set({
                'uid': uid,
                'email': decoded.get('email', ''),
                'displayName': decoded.get('name', decoded.get('email', '').split('@')[0]),
                'photoURL': decoded.get('picture', ''),
                'createdAt': firestore.SERVER_TIMESTAMP,
                'postCount': 0
            })

        return jsonify({'success': True, 'uid': uid})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 401

# ── API: Posts ─────────────────────────────────────────────────────────────────

@app.route('/api/posts', methods=['GET'])
def get_posts():
    try:
        category = request.args.get('category', 'all')
        limit = int(request.args.get('limit', 20))
        last_doc_id = request.args.get('lastDocId')

        query = db.collection('posts').order_by('createdAt', direction=firestore.Query.DESCENDING)

        if category != 'all':
            query = db.collection('posts')\
                .where('category', '==', category)\
                .order_by('createdAt', direction=firestore.Query.DESCENDING)

        if last_doc_id:
            last_doc = db.collection('posts').document(last_doc_id).get()
            if last_doc.exists:
                query = query.start_after(last_doc)

        docs = query.limit(limit).stream()
        posts = []
        for doc in docs:
            d = doc.to_dict()
            d['id'] = doc.id
            if d.get('createdAt'):
                d['createdAt'] = d['createdAt'].isoformat() if hasattr(d['createdAt'], 'isoformat') else str(d['createdAt'])
            posts.append(d)

        return jsonify({'success': True, 'posts': posts})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts', methods=['POST'])
def create_post():
    try:
        id_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        decoded = auth.verify_id_token(id_token)
        uid = decoded['uid']

        user_doc = db.collection('users').document(uid).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}

        data = request.get_json()
        post_id = str(uuid.uuid4())

        post = {
            'id': post_id,
            'authorUid': uid,
            'authorName': user_data.get('displayName', '익명'),
            'authorPhoto': user_data.get('photoURL', ''),
            'restaurantName': data.get('restaurantName', ''),
            'category': data.get('category', '기타'),
            'rating': int(data.get('rating', 5)),
            'menu': data.get('menu', ''),
            'location': data.get('location', ''),
            'content': data.get('content', ''),
            'imageUrls': data.get('imageUrls', []),
            'tags': data.get('tags', []),
            'likeCount': 0,
            'commentCount': 0,
            'createdAt': firestore.SERVER_TIMESTAMP
        }

        db.collection('posts').document(post_id).set(post)

        user_ref = db.collection('users').document(uid)
        user_ref.update({'postCount': firestore.Increment(1)})

        return jsonify({'success': True, 'postId': post_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts/<post_id>', methods=['GET'])
def get_post(post_id):
    try:
        doc = db.collection('posts').document(post_id).get()
        if not doc.exists:
            return jsonify({'success': False, 'error': 'Post not found'}), 404
        d = doc.to_dict()
        d['id'] = doc.id
        if d.get('createdAt'):
            d['createdAt'] = d['createdAt'].isoformat() if hasattr(d['createdAt'], 'isoformat') else str(d['createdAt'])
        return jsonify({'success': True, 'post': d})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ── API: Likes ─────────────────────────────────────────────────────────────────

@app.route('/api/posts/<post_id>/like', methods=['POST'])
def toggle_like(post_id):
    try:
        id_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        decoded = auth.verify_id_token(id_token)
        uid = decoded['uid']

        like_ref = db.collection('likes').document(f'{post_id}_{uid}')
        like_doc = like_ref.get()
        post_ref = db.collection('posts').document(post_id)

        if like_doc.exists:
            like_ref.delete()
            post_ref.update({'likeCount': firestore.Increment(-1)})
            liked = False
        else:
            like_ref.set({'postId': post_id, 'uid': uid, 'createdAt': firestore.SERVER_TIMESTAMP})
            post_ref.update({'likeCount': firestore.Increment(1)})
            liked = True

        post = post_ref.get().to_dict()
        return jsonify({'success': True, 'liked': liked, 'likeCount': post.get('likeCount', 0)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts/<post_id>/like-status', methods=['GET'])
def like_status(post_id):
    try:
        id_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        decoded = auth.verify_id_token(id_token)
        uid = decoded['uid']
        like_ref = db.collection('likes').document(f'{post_id}_{uid}')
        return jsonify({'success': True, 'liked': like_ref.get().exists})
    except:
        return jsonify({'success': True, 'liked': False})

# ── API: Comments ──────────────────────────────────────────────────────────────

@app.route('/api/posts/<post_id>/comments', methods=['GET'])
def get_comments(post_id):
    try:
        docs = db.collection('posts').document(post_id)\
            .collection('comments')\
            .order_by('createdAt').stream()
        comments = []
        for doc in docs:
            d = doc.to_dict()
            d['id'] = doc.id
            if d.get('createdAt'):
                d['createdAt'] = d['createdAt'].isoformat() if hasattr(d['createdAt'], 'isoformat') else str(d['createdAt'])
            comments.append(d)
        return jsonify({'success': True, 'comments': comments})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts/<post_id>/comments', methods=['POST'])
def add_comment(post_id):
    try:
        id_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        decoded = auth.verify_id_token(id_token)
        uid = decoded['uid']

        user_doc = db.collection('users').document(uid).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}

        data = request.get_json()
        comment_ref = db.collection('posts').document(post_id).collection('comments').document()
        comment_ref.set({
            'authorUid': uid,
            'authorName': user_data.get('displayName', '익명'),
            'authorPhoto': user_data.get('photoURL', ''),
            'text': data.get('text', ''),
            'createdAt': firestore.SERVER_TIMESTAMP
        })

        db.collection('posts').document(post_id).update({'commentCount': firestore.Increment(1)})
        return jsonify({'success': True, 'commentId': comment_ref.id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ── API: Image Upload ──────────────────────────────────────────────────────────

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    try:
        id_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        auth.verify_id_token(id_token)

        data = request.get_json()
        image_data = data.get('imageData', '')
        filename = data.get('filename', f'{uuid.uuid4()}.jpg')

        # Strip base64 header
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)

        bucket = storage.bucket()
        blob = bucket.blob(f'posts/{uuid.uuid4()}_{filename}')
        blob.upload_from_string(image_bytes, content_type='image/jpeg')
        blob.make_public()

        return jsonify({'success': True, 'url': blob.public_url})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ── API: User profile ──────────────────────────────────────────────────────────

@app.route('/api/user/<uid>', methods=['GET'])
def get_user(uid):
    try:
        doc = db.collection('users').document(uid).get()
        if not doc.exists:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        d = doc.to_dict()
        d.pop('email', None)
        return jsonify({'success': True, 'user': d})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/user/posts', methods=['GET'])
def get_user_posts():
    try:
        id_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        decoded = auth.verify_id_token(id_token)
        uid = decoded['uid']
        docs = db.collection('posts').where('authorUid', '==', uid)\
            .order_by('createdAt', direction=firestore.Query.DESCENDING).stream()
        posts = []
        for doc in docs:
            d = doc.to_dict()
            d['id'] = doc.id
            if d.get('createdAt'):
                d['createdAt'] = d['createdAt'].isoformat() if hasattr(d['createdAt'], 'isoformat') else str(d['createdAt'])
            posts.append(d)
        return jsonify({'success': True, 'posts': posts})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/firebase-config', methods=['GET'])
def firebase_config():
    """serviceAccountKey.json의 project_id로 클라이언트 설정을 반환합니다."""
    try:
        import json
        with open('serviceAccountKey.json', 'r') as f:
            sak = json.load(f)
        project_id = sak.get('project_id', '')
        # Firebase 클라이언트 SDK는 project_id만으로 기본 설정을 구성할 수 있습니다
        config = {
            'apiKey': os.environ.get('FIREBASE_API_KEY', ''),
            'authDomain': f'{project_id}.firebaseapp.com',
            'projectId': project_id,
            'storageBucket': os.environ.get('FIREBASE_STORAGE_BUCKET', f'{project_id}.appspot.com'),
            'messagingSenderId': os.environ.get('FIREBASE_MESSAGING_SENDER_ID', ''),
            'appId': os.environ.get('FIREBASE_APP_ID', '')
        }
        return jsonify(config)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
