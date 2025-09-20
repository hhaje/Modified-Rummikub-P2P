// 카드 클래스 정의
class Card {
    constructor(type, value) {
        this.type = type; // 'number', 'operator', 'joker', 'equals'
        this.value = value; // 숫자 값 또는 연산자
        this.id = this.generateId();
        this.temporaryOperator = null; // 조커 카드의 임시 연산자 저장
    }

    generateId() {
        return `${this.type}-${this.value}-${Math.random().toString(36).substr(2, 9)}`;
    }

    createElement() {
        const element = document.createElement('div');
        element.className = `card ${this.type}`;
        element.dataset.cardId = this.id;
        element.draggable = true;

        if (this.type === 'number') {
            element.textContent = this.value;
        } else if (this.type === 'operator') {
            element.classList.add(this.getOperatorClass());
        } else if (this.type === 'joker') {
            // 조커는 항상 조커 스타일로 표시, 임시 연산자가 있어도 시각적으로는 조커 유지
            // 임시 연산자 정보는 툴팁이나 작은 표시로 보여줄 수 있음
            if (this.temporaryOperator) {
                element.title = `조커 카드 (현재: ${this.temporaryOperator})`;
                element.classList.add('joker-with-operator');
                element.dataset.operator = this.temporaryOperator;
            }
        }

        // 드래그 이벤트 추가
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', this.id);
            e.dataTransfer.setData('source', 'hand');
            element.classList.add('dragging');
        });

        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
        });

        return element;
    }

    getOperatorClass() {
        const classMap = {
            '+': 'plus',
            '-': 'minus',
            '×': 'multiply',
            '÷': 'divide'
        };
        return classMap[this.value] || '';
    }

    // 조커 카드 상태 관리 메서드들
    setTemporaryOperator(operator) {
        if (this.type === 'joker') {
            this.temporaryOperator = operator;
        }
    }

    clearTemporaryOperator() {
        if (this.type === 'joker') {
            this.temporaryOperator = null;
        }
    }

    getEffectiveValue() {
        // 조커 카드의 경우 임시 연산자가 있으면 그것을 반환, 없으면 기본값
        if (this.type === 'joker' && this.temporaryOperator) {
            return this.temporaryOperator;
        }
        return this.value;
    }

    isJokerWithOperator() {
        return this.type === 'joker' && this.temporaryOperator !== null;
    }
}

// 등호 카드 클래스 정의
class EqualsCard extends Card {
    constructor() {
        super('equals', '=');
    }
    
    createElement() {
        const element = document.createElement('div');
        element.className = 'card equals equation-equals';
        element.dataset.cardId = this.id;
        element.textContent = '=';
        element.style.cursor = 'default'; // 등호는 드래그 불가
        return element;
    }
}

// 등식 클래스 정의 (스마트 사이드 구분 시스템)
class Equation {
    constructor(leftSide, rightSide) {
        this.cards = []; // 모든 카드를 하나의 배열로 관리
        this.id = this.generateId();
        
        // 초기 등식 구성: leftSide + equals + rightSide
        this.cards = [...leftSide, new EqualsCard(), ...(Array.isArray(rightSide) ? rightSide : [rightSide])];
    }
    
    get leftSide() {
        const equalsIndex = this.cards.findIndex(card => card.type === 'equals');
        return equalsIndex !== -1 ? this.cards.slice(0, equalsIndex) : this.cards;
    }
    
    get rightSide() {
        const equalsIndex = this.cards.findIndex(card => card.type === 'equals');
        return equalsIndex !== -1 ? this.cards.slice(equalsIndex + 1) : [];
    }
    
    // 카드를 특정 위치에 삽입
    insertCard(card, position) {
        if (position >= 0 && position <= this.cards.length) {
            this.cards.splice(position, 0, card);
        } else {
            this.cards.push(card);
        }
    }
    
    // 카드 제거
    removeCard(cardId) {
        const index = this.cards.findIndex(c => c.id === cardId);
        if (index !== -1 && this.cards[index].type !== 'equals') { // 등호는 제거 불가
            return this.cards.splice(index, 1)[0];
        }
        return null;
    }

    generateId() {
        return `eq-${Math.random().toString(36).substr(2, 9)}`;
    }

    getAllCards() {
        return this.cards.filter(card => card.type !== 'equals'); // 등호 제외한 모든 카드
    }

    isValid() {
        // 왼쪽 수식을 계산해서 오른쪽과 일치하는지 확인
        const calculator = new ExpressionCalculator();
        this.leftSide.forEach(card => {
            calculator.addCard(card);
        });
        const leftResult = calculator.calculate();
        
        // 오른쪽 카드들로 만들 수 있는 수 계산
        const rightResult = this.calculateRightSide();
        
        return leftResult === rightResult;
    }

    calculateRightSide() {
        const rightCards = this.rightSide;
        if (rightCards.length === 0) return 0;
        if (rightCards.length === 1) {
            return rightCards[0].value;
        } else {
            // 여러 카드로 다자리 수 구성
            const numberStr = rightCards.map(card => card.value).join('');
            return parseInt(numberStr);
        }
    }

    getDisplayString() {
        return this.cards.map(card => {
            if (card.type === 'equals') return '=';
            if (card.type === 'number') return card.value;
            if (card.type === 'operator') return card.value;
            if (card.type === 'joker') return '?';
            return card.value;
        }).join(' ');
    }
}


// 게임 상태 관리 클래스
class GameState {
    constructor() {
        this.players = [];
        this.currentPlayer = 0;
        this.targetAnswer = null;
        this.targetCards = [];
        this.possibleAnswers = []; // 가능한 모든 정답들
        this.fieldEquations = []; // 필드의 등식들
        this.remainingDeck = []; // 남은 카드 덱
        this.isGameActive = false;
        this.cycleStartPlayer = 0; // 사이클 시작 플레이어 추적
        this.hasAnswerThisCycle = false; // 현재 사이클에서 정답이 나왔는지 추적
        this.settings = {
            numberSets: 3,
            operatorSets: 4,
            jokerCount: 2,
            playerCount: 4,
            initialNumberCards: 13,
            initialOperatorCards: 5
        };
    }

    createDeck() {
        const deck = [];
        
        // 숫자 카드 생성 (0-9, n세트)
        for (let set = 0; set < this.settings.numberSets; set++) {
            for (let num = 0; num <= 9; num++) {
                deck.push(new Card('number', num));
            }
        }

        // 연산자 카드 생성 (+, -, ×, ÷, m세트)
        const operators = ['+', '-', '×', '÷'];
        for (let set = 0; set < this.settings.operatorSets; set++) {
            operators.forEach(op => {
                deck.push(new Card('operator', op));
            });
        }

        // 조커 카드 생성 (l개)
        for (let i = 0; i < this.settings.jokerCount; i++) {
            deck.push(new Card('joker', 'joker'));
        }

        return this.shuffleDeck(deck);
    }

    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    dealCards(deck) {
        console.log('dealCards 시작, 덱 크기:', deck.length);
        this.players = [];
        
        // 카드 타입별로 미리 분리
        const availableNumberCards = deck.filter(card => card.type === 'number');
        const availableOperatorCards = deck.filter(card => card.type === 'operator' || card.type === 'joker');
        
        console.log('사용 가능한 숫자 카드:', availableNumberCards.length);
        console.log('사용 가능한 연산자 카드:', availableOperatorCards.length);
        
        for (let i = 0; i < this.settings.playerCount; i++) {
            const player = {
                id: i,
                name: `플레이어 ${i + 1}`,
                numberCards: [],
                operatorCards: []
            };

            // 숫자 카드 배분
            for (let j = 0; j < this.settings.initialNumberCards && availableNumberCards.length > 0; j++) {
                const randomIndex = Math.floor(Math.random() * availableNumberCards.length);
                const card = availableNumberCards.splice(randomIndex, 1)[0];
                player.numberCards.push(card);
            }
            
            // 연산자 카드 배분
            for (let j = 0; j < this.settings.initialOperatorCards && availableOperatorCards.length > 0; j++) {
                const randomIndex = Math.floor(Math.random() * availableOperatorCards.length);
                const card = availableOperatorCards.splice(randomIndex, 1)[0];
                player.operatorCards.push(card);
            }

            console.log(`${player.name}: 숫자 ${player.numberCards.length}장, 연산자 ${player.operatorCards.length}장`);
            this.players.push(player);
        }

        // 남은 카드들로 덱 재구성
        this.remainingDeck = [...availableNumberCards, ...availableOperatorCards];
        console.log('남은 덱 크기:', this.remainingDeck.length);
    }

    generateNewTarget() {
        const numberCards = this.remainingDeck.filter(card => card.type === 'number');
        if (numberCards.length < 2) {
            // 덱에 숫자가 부족한 경우 필드에서 가져오기
            const fieldNumbers = this.getAvailableFieldCards().filter(card => card.type === 'number');
            if (fieldNumbers.length >= 2) {
                this.targetCards = [fieldNumbers[0], fieldNumbers[1]];
            } else {
                // 새로운 덱 생성 (비상 상황)
                const newDeck = this.createDeck();
                this.targetCards = [newDeck[0], newDeck[1]];
            }
        } else {
            const card1 = numberCards[Math.floor(Math.random() * numberCards.length)];
            let card2;
            do {
                card2 = numberCards[Math.floor(Math.random() * numberCards.length)];
            } while (card1.id === card2.id);
            
            this.targetCards = [card1, card2];
        }

        this.generateTargetAnswers();
    }

    generateTargetAnswers() {
        if (this.targetCards.length === 0) return;

        this.possibleAnswers = [];
        
        // 카드가 1장뿐인 경우
        if (this.targetCards.length === 1) {
            this.possibleAnswers = [this.targetCards[0].value];
        } else {
            // 2장 이상인 경우: 모든 2장 조합으로 2자리 수 생성
            for (let i = 0; i < this.targetCards.length; i++) {
                for (let j = 0; j < this.targetCards.length; j++) {
                    if (i !== j) {
                        const num1 = this.targetCards[i].value.toString();
                        const num2 = this.targetCards[j].value.toString();
                        const combination = parseInt(num1 + num2);
                        this.possibleAnswers.push(combination);
                    }
                }
            }
        }
        
        // 중복 제거 및 정렬
        this.possibleAnswers = [...new Set(this.possibleAnswers)].sort((a, b) => a - b);
        
        // 첫 번째 가능한 답을 기본 정답으로 설정
        this.targetAnswer = this.possibleAnswers[0];
    }

