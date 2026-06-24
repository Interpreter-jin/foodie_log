// ─────────────────────────────────────────────────────────────────────────────
// firebase-config.js
// serviceAccountKey.json의 project_id를 기반으로 Firebase 클라이언트를 초기화합니다.
// ─────────────────────────────────────────────────────────────────────────────

// 아래 값들은 serviceAccountKey.json의 project_id로 자동 구성됩니다.
// Firebase Console > Project Settings > 일반 > 내 앱 에서 확인 가능합니다.
// 단, serviceAccountKey.json의 project_id만 있으면 아래를 자동 추론할 수 있습니다.

async function loadFirebaseConfig() {
  const res = await fetch('/api/firebase-config');
  return res.json();
}

// Firebase 클라이언트 SDK 설정
// serviceAccountKey.json의 project_id를 직접 사용합니다
const firebaseConfig = {
  // 이 값은 서버에서 주입됩니다 (/api/firebase-config 엔드포인트)
};

export { firebaseConfig };
