# 🍽️ FoodieLog — 팀 맛집 커뮤니티

쿠팡 레드 컬러 기반의 팀 맛집 공유 커뮤니티 웹앱입니다.  
**Firebase + Flask + Vercel** 스택으로 구성되어 있습니다.

---

## 📁 프로젝트 구조

```
foodie/
├── app.py                  # Flask 백엔드 (API + 페이지 라우팅)
├── requirements.txt        # Python 의존성
├── vercel.json             # Vercel 배포 설정
├── .env.example            # 환경 변수 샘플
├── .gitignore              # Git 제외 파일 (serviceAccountKey.json 포함!)
├── serviceAccountKey.json  # ← 여기에 넣으세요 (절대 커밋 금지!)
├── templates/
│   ├── base.html           # 공통 레이아웃 (네비게이션)
│   ├── index.html          # 로그인/회원가입 페이지
│   ├── feed.html           # 메인 피드
│   ├── write.html          # 후기 작성
│   ├── post_detail.html    # 포스트 상세 + 댓글
│   └── profile.html        # 내 프로필
└── static/
    ├── css/style.css       # 전체 스타일시트
    └── js/app.js           # 공통 JS 유틸리티
```

---

## 🚀 로컬 실행 방법

### 1. serviceAccountKey.json 준비

Firebase Console → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성**  
다운로드한 파일을 프로젝트 루트에 `serviceAccountKey.json` 이름으로 저장

### 2. .env 파일 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 아래 값을 Firebase Console에서 복사해 넣으세요:

**Firebase Console → 프로젝트 설정 → 일반 → 내 앱 → 웹 앱 구성**

```env
SECRET_KEY=랜덤한-비밀키-입력
FIREBASE_API_KEY=AIzaSy...
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3. 패키지 설치 & 실행

```bash
pip install -r requirements.txt
python app.py
```

브라우저에서 `http://localhost:5000` 접속

---

## ☁️ Vercel 배포 방법

### 1. GitHub에 코드 업로드

```bash
git init
git add .
git commit -m "초기 커밋"
git remote add origin https://github.com/YOUR_USERNAME/foodielog.git
git push -u origin main
```

> ⚠️ `.gitignore`에 `serviceAccountKey.json`이 포함되어 있어 자동으로 제외됩니다.

### 2. Vercel 환경 변수 설정

Vercel Dashboard → 프로젝트 → Settings → Environment Variables 에서 추가:

| 키 | 값 |
|---|---|
| `SECRET_KEY` | 랜덤 문자열 |
| `FIREBASE_API_KEY` | Firebase 웹 API 키 |
| `FIREBASE_STORAGE_BUCKET` | your-project.appspot.com |
| `FIREBASE_MESSAGING_SENDER_ID` | 숫자 ID |
| `FIREBASE_APP_ID` | Firebase 앱 ID |

### 3. serviceAccountKey.json을 Vercel에 올리는 방법

Vercel은 파일 업로드를 직접 지원하지 않으므로, **환경 변수로** 처리합니다:

```bash
# serviceAccountKey.json 내용을 base64로 인코딩
base64 -i serviceAccountKey.json
```

Vercel 환경 변수에 `FIREBASE_SERVICE_ACCOUNT_BASE64` 키로 추가하고,  
`app.py` 상단의 Firebase 초기화 코드를 아래로 교체하세요:

```python
import json, base64, os

sa_b64 = os.environ.get('FIREBASE_SERVICE_ACCOUNT_BASE64')
if sa_b64:
    sa_dict = json.loads(base64.b64decode(sa_b64))
    cred = credentials.Certificate(sa_dict)
else:
    cred = credentials.Certificate('serviceAccountKey.json')
```

### 4. Vercel CLI로 배포 (선택)

```bash
npm i -g vercel
vercel
```

---

## 🔥 Firebase 설정 (Firestore 규칙)

Firebase Console → Firestore Database → 규칙 탭에서 아래 규칙을 적용하세요:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 게시물: 읽기는 누구나, 쓰기는 로그인 유저
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null && request.auth.uid == resource.data.authorUid;
      
      // 댓글
      match /comments/{commentId} {
        allow read: if true;
        allow create: if request.auth != null;
      }
    }
    // 유저 프로필
    match /users/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    // 좋아요
    match /likes/{likeId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Firebase Storage 규칙

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /posts/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 🔐 회원가입/로그인 | 이메일+비밀번호 또는 Google 소셜 로그인 |
| 📝 후기 작성 | 식당명, 카테고리(5종), 별점, 메뉴, 위치 |
| 📸 이미지 업로드 | 즉시 촬영 또는 앨범 선택, 최대 5장 |
| ❤️ 공감 (좋아요) | SNS형 공감 버튼 |
| 💬 댓글 | 실시간 댓글 작성 |
| 👥 팀원 태그 | @닉네임 형태로 함께한 팀원 태그 |
| 📍 위치 | 도보 거리 또는 직접 입력 |
| 📱 모바일 최적화 | 반응형 + 카메라 직접 촬영 지원 |

---

## 🎨 디자인 컨셉

- **메인 컬러**: 쿠팡 레드 `#E8003D`
- **보조 컬러**: 오렌지 `#FF6B35`, 노란색 `#FFB800`
- **폰트**: 시스템 폰트 (Pretendard/Noto Sans KR 우선)
- **레이아웃**: 모바일 퍼스트, 최대 480px 컨테이너