    addTargetCard() {
        // 덱에서 숫자 카드 한 장 더 뽑기
        const numberCards = this.remainingDeck.filter(card => card.type === 'number');
        if (numberCards.length === 0) {
            // 필드에서 가져오기 (등식에서 숫자 카드 찾기)
            const fieldCards = this.getAvailableFieldCards();
            const fieldNumbers = fieldCards.filter(card => card.type === 'number');
            if (fieldNumbers.length > 0) {
                const newCard = fieldNumbers[0];
                this.targetCards.push(newCard);
                
                // 해당 카드가 포함된 등식들을 깨뜨림 처리 (게임 로직에서 처리)
            }
        } else {
            const randomIndex = Math.floor(Math.random() * numberCards.length);
            const newCard = numberCards[randomIndex];
            
            // 덱에서 제거
            const deckIndex = this.remainingDeck.findIndex(card => card.id === newCard.id);
            if (deckIndex !== -1) {
                this.remainingDeck.splice(deckIndex, 1);
            }
            
            this.targetCards.push(newCard);
        }
        
        // 새로운 가능한 정답들 생성
        this.generateTargetAnswers();
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayer];
    }

    nextPlayer() {
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        
        // 사이클 완료 체크 (모든 플레이어가 한 번씩 플레이했는지)
        if (this.currentPlayer === this.cycleStartPlayer) {
            return true; // 사이클 완료
        }
        return false; // 사이클 진행 중
    }

    startNewCycle() {
        this.cycleStartPlayer = this.currentPlayer;
        this.hasAnswerThisCycle = false;
    }

    getAvailableFieldCards() {
        // 필드의 모든 등식에서 사용 가능한 카드들을 수집
        const allCards = [];
        this.fieldEquations.forEach(equation => {
            allCards.push(...equation.getAllCards());
        });
        return allCards;
    }

    validateAllEquations() {
        // 모든 등식이 유효한지 확인
        return this.fieldEquations.every(equation => equation.isValid());
    }

    findBrokenEquations() {
        // 유효하지 않은 등식들을 찾아 반환
        return this.fieldEquations.filter(equation => !equation.isValid());
    }

    removeEquation(equationId) {
        const index = this.fieldEquations.findIndex(eq => eq.id === equationId);
        if (index !== -1) {
            return this.fieldEquations.splice(index, 1)[0];
        }
        return null;
    }

    checkVictory(player) {
        const numberVictory = player.numberCards.length === 0;
        const operatorVictory = player.operatorCards.length === 0;
        return { numberVictory, operatorVictory, hasWon: numberVictory || operatorVictory };
    }
}

// 수식 구성 영역 클래스 (필드처럼 취급)
class ExpressionArea {
    constructor(gameController = null) {
        this.cards = []; // 수식 영역의 카드들
        this.id = 'expression-area';
        this.gameController = gameController;
    }

    addCard(card, position = null) {
        if (position !== null && position >= 0 && position <= this.cards.length) {
            this.cards.splice(position, 0, card);
        } else {
            this.cards.push(card);
        }
        // UI 업데이트 트리거
        if (this.gameController) {
            this.gameController.updateSubmitButton();
            this.gameController.updateTurnButtons();
        }
    }

    removeCard(cardId) {
        const index = this.cards.findIndex(c => c.id === cardId);
        if (index !== -1) {
            const removedCard = this.cards.splice(index, 1)[0];
            // UI 업데이트 트리거
            if (this.gameController) {
                this.gameController.updateSubmitButton();
                this.gameController.updateTurnButtons();
            }
            return removedCard;
        }
        return null;
    }

    moveCard(cardId, newPosition) {
        const card = this.removeCard(cardId);
        if (card) {
            this.addCard(card, newPosition);
        }
    }

    clear() {
        this.cards = [];
    }

    calculate() {
        try {
            if (this.cards.length === 0) return null;

            const expression = this.buildExpression();
            if (expression.length === 0) return null;

            // 단일 숫자인 경우
            if (expression.length === 1 && typeof expression[0] === 'number') {
                return expression[0];
            }

            // 사칙연산 우선순위 적용: 곱셈, 나눗셈 먼저 계산
            let tokens = [...expression]; // 복사본 생성

            // 1단계: 곱셈과 나눗셈 먼저 처리
            for (let i = 1; i < tokens.length - 1; i += 2) {
                const operator = tokens[i];
                if (operator === '×' || operator === '÷') {
                    const left = tokens[i - 1];
                    const right = tokens[i + 1];
                    let result;

                    if (operator === '×') {
                        result = left * right;
                    } else { // '÷'
                        result = Math.floor(left / right); // 몫만 취급
                    }

                    // 계산 결과로 3개 토큰을 1개로 교체
                    tokens.splice(i - 1, 3, result);
                    i -= 2; // 인덱스 조정
                }
            }

            // 2단계: 덧셈과 뺄셈 처리 (좌→우)
            let result = tokens[0];
            for (let i = 1; i < tokens.length - 1; i += 2) {
                const operator = tokens[i];
                const right = tokens[i + 1];

                if (operator === '+') {
                    result = result + right;
                } else if (operator === '-') {
                    result = result - right;
                }
            }

            return result;
        } catch (error) {
            console.error('계산 오류:', error);
            return null;
        }
    }

    buildExpression() {
        let expressionStr = '';
        let numbers = [];
        let currentNumber = '';

            for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];

            if (card.type === 'number') {
                currentNumber += card.value;
            } else {
                // 연산자나 조커를 만나면 현재 숫자를 완성
                if (currentNumber !== '') {
                    numbers.push(parseInt(currentNumber));
                    currentNumber = '';
                }

                if (card.type === 'operator') {
                    numbers.push(card.value);
                } else if (card.type === 'joker') {
                    // 조커는 임시 연산자가 있으면 그것을 사용, 없으면 '+' 로 기본 처리
                    numbers.push(card.getEffectiveValue() || '+');
                }
            }
        }

        // 마지막 숫자 처리
        if (currentNumber !== '') {
            numbers.push(parseInt(currentNumber));
        }

        return numbers;
    }

    getDisplayString() {
        let display = '';
        let currentNumber = '';

        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];

            if (card.type === 'number') {
                currentNumber += card.value;
            } else {
                if (currentNumber !== '') {
                    display += currentNumber + ' ';
                    currentNumber = '';
                }

                if (card.type === 'operator') {
                    display += card.value + ' ';
                } else if (card.type === 'joker') {
                    display += (card.temporaryOperator ? `🃏(${card.temporaryOperator})` : '🃏') + ' ';
                }
            }
        }

        if (currentNumber !== '') {
            display += currentNumber;
        }

        return display.trim();
    }
}

// 수식 계산기 클래스 (호환성을 위해 유지)
class ExpressionCalculator {
    constructor() {
        this.expression = [];
        this.usedCards = [];
        this.usedFieldCards = []; // 필드에서 사용한 카드들 추적
    }

    addCard(card, isFromField = false) {
        this.expression.push({
            card: card,
            fromField: isFromField
        });
        this.usedCards.push(card);
        
        if (isFromField) {
            this.usedFieldCards.push(card);
        }
    }

    removeLastCard() {
        if (this.expression.length > 0) {
            const removed = this.expression.pop();
            this.usedCards.pop();
            return removed;
        }
        return null;
    }

    clear() {
        this.expression = [];
        this.usedCards = [];
        this.usedFieldCards = [];
    }

    buildExpression() {
        let expressionStr = '';
        let numbers = [];
        let currentNumber = '';

        for (let i = 0; i < this.expression.length; i++) {
            const item = this.expression[i];
            const card = item.card;

            if (card.type === 'number') {
                currentNumber += card.value;
            } else {
                // 연산자나 조커를 만나면 현재 숫자를 완성
                if (currentNumber !== '') {
                    numbers.push(parseInt(currentNumber));
                    currentNumber = '';
                }

                if (card.type === 'operator') {
                    numbers.push(card.value);
                } else if (card.type === 'joker') {
                    // 조커는 임시 연산자가 있으면 그것을 사용, 없으면 '+' 로 기본 처리
                    numbers.push(card.getEffectiveValue() || '+');
                }
            }
        }

        // 마지막 숫자 처리
        if (currentNumber !== '') {
            numbers.push(parseInt(currentNumber));
        }

        return numbers;
    }

    calculate() {
        try {
            const expression = this.buildExpression();
            if (expression.length === 0) return null;

            // 단일 숫자인 경우
            if (expression.length === 1 && typeof expression[0] === 'number') {
                return expression[0];
            }

            // 사칙연산 우선순위 적용: 곱셈, 나눗셈 먼저 계산
            let tokens = [...expression]; // 복사본 생성

            // 1단계: 곱셈과 나눗셈 먼저 처리
            for (let i = 1; i < tokens.length - 1; i += 2) {
                const operator = tokens[i];
                if (operator === '×' || operator === '÷') {
                    const left = tokens[i - 1];
                    const right = tokens[i + 1];
                    let result;

                    if (operator === '×') {
                        result = left * right;
                    } else { // '÷'
                        result = Math.floor(left / right); // 몫만 취급
                    }

                    // 계산 결과로 3개 토큰을 1개로 교체
                    tokens.splice(i - 1, 3, result);
                    i -= 2; // 인덱스 조정
                }
            }

            // 2단계: 덧셈과 뺄셈 처리 (좌→우)
            let result = tokens[0];
            for (let i = 1; i < tokens.length - 1; i += 2) {
                const operator = tokens[i];
                const right = tokens[i + 1];

                if (operator === '+') {
                    result = result + right;
                } else if (operator === '-') {
                    result = result - right;
                }
            }

            return result;
        } catch (error) {
            console.error('계산 오류:', error);
            return null;
        }
    }

    getDisplayString() {
        let display = '';
        let currentNumber = '';

        for (let i = 0; i < this.expression.length; i++) {
            const item = this.expression[i];
            const card = item.card;

            if (card.type === 'number') {
                currentNumber += card.value;
            } else {
                if (currentNumber !== '') {
                    display += currentNumber + ' ';
                    currentNumber = '';
                }

                if (card.type === 'operator') {
                    display += card.value + ' ';
                } else if (card.type === 'joker') {
                    display += '? ';
                }
            }
        }

        if (currentNumber !== '') {
            display += currentNumber;
        }

        return display.trim();
    }
}

// 로컬 P2P 연결 관리 클래스
class P2PManager {
    constructor(gameController) {
        this.gameController = gameController;
        this.isHost = false;
        this.sessionCode = null;
        this.playerName = null;
        this.connections = new Map(); // peer connections
        this.players = new Map(); // 플레이어 정보
        this.isReady = false;
        
        // WebRTC 설정
        this.localPeerConnection = null;
        this.dataChannels = new Map();
        this.messageHandlers = new Map();
        
        // STUN 서버 (Google 공용)
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        // 로컬 네트워크 브로드캐스트를 위한 BroadcastChannel
        this.broadcastChannel = new BroadcastChannel('rumikub-local-p2p');
        this.setupBroadcastChannel();
    }

