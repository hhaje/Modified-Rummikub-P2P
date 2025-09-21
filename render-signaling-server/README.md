# Rummikub Signaling Server

WebSocket 기반 시그널링 서버 for Rummikub Math Game P2P multiplayer

## 배포 정보

- **플랫폼**: Render
- **런타임**: Node.js 18+
- **포트**: 환경변수 PORT (Render에서 자동 설정)

## 로컬 개발

```bash
npm install
npm start
```

## API 엔드포인트

- **WebSocket**: `ws://your-app.onrender.com/ws`
- **상태 확인**: `https://your-app.onrender.com/status`
- **세션 목록**: `https://your-app.onrender.com/sessions`

## 환경변수

- `PORT`: 서버 포트 (Render에서 자동 설정)
