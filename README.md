# 게임 용어 학습 앱

게임 개발 프롬프트에 쓸 전문 용어(카메라 워크, 검술, 애니메이션, 이펙트, UI 등)를 분야별 덱으로 익히는 안드로이드 앱.
React + Vite로 만든 화면을 한 파일(index.html)로 묶어 WebView 앱에 넣는다.

## 빌드
```
npm install
npm run apk        # data 생성 → 웹 빌드 → game-terms.apk
```
Gradle/Android Studio 없이 aapt, dx, zipalign, apksigner로 빌드한다.
Ubuntu: `apt-get install android-sdk-platform-23 aapt apksigner zipalign dalvik-exchange`

서명: `KEYSTORE_PASS=... npm run apk`. 키는 `keystore/release.jks`(저장소에 포함하지 않음, 없으면 새로 만든다). 같은 키로 서명해야 기존 설치 위에 업데이트된다.

## 데이터
- `data/*.json`: 용어 배열. 필드 `id, deck, term, en, definition, example, exampleEn?, tags?, aliases?`
- `scripts/terms-*.mjs`: 짧은 표 형식 원본. `node scripts/gen-data.mjs`가 `data/<deck>-plus.json`을 만들고, 다른 파일에 이미 있는 용어는 건너뛴다.
- 새 분야는 deck id만 새로 쓰면 덱이 생긴다. 이름과 아이콘은 `src/data.ts`의 `DECK_META`.