    setupBroadcastChannel() {
        this.broadcastChannel.addEventListener('message', async (event) => {
            const { type, data, from } = event.data;
            
            switch (type) {
                case 'session_announce':
                    if (!this.isHost && !this.sessionCode) {
                        console.log('세션 발견:', data.sessionCode);
                    }
                    break;
                    
                case 'join_request':
                    if (this.isHost && data.sessionCode === this.sessionCode) {
                        await this.handleJoinRequest(data);
                    }
                    break;
                    
                case 'join_response':
                    if (!this.isHost && data.to === this.playerName) {
                        await this.handleJoinResponse(data);
                    }
                    break;
                    
                case 'ice_candidate':
                    if (data.to === this.playerName) {
                        await this.handleIceCandidate(data);
                    }
                    break;
                    
                case 'offer':
                    if (data.to === this.playerName) {
                        await this.handleOffer(data);
                    }
                    break;
                    
                case 'answer':
                    if (data.to === this.playerName) {
                        await this.handleAnswer(data);
                    }
                    break;
            }
        });
    }

    generateSessionCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    async createSession(playerName, gameSettings) {
        this.isHost = true;
        this.playerName = playerName;
        this.sessionCode = this.generateSessionCode();
        
        // 호스트 플레이어 추가
        this.players.set(this.playerName, {
            id: this.playerName,
            name: playerName,
            isHost: true,
            isReady: true,
            connection: null
        });
        
        // 세션 브로드캐스트
        this.broadcastToLocal('session_announce', {
            sessionCode: this.sessionCode,
            hostName: playerName,
            maxPlayers: gameSettings.playerCount
        });
        
        console.log(`세션 생성됨: ${this.sessionCode}`);
        return this.sessionCode;
    }

    async joinSession(sessionCode, playerName) {
        this.isHost = false;
        this.playerName = playerName;
        this.sessionCode = sessionCode;
        
        // 호스트에게 참여 요청
        this.broadcastToLocal('join_request', {
            sessionCode,
            playerName,
            from: playerName
        });
        
        return new Promise((resolve, reject) => {
            // 10초 타임아웃
            const timeout = setTimeout(() => {
                reject(new Error('연결 시간 초과'));
            }, 10000);
            
            // 응답 대기
            const checkConnection = () => {
                if (this.connections.size > 0) {
                    clearTimeout(timeout);
                    resolve(true);
                } else {
                    setTimeout(checkConnection, 100);
                }
            };
            checkConnection();
        });
    }

    async handleJoinRequest(data) {
        console.log('참여 요청 받음:', data.playerName);
        
        // 플레이어 추가
        this.players.set(data.playerName, {
            id: data.playerName,
            name: data.playerName,
            isHost: false,
            isReady: false,
            connection: null
        });
        
        // WebRTC 연결 시작
        await this.createPeerConnection(data.playerName);
        
        // 응답 전송
        this.broadcastToLocal('join_response', {
            sessionCode: this.sessionCode,
            accepted: true,
            to: data.playerName,
            from: this.playerName
        });
        
        this.gameController.updateWaitingRoom();
    }

    async handleJoinResponse(data) {
        if (data.accepted) {
            console.log('참여 승인됨');
            await this.createPeerConnection(data.from);
            this.gameController.onP2PConnected();
        } else {
            throw new Error('참여가 거부되었습니다');
        }
    }

    async createPeerConnection(remotePlayerName) {
        const peerConnection = new RTCPeerConnection(this.rtcConfig);
        this.connections.set(remotePlayerName, peerConnection);
        
        // 데이터 채널 생성 (호스트만)
        if (this.isHost) {
            const dataChannel = peerConnection.createDataChannel('game', {
                ordered: true
            });
            this.setupDataChannel(dataChannel, remotePlayerName);
        }
        
        // 데이터 채널 수신 (게스트)
        peerConnection.addEventListener('datachannel', (event) => {
            this.setupDataChannel(event.channel, remotePlayerName);
        });
        
        // ICE 후보 처리
        peerConnection.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
                this.broadcastToLocal('ice_candidate', {
                    candidate: event.candidate,
                    to: remotePlayerName,
                    from: this.playerName
                });
            }
        });
        
        // 연결 상태 모니터링
        peerConnection.addEventListener('connectionstatechange', () => {
            console.log(`연결 상태 (${remotePlayerName}):`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log(`${remotePlayerName}와 연결됨`);
            }
        });
        
        // Offer 생성 (호스트만)
        if (this.isHost) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.broadcastToLocal('offer', {
                offer: offer,
                to: remotePlayerName,
                from: this.playerName
            });
        }
    }

    setupDataChannel(dataChannel, remotePlayerName) {
        this.dataChannels.set(remotePlayerName, dataChannel);
        
        dataChannel.addEventListener('open', () => {
            console.log(`데이터 채널 열림: ${remotePlayerName}`);
        });
        
        dataChannel.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            this.handleGameMessage(message, remotePlayerName);
        });
        
        dataChannel.addEventListener('close', () => {
            console.log(`데이터 채널 닫힘: ${remotePlayerName}`);
        });
    }

    async handleOffer(data) {
        const peerConnection = this.connections.get(data.from);
        if (peerConnection) {
            await peerConnection.setRemoteDescription(data.offer);
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            this.broadcastToLocal('answer', {
                answer: answer,
                to: data.from,
                from: this.playerName
            });
        }
    }

    async handleAnswer(data) {
        const peerConnection = this.connections.get(data.from);
        if (peerConnection) {
            await peerConnection.setRemoteDescription(data.answer);
        }
    }

    async handleIceCandidate(data) {
        const peerConnection = this.connections.get(data.from);
        if (peerConnection) {
            await peerConnection.addIceCandidate(data.candidate);
        }
    }

    broadcastToLocal(type, data) {
        this.broadcastChannel.postMessage({
            type,
            data,
            from: this.playerName,
            timestamp: Date.now()
        });
    }

    broadcastMessage(type, data) {
        const message = {
            type,
            data,
            from: this.playerName,
            timestamp: Date.now()
        };
        
        // 모든 연결된 플레이어에게 전송
        this.dataChannels.forEach((channel, playerName) => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify(message));
            }
        });
    }

    sendToPlayer(playerId, type, data) {
        const channel = this.dataChannels.get(playerId);
        if (channel && channel.readyState === 'open') {
            const message = {
                type,
                data,
                from: this.playerName,
                to: playerId,
                timestamp: Date.now()
            };
            channel.send(JSON.stringify(message));
        }
    }

    handleGameMessage(message, from) {
        console.log('게임 메시지 수신:', message);
        
        switch (message.type) {
            case 'player_ready':
                this.updatePlayerReady(message.data.playerId, message.data.isReady);
                this.gameController.updateWaitingRoom();
                break;

            case 'game_start':
                this.gameController.initializeMultiplayerGame(message.data);
                break;
                
            case 'game_action':
                // 게임 액션 처리
                break;
        }
    }

    getPlayerList() {
        return Array.from(this.players.values());
    }

    updatePlayerReady(playerId, isReady) {
        if (this.players.has(playerId)) {
            this.players.get(playerId).isReady = isReady;
        }
    }

    canStartGame() {
        const players = this.getPlayerList();
        return players.length >= 2 && players.every(p => p.isReady);
    }

    disconnect() {
        // 데이터 채널 닫기
        this.dataChannels.forEach(channel => {
            if (channel.readyState === 'open') {
                channel.close();
            }
        });
        this.dataChannels.clear();
        
        // P2P 연결 닫기
        this.connections.forEach(connection => {
            connection.close();
        });
        this.connections.clear();
        
        // 브로드캐스트 채널 닫기
        this.broadcastChannel.close();
        
        this.players.clear();
    }
}

// 메인 게임 컨트롤러 클래스
class GameController {
    constructor() {
        this.gameState = new GameState();
        this.calculator = new ExpressionCalculator(); // 호환성을 위해 유지
        this.expressionArea = new ExpressionArea(this); // 새로운 수식 영역
        this.selectedCards = [];
        this.originalEquations = []; // 턴 시작 시 등식 백업
        this.originalPlayerCards = null; // 턴 시작 시 플레이어 카드 백업
        this.originalExpressionCards = []; // 턴 시작 시 수식 영역 백업
        this.hasSubmittedAnswer = false; // 이번 턴에 정답을 제출했는지 추적
        this.isAnswerSubmitted = false; // 정답 제출 상태
        this.pendingJokerDrop = null; // 조커 드롭 대기 정보
        
        // 멀티플레이어 관련
        this.p2pManager = new P2PManager(this);
        this.isMultiplayer = false;
        this.isHost = false;
        this.localPlayerName = '';
        this.sessionCode = null;
        this.currentScreen = 'lobby';
        
        this.initializeEventListeners();
        this.showLobby();
    }

    initializeEventListeners() {
        // 로비 관련
        document.getElementById('create-game-btn').addEventListener('click', () => this.showGameSettings());
        document.getElementById('join-game-btn').addEventListener('click', () => this.showJoinModal());
        
        // 게임 참여 모달
        document.getElementById('join-game-confirm').addEventListener('click', () => this.joinGame());
        document.getElementById('join-game-cancel').addEventListener('click', () => this.hideJoinModal());
        
        // 대기실 관련
        document.getElementById('copy-code-btn').addEventListener('click', () => this.copySessionCode());
        document.getElementById('change-settings-btn').addEventListener('click', () => this.showGameSettings());
        document.getElementById('start-multiplayer-game-btn').addEventListener('click', () => this.startMultiplayerGame());
        document.getElementById('toggle-ready-btn').addEventListener('click', () => this.toggleReady());
        document.getElementById('leave-room-btn').addEventListener('click', () => this.leaveRoom());

        // 모달 관련
        document.getElementById('start-game').addEventListener('click', () => this.startNewGame());
        document.getElementById('close-settings').addEventListener('click', () => this.hideSettingsModal());

        // 게임 액션
        document.getElementById('submit-expression').addEventListener('click', () => this.submitExpression());
        document.getElementById('clear-expression').addEventListener('click', () => this.resetTurn());
        document.getElementById('number-card-btn').addEventListener('click', () => this.drawCard('number'));
        document.getElementById('operator-card-btn').addEventListener('click', () => this.drawCard('operator'));
        document.getElementById('restart-game').addEventListener('click', () => this.restartGame());

        // 조커 선택 모달 관련
        document.getElementById('cancel-joker').addEventListener('click', () => this.cancelJokerSelection());
        this.setupJokerSelection();

        // 드래그 앤 드롭 이벤트
        this.setupDragAndDrop();
    }


