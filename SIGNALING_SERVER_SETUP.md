# 시그널링 서버 설정 가이드

## 개요
시그널링 서버는 WebRTC P2P 연결을 위한 중간 서버입니다. 클라이언트들이 서로의 주소와 연결 정보를 교환할 수 있도록 도와줍니다.

## 설치 및 실행

### 1. Node.js 설치
- [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전 다운로드 및 설치
- 버전 14.0.0 이상 필요

### 2. 의존성 설치
```bash
npm install
```

### 3. 서버 실행
```bash
# 일반 실행
npm start

# 개발 모드 (자동 재시작)
npm run dev
```

### 4. 서버 상태 확인
- 서버 상태: http://localhost:8080/status
- 세션 목록: http://localhost:8080/sessions

## 네트워크 설정

### 로컬 네트워크 (같은 Wi-Fi)
1. 서버를 실행할 컴퓨터의 IP 주소 확인
   ```bash
   # Windows
   ipconfig
   
   # macOS/Linux
   ifconfig
   ```

2. 클라이언트에서 시그널링 서버 주소 변경
   ```javascript
   // game.js에서
   this.signalingServer = 'ws://192.168.1.100:8080/ws'; // 실제 IP로 변경
   ```

### 인터넷 접근 (다른 네트워크)
1. 포트 포워딩 설정
   - 라우터에서 포트 8080을 서버 컴퓨터로 포워딩

2. 방화벽 설정
   - Windows: 방화벽에서 포트 8080 허용
   - macOS: 시스템 환경설정 > 보안 및 개인 정보 보호 > 방화벽

3. 클라이언트에서 공인 IP 사용
   ```javascript
   this.signalingServer = 'ws://your-public-ip:8080/ws';
   ```

## 서버 기능

### 1. 세션 관리
- 세션 생성: 호스트가 게임 세션 생성
- 세션 참여: 게스트가 세션에 참여
- 세션 종료: 호스트 연결 종료 시 자동 종료

### 2. 시그널링
- WebRTC offer/answer 교환
- ICE candidate 교환
- 연결 상태 관리

### 3. 브로드캐스트
- 게임 상태 동기화
- 플레이어 준비 상태 관리
- 실시간 메시지 전송

### 4. 연결 관리
- 자동 재연결 지원
- 연결 상태 모니터링
- 우아한 종료 처리

## 메시지 타입

### 클라이언트 → 서버
```javascript
// 세션 생성
{
  type: 'create_session',
  sessionCode: 'ABC123',
  playerName: 'Player1',
  gameSettings: { playerCount: 2, ... }
}

// 세션 참여
{
  type: 'join_session',
  sessionCode: 'ABC123',
  playerName: 'Player2'
}

// 시그널링
{
  type: 'signal',
  sessionCode: 'ABC123',
  to: 'clientId',
  message: { type: 'offer', data: '...' }
}

// 브로드캐스트
{
  type: 'broadcast',
  sessionCode: 'ABC123',
  message: { type: 'game_state', data: '...' }
}

// 준비 완료
{
  type: 'ready',
  sessionCode: 'ABC123'
}
```

### 서버 → 클라이언트
```javascript
// 연결 확인
{
  type: 'connected',
  clientId: 'abc123def',
  timestamp: 1234567890
}

// 세션 생성 성공
{
  type: 'session_created',
  sessionCode: 'ABC123',
  clientId: 'abc123def',
  timestamp: 1234567890
}

// 세션 참여 성공
{
  type: 'join_success',
  sessionCode: 'ABC123',
  clientId: 'def456ghi',
  hostId: 'abc123def',
  gameSettings: { ... },
  timestamp: 1234567890
}

// 게스트 참여 알림
{
  type: 'guest_joined',
  guestId: 'def456ghi',
  playerName: 'Player2',
  timestamp: 1234567890
}

// 시그널 메시지
{
  type: 'signal',
  from: 'abc123def',
  data: { type: 'offer', data: '...' },
  timestamp: 1234567890
}

// 브로드캐스트 메시지
{
  type: 'broadcast',
  data: { type: 'game_state', data: '...' },
  from: 'abc123def',
  timestamp: 1234567890
}

// 오류 메시지
{
  type: 'error',
  message: 'Session not found'
}
```

## 문제 해결

### 1. 연결 실패
- 방화벽 설정 확인
- 포트 8080이 사용 중인지 확인
- IP 주소가 올바른지 확인

### 2. 시그널링 실패
- 네트워크 연결 상태 확인
- STUN 서버 접근 가능 여부 확인
- 브라우저 WebRTC 지원 여부 확인

### 3. 성능 문제
- 동시 연결 수 확인
- 메모리 사용량 모니터링
- 네트워크 대역폭 확인

## 보안 고려사항

### 1. 기본 보안
- CORS 설정으로 접근 제한
- 메시지 크기 제한
- 연결 수 제한

### 2. 고급 보안
- SSL/TLS 암호화 (wss://)
- 인증 토큰 사용
- 세션 암호화

## 모니터링

### 1. 로그 확인
```bash
# 실시간 로그 확인
tail -f server.log

# 에러 로그만 확인
grep "ERROR" server.log
```

### 2. 성능 모니터링
- CPU 사용률
- 메모리 사용량
- 네트워크 트래픽
- 연결 수

## 배포

### 1. PM2 사용 (권장)
```bash
# PM2 설치
npm install -g pm2

# 서버 실행
pm2 start signaling-server.js --name "rumikub-signaling"

# 상태 확인
pm2 status

# 로그 확인
pm2 logs rumikub-signaling
```

### 2. Docker 사용
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

### 3. 클라우드 배포
- AWS EC2
- Google Cloud Platform
- Azure
- Heroku
- Railway

## 지원

문제가 발생하면 다음을 확인하세요:
1. 서버 로그
2. 브라우저 콘솔
3. 네트워크 연결 상태
4. 방화벽 설정
