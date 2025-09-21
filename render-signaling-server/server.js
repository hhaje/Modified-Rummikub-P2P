// WebSocket 기반 시그널링 서버 (Render 배포용)
const WebSocket = require('ws');
const http = require('http');

class SignalingServer {
    constructor(port = process.env.PORT || 8080) {
        this.port = port;
        this.sessions = new Map(); // sessionCode -> { host, guests: [], createdAt }
        this.clients = new Map(); // clientId -> { ws, sessionCode, isHost, playerName, isReady }
        
        this.server = http.createServer();
        this.wss = new WebSocket.Server({ 
            server: this.server,
            path: '/ws'
        });
        
        this.setupWebSocketServer();
        this.setupHttpServer();
    }
    
    setupHttpServer() {
        // HTTP 서버 설정 (CORS 지원)
        this.server.on('request', (req, res) => {
            // CORS 헤더 설정
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
            
            // 서버 상태 확인 엔드포인트
            if (req.url === '/status') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'running',
                    sessions: this.sessions.size,
                    clients: this.clients.size,
                    uptime: process.uptime(),
                    port: this.port
                }));
                return;
            }
            
            // 세션 목록 조회 엔드포인트
            if (req.url === '/sessions') {
                const sessionList = Array.from(this.sessions.entries()).map(([code, session]) => ({
                    code,
                    host: this.clients.get(session.host)?.playerName || 'Unknown',
                    guestCount: session.guests.length,
                    createdAt: session.createdAt,
                    hostId: session.host,
                    guests: session.guests
                }));
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    sessions: sessionList,
                    totalSessions: this.sessions.size,
                    totalClients: this.clients.size
                }));
                return;
            }
            
            // 호스트 클라이언트 ID 조회 엔드포인트
            if (req.url.startsWith('/host/')) {
                const sessionCode = req.url.split('/')[2];
                const session = this.sessions.get(sessionCode);
                
                if (session) {
                    const hostClient = this.clients.get(session.host);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        hostId: session.host,
                        hostName: hostClient?.playerName || 'Unknown',
                        sessionCode: sessionCode
                    }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Session not found'
                    }));
                }
                return;
            }
            
            // 루트 경로 - 서버 정보
            if (req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <head><title>Rummikub Signaling Server</title></head>
                        <body>
                            <h1>Rummikub Signaling Server</h1>
                            <p>Status: Running</p>
                            <p>WebSocket Endpoint: wss://${req.headers.host}/ws</p>
                            <p>Active Sessions: ${this.sessions.size}</p>
                            <p>Active Clients: ${this.clients.size}</p>
                            <p><a href="/status">Status API</a></p>
                            <p><a href="/sessions">Sessions API</a></p>
                            <p><a href="/keepalive">Keep Alive</a></p>
                        </body>
                    </html>
                `);
                return;
            }
            
            // Keep Alive 엔드포인트 (Render 무료 플랜용)
            if (req.url === '/keepalive') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'alive',
                    timestamp: Date.now(),
                    uptime: process.uptime()
                }));
                return;
            }
            
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        });
    }
    
    setupWebSocketServer() {
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            console.log(`새 클라이언트 연결됨: ${clientId}`);
            
            // 클라이언트 정보 저장
            this.clients.set(clientId, {
                ws,
                sessionCode: null,
                isHost: false,
                playerName: null,
                isReady: false,
                connectedAt: Date.now()
            });
            
            // 연결 확인 메시지 전송
            ws.send(JSON.stringify({
                type: 'connected',
                clientId: clientId,
                timestamp: Date.now()
            }));
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data, clientId);
                } catch (error) {
                    console.error('메시지 파싱 오류:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid JSON format'
                    }));
                }
            });
            
            ws.on('close', () => {
                console.log(`클라이언트 연결 종료: ${clientId}`);
                this.handleDisconnect(clientId);
            });
            
            ws.on('error', (error) => {
                console.error(`클라이언트 오류 (${clientId}):`, error);
            });
        });
    }
    
    handleMessage(ws, data, clientId) {
        const { type, sessionCode, playerName, to, message, gameSettings } = data;
        
        console.log(`메시지 수신 (${clientId}):`, type);
        console.log('메시지 데이터:', data);
        
        switch (type) {
            case 'create_session':
                this.createSession(ws, clientId, sessionCode, playerName, gameSettings);
                break;
                
            case 'join_session':
                console.log('join_session 처리 시작');
                console.log('sessionCode:', sessionCode);
                console.log('playerName:', playerName);
                this.joinSession(ws, clientId, sessionCode, playerName);
                break;
                
            case 'direct_join':
                console.log('direct_join 처리 시작');
                console.log('hostClientId:', data.hostClientId);
                console.log('playerName:', data.playerName);
                console.log('sessionCode:', data.sessionCode);
                this.directJoin(ws, clientId, data.hostClientId, data.playerName, data.sessionCode);
                break;
                
            case 'signal':
                this.forwardSignal(sessionCode, to, message, clientId);
                break;
                
            case 'broadcast':
                this.broadcastToSession(sessionCode, message, clientId);
                break;
                
            case 'join_response':
                this.forwardJoinResponse(data, clientId);
                break;
                
            case 'ready':
                this.handleReady(clientId, sessionCode);
                break;
                
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
                
            default:
                console.log('알 수 없는 메시지 타입:', type);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `Unknown message type: ${type}`
                }));
        }
    }
    
    createSession(ws, clientId, sessionCode, playerName, gameSettings) {
        console.log('=== createSession 호출 ===');
        console.log('clientId:', clientId);
        console.log('sessionCode:', sessionCode);
        console.log('playerName:', playerName);
        console.log('gameSettings:', gameSettings);
        
        // 기존 세션이 있는지 확인
        if (this.sessions.has(sessionCode)) {
            console.log('세션이 이미 존재함:', sessionCode);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Session already exists'
            }));
            return;
        }
        
        // 세션 생성
        const sessionData = {
            host: clientId,
            guests: [],
            createdAt: Date.now(),
            gameSettings: gameSettings || {}
        };
        this.sessions.set(sessionCode, sessionData);
        
        console.log('세션 생성 완료:', sessionCode);
        console.log('세션 데이터:', sessionData);
        console.log('현재 세션 목록:', Array.from(this.sessions.keys()));
        
        // 클라이언트 정보 업데이트
        const client = this.clients.get(clientId);
        if (client) {
            client.sessionCode = sessionCode;
            client.isHost = true;
            client.playerName = playerName;
            client.isReady = true;
            console.log('클라이언트 정보 업데이트 완료:', client);
        } else {
            console.error('클라이언트를 찾을 수 없음:', clientId);
        }
        
        ws.send(JSON.stringify({
            type: 'session_created',
            sessionCode,
            clientId,
            timestamp: Date.now()
        }));
        
        console.log(`세션 생성됨: ${sessionCode} (호스트: ${playerName})`);
    }
    
    joinSession(ws, clientId, sessionCode, playerName) {
        console.log('=== joinSession 호출 ===');
        console.log('clientId:', clientId);
        console.log('sessionCode:', sessionCode);
        console.log('playerName:', playerName);
        
        // 현재 세션 목록 출력
        console.log('현재 세션 목록:', Array.from(this.sessions.keys()));
        console.log('세션 상세 정보:', Array.from(this.sessions.entries()));
        
        const session = this.sessions.get(sessionCode);
        if (!session) {
            console.log('세션을 찾을 수 없음:', sessionCode);
            console.log('사용 가능한 세션들:', Array.from(this.sessions.keys()));
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Session not found'
            }));
            return;
        }
        
        console.log('세션 찾음:', sessionCode);
        
        const hostClient = this.clients.get(session.host);
        if (!hostClient || hostClient.ws.readyState !== WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Host is not available'
            }));
            return;
        }
        
        // 클라이언트 정보 업데이트
        const client = this.clients.get(clientId);
        client.sessionCode = sessionCode;
        client.isHost = false;
        client.playerName = playerName;
        client.isReady = false;
        
        // 게스트 목록에 추가
        session.guests.push(clientId);
        
        // 호스트에게 게스트 참여 알림
        const guestJoinedMessage = {
            type: 'guest_joined',
            guestId: clientId,
            playerName,
            sessionCode: sessionCode,
            timestamp: Date.now()
        };
        console.log('호스트에게 전송할 guest_joined 메시지:', guestJoinedMessage);
        hostClient.ws.send(JSON.stringify(guestJoinedMessage));
        
        // 게스트에게 참여 성공 알림
        ws.send(JSON.stringify({
            type: 'join_success',
            sessionCode,
            clientId,
            hostId: session.host,
            gameSettings: session.gameSettings,
            timestamp: Date.now()
        }));
        
        console.log(`게스트 참여: ${playerName} (세션: ${sessionCode})`);
    }
    
    directJoin(ws, clientId, hostClientId, playerName, sessionCode) {
        console.log('=== directJoin 호출 ===');
        console.log('clientId:', clientId);
        console.log('hostClientId:', hostClientId);
        console.log('playerName:', playerName);
        console.log('sessionCode:', sessionCode);
        
        // 호스트 클라이언트가 존재하는지 확인
        const hostClient = this.clients.get(hostClientId);
        if (!hostClient) {
            console.log('호스트 클라이언트를 찾을 수 없음:', hostClientId);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Host not found'
            }));
            return;
        }
        
        // 호스트가 연결되어 있는지 확인
        if (hostClient.ws.readyState !== WebSocket.OPEN) {
            console.log('호스트가 연결되어 있지 않음:', hostClientId);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Host is not available'
            }));
            return;
        }
        
        console.log('호스트 클라이언트 찾음:', hostClient);
        
        // 게스트 클라이언트 정보 저장
        this.clients.set(clientId, {
            playerName: playerName,
            sessionCode: sessionCode,
            isHost: false,
            hostClientId: hostClientId,
            isReady: false
        });
        
        // 호스트에게 게스트 참여 알림
        const guestJoinedMessage = {
            type: 'guest_joined',
            guestId: clientId,
            playerName: playerName,
            sessionCode: sessionCode,
            timestamp: Date.now()
        };
        console.log('호스트에게 전송할 guest_joined 메시지:', guestJoinedMessage);
        console.log('호스트 WebSocket 상태:', hostClient.ws.readyState);
        console.log('호스트 WebSocket URL:', hostClient.ws.url);
        
        try {
            hostClient.ws.send(JSON.stringify(guestJoinedMessage));
            console.log('guest_joined 메시지 전송 성공');
        } catch (error) {
            console.error('guest_joined 메시지 전송 실패:', error);
        }
        
        // 게스트에게 참여 성공 알림
        ws.send(JSON.stringify({
            type: 'join_success',
            sessionCode: sessionCode,
            clientId: clientId,
            hostId: hostClientId,
            timestamp: Date.now()
        }));
        
        console.log(`직접 참여 성공: ${playerName} -> 호스트 ${hostClientId}`);
    }
    
    forwardJoinResponse(data, fromClientId) {
        console.log('=== forwardJoinResponse 호출 ===');
        console.log('fromClientId:', fromClientId);
        console.log('data:', data);
        
        const { to: targetClientId, data: responseData } = data;
        
        // 대상 클라이언트 찾기
        const targetClient = this.clients.get(targetClientId);
        if (!targetClient) {
            console.log('대상 클라이언트를 찾을 수 없음:', targetClientId);
            return;
        }
        
        // 대상 클라이언트가 연결되어 있는지 확인
        if (targetClient.ws.readyState !== WebSocket.OPEN) {
            console.log('대상 클라이언트가 연결되어 있지 않음:', targetClientId);
            return;
        }
        
        // 게스트에게 참여 응답 전달
        const joinResponseMessage = {
            type: 'join_response',
            data: responseData,
            from: fromClientId,
            timestamp: Date.now()
        };
        
        console.log('게스트에게 전달할 join_response 메시지:', joinResponseMessage);
        targetClient.ws.send(JSON.stringify(joinResponseMessage));
        
        console.log(`참여 응답 전달 완료: ${fromClientId} -> ${targetClientId}`);
    }
    
    forwardSignal(sessionCode, to, message, fromClientId) {
        const session = this.sessions.get(sessionCode);
        if (!session) {
            console.log('세션을 찾을 수 없음:', sessionCode);
            return;
        }
        
        const targetClient = this.clients.get(to);
        if (!targetClient || targetClient.ws.readyState !== WebSocket.OPEN) {
            console.log('대상 클라이언트를 찾을 수 없음:', to);
            return;
        }
        
        // 시그널 메시지 전달
        targetClient.ws.send(JSON.stringify({
            type: 'signal',
            from: fromClientId,
            data: message,
            timestamp: Date.now()
        }));
        
        console.log(`시그널 전달: ${fromClientId} -> ${to} (${message.type})`);
    }
    
    broadcastToSession(sessionCode, message, senderClientId) {
        const session = this.sessions.get(sessionCode);
        if (!session) {
            console.log('세션을 찾을 수 없음:', sessionCode);
            return;
        }
        
        // 호스트에게 전송 (발신자 제외)
        const hostClient = this.clients.get(session.host);
        if (hostClient && hostClient.ws !== this.clients.get(senderClientId)?.ws && 
            hostClient.ws.readyState === WebSocket.OPEN) {
            hostClient.ws.send(JSON.stringify({
                type: 'broadcast',
                data: message,
                from: senderClientId,
                timestamp: Date.now()
            }));
        }
        
        // 모든 게스트에게 전송 (발신자 제외)
        session.guests.forEach(guestId => {
            const guestClient = this.clients.get(guestId);
            if (guestClient && guestClient.ws !== this.clients.get(senderClientId)?.ws && 
                guestClient.ws.readyState === WebSocket.OPEN) {
                guestClient.ws.send(JSON.stringify({
                    type: 'broadcast',
                    data: message,
                    from: senderClientId,
                    timestamp: Date.now()
                }));
            }
        });
        
        console.log(`브로드캐스트 전송: ${senderClientId} -> 세션 ${sessionCode}`);
    }
    
    handleReady(clientId, sessionCode) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        client.isReady = true;
        
        // 세션의 모든 플레이어에게 준비 상태 알림
        this.broadcastToSession(sessionCode, {
            type: 'player_ready',
            playerId: clientId,
            playerName: client.playerName
        }, clientId);
        
        console.log(`플레이어 준비 완료: ${client.playerName} (${clientId})`);
    }
    
    handleDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        const session = this.sessions.get(client.sessionCode);
        if (session) {
            if (client.isHost) {
                // 호스트가 연결을 끊으면 세션 종료
                console.log(`세션 종료됨: ${client.sessionCode}`);
                
                // 모든 게스트에게 세션 종료 알림
                session.guests.forEach(guestId => {
                    const guestClient = this.clients.get(guestId);
                    if (guestClient && guestClient.ws.readyState === WebSocket.OPEN) {
                        guestClient.ws.send(JSON.stringify({
                            type: 'session_ended',
                            reason: 'Host disconnected',
                            timestamp: Date.now()
                        }));
                    }
                });
                
                this.sessions.delete(client.sessionCode);
            } else {
                // 게스트가 연결을 끊으면 게스트 목록에서 제거
                const guestIndex = session.guests.indexOf(clientId);
                if (guestIndex > -1) {
                    session.guests.splice(guestIndex, 1);
                }
                
                // 호스트에게 게스트 연결 종료 알림
                const hostClient = this.clients.get(session.host);
                if (hostClient && hostClient.ws.readyState === WebSocket.OPEN) {
                    hostClient.ws.send(JSON.stringify({
                        type: 'guest_left',
                        guestId: clientId,
                        playerName: client.playerName,
                        timestamp: Date.now()
                    }));
                }
                
                console.log(`게스트 연결 종료: ${client.playerName} (${clientId})`);
            }
        }
        
        this.clients.delete(clientId);
    }
    
    generateClientId() {
        return Math.random().toString(36).substr(2, 9);
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log(`시그널링 서버가 포트 ${this.port}에서 실행 중입니다.`);
            console.log(`WebSocket 엔드포인트: ws://localhost:${this.port}/ws`);
            console.log(`상태 확인: http://localhost:${this.port}/status`);
            console.log(`세션 목록: http://localhost:${this.port}/sessions`);
        });
    }
    
    stop() {
        console.log('시그널링 서버를 종료합니다...');
        
        // 모든 클라이언트에게 서버 종료 알림
        this.clients.forEach(client => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify({
                    type: 'server_shutdown',
                    message: 'Server is shutting down',
                    timestamp: Date.now()
                }));
            }
        });
        
        this.wss.close();
        this.server.close();
    }
}

// 서버 시작
const server = new SignalingServer();
server.start();

// 우아한 종료 처리
process.on('SIGINT', () => {
    console.log('\nSIGINT 신호 수신, 서버 종료 중...');
    server.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nSIGTERM 신호 수신, 서버 종료 중...');
    server.stop();
    process.exit(0);
});