    applySettingsFromInputs() {
        const readNumber = (id, fallback) => {
            const element = document.getElementById(id);
            if (!element) return fallback;
            const value = parseInt(element.value, 10);
            return Number.isFinite(value) ? value : fallback;
        };

        const updatedSettings = {
            numberSets: readNumber('number-sets', this.gameState.settings.numberSets),
            operatorSets: readNumber('operator-sets', this.gameState.settings.operatorSets),
            jokerCount: readNumber('joker-count', this.gameState.settings.jokerCount),
            playerCount: readNumber('player-count', this.gameState.settings.playerCount),
            initialNumberCards: readNumber('initial-number-cards', this.gameState.settings.initialNumberCards),
            initialOperatorCards: readNumber('initial-operator-cards', this.gameState.settings.initialOperatorCards)
        };

        Object.assign(this.gameState.settings, updatedSettings);
    }

    showLobby() {
        const lobbyScreen = document.getElementById('lobby-screen');
        const waitingRoom = document.getElementById('waiting-room-screen');
        const gameScreen = document.getElementById('game-screen');

        if (lobbyScreen) lobbyScreen.style.display = 'block';
        if (waitingRoom) waitingRoom.style.display = 'none';
        if (gameScreen) gameScreen.style.display = 'none';

        this.currentScreen = 'lobby';
        this.isMultiplayer = false;
        this.isHost = false;
        this.localPlayerName = '';
        this.sessionCode = null;
        this.p2pManager.isReady = false;

        const sessionCodeElement = document.getElementById('session-code');
        if (sessionCodeElement) {
            sessionCodeElement.textContent = '------';
        }

        const waitingPlayers = document.getElementById('waiting-players');
        if (waitingPlayers) {
            waitingPlayers.innerHTML = '';
        }

        const currentPlayers = document.getElementById('current-players');
        if (currentPlayers) {
            currentPlayers.textContent = '0';
        }

        const maxPlayers = document.getElementById('max-players');
        if (maxPlayers) {
            maxPlayers.textContent = this.gameState.settings.playerCount;
        }

        this.hideJoinModal();
    }

    async showGameSettings() {
        if (this.isMultiplayer && this.isHost && this.currentScreen === 'waiting') {
            this.showSettingsModal();
            return;
        }

        this.hideJoinModal();

        const defaultName = this.localPlayerName || '호스트';
        const playerName = prompt('플레이어 이름을 입력하세요', defaultName);
        if (!playerName) {
            return;
        }

        const trimmedName = playerName.trim();
        if (!trimmedName) {
            alert('플레이어 이름을 입력해주세요.');
            return;
        }
        this.localPlayerName = trimmedName;

        this.applySettingsFromInputs();

        this.isMultiplayer = true;
        this.isHost = true;

        try {
            const sessionCode = await this.p2pManager.createSession(this.localPlayerName, this.gameState.settings);
            this.sessionCode = sessionCode;

            const lobbyScreen = document.getElementById('lobby-screen');
            const waitingRoom = document.getElementById('waiting-room-screen');
            const gameScreen = document.getElementById('game-screen');

            if (lobbyScreen) lobbyScreen.style.display = 'none';
            if (waitingRoom) waitingRoom.style.display = 'block';
            if (gameScreen) gameScreen.style.display = 'none';
            this.currentScreen = 'waiting';

            const sessionCodeElement = document.getElementById('session-code');
            if (sessionCodeElement) {
                sessionCodeElement.textContent = sessionCode;
            }

            const maxPlayers = document.getElementById('max-players');
            if (maxPlayers) {
                maxPlayers.textContent = this.gameState.settings.playerCount;
            }

            this.updateWaitingRoom();
        } catch (error) {
            console.error('세션 생성 실패:', error);
            alert('세션을 생성하지 못했습니다. 다시 시도해주세요.');
            this.leaveRoom();
        }
    }

    showJoinModal() {
        const modal = document.getElementById('join-game-modal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideJoinModal() {
        const modal = document.getElementById('join-game-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async joinGame() {
        const codeInput = document.getElementById('join-code');
        const nameInput = document.getElementById('player-name');

        const sessionCode = codeInput ? codeInput.value.trim().toUpperCase() : '';
        const playerName = nameInput ? nameInput.value.trim() : '';

        if (!sessionCode || sessionCode.length !== 6) {
            alert('유효한 6자리 참여 코드를 입력해주세요.');
            return;
        }

        if (!playerName) {
            alert('플레이어 이름을 입력해주세요.');
            return;
        }

        this.hideJoinModal();
        this.isMultiplayer = true;
        this.isHost = false;
        this.localPlayerName = playerName;
        this.p2pManager.isReady = false;

        try {
            await this.p2pManager.joinSession(sessionCode, playerName);
            this.sessionCode = sessionCode;

            // 플레이어 정보 반영
            this.p2pManager.players.set(playerName, {
                id: playerName,
                name: playerName,
                isHost: false,
                isReady: this.p2pManager.isReady,
                connection: null
            });

            const connections = Array.from(this.p2pManager.connections.keys());
            if (connections.length > 0) {
                const hostId = connections[0];
                if (!this.p2pManager.players.has(hostId)) {
                    this.p2pManager.players.set(hostId, {
                        id: hostId,
                        name: hostId,
                        isHost: true,
                        isReady: true,
                        connection: this.p2pManager.connections.get(hostId)
                    });
                }
            }

            const lobbyScreen = document.getElementById('lobby-screen');
            const waitingRoom = document.getElementById('waiting-room-screen');
            const gameScreen = document.getElementById('game-screen');

            if (lobbyScreen) lobbyScreen.style.display = 'none';
            if (waitingRoom) waitingRoom.style.display = 'block';
            if (gameScreen) gameScreen.style.display = 'none';
            this.currentScreen = 'waiting';

            const sessionCodeElement = document.getElementById('session-code');
            if (sessionCodeElement) {
                sessionCodeElement.textContent = sessionCode;
            }

            const maxPlayers = document.getElementById('max-players');
            if (maxPlayers) {
                maxPlayers.textContent = this.gameState.settings.playerCount;
            }

            this.updateWaitingRoom();
        } catch (error) {
            console.error('세션 참여 실패:', error);
            alert('세션에 참여하지 못했습니다. 참여 코드를 확인해주세요.');
            this.showLobby();
        }
    }

    async copySessionCode() {
        if (!this.sessionCode) {
            alert('복사할 세션 코드가 없습니다.');
            return;
        }

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(this.sessionCode);
            } else {
                const tempInput = document.createElement('input');
                tempInput.value = this.sessionCode;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
            }
            alert('세션 코드가 복사되었습니다.');
        } catch (error) {
            console.error('세션 코드 복사 실패:', error);
            alert('세션 코드를 복사하지 못했습니다.');
        }
    }

    startMultiplayerGame() {
        if (!this.isHost) {
            return;
        }

        if (!this.p2pManager.canStartGame()) {
            alert('모든 플레이어가 준비되지 않았습니다.');
            return;
        }

        this.p2pManager.broadcastMessage('game_start', {
            settings: this.gameState.settings
        });

        this.initializeMultiplayerGame();
    }

    toggleReady() {
        if (this.isHost) {
            return;
        }

        this.p2pManager.isReady = !this.p2pManager.isReady;
        this.p2pManager.updatePlayerReady(this.p2pManager.playerName, this.p2pManager.isReady);
        this.p2pManager.broadcastMessage('player_ready', {
            playerId: this.p2pManager.playerName,
            isReady: this.p2pManager.isReady
        });

        this.updateWaitingRoom();
    }

    leaveRoom() {
        if (this.p2pManager) {
            this.p2pManager.disconnect();
        }

        this.p2pManager = new P2PManager(this);
        this.isMultiplayer = false;
        this.isHost = false;
        this.localPlayerName = '';
        this.sessionCode = null;

        this.showLobby();
    }

    updateWaitingRoom() {
        const waitingPlayers = document.getElementById('waiting-players');
        const currentPlayers = document.getElementById('current-players');
        const maxPlayers = document.getElementById('max-players');
        const hostActions = document.getElementById('host-actions');
        const guestActions = document.getElementById('guest-actions');
        const startButton = document.getElementById('start-multiplayer-game-btn');
        const readyButton = document.getElementById('toggle-ready-btn');

        if (!waitingPlayers || !currentPlayers || !maxPlayers) {
            return;
        }

        const players = this.p2pManager ? this.p2pManager.getPlayerList() : [];

        waitingPlayers.innerHTML = '';
        players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'waiting-player';

            const nameElement = document.createElement('div');
            nameElement.className = 'player-name';
            nameElement.textContent = player.isHost ? `${player.name} (호스트)` : player.name;

            const statusElement = document.createElement('div');
            statusElement.className = `player-status ${player.isReady ? 'ready' : 'waiting'}`;
            statusElement.textContent = player.isReady ? '준비 완료' : '대기 중';

            playerElement.appendChild(nameElement);
            playerElement.appendChild(statusElement);
            waitingPlayers.appendChild(playerElement);
        });

        currentPlayers.textContent = players.length.toString();
        maxPlayers.textContent = this.gameState.settings.playerCount;

        if (hostActions) {
            hostActions.style.display = this.isHost ? 'flex' : 'none';
        }

        if (guestActions) {
            guestActions.style.display = this.isHost ? 'none' : 'flex';
        }

        if (startButton) {
            startButton.disabled = !this.p2pManager.canStartGame();
        }

        if (readyButton) {
            readyButton.textContent = this.p2pManager.isReady ? '⌛ 준비 취소' : '✋ 준비 완료';
        }
    }

    onP2PConnected() {
        if (this.currentScreen !== 'waiting') {
            const lobbyScreen = document.getElementById('lobby-screen');
            const waitingRoom = document.getElementById('waiting-room-screen');
            const gameScreen = document.getElementById('game-screen');

            if (lobbyScreen) lobbyScreen.style.display = 'none';
            if (waitingRoom) waitingRoom.style.display = 'block';
            if (gameScreen) gameScreen.style.display = 'none';
            this.currentScreen = 'waiting';
        }

        this.updateWaitingRoom();
    }

    initializeMultiplayerGame(messageData = null) {
        if (messageData && messageData.settings) {
            Object.assign(this.gameState.settings, messageData.settings);
        }

        const players = this.p2pManager ? this.p2pManager.getPlayerList() : [];
        if (players.length > 0) {
            this.gameState.settings.playerCount = players.length;
        }

        const lobbyScreen = document.getElementById('lobby-screen');
        const waitingRoom = document.getElementById('waiting-room-screen');
        const gameScreen = document.getElementById('game-screen');

        if (lobbyScreen) lobbyScreen.style.display = 'none';
        if (waitingRoom) waitingRoom.style.display = 'none';
        if (gameScreen) gameScreen.style.display = 'block';

        this.currentScreen = 'game';
        this.isMultiplayer = true;

        this.initializeGame();

        if (players.length > 0) {
            this.gameState.players.forEach((player, index) => {
                if (players[index]) {
                    player.name = players[index].name;
                }
            });
            this.updateUI();
        }
    }


    setupJokerSelection() {
        // 조커 선택 버튼들에 이벤트 리스너 추가
        document.querySelectorAll('.joker-option').forEach(button => {
            button.addEventListener('click', (e) => {
                const selectedOperator = e.target.dataset.operator;
                this.handleJokerSelection(selectedOperator);
            });
        });
    }

    showJokerSelectionModal() {
        document.getElementById('joker-selection-modal').style.display = 'block';
    }

    hideJokerSelectionModal() {
        document.getElementById('joker-selection-modal').style.display = 'none';
    }

    cancelJokerSelection() {
        this.hideJokerSelectionModal();
        this.pendingJokerDrop = null;
    }

    handleJokerSelection(selectedOperator) {
        this.hideJokerSelectionModal();
        
        if (this.pendingJokerDrop) {
            // 조커 카드에 임시 연산자 설정 (카드 타입은 조커로 유지)
            const jokerCard = this.pendingJokerDrop.card;
            jokerCard.setTemporaryOperator(selectedOperator);
            
            // 원래 드롭 동작 수행
            this.completePendingJokerDrop(jokerCard);
        }
        
        this.pendingJokerDrop = null;
    }

    completePendingJokerDrop(jokerCard) {
        const dropInfo = this.pendingJokerDrop;
        
        if (dropInfo.targetType === 'expression') {
            this.moveCardToExpressionWithJoker(jokerCard, dropInfo.position);
        } else if (dropInfo.targetType === 'equation') {
            this.moveCardToEquationWithJoker(jokerCard, dropInfo.equationId, dropInfo.position);
        } else if (dropInfo.targetType === 'hand') {
            this.moveCardToPlayerHandWithJoker(jokerCard, dropInfo.handType);
        }
    }

    showSettingsModal() {
        document.getElementById('settings-modal').style.display = 'block';
    }

    hideSettingsModal() {
        document.getElementById('settings-modal').style.display = 'none';

        if (this.isMultiplayer && this.isHost && this.currentScreen === 'waiting') {
            this.applySettingsFromInputs();

            const maxPlayers = document.getElementById('max-players');
            if (maxPlayers) {
                maxPlayers.textContent = this.gameState.settings.playerCount;
            }

            this.updateWaitingRoom();
        }
    }

    startNewGame() {
        // 설정 읽기
        this.gameState.settings.numberSets = parseInt(document.getElementById('number-sets').value);
        this.gameState.settings.operatorSets = parseInt(document.getElementById('operator-sets').value);
        this.gameState.settings.jokerCount = parseInt(document.getElementById('joker-count').value);
        this.gameState.settings.playerCount = parseInt(document.getElementById('player-count').value);
        this.gameState.settings.initialNumberCards = parseInt(document.getElementById('initial-number-cards').value);
        this.gameState.settings.initialOperatorCards = parseInt(document.getElementById('initial-operator-cards').value);

        // 카드 수 검증
        const totalNumberCards = this.gameState.settings.numberSets * 10; // 0-9
        const totalOperatorCards = this.gameState.settings.operatorSets * 4 + this.gameState.settings.jokerCount;
        const requiredNumberCards = this.gameState.settings.playerCount * this.gameState.settings.initialNumberCards;
        const requiredOperatorCards = this.gameState.settings.playerCount * this.gameState.settings.initialOperatorCards;

        if (totalNumberCards < requiredNumberCards) {
            alert(`숫자 카드가 부족합니다!\n필요: ${requiredNumberCards}장, 현재: ${totalNumberCards}장\n숫자 카드 세트 수를 늘려주세요.`);
            return;
        }

        if (totalOperatorCards < requiredOperatorCards) {
            alert(`연산자 카드가 부족합니다!\n필요: ${requiredOperatorCards}장, 현재: ${totalOperatorCards}장\n연산자 카드 세트 수나 조커 수를 늘려주세요.`);
            return;
        }

        this.hideSettingsModal();
        this.initializeGame();
    }

    initializeGame() {
        // 덱 생성 및 카드 배분
        const deck = this.gameState.createDeck();
        this.logMessage(`생성된 덱 크기: ${deck.length}`, 'info');
        
        this.gameState.dealCards(deck);
        this.logMessage(`플레이어 수: ${this.gameState.players.length}`, 'info');
        
        // 현재 플레이어 카드 확인
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (currentPlayer) {
            this.logMessage(`플레이어 1 숫자 카드: ${currentPlayer.numberCards.length}장`, 'info');
            this.logMessage(`플레이어 1 연산자 카드: ${currentPlayer.operatorCards.length}장`, 'info');
        }
        
        // 첫 정답 생성
        this.gameState.generateNewTarget();
        
        // 게임 상태 활성화
        this.gameState.isGameActive = true;
        this.gameState.currentPlayer = 0;
        this.gameState.startNewCycle();
        
        // 턴 상태 초기화
        this.hasSubmittedAnswer = false;
        this.isAnswerSubmitted = false;

        // UI 업데이트
        this.updateUI();
        this.logMessage('게임이 시작되었습니다!', 'info');
        this.logMessage(`가능한 정답: ${this.gameState.possibleAnswers.join(', ')}`, 'info');
    }

    backupTurnState() {
        // 등식 백업
        this.originalEquations = this.gameState.fieldEquations.map(eq => ({
            id: eq.id,
            leftSide: [...eq.leftSide],
            rightSide: [...eq.rightSide]
        }));
        
        // 플레이어 카드 백업
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (currentPlayer) {
            this.originalPlayerCards = {
                numberCards: [...currentPlayer.numberCards],
                operatorCards: [...currentPlayer.operatorCards]
            };
        }
        
        // 수식 영역 백업
        this.originalExpressionCards = [...this.expressionArea.cards];
    }

    updateUI() {
        // 턴 시작 시 백업 생성 (처음 한 번만)
        if (this.originalEquations.length === 0 && this.gameState.fieldEquations.length > 0) {
            this.backupTurnState();
        }
        
        // 턴 버튼 상태 업데이트
        this.updateTurnButtons();
        
        // 제출 버튼 상태 업데이트
        this.updateSubmitButton();
        
        // 현재 정답들 표시 (모든 가능한 답)
        const answersElement = document.getElementById('target-answer');
        if (this.gameState.possibleAnswers && this.gameState.possibleAnswers.length > 0) {
            answersElement.textContent = this.gameState.possibleAnswers.join(', ');
        } else {
            answersElement.textContent = '--';
        }
        
        // 정답 카드들 표시
        const cardsElement = document.getElementById('target-cards');
        if (this.gameState.targetCards && this.gameState.targetCards.length > 0) {
            const cardValues = this.gameState.targetCards.map(card => card.value).join(', ');
            cardsElement.textContent = cardValues;
        } else {
            cardsElement.textContent = '--';
        }
        
        // 현재 플레이어 표시
        const currentPlayer = this.gameState.getCurrentPlayer();
        document.getElementById('current-player').textContent = currentPlayer ? currentPlayer.name : '게임 대기중';

        // 플레이어 핸드 업데이트
        this.updatePlayerHand();
        
        // 필드 등식 업데이트
        this.updateFieldEquations();
        
        // 플레이어 상태 업데이트
        this.updatePlayersStatus();
        
        // 수식 영역 업데이트
        this.updateExpressionArea();
        
        // 수식 계산 결과 업데이트
        this.updateExpressionResult();
    }

    updatePlayerHand() {
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (!currentPlayer) return;

        const handNumbers = document.getElementById('hand-numbers');
        const handOperators = document.getElementById('hand-operators');
        
        // 카드 수 업데이트
        document.getElementById('number-count').textContent = currentPlayer.numberCards.length;
        document.getElementById('operator-count').textContent = currentPlayer.operatorCards.length;

        // 숫자 카드 렌더링
        handNumbers.innerHTML = '';
        currentPlayer.numberCards.forEach(card => {
            const element = card.createElement();
            handNumbers.appendChild(element);
        });

        // 연산자 카드 렌더링
        handOperators.innerHTML = '';
        currentPlayer.operatorCards.forEach(card => {
            const element = card.createElement();
            handOperators.appendChild(element);
        });
    }

    updateFieldEquations() {
        const fieldEquations = document.getElementById('field-equations');
        
        if (this.gameState.fieldEquations.length === 0) {
            fieldEquations.innerHTML = '<p class="no-equations">아직 등식이 없습니다.</p>';
            return;
        }

        fieldEquations.innerHTML = '';
        this.gameState.fieldEquations.forEach(equation => {
            const equationElement = this.createEquationElement(equation);
            fieldEquations.appendChild(equationElement);
        });
    }

    createEquationElement(equation) {
        const equationDiv = document.createElement('div');
        const validClass = equation.isValid() ? '' : 'invalid';
        equationDiv.className = `equation ${validClass}`.trim();
        equationDiv.dataset.equationId = equation.id;
        
        // 등식 클릭 시 수식으로 가져오기 (등호 제외한 카드들만)
        equationDiv.addEventListener('click', (e) => {
            // 개별 카드 클릭이 아닌 경우에만 전체 가져오기
            if (!e.target.classList.contains('equation-card')) {
                this.importEquationToExpression(equation);
            }
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'equation-content';

        // 모든 카드를 하나의 컨테이너에 순서대로 표시
        const allCards = document.createElement('div');
        allCards.className = 'equation-cards';
        
        equation.cards.forEach((card, index) => {
            const cardElement = this.createEquationCardElement(card, index);
            allCards.appendChild(cardElement);
        });

        contentDiv.appendChild(allCards);
        equationDiv.appendChild(contentDiv);

        return equationDiv;
    }

    createEquationCardElement(card, index) {
        const element = document.createElement('div');
        element.className = `equation-card ${card.type}`;
        element.dataset.cardId = card.id;
        element.dataset.position = index;
        
        // 등호는 드래그 불가, 나머지는 드래그 가능
        if (card.type !== 'equals') {
            element.draggable = true;
        }

        if (card.type === 'number') {
            element.textContent = card.value;
        } else if (card.type === 'operator') {
            const symbols = { '+': '+', '-': '−', '×': '×', '÷': '÷' };
            element.textContent = symbols[card.value] || card.value;
        } else if (card.type === 'joker') {
            element.textContent = '🃏';
            if (card.temporaryOperator) {
                element.title = `조커 카드 (현재: ${card.temporaryOperator})`;
                element.classList.add('joker-with-operator');
                element.dataset.operator = card.temporaryOperator;
            }
        } else if (card.type === 'equals') {
            element.textContent = '=';
            element.style.cursor = 'default';
            element.classList.add('equation-equals');
        }

        // 등호가 아닌 카드만 드래그 이벤트 추가
        if (card.type !== 'equals') {
            element.addEventListener('dragstart', (e) => {
                element.classList.add('dragging');
                e.dataTransfer.setData('text/plain', card.id);
                e.dataTransfer.setData('source', 'equation');
                e.stopPropagation(); // 등식 클릭 이벤트 방지
            });

            element.addEventListener('dragend', (e) => {
                element.classList.remove('dragging');
            });
        }

        return element;
    }

    updatePlayersStatus() {
        const playersListElement = document.getElementById('players-list');
        playersListElement.innerHTML = '';

        this.gameState.players.forEach((player, index) => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-status';
            if (index === this.gameState.currentPlayer) {
                playerElement.classList.add('active');
            }

            playerElement.innerHTML = `
                <span>${player.name}</span>
                <div class="player-cards">
                    숫자: ${player.numberCards.length}장 | 연산자: ${player.operatorCards.length}장
                </div>
            `;

            playersListElement.appendChild(playerElement);
        });
    }

    updateExpressionArea() {
        const expressionDisplay = document.getElementById('expression-display');
        expressionDisplay.innerHTML = '';
        
        if (this.expressionArea.cards.length === 0) {
            const placeholder = document.createElement('span');
            placeholder.textContent = '카드를 드래그해서 수식을 만드세요';
            placeholder.style.color = '#a0aec0';
            placeholder.style.fontStyle = 'italic';
            expressionDisplay.appendChild(placeholder);
        } else {
            // 각 카드를 개별 요소로 표시
            this.expressionArea.cards.forEach((card, index) => {
                const cardElement = this.createExpressionCardElement(card, index);
                expressionDisplay.appendChild(cardElement);
            });
        }
    }

    createExpressionCardElement(card, position) {
        const element = document.createElement('div');
        element.className = `card ${card.type} expression-card`;
        element.dataset.cardId = card.id;
        element.dataset.position = position;
        element.draggable = true;

        if (card.type === 'number') {
            element.textContent = card.value;
        } else if (card.type === 'operator') {
            const symbols = { '+': '+', '-': '−', '×': '×', '÷': '÷' };
            element.textContent = symbols[card.value] || card.value;
        } else if (card.type === 'joker') {
            element.textContent = '🃏';
            if (card.temporaryOperator) {
                element.title = `조커 카드 (현재: ${card.temporaryOperator})`;
                element.classList.add('joker-with-operator');
                element.dataset.operator = card.temporaryOperator;
            }
        }

        // 드래그 이벤트
        element.addEventListener('dragstart', (e) => {
            element.classList.add('dragging');
            e.dataTransfer.setData('text/plain', card.id);
            e.dataTransfer.setData('source', 'expression');
        });

        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
        });

        // 클릭으로 제거
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeCardFromExpression(card.id);
        });

        return element;
    }

    updateExpressionResult() {
        const result = this.expressionArea.calculate();
        const resultElement = document.getElementById('calculated-result');
        const submitButton = document.getElementById('submit-expression');
        
        if (result !== null) {
            resultElement.textContent = result;
            
            // 정답 확인
            const isCorrect = this.gameState.possibleAnswers && this.gameState.possibleAnswers.includes(result);
            submitButton.disabled = !isCorrect;
            
            if (isCorrect) {
                resultElement.style.color = '#38a169';
                submitButton.textContent = '정답 제출 ✓';
            } else {
                resultElement.style.color = '#e53e3e';
                submitButton.textContent = '정답 제출';
            }
        } else {
            resultElement.textContent = '--';
            resultElement.style.color = '#4a5568';
            submitButton.disabled = true;
            submitButton.textContent = '정답 제출';
        }
    }

    setupDragAndDrop() {
        const container = document.querySelector('.game-container');
        
        container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('card')) {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.cardId);
            }
        });

        container.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('card')) {
                e.target.classList.remove('dragging');
            }
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // 이전 시각적 피드백 제거
            document.querySelectorAll('.drop-zone').forEach(el => el.classList.remove('drop-zone'));
            document.querySelectorAll('.drop-target-before, .drop-target-after').forEach(el => {
                el.classList.remove('drop-target-before', 'drop-target-after');
            });
            
            // 드롭 가능한 영역들
            const dropZones = [
                '.expression-display',
                '.equation',
                '.hand-numbers',
                '.hand-operators'
            ];
            
            for (const zone of dropZones) {
                if (e.target.classList.contains(zone.slice(1)) || 
                    e.target.closest(zone)) {
                    const element = e.target.closest(zone) || e.target;
                    element.classList.add('drop-zone');
                    
                    // 수식 영역의 경우 정확한 삽입 위치 표시
                    if (zone === '.expression-display') {
                        this.showDropIndicator(e, 'expression');
                    } else if (zone === '.equation') {
                        this.showDropIndicator(e, 'equation');
                    }
                    break;
                }
            }
        });

        container.addEventListener('dragleave', (e) => {
            // 컨테이너를 완전히 벗어났을 때만 제거
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;
            
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                document.querySelectorAll('.drop-zone').forEach(el => el.classList.remove('drop-zone'));
                document.querySelectorAll('.drop-target-before, .drop-target-after').forEach(el => {
                    el.classList.remove('drop-target-before', 'drop-target-after');
                });
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            
            // 모든 시각적 피드백 제거
            document.querySelectorAll('.drop-zone').forEach(el => el.classList.remove('drop-zone'));
            document.querySelectorAll('.drop-target-before, .drop-target-after').forEach(el => {
                el.classList.remove('drop-target-before', 'drop-target-after');
            });
            
            const cardId = e.dataTransfer.getData('text/plain');
            const source = e.dataTransfer.getData('source');
            
            // 드롭되는 카드가 조커인지 확인
            const droppedCard = this.findCardById(cardId);
            if (droppedCard && droppedCard.type === 'joker') {
                // 조커 카드인 경우 드롭 정보를 저장하고 선택 모달 표시
                this.pendingJokerDrop = {
                    card: droppedCard,
                    source: source,
                    event: e
                };
                
                // 드롭 대상 정보 저장
                if (e.target.classList.contains('expression-display') || 
                    e.target.closest('.expression-display')) {
                    this.pendingJokerDrop.targetType = 'expression';
                    this.pendingJokerDrop.position = this.calculateDropPosition(e, 'expression');
                } else if (e.target.classList.contains('equation') || 
                          e.target.closest('.equation')) {
                    const equationElement = e.target.closest('.equation');
                    if (equationElement) {
                        this.pendingJokerDrop.targetType = 'equation';
                        this.pendingJokerDrop.equationId = equationElement.dataset.equationId;
                        this.pendingJokerDrop.position = this.calculateDropPosition(e, 'equation');
                    }
                } else if (e.target.classList.contains('hand-numbers') || 
                          e.target.closest('.hand-numbers')) {
                    this.pendingJokerDrop.targetType = 'hand';
                    this.pendingJokerDrop.handType = 'number';
                } else if (e.target.classList.contains('hand-operators') || 
                          e.target.closest('.hand-operators')) {
                    this.pendingJokerDrop.targetType = 'hand';
                    this.pendingJokerDrop.handType = 'operator';
                }
                
                this.showJokerSelectionModal();
                return;
            }
            
            // 일반 카드인 경우 기존 로직 수행
            if (e.target.classList.contains('expression-display') || 
                e.target.closest('.expression-display')) {
                // 수식 영역에 드롭 - 위치 계산
                const position = this.calculateDropPosition(e, 'expression');
                this.moveCardToExpression(cardId, source, position);
            } else if (e.target.classList.contains('equation') || 
                      e.target.closest('.equation')) {
                // 등식에 드롭 - 위치 계산
                const equationElement = e.target.closest('.equation');
                if (equationElement) {
                    const position = this.calculateDropPosition(e, 'equation');
                    this.moveCardToEquation(cardId, equationElement.dataset.equationId, source, position);
                }
            } else if (e.target.classList.contains('hand-numbers') || 
                      e.target.closest('.hand-numbers')) {
                // 플레이어 숫자 카드 영역에 드롭
                this.moveCardToPlayerHand(cardId, 'number', source);
            } else if (e.target.classList.contains('hand-operators') || 
                      e.target.closest('.hand-operators')) {
                // 플레이어 연산자 카드 영역에 드롭
                this.moveCardToPlayerHand(cardId, 'operator', source);
            }
        });

        // 수식 영역 클릭으로 카드 제거
        document.getElementById('expression-display').addEventListener('click', () => {
            this.removeLastCardFromExpression();
        });
    }

    calculateDropPosition(event, areaType) {
        let targetContainer;
        let cards;
        
        if (areaType === 'expression') {
            targetContainer = document.getElementById('expression-display');
            cards = targetContainer.querySelectorAll('.expression-card');
        } else if (areaType === 'equation') {
            const equationElement = event.target.closest('.equation');
            targetContainer = equationElement.querySelector('.equation-cards');
            cards = targetContainer.querySelectorAll('.equation-card');
        } else {
            return null; // 맨 뒤에 추가
        }
        
        if (cards.length === 0) {
            return 0; // 맨 앞에 추가
        }
        
        const containerRect = targetContainer.getBoundingClientRect();
        const dropX = event.clientX - containerRect.left;
        
        // 각 카드의 위치와 비교하여 삽입 위치 결정
        for (let i = 0; i < cards.length; i++) {
            const cardRect = cards[i].getBoundingClientRect();
            const cardX = cardRect.left - containerRect.left;
            const cardMiddle = cardX + cardRect.width / 2;
            
            if (dropX < cardMiddle) {
                return i; // 이 카드 앞에 삽입
            }
        }
        
        return cards.length; // 맨 뒤에 추가
    }

    showDropIndicator(event, areaType) {
        let targetContainer;
        let cards;
        
        if (areaType === 'expression') {
            targetContainer = document.getElementById('expression-display');
            cards = targetContainer.querySelectorAll('.expression-card');
        } else if (areaType === 'equation') {
            const equationElement = event.target.closest('.equation');
            targetContainer = equationElement.querySelector('.equation-cards');
            cards = targetContainer.querySelectorAll('.equation-card');
        } else {
            return;
        }
        
        if (cards.length === 0) {
            return; // 카드가 없으면 표시할 필요 없음
        }
        
        const containerRect = targetContainer.getBoundingClientRect();
        const dropX = event.clientX - containerRect.left;
        
        // 각 카드의 위치와 비교하여 시각적 표시
        for (let i = 0; i < cards.length; i++) {
            const cardRect = cards[i].getBoundingClientRect();
            const cardX = cardRect.left - containerRect.left;
            const cardMiddle = cardX + cardRect.width / 2;
            
            if (dropX < cardMiddle) {
                cards[i].classList.add('drop-target-before');
                return;
            }
        }
        
        // 마지막 카드 뒤에 표시
        if (cards.length > 0) {
            cards[cards.length - 1].classList.add('drop-target-after');
        }
    }

    importEquationToExpression(equation) {
        // 등식의 등호를 제외한 모든 카드를 수식으로 가져오기
        const cardsToImport = equation.getAllCards(); // 등호 제외
        cardsToImport.forEach(card => {
            this.expressionArea.addCard(card);
        });
        
        // 등식을 필드에서 제거
        this.gameState.removeEquation(equation.id);
        
        this.updateUI();
        
        this.logMessage(`등식 "${equation.getDisplayString()}"를 수식으로 가져왔습니다.`, 'info');
    }

    moveCardToExpression(cardId, source, position = null) {
        const card = this.findAndRemoveCard(cardId, source);
        if (card) {
            this.expressionArea.addCard(card, position);
            this.updateUI();
        }
    }

    moveCardToEquation(cardId, equationId, source, position = null) {
        const card = this.findAndRemoveCard(cardId, source);
        if (card) {
            const equation = this.gameState.fieldEquations.find(eq => eq.id === equationId);
            if (equation) {
                if (position !== null && position >= 0 && position <= equation.cards.length) {
                    equation.insertCard(card, position);
                } else {
                    equation.cards.push(card);
                }
                this.updateUI();
            }
        }
    }

    moveCardToExpressionWithJoker(jokerCard, position = null) {
        // 조커 카드를 제거하고 수식 영역에 추가
        const originalCard = this.findAndRemoveCard(jokerCard.id, this.pendingJokerDrop.source);
        if (originalCard) {
            this.expressionArea.addCard(jokerCard, position);
            this.updateUI();
        }
    }

    moveCardToEquationWithJoker(jokerCard, equationId, position = null) {
        // 조커 카드를 제거하고 등식에 추가
        const originalCard = this.findAndRemoveCard(jokerCard.id, this.pendingJokerDrop.source);
        if (originalCard) {
            const equation = this.gameState.fieldEquations.find(eq => eq.id === equationId);
            if (equation) {
                if (position !== null && position >= 0 && position <= equation.cards.length) {
                    equation.insertCard(jokerCard, position);
                } else {
                    equation.cards.push(jokerCard);
                }
                this.updateUI();
            }
        }
    }

    moveCardToPlayerHandWithJoker(jokerCard, handType) {
        // 조커 카드를 손패로 이동할 때 상태 리셋
        const originalCard = this.findAndRemoveCard(jokerCard.id, this.pendingJokerDrop.source);
        if (originalCard) {
            // 손패로 돌아갈 때 조커 상태 리셋
            jokerCard.clearTemporaryOperator();
            
            const currentPlayer = this.gameState.getCurrentPlayer();
            if (currentPlayer) {
                if (handType === 'number' && jokerCard.type === 'number') {
                    currentPlayer.numberCards.push(jokerCard);
                } else if (handType === 'operator' && (jokerCard.type === 'operator' || jokerCard.type === 'joker')) {
                    currentPlayer.operatorCards.push(jokerCard);
                } else {
                    // 타입이 맞지 않으면 원래 위치로 복구
                    this.restoreCard(originalCard, this.pendingJokerDrop.source);
                    return;
                }
                this.updateUI();
            }
        }
    }

    moveCardToPlayerHand(cardId, handType, source) {
        const card = this.findAndRemoveCard(cardId, source);
        if (card) {
            // 조커 카드가 손패로 돌아갈 때 상태 리셋
            if (card.type === 'joker') {
                card.clearTemporaryOperator();
            }
            
            const currentPlayer = this.gameState.getCurrentPlayer();
            if (currentPlayer) {
                if (handType === 'number' && card.type === 'number') {
                    currentPlayer.numberCards.push(card);
                } else if (handType === 'operator' && (card.type === 'operator' || card.type === 'joker')) {
                    currentPlayer.operatorCards.push(card);
                } else {
                    // 타입이 맞지 않으면 원래 위치로 복구
                    this.restoreCard(card, source);
                    return;
                }
                this.updateUI();
            }
        }
    }

    findAndRemoveCard(cardId, source) {
        const currentPlayer = this.gameState.getCurrentPlayer();
        
        // 수식 영역에서 찾기
        if (source === 'expression') {
            return this.expressionArea.removeCard(cardId);
        }
        
        // 플레이어 카드에서 찾기
        if (currentPlayer) {
            let index = currentPlayer.numberCards.findIndex(c => c.id === cardId);
            if (index !== -1) {
                return currentPlayer.numberCards.splice(index, 1)[0];
            }
            
            index = currentPlayer.operatorCards.findIndex(c => c.id === cardId);
            if (index !== -1) {
                return currentPlayer.operatorCards.splice(index, 1)[0];
            }
        }
        
        // 등식에서 찾기
        for (let equation of this.gameState.fieldEquations) {
            const removedCard = equation.removeCard(cardId);
            if (removedCard) {
                return removedCard;
            }
        }
        
        return null;
    }

    restoreCard(card, source) {
        // 카드를 원래 위치로 복구하는 로직
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (currentPlayer) {
            if (card.type === 'number') {
                currentPlayer.numberCards.push(card);
            } else {
                currentPlayer.operatorCards.push(card);
            }
        }
    }

    removeCardFromExpression(cardId) {
        this.expressionArea.removeCard(cardId);
        this.updateUI();
    }

    addCardToExpression(cardId) {
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (!currentPlayer) return;

        // 플레이어 카드에서 찾기
        let card = null;
        let isFromField = false;

        // 숫자 카드에서 찾기
        card = currentPlayer.numberCards.find(c => c.id === cardId);
        
        if (!card) {
            // 연산자 카드에서 찾기
            card = currentPlayer.operatorCards.find(c => c.id === cardId);
        }

        if (!card) {
            // 필드 등식의 카드에서 찾기
            const fieldCards = this.gameState.getAvailableFieldCards();
            card = fieldCards.find(c => c.id === cardId);
            isFromField = true;
        }

        if (card) {
            this.calculator.addCard(card, isFromField);
            this.updateExpressionResult();
        }
    }


    removeLastCardFromExpression() {
        this.calculator.removeLastCard();
        this.updateExpressionResult();
    }

    resetTurn() {
        // 수식 영역 초기화
        this.expressionArea.clear();
        this.calculator.clear();
        
        // 등식 복원
        if (this.originalEquations.length > 0) {
            this.restoreEquations();
        }
        
        // 플레이어 카드 복원
        if (this.originalPlayerCards) {
            this.restorePlayerCards();
        }
        
        // 수식 영역 복원
        if (this.originalExpressionCards.length > 0) {
            this.restoreExpressionArea();
        }
        
        // 턴 상태 초기화
        this.hasSubmittedAnswer = false;
        this.isAnswerSubmitted = false;
        
        this.updateUI();
        this.logMessage('턴이 초기화되었습니다.', 'info');
    }

    restoreEquations() {
        // 백업된 등식들로 복원
        this.gameState.fieldEquations = this.originalEquations.map(backup => {
            const leftSide = backup.leftSide.map(cardData => 
                this.findCardById(cardData.id) || cardData
            );
            const rightSide = backup.rightSide.map(cardData => 
                this.findCardById(cardData.id) || cardData
            );
            
            const equation = new Equation(leftSide, rightSide);
            equation.id = backup.id;
            return equation;
        });
    }

    restorePlayerCards() {
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (currentPlayer && this.originalPlayerCards) {
            currentPlayer.numberCards = [...this.originalPlayerCards.numberCards];
            currentPlayer.operatorCards = [...this.originalPlayerCards.operatorCards];
        }
    }

    restoreExpressionArea() {
        this.expressionArea.clear();
        this.originalExpressionCards.forEach(card => {
            this.expressionArea.addCard(card);
        });
    }

    clearBackups() {
        this.originalEquations = [];
        this.originalPlayerCards = null;
        this.originalExpressionCards = [];
    }

    updateTurnButtons() {
        const drawNumberBtn = document.getElementById('number-card-btn');
        const drawOperatorBtn = document.getElementById('operator-card-btn');

        if (drawNumberBtn && drawOperatorBtn) {
            if (this.isAnswerSubmitted || this.hasSubmittedAnswer) {
                // 정답을 제출한 경우: 카드 뽑기 비활성화
                drawNumberBtn.disabled = true;
                drawOperatorBtn.disabled = true;
            } else {
                // 정답을 제출하지 않은 경우: 카드 뽑기 활성화
                drawNumberBtn.disabled = false;
                drawOperatorBtn.disabled = false;
            }
        }
    }

    clearExpression() {
        this.calculator.clear();
        this.updateExpressionResult();
    }

    submitExpression() {
        const result = this.expressionArea.calculate();
        const isCorrect = this.gameState.possibleAnswers && this.gameState.possibleAnswers.includes(result);
        
        if (!isCorrect) {
            this.logMessage('올바르지 않은 정답입니다.', 'error');
            return;
        }

        // 정답 처리
        this.processCorrectAnswer();
        
        // 정답 제출 상태로 변경
        this.isAnswerSubmitted = true;
        this.updateSubmitButton();
        this.updateUI();
    }

    processCorrectAnswer() {
        const currentPlayer = this.gameState.getCurrentPlayer();
        
        // 정답 제출 표시
        this.hasSubmittedAnswer = true;
        
        // 백업 초기화 (정답 달성 시 변경사항 확정)
        this.clearBackups();
        
        // 정답에 해당하는 카드들을 정답 카드 풀에서 가져오기
        const result = this.expressionArea.calculate();
        const answerCards = this.findMatchingTargetCards(result);
        
        if (!answerCards || answerCards.length === 0) {
            this.logMessage('정답 카드를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 수식 영역의 모든 카드를 등식의 왼쪽으로 사용
        const leftSideCards = [...this.expressionArea.cards];
        
        // 수식 영역 초기화
        this.expressionArea.clear();

        // 사용된 정답 카드들을 정답 카드 풀에서 제거
        answerCards.forEach(card => {
            const index = this.gameState.targetCards.findIndex(c => c.id === card.id);
            if (index !== -1) {
                this.gameState.targetCards.splice(index, 1);
            }
        });

        // 새로운 등식 생성 (정답 카드들을 오른쪽에 배치)
        const newEquation = new Equation(leftSideCards, answerCards);
        
        // 필드에서 사용된 카드들의 등식 제거 (필요시)
        if (this.calculator.usedFieldCards.length > 0) {
            const affectedEquations = this.findEquationsWithCards(this.calculator.usedFieldCards);
            this.handleBrokenEquations(affectedEquations, currentPlayer);
        }

        // 새 등식을 필드에 추가
        this.gameState.fieldEquations.push(newEquation);

        // 승리 조건 확인
        const victoryCheck = this.gameState.checkVictory(currentPlayer);
        if (victoryCheck.hasWon) {
            this.endGame(currentPlayer, victoryCheck);
            return;
        }

        // 정답을 맞혔으므로 현재 사이클에서 정답이 나왔음을 표시
        this.gameState.hasAnswerThisCycle = true;
        
        // 정답 카드를 덱으로 되돌리고 새 정답 생성
        this.gameState.generateNewTarget();
        
        // UI 업데이트
        this.updateUI();
        
        this.logMessage(`${currentPlayer.name}이(가) 정답을 맞혔습니다!`, 'success');
        this.logMessage(`새로운 등식이 필드에 추가되었습니다: ${newEquation.getDisplayString()}`, 'info');
        this.logMessage(`새로운 가능한 정답: ${this.gameState.possibleAnswers.join(', ')}`, 'info');
    }

    findMatchingTargetCards(result) {
        // 현재 정답에서 해당 결과와 일치하는 카드 조합 찾기
        for (let i = 0; i < this.gameState.possibleAnswers.length; i++) {
            if (this.gameState.possibleAnswers[i] === result) {
                // 해당 정답을 만드는 카드 조합 찾기
                const targetStr = result.toString();
                const matchingCards = [];
                
                // 정답 카드들에서 해당 조합 찾기
                if (targetStr.length === 1) {
                    // 1자리 수인 경우
                    const card = this.gameState.targetCards.find(c => c.value === result);
                    if (card) matchingCards.push(card);
                } else {
                    // 2자리 이상인 경우 - 카드 조합으로 만들어진 수
                    const digits = targetStr.split('').map(d => parseInt(d));
                    const usedCards = [];
                    
                    for (let digit of digits) {
                        const card = this.gameState.targetCards.find(c => 
                            c.value === digit && !usedCards.includes(c)
                        );
                        if (card) {
                            matchingCards.push(card);
                            usedCards.push(card);
                        }
                    }
                }
                
                return matchingCards;
            }
        }
        return [];
    }

    findEquationsWithCards(cards) {
        return this.gameState.fieldEquations.filter(equation => {
            return equation.getAllCards().some(eqCard => 
                cards.some(usedCard => usedCard.id === eqCard.id)
            );
        });
    }

    handleBrokenEquations(brokenEquations, currentPlayer) {
        brokenEquations.forEach(equation => {
            // 등식의 모든 카드를 현재 플레이어에게 돌려줌
            equation.getAllCards().forEach(card => {
                if (card.type === 'number') {
                    currentPlayer.numberCards.push(card);
                } else {
                    currentPlayer.operatorCards.push(card);
                }
            });
            
            // 필드에서 등식 제거
            this.gameState.removeEquation(equation.id);
            
            this.logMessage(`등식이 깨져서 모든 카드를 가져왔습니다: ${equation.getDisplayString()}`, 'error');
        });
    }

    drawCard(cardType) {
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (!currentPlayer) {
            this.logMessage('유효하지 않은 플레이어입니다.', 'error');
            return;
        }

        // 요청된 타입의 카드 찾기
        let availableCards = [];
        if (cardType === 'number') {
            availableCards = this.gameState.remainingDeck.filter(card => card.type === 'number');
        } else if (cardType === 'operator') {
            availableCards = this.gameState.remainingDeck.filter(card => card.type === 'operator' || card.type === 'joker');
        }

        if (availableCards.length === 0) {
            this.logMessage(`더 이상 뽑을 ${cardType === 'number' ? '숫자' : '연산자'} 카드가 없습니다.`, 'error');
            return;
        }

        // 랜덤으로 카드 선택
        const randomIndex = Math.floor(Math.random() * availableCards.length);
        const drawnCard = availableCards[randomIndex];
        
        // 덱에서 제거
        const deckIndex = this.gameState.remainingDeck.findIndex(card => card.id === drawnCard.id);
        if (deckIndex !== -1) {
            this.gameState.remainingDeck.splice(deckIndex, 1);
        }

        // 플레이어에게 추가
        if (drawnCard.type === 'number') {
            currentPlayer.numberCards.push(drawnCard);
        } else {
            currentPlayer.operatorCards.push(drawnCard);
        }

        const cardTypeName = drawnCard.type === 'number' ? '숫자' : 
                            drawnCard.type === 'joker' ? '조커' : '연산자';
        this.logMessage(`${currentPlayer.name}이(가) ${cardTypeName} 카드를 뽑았습니다.`, 'info');
        
        // 턴 초기화 후 턴 종료
        this.resetTurn();
        
        // 백업 초기화 후 턴 종료
        this.clearBackups();
        
        // 턴 상태 초기화
        this.hasSubmittedAnswer = false;
        
        this.passTurn();
    }


    findCardById(cardId) {
        // 모든 곳에서 카드 찾기
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (!currentPlayer) return null;
        
        // 플레이어 카드에서 찾기
        let card = [...currentPlayer.numberCards, ...currentPlayer.operatorCards]
            .find(c => c.id === cardId);
        
        if (!card) {
            // 필드 카드에서 찾기
            const fieldCards = this.gameState.getAvailableFieldCards();
            card = fieldCards.find(c => c.id === cardId);
        }
        
        return card;
    }

    passTurn() {
        // 정답을 제출하지 않은 경우 턴 초기화
        if (!this.hasSubmittedAnswer) {
            this.resetTurn();
        }
        
        // 백업 초기화
        this.clearBackups();
        
        // 턴 상태 초기화
        this.hasSubmittedAnswer = false;
        this.isAnswerSubmitted = false;
        
        this.clearExpression();
        const cycleCompleted = this.gameState.nextPlayer();
        
        // 사이클이 완료되었고 아무도 정답을 맞히지 못한 경우
        if (cycleCompleted && !this.gameState.hasAnswerThisCycle) {
            this.handleNoCycleAnswer();
        }
        
        this.updateUI();
        
        const newPlayer = this.gameState.getCurrentPlayer();
        this.logMessage(`${newPlayer.name}의 턴입니다.`, 'info');
    }

    handleNoCycleAnswer() {
        this.logMessage('한 사이클 동안 아무도 정답을 맞히지 못했습니다!', 'info');
        
        // 정답 카드 한 장 추가
        const beforeCount = this.gameState.targetCards.length;
        this.gameState.addTargetCard();
        const afterCount = this.gameState.targetCards.length;
        
        if (afterCount > beforeCount) {
            const newCard = this.gameState.targetCards[afterCount - 1];
            this.logMessage(`새로운 정답 카드 추가: ${newCard.value}`, 'info');
            this.logMessage(`새로운 가능한 정답: ${this.gameState.possibleAnswers.join(', ')}`, 'info');
        } else {
            this.logMessage('더 이상 추가할 정답 카드가 없습니다.', 'error');
        }
        
        // 새로운 사이클 시작
        this.gameState.startNewCycle();
    }

    endGame(winner, victoryType) {
        this.gameState.isGameActive = false;
        
        let victoryMessage = `${winner.name}이(가) 승리했습니다!\n`;
        if (victoryType.numberVictory) {
            victoryMessage += '모든 숫자 카드를 사용했습니다.';
        } else if (victoryType.operatorVictory) {
            victoryMessage += '모든 연산자 카드를 사용했습니다.';
        }

        document.getElementById('victory-message').textContent = victoryMessage;
        document.getElementById('victory-modal').style.display = 'block';
        
        this.logMessage(victoryMessage, 'success');
    }

    restartGame() {
        document.getElementById('victory-modal').style.display = 'none';
        this.showSettingsModal();
    }

    updateSubmitButton() {
        const submitBtn = document.getElementById('submit-expression');
        if (!submitBtn) return; // 요소가 없으면 종료
        
        const expressionResult = this.expressionArea.calculate();
        const isValidAnswer = this.gameState.possibleAnswers && this.gameState.possibleAnswers.includes(expressionResult);
        const hasExpression = this.expressionArea.cards.length > 0;
        
        if (this.isAnswerSubmitted) {
            // 정답을 제출한 상태
            if (isValidAnswer && expressionResult !== null && hasExpression) {
                // 새로운 정답 수식이 있으면 다시 제출 가능
                submitBtn.textContent = '정답 제출';
                submitBtn.disabled = false;
                submitBtn.className = 'action-btn submit-btn';
                submitBtn.onclick = () => this.submitExpression();
                // 새로운 정답이 감지되면 isAnswerSubmitted를 false로 변경
                this.isAnswerSubmitted = false;
            } else {
                // 턴 종료 버튼 상태
                submitBtn.textContent = '턴 종료';
                submitBtn.disabled = false;
                submitBtn.className = 'action-btn submit-btn';
                submitBtn.onclick = () => this.endTurn();
            }
        } else {
            // 아직 정답을 제출하지 않은 상태
            submitBtn.textContent = '정답 제출';
            submitBtn.disabled = !isValidAnswer || !hasExpression;
            submitBtn.className = 'action-btn submit-btn';
            submitBtn.onclick = () => this.submitExpression();
        }
    }

    endTurn() {
        // 정답 제출 후 턴 종료
        this.isAnswerSubmitted = false;
        this.hasSubmittedAnswer = true;
        
        // 새로운 사이클 시작 (정답을 맞혔을 때만)
        if (this.gameState.hasAnswerThisCycle) {
            this.gameState.startNewCycle();
        }
        
        this.passTurn();
    }

    logMessage(message, type = 'info') {
        const logContainer = document.getElementById('log-messages');
        if (!logContainer) return; // 로그 컨테이너가 없으면 무시
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}

// 게임 초기화
document.addEventListener('DOMContentLoaded', () => {
    new GameController();
});

