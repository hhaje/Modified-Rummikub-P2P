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
            console.log('드래그 시작:', this.id, this.type, this.value);
            
            // 멀티플레이어에서 내 차례가 아닌 경우 드래그 방지
            if (window.gameController && window.gameController.isMultiplayer) {
                const players = window.gameController.p2pManager.getPlayerList();
                const myIndex = players.findIndex(p => p.name === window.gameController.p2pManager.playerName);
                const isMyTurn = window.gameController.gameState.currentPlayer === myIndex;
                
                if (!isMyTurn) {
                    console.log('내 차례가 아니므로 드래그를 방지합니다.');
                    e.preventDefault();
                    return;
                }
            }
            
            e.dataTransfer.setData('text/plain', this.id);
            e.dataTransfer.setData('source', 'hand');
            element.classList.add('dragging');
        });

        element.addEventListener('dragend', (e) => {
            console.log('드래그 종료:', this.id);
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
    constructor(gameController = null) {
        this.gameController = gameController;
        this.players = [];
        this.currentPlayer = 0;
        this.targetAnswer = null;
        this.targetCards = [];
        this.possibleAnswers = []; // 가능한 모든 정답들
        this.fieldEquations = []; // 필드의 등식들
        this.remainingDeck = []; // 남은 카드 덱
        this.isGameActive = false;
        // 새로운 사이클 시스템
        this.cycleStartPlayer = 0; // 사이클 시작 플레이어
        this.cycleCompleted = false; // 사이클 완료 여부
        this.cycleAnswerFound = false; // 현재 사이클에서 정답 발견 여부
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

    dealCards(deck, playerNames = null) {
        console.log('dealCards 시작, 덱 크기:', deck.length);
        this.players = [];
        
        // 카드 타입별로 미리 분리
        const availableNumberCards = deck.filter(card => card.type === 'number');
        const availableOperatorCards = deck.filter(card => card.type === 'operator' || card.type === 'joker');
        
        console.log('사용 가능한 숫자 카드:', availableNumberCards.length);
        console.log('사용 가능한 연산자 카드:', availableOperatorCards.length);
        
        for (let i = 0; i < this.settings.playerCount; i++) {
            const playerName = playerNames && playerNames[i] ? playerNames[i] : `플레이어 ${i + 1}`;
            const player = {
                id: i,
                name: playerName,
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
        // 멀티플레이어에서는 현재 플레이어를 P2PManager에서 가져옴
        if (this.gameController && this.gameController.isMultiplayer) {
            const players = this.gameController.p2pManager.getPlayerList();
            
            if (players && players.length > 0 && this.currentPlayer >= 0 && this.currentPlayer < players.length) {
                const currentPlayerName = players[this.currentPlayer]?.name;
                
                if (currentPlayerName) {
                    // 실제 카드 정보가 있는 플레이어 찾기
                    const actualPlayer = this.players.find(p => p.name === currentPlayerName);
                    if (actualPlayer) {
                        return actualPlayer;
                    } else {
                        // P2PManager에서 플레이어 정보 찾기
                        const p2pPlayer = this.gameController.p2pManager.players.get(currentPlayerName);
                        if (p2pPlayer) {
                            return {
                                id: this.currentPlayer,
                                name: currentPlayerName,
                                numberCards: [], // 멀티플레이어에서는 카드 정보를 직접 노출하지 않음
                                operatorCards: [],
                                isHost: p2pPlayer.isHost,
                                isReady: p2pPlayer.isReady
                            };
                        } else {
                            return {
                                id: this.currentPlayer,
                                name: currentPlayerName,
                                numberCards: [], // 멀티플레이어에서는 카드 정보를 직접 노출하지 않음
                                operatorCards: []
                            };
                        }
                    }
                }
            }
            return null;
        }
        
        // 솔로플레이에서는 기존 로직 사용
        return this.players[this.currentPlayer];
    }

    nextPlayer() {
        // 멀티플레이어에서는 실제 플레이어 수 사용
        const playerCount = (this.gameController && this.gameController.isMultiplayer) 
            ? this.gameController.p2pManager.getPlayerList().length 
            : this.players.length;
        
        this.currentPlayer = (this.currentPlayer + 1) % playerCount;
        
        // 사이클 완료 체크 (모든 플레이어가 한 번씩 플레이했는지)
        if (this.currentPlayer === this.cycleStartPlayer) {
            this.cycleCompleted = true;
            return true; // 사이클 완료
        }
        return false; // 사이클 진행 중
    }

    startNewCycle() {
        this.cycleStartPlayer = this.currentPlayer;
        this.cycleCompleted = false;
        this.cycleAnswerFound = false;
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
        console.log('=== removeEquation 호출 ===');
        console.log('제거할 등식 ID:', equationId);
        console.log('현재 필드 등식 수:', this.fieldEquations.length);
        console.log('현재 필드 등식들:', this.fieldEquations.map(eq => ({id: eq.id, cards: eq.cards.length})));
        
        const index = this.fieldEquations.findIndex(eq => eq.id === equationId);
        console.log('찾은 인덱스:', index);
        
        if (index !== -1) {
            const removedEquation = this.fieldEquations.splice(index, 1)[0];
            console.log('등식 제거 완료:', removedEquation.id);
            console.log('제거 후 필드 등식 수:', this.fieldEquations.length);
            console.log('제거 후 필드 등식들:', this.fieldEquations.map(eq => ({id: eq.id, cards: eq.cards.length})));
            return removedEquation;
        }
        
        console.log('등식을 찾을 수 없음');
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

    isValidExpression() {
        // 빈 수식은 유효하지 않음
        if (this.cards.length === 0) return false;
        
        // 연산자가 없는 경우 (숫자만 있는 경우) 유효하지 않음
        const hasOperator = this.cards.some(card => 
            card.type === 'operator' || 
            (card.type === 'joker' && card.temporaryOperator)
        );
        
        if (!hasOperator) return false;
        
        // 연산자가 마지막에 있는 경우 유효하지 않음
        const lastCard = this.cards[this.cards.length - 1];
        if (lastCard.type === 'operator' || 
            (lastCard.type === 'joker' && lastCard.temporaryOperator)) {
            return false;
        }
        
        // 연산자가 첫 번째에 있는 경우 유효하지 않음
        const firstCard = this.cards[0];
        if (firstCard.type === 'operator' || 
            (firstCard.type === 'joker' && firstCard.temporaryOperator)) {
            return false;
        }
        
        return true;
    }

    calculate() {
        try {
            if (this.cards.length === 0) return null;

            // 수식 유효성 검사
            if (!this.isValidExpression()) {
                return '없음';
            }

            // ExpressionCalculator를 사용하여 계산 (usedFieldCards 추적을 위해)
            const calculator = new ExpressionCalculator();
            this.cards.forEach(card => {
                // 카드가 필드에서 온 것인지 확인 (손패 카드는 제외)
                const isFromField = this.gameController && this.gameController.gameState.getAvailableFieldCards().some(fieldCard => fieldCard.id === card.id);
                console.log(`카드 ${card.id} (${card.value}) 필드에서 온 카드인가?`, isFromField);
                console.log('현재 플레이어 손패 카드들:', this.gameController.gameState.getCurrentPlayer().numberCards.map(c => c.id), this.gameController.gameState.getCurrentPlayer().operatorCards.map(c => c.id));
                console.log('필드 카드들:', this.gameController.gameState.getAvailableFieldCards().map(c => c.id));
                calculator.addCard(card, isFromField);
            });

            const result = calculator.calculate();
            
            // 단일 숫자인 경우 (연산자 없이 숫자만 있는 경우)
            if (this.cards.length === 1 && this.cards[0].type === 'number') {
                return '없음'; // 연산자가 없으면 유효하지 않음
            }

            // 연산자가 마지막에 있는 경우
            if (this.cards.length > 1 && (this.cards[this.cards.length - 1].type === 'operator' || this.cards[this.cards.length - 1].type === 'joker')) {
                return '없음';
            }

            // GameController의 calculator에 usedFieldCards 정보 전달
            if (this.gameController) {
                this.gameController.calculator.usedFieldCards = calculator.usedFieldCards;
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
        this.peerConnections = new Map(); // peer connections
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
        
        // WebSocket 기반 시그널링 서버 연결
        // 로컬 개발: ws://localhost:8080/ws
        // Render 배포:wss://modified-rummikub-p2p.onrender.com/ws
        // 같은 Wi-Fi: ws://192.168.1.100:8080/ws (실제 IP로 변경)
        // 인터넷: ws://your-public-ip:8080/ws
        
        // 환경에 따른 자동 설정
        if (location.hostname === 'localhost') {
            this.signalingServer = 'ws://localhost:8080/ws';
        } else {
            // Render 배포 서버 사용
            this.signalingServer = 'wss://modified-rummikub-p2p.onrender.com/ws';
        }
        this.ws = null;
        this.clientId = null;
        this.setupWebSocketConnection();
    }

    setupWebSocketConnection() {
        try {
            this.ws = new WebSocket(this.signalingServer);
            
            this.ws.onopen = () => {
                console.log('시그널링 서버에 연결됨');
            };
            
            this.ws.onmessage = async (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('WebSocket 원본 메시지:', event.data);
                    console.log('파싱된 메시지:', message);
                    await this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('WebSocket 메시지 처리 오류:', error);
                    console.error('원본 메시지:', event.data);
                }
            };
            
            this.ws.onclose = () => {
                console.log('시그널링 서버 연결이 끊어졌습니다.');
                // 재연결 시도
                setTimeout(() => {
                    this.setupWebSocketConnection();
                }, 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket 오류:', error);
            };
            
        } catch (error) {
            console.error('WebSocket 연결 실패:', error);
            // BroadcastChannel로 폴백
            this.setupBroadcastChannelFallback();
        }
    }
    
    async handleWebSocketMessage(message) {
        console.log(`=== WebSocket 메시지 수신 ===`);
        console.log(`메시지 타입:`, message.type);
        console.log(`전체 메시지:`, message);
        
        const { type, data, from, sessionCode, clientId, timestamp } = message;
        
        switch (type) {
            case 'connected':
                this.clientId = clientId;
                console.log('서버 연결 확인됨:', clientId);
                break;
                
            case 'session_created':
                this.clientId = clientId;
                console.log('=== 세션 생성 성공 ===');
                console.log('세션 코드:', sessionCode);
                console.log('클라이언트 ID:', clientId);
                break;
                
            case 'join_success':
                this.clientId = clientId;
                console.log('세션 참여 성공:', sessionCode);
                break;
                
            case 'join_request':
                console.log('=== 호스트 join_request 메시지 수신 ===');
                console.log('전체 메시지:', message);
                console.log('게스트 ID:', message.guestId);
                console.log('플레이어 이름:', message.playerName);
                console.log('세션 코드:', message.sessionCode);
                
                const joinRequestData = {
                    playerName: message.playerName,
                    sessionCode: message.sessionCode,
                    guestId: message.guestId
                };
                console.log('joinRequestData:', joinRequestData);
                await this.handleJoinRequest(joinRequestData);
                break;
                
            case 'signal':
                await this.handleSignal(message);
                break;
                
            case 'broadcast':
                this.handleGameMessage(data, from);
                break;
                
            case 'join_response':
                console.log('=== 게스트 join_response 메시지 수신 ===');
                console.log('전체 메시지:', message);
                console.log('메시지 데이터:', message.data);
                await this.handleJoinResponse(message.data);
                break;
                
            case 'error':
                console.error('=== 서버 오류 발생 ===');
                console.error('오류 메시지:', message.message || message);
                console.error('전체 메시지:', message);
                
                // 세션 참여 실패 시 특별 처리
                if (message.message === 'Session not found') {
                    console.error('세션을 찾을 수 없습니다. 호스트가 세션을 생성했는지 확인하세요.');
                }
                break;
        }
    }
    
    async handleSignal(message) {
        const { from, data: signalData } = message;
        
        if (!signalData) {
            console.error('시그널 메시지에 data가 없습니다:', message);
            return;
        }
        
        switch (signalData.type) {
            case 'join_request':
                if (this.isHost && signalData.sessionCode === this.sessionCode) {
                    await this.handleJoinRequest(signalData);
                }
                break;
                
            case 'join_response':
                if (!this.isHost && signalData.to === this.playerName) {
                    await this.handleJoinResponse(signalData);
                }
                break;
                
            case 'ice_candidate':
                if (signalData.to === this.playerName) {
                    await this.handleIceCandidate(signalData);
                }
                break;
                
            case 'offer':
                if (signalData.to === this.playerName) {
                    await this.handleOffer(signalData);
                }
                break;
                
            case 'answer':
                if (signalData.to === this.playerName) {
                    await this.handleAnswer(signalData);
                }
                break;
        }
    }
    
    setupBroadcastChannelFallback() {
        console.log('BroadcastChannel로 폴백');
        this.broadcastChannel = new BroadcastChannel('rumikub-local-p2p');
        this.broadcastChannel.addEventListener('message', async (event) => {
            const { type, data, from } = event.data;
            console.log(`브로드캐스트 메시지 수신: ${type}`, { from, data });
            
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
                    
                case 'game_message':
                    // 게임 메시지 처리 (준비 상태 등)
                    this.handleGameMessage(data, from);
                    break;
                    
                default:
                    console.log('알 수 없는 메시지 타입:', type);
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
        console.log('=== 세션 생성 요청 ===');
        console.log('WebSocket 상태:', this.ws ? this.ws.readyState : 'null');
        console.log('세션 코드:', this.sessionCode);
        console.log('플레이어 이름:', playerName);
        console.log('게임 설정:', gameSettings);
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // WebSocket을 통한 세션 생성
            const createSessionMessage = {
                type: 'create_session',
                sessionCode: this.sessionCode,
                playerName: playerName,
                gameSettings: gameSettings
            };
            console.log('서버에 전송할 메시지:', createSessionMessage);
            this.ws.send(JSON.stringify(createSessionMessage));
        } else {
            console.log('WebSocket 연결 없음, BroadcastChannel 폴백');
            // BroadcastChannel 폴백
            this.broadcastToLocal('session_announce', {
                sessionCode: this.sessionCode,
                hostName: playerName,
                maxPlayers: gameSettings.playerCount
            });
        }
        
        console.log(`세션 생성됨: ${this.sessionCode}`);
        return this.sessionCode;
    }

    async joinSession(sessionCode, playerName) {
        console.log('=== 게스트 세션 참여 시작 ===');
        console.log('참여 코드:', sessionCode);
        console.log('플레이어 이름:', playerName);
        
        this.isHost = false;
        this.playerName = playerName;
        this.sessionCode = sessionCode;
        
        // 서버를 통해 참여 요청
        console.log('=== 서버를 통해 참여 요청 ===');
        console.log('WebSocket 상태:', this.ws ? this.ws.readyState : 'null');
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const joinRequestMessage = {
                type: 'join_request',
                sessionCode: sessionCode,
                playerName: playerName
            };
            console.log('서버에 전송할 참여 요청:', joinRequestMessage);
            this.ws.send(JSON.stringify(joinRequestMessage));
        } else {
            console.log('WebSocket 연결 없음, BroadcastChannel 폴백');
            this.broadcastToLocal('join_request', {
                sessionCode,
                playerName,
                from: playerName
            });
        }
        console.log('참여 요청 전송 완료');
        
        return new Promise((resolve, reject) => {
            // 10초 타임아웃
            const timeout = setTimeout(() => {
                console.error('연결 시간 초과 - 호스트로부터 응답을 받지 못함');
                console.log('현재 peer connections:', this.peerConnections.size);
                reject(new Error('연결 시간 초과'));
            }, 10000);
            
            // 응답 대기
            const checkConnection = () => {
                console.log('연결 상태 확인 중, peer connections:', this.peerConnections.size);
                if (this.peerConnections.size > 0) {
                    console.log('연결 성공!');
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
        console.log('=== 호스트 참여 요청 처리 시작 ===');
        console.log('참여 요청 받음:', data.playerName);
        console.log('요청된 세션 코드:', data.sessionCode);
        console.log('현재 세션 코드:', this.sessionCode);
        
        // 세션 코드 확인
        if (data.sessionCode !== this.sessionCode) {
            console.error('세션 코드 불일치:', data.sessionCode, 'vs', this.sessionCode);
            return;
        }
        
        // 플레이어 추가
        console.log('플레이어 추가 중:', data.playerName);
        this.players.set(data.playerName, {
            id: data.playerName,
            name: data.playerName,
            isHost: false,
            isReady: false,
            connection: null
        });
        console.log('플레이어 추가 완료, 현재 플레이어 수:', this.players.size);
        
        // WebRTC 연결 시작
        console.log('WebRTC 연결 시작:', data.playerName);
        await this.createPeerConnection(data.playerName);
        console.log('WebRTC 연결 생성 완료');
        
        // 응답 전송 (전체 플레이어 목록 포함)
        console.log('참여 응답 전송 중:', data.playerName);
        
        // 서버를 통해 게스트에게 응답 전송
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const joinResponseMessage = {
                type: 'join_response',
                data: {
                    sessionCode: this.sessionCode,
                    accepted: true,
                    to: data.playerName,
                    from: this.playerName,
                    playerList: Array.from(this.players.values())
                },
                to: data.guestId, // 게스트 클라이언트 ID
                from: this.clientId
            };
            console.log('서버를 통해 게스트에게 응답 전송:', joinResponseMessage);
            this.ws.send(JSON.stringify(joinResponseMessage));
        } else {
            // 폴백: BroadcastChannel 사용
            this.broadcastToLocal('join_response', {
                sessionCode: this.sessionCode,
                accepted: true,
                to: data.playerName,
                from: this.playerName,
                playerList: Array.from(this.players.values())
            });
        }
        console.log('참여 응답 전송 완료');
        
        this.gameController.updateWaitingRoom();
        console.log('=== 호스트 참여 요청 처리 완료 ===');
    }

    async handleJoinResponse(data) {
        console.log('=== 게스트 참여 응답 처리 시작 ===');
        console.log('참여 응답 수신:', data);
        
        if (data.accepted) {
            console.log('참여 승인됨');
            
            // 호스트가 전송한 플레이어 목록을 사용
            if (data.playerList && Array.isArray(data.playerList)) {
                console.log('호스트로부터 플레이어 목록 수신:', data.playerList);
                
                // 플레이어 목록 초기화
                this.players.clear();
                
                // 호스트가 전송한 플레이어 목록을 그대로 사용
                data.playerList.forEach(player => {
                    this.players.set(player.name, {
                        id: player.name,
                        name: player.name,
                        isHost: player.isHost,
                        isReady: player.isReady,
                        connection: null
                    });
                });
                
                console.log('게스트 플레이어 목록 설정 완료:', Array.from(this.players.keys()));
            } else {
                console.warn('플레이어 목록을 받지 못함, 기본 설정 사용');
                // 폴백: 기본 설정
                this.players.set(this.playerName, {
                    id: this.playerName,
                    name: this.playerName,
                    isHost: false,
                    isReady: false,
                    connection: null
                });
                
                this.players.set(data.from, {
                    id: data.from,
                    name: data.from,
                    isHost: true,
                    isReady: true,
                    connection: null
                });
            }
            
            console.log('WebRTC 연결 생성 시작:', data.from);
            await this.createPeerConnection(data.from);
            console.log('WebRTC 연결 생성 완료');
            
            console.log('P2P 연결 완료 콜백 호출');
            this.gameController.onP2PConnected();
            console.log('=== 게스트 참여 응답 처리 완료 ===');
        } else {
            console.error('참여가 거부되었습니다');
            throw new Error('참여가 거부되었습니다');
        }
    }

    async createPeerConnection(remotePlayerName) {
        console.log(`Peer connection 생성 중: ${remotePlayerName}`);
        const peerConnection = new RTCPeerConnection(this.rtcConfig);
        this.peerConnections.set(remotePlayerName, peerConnection);
        console.log(`Peer connection 생성 완료: ${remotePlayerName}`);
        
        // 데이터 채널 생성 (호스트만)
        if (this.isHost) {
            console.log(`데이터 채널 생성 중: ${remotePlayerName}`);
            const dataChannel = peerConnection.createDataChannel('game', {
                ordered: true
            });
            this.setupDataChannel(dataChannel, remotePlayerName);
            console.log(`데이터 채널 생성 완료: ${remotePlayerName}`);
        }
        
        // 데이터 채널 수신 (게스트)
        peerConnection.addEventListener('datachannel', (event) => {
            console.log(`데이터 채널 수신: ${remotePlayerName}`);
            this.setupDataChannel(event.channel, remotePlayerName);
        });
        
        // ICE 후보 처리
        peerConnection.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
                console.log(`ICE candidate 생성: ${remotePlayerName}`);
                // RTCIceCandidate 객체를 직렬화 가능한 형태로 변환
                const candidateData = {
                    candidate: event.candidate.candidate,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    sdpMid: event.candidate.sdpMid
                };
                
                this.broadcastToLocal('ice_candidate', {
                    candidate: candidateData,
                    to: remotePlayerName,
                    from: this.playerName
                });
                console.log(`ICE candidate 전송 완료: ${remotePlayerName}`);
            } else {
                console.log(`ICE candidate 수집 완료: ${remotePlayerName}`);
            }
        });
        
        // 연결 상태 모니터링
        peerConnection.addEventListener('connectionstatechange', () => {
            console.log(`연결 상태 (${remotePlayerName}):`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log(`${remotePlayerName}와 연결됨`);
            } else if (peerConnection.connectionState === 'failed') {
                console.error(`${remotePlayerName}와 연결 실패`);
                // 연결 실패 시 재시도
                this.retryConnection(remotePlayerName);
            } else if (peerConnection.connectionState === 'disconnected') {
                console.warn(`${remotePlayerName}와 연결 끊어짐`);
            }
        });
        
        peerConnection.addEventListener('iceconnectionstatechange', () => {
            console.log(`ICE 연결 상태 (${remotePlayerName}):`, peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'failed') {
                console.error(`ICE 연결 실패 (${remotePlayerName})`);
                // ICE 연결 실패 시 재시도
                this.retryConnection(remotePlayerName);
            }
        });
        
        peerConnection.addEventListener('icegatheringstatechange', () => {
            console.log(`ICE 수집 상태 (${remotePlayerName}):`, peerConnection.iceGatheringState);
        });
        
        // Offer 생성 (호스트만)
        if (this.isHost) {
            console.log(`Offer 생성 중: ${remotePlayerName}`);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.broadcastToLocal('offer', {
                offer: offer,
                to: remotePlayerName,
                from: this.playerName
            });
            console.log(`Offer 전송 완료: ${remotePlayerName}`);
        }
    }

    setupDataChannel(dataChannel, remotePlayerName) {
        this.dataChannels.set(remotePlayerName, dataChannel);
        
        // 데이터 채널 상태 모니터링
        console.log(`데이터 채널 설정: ${remotePlayerName}, 상태: ${dataChannel.readyState}`);
        
        dataChannel.addEventListener('open', () => {
            console.log(`데이터 채널 열림: ${remotePlayerName}`);
            console.log('현재 열린 데이터 채널 수:', this.dataChannels.size);
            
            // 데이터 채널이 열리면 대기 중인 메시지가 있는지 확인
            this.checkPendingMessages(remotePlayerName);
        });
        
        dataChannel.addEventListener('message', (event) => {
            console.log(`데이터 채널에서 메시지 수신: ${remotePlayerName}`, event.data);
            try {
                const message = JSON.parse(event.data);
                this.handleGameMessage(message, remotePlayerName);
            } catch (error) {
                console.error('메시지 파싱 오류:', error);
            }
        });
        
        dataChannel.addEventListener('close', () => {
            console.log(`데이터 채널 닫힘: ${remotePlayerName}`);
            this.dataChannels.delete(remotePlayerName);
        });
        
        dataChannel.addEventListener('error', (error) => {
            console.error(`데이터 채널 오류: ${remotePlayerName}`, error);
        });
        
        // 데이터 채널 상태 주기적 체크
        const statusCheckInterval = setInterval(() => {
            console.log(`데이터 채널 상태 체크 (${remotePlayerName}): ${dataChannel.readyState}`);
            
            if (dataChannel.readyState === 'open') {
                clearInterval(statusCheckInterval);
            } else if (dataChannel.readyState === 'closed') {
                clearInterval(statusCheckInterval);
                console.error(`데이터 채널이 예상치 못하게 닫힘: ${remotePlayerName}`);
            }
        }, 1000);
        
        // 10초 후에도 연결되지 않으면 타임아웃
        setTimeout(() => {
            if (dataChannel.readyState !== 'open') {
                console.error(`데이터 채널 연결 타임아웃: ${remotePlayerName}, 상태: ${dataChannel.readyState}`);
                clearInterval(statusCheckInterval);
                this.retryConnection(remotePlayerName);
            }
        }, 10000);
    }
    
    checkPendingMessages(playerName) {
        console.log(`대기 중인 메시지 확인: ${playerName}`);
        // 여기서 대기 중인 메시지가 있다면 전송할 수 있습니다
    }

    async handleOffer(data) {
        console.log('Offer 수신:', data.from);
        console.log('현재 peer connections:', Array.from(this.peerConnections.keys()));
        
        let peerConnection = this.peerConnections.get(data.from);
        
        // Peer connection이 없으면 생성
        if (!peerConnection) {
            console.log('Peer connection이 없음, 생성 중:', data.from);
            await this.createPeerConnection(data.from);
            peerConnection = this.peerConnections.get(data.from);
            
            if (!peerConnection) {
                console.error('Peer connection 생성 실패:', data.from);
                return;
            }
        }
        
        try {
            console.log('Remote description 설정 중...');
            await peerConnection.setRemoteDescription(data.offer);
            console.log('Remote description 설정 완료');
            
            // 대기 중인 ICE candidate들 처리
            await this.processPendingIceCandidates(data.from);
            
            console.log('Answer 생성 중...');
            const answer = await peerConnection.createAnswer();
            console.log('Answer 생성 완료');
            
            console.log('Local description 설정 중...');
            await peerConnection.setLocalDescription(answer);
            console.log('Local description 설정 완료');
            
            console.log('Answer 전송 중...');
            this.broadcastToLocal('answer', {
                answer: answer,
                to: data.from,
                from: this.playerName
            });
            console.log('Answer 전송 완료');
        } catch (error) {
            console.error('Offer 처리 중 오류:', error);
        }
    }

    async handleAnswer(data) {
        console.log('Answer 수신:', data.from);
        console.log('현재 peer connections:', Array.from(this.peerConnections.keys()));
        
        let peerConnection = this.peerConnections.get(data.from);
        
        // Peer connection이 없으면 생성
        if (!peerConnection) {
            console.log('Peer connection이 없음, 생성 중:', data.from);
            await this.createPeerConnection(data.from);
            peerConnection = this.peerConnections.get(data.from);
            
            if (!peerConnection) {
                console.error('Peer connection 생성 실패:', data.from);
                return;
            }
        }
        
        try {
            console.log('Remote description 설정 중...');
            await peerConnection.setRemoteDescription(data.answer);
            console.log('Remote description 설정 완료');
            
            // 대기 중인 ICE candidate들 처리
            await this.processPendingIceCandidates(data.from);
            console.log('Answer 처리 완료');
        } catch (error) {
            console.error('Answer 처리 중 오류:', error);
        }
    }

    async processPendingIceCandidates(playerName) {
        if (this.pendingIceCandidates && this.pendingIceCandidates.has(playerName)) {
            const peerConnection = this.peerConnections.get(playerName);
            if (peerConnection) {
                const candidates = this.pendingIceCandidates.get(playerName);
                console.log(`대기 중인 ICE candidate ${candidates.length}개 처리 중:`, playerName);
                
                for (const candidateData of candidates) {
                    try {
                        // remote description이 설정되었는지 다시 확인
                        if (!peerConnection.remoteDescription) {
                            console.log('Remote description이 아직 설정되지 않음, ICE candidate 건너뜀:', playerName);
                            continue;
                        }
                        
                        const candidate = new RTCIceCandidate(candidateData);
                        await peerConnection.addIceCandidate(candidate);
                        console.log('대기 중인 ICE candidate 추가 성공:', playerName);
                    } catch (error) {
                        console.warn('대기 중인 ICE candidate 추가 실패 (무시됨):', error.message);
                        // 오류가 발생해도 계속 진행
                    }
                }
                
                // 처리된 candidate들 제거
                this.pendingIceCandidates.delete(playerName);
            }
        }
    }

    async handleIceCandidate(data) {
        console.log('ICE candidate 수신:', data.from);
        console.log('현재 peer connections:', Array.from(this.peerConnections.keys()));
        
        let peerConnection = this.peerConnections.get(data.from);
        
        // Peer connection이 없으면 생성
        if (!peerConnection) {
            console.log('Peer connection이 없음, 생성 중:', data.from);
            await this.createPeerConnection(data.from);
            peerConnection = this.peerConnections.get(data.from);
            
            if (!peerConnection) {
                console.error('Peer connection 생성 실패:', data.from);
                return;
            }
        }
        
        // remote description이 설정되었는지 확인
        if (peerConnection.remoteDescription) {
            try {
                // 직렬화된 데이터를 RTCIceCandidate 객체로 변환
                const candidate = new RTCIceCandidate(data.candidate);
                await peerConnection.addIceCandidate(candidate);
                console.log('ICE candidate 추가 성공:', data.from);
            } catch (error) {
                console.warn('ICE candidate 추가 실패 (무시됨):', error.message);
                // 오류가 발생해도 계속 진행
            }
        } else {
            console.log('Remote description이 아직 설정되지 않음, ICE candidate 대기 중:', data.from);
            // ICE candidate를 나중에 처리하기 위해 저장
            if (!this.pendingIceCandidates) {
                this.pendingIceCandidates = new Map();
            }
            if (!this.pendingIceCandidates.has(data.from)) {
                this.pendingIceCandidates.set(data.from, []);
            }
            this.pendingIceCandidates.get(data.from).push(data.candidate);
        }
    }

    broadcastToLocal(type, data) {
        console.log(`로컬 브로드캐스트 전송: ${type}`, data);
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // WebSocket을 통한 전송
            const broadcastMessage = {
                type: 'broadcast',
                sessionCode: this.sessionCode,
                data: {
                    type,
                    data,
                    from: this.playerName,
                    timestamp: Date.now()
                }
            };
            console.log('=== 클라이언트 브로드캐스트 전송 ===');
            console.log('전송할 메시지:', broadcastMessage);
            console.log('JSON 문자열:', JSON.stringify(broadcastMessage));
            
            try {
                this.ws.send(JSON.stringify(broadcastMessage));
                console.log('브로드캐스트 메시지 전송 성공');
            } catch (error) {
                console.error('브로드캐스트 메시지 전송 실패:', error);
            }
        } else if (this.broadcastChannel) {
            // BroadcastChannel 폴백
            this.broadcastChannel.postMessage({
                type,
                data,
                from: this.playerName,
                timestamp: Date.now()
            });
        }
        
        console.log(`로컬 브로드캐스트 전송 완료: ${type}`);
    }

    broadcastMessage(type, data) {
        const message = {
            type,
            data,
            from: this.playerName,
            timestamp: Date.now()
        };
        
        // BroadcastChannel을 통한 로컬 네트워크 브로드캐스트
        this.broadcastChannel.postMessage({
            type: 'game_message',
            data: message,
            from: this.playerName
        });
        
        // 모든 연결된 플레이어에게 전송 (P2P 연결이 설정된 경우)
        this.dataChannels.forEach((channel, playerName) => {
            if (channel.readyState === 'open') {
                channel.send(JSON.stringify(message));
            }
        });
    }

    sendToPlayer(playerId, type, data) {
        console.log(`플레이어에게 메시지 전송 시도: ${playerId}, 타입: ${type}`);
        const channel = this.dataChannels.get(playerId);
        
        if (channel) {
            console.log(`데이터 채널 상태: ${channel.readyState}`);
            if (channel.readyState === 'open') {
                const message = {
                    type,
                    data,
                    from: this.playerName,
                    to: playerId,
                    timestamp: Date.now()
                };
                channel.send(JSON.stringify(message));
                console.log(`메시지 전송 성공: ${playerId}, 타입: ${type}`);
                return true;
            } else {
                console.log(`데이터 채널이 열리지 않음: ${playerId}, 상태: ${channel.readyState}`);
                return false;
            }
        } else {
            console.log(`데이터 채널을 찾을 수 없음: ${playerId}`);
            console.log('사용 가능한 데이터 채널:', Array.from(this.dataChannels.keys()));
            return false;
        }
    }

    async sendToPlayerWithRetry(playerId, type, data, maxRetries = 10, delay = 500) {
        console.log(`플레이어에게 메시지 전송 시도 (재시도 포함): ${playerId}, 타입: ${type}`);
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`전송 시도 ${attempt}/${maxRetries}: ${playerId}`);
            
            if (this.sendToPlayer(playerId, type, data)) {
                console.log(`메시지 전송 성공 (시도 ${attempt}): ${playerId}, 타입: ${type}`);
                return true;
            }
            
            if (attempt < maxRetries) {
                console.log(`${delay}ms 후 재시도...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        console.error(`메시지 전송 실패 (${maxRetries}회 시도): ${playerId}, 타입: ${type}`);
        return false;
    }

    retryConnection(playerName) {
        console.log(`연결 재시도 시작: ${playerName}`);
        
        // 기존 연결 정리
        const existingConnection = this.peerConnections.get(playerName);
        if (existingConnection) {
            existingConnection.close();
            this.peerConnections.delete(playerName);
        }
        
        // 데이터 채널도 정리
        const existingChannel = this.dataChannels.get(playerName);
        if (existingChannel) {
            this.dataChannels.delete(playerName);
        }
        
        // 잠시 후 재연결 시도
        setTimeout(() => {
            console.log(`재연결 시도: ${playerName}`);
            this.createPeerConnection(playerName);
        }, 2000);
    }

    handleGameMessage(message, from) {
        console.log('게임 메시지 수신:', message);
        
        // 메시지 데이터가 없는 경우 처리
        if (!message || !message.type) {
            console.log('유효하지 않은 게임 메시지:', message);
            return;
        }
        
        switch (message.type) {
            case 'player_ready':
                if (message.data) {
                    console.log('플레이어 준비 상태 업데이트:', message.data.playerId, message.data.isReady);
                    this.updatePlayerReady(message.data.playerId, message.data.isReady);
                    console.log('현재 플레이어 목록:', this.getPlayerList());
                    this.gameController.updateWaitingRoom();
                } else {
                    console.log('player_ready 메시지에 데이터가 없음:', message);
                }
                break;
                
            case 'game_start':
                // 비동기 함수를 즉시 실행
                (async () => {
                    await this.gameController.initializeMultiplayerGame();
                })();
                break;
                
            case 'game_state':
                // 개별 플레이어 게임 상태 수신
                this.gameController.handlePlayerGameState(message.data);
                break;
                
            case 'game_state_fallback':
                // BroadcastChannel을 통한 대체 게임 상태 수신
                console.log('BroadcastChannel을 통한 게임 상태 수신:', message.data);
                if (message.data.targetPlayer === this.playerName) {
                    console.log('내게 전송된 대체 게임 상태 처리');
                    this.gameController.handlePlayerGameState(message.data);
                }
                break;
                
            case 'game_state_common':
                // 공통 게임 상태 수신
                this.gameController.handleCommonGameState(message.data);
                break;
                
            case 'turn_change':
                // 턴 변경 처리
                this.gameController.handleTurnChange(message.data);
                break;
                
            case 'card_move':
                // 카드 이동 처리
                this.gameController.handleCardMove(message.data);
                break;
                
            case 'card_draw':
                // 카드 뽑기 동기화 처리
                this.gameController.handleCardDraw(message.data);
                break;
                
            case 'expression_state':
                // 수식 영역 상태 동기화 처리
                this.gameController.handleExpressionState(message.data);
                break;
                
            case 'field_equations_update':
                // 필드 등식 업데이트 동기화 처리
                this.gameController.handleFieldEquationsUpdate(message.data);
                break;
                
            case 'card_draw_request':
                // 게스트의 카드 뽑기 요청 처리 (호스트만)
                if (this.isHost) {
                    console.log('게스트 카드 뽑기 요청 수신:', message.data);
                    this.gameController.handleCardDrawRequest(message.data);
                }
                break;
                
            case 'card_draw_response':
                // 호스트의 카드 뽑기 응답 처리 (게스트만)
                if (!this.isHost) {
                    console.log('호스트 카드 뽑기 응답 수신:', message.data);
                    this.gameController.handleCardDrawResponse(message.data);
                }
                break;
                
            case 'game_action':
                // 게임 액션 처리
                break;
                
            case 'equation_position_update':
                // 등식박스 위치 업데이트 처리
                this.gameController.handleEquationPositionUpdate(message.data);
                break;
                
            case 'new_target_update':
                // 새 정답 업데이트 처리
                this.gameController.handleNewTargetUpdate(message.data);
                break;
                
            case 'cycle_start':
                // 새로운 사이클 시작 처리
                this.gameController.handleCycleStart(message.data);
                break;
                
            case 'add_target_card_request':
                // 게스트의 정답카드 추가 요청 처리 (호스트만)
                if (this.isHost) {
                    console.log('게스트의 정답카드 추가 요청 수신:', message.data);
                    // 호스트가 이미 사이클 완료를 처리했으므로 추가 처리하지 않음
                    console.log('호스트가 이미 사이클 완료를 처리했으므로 추가 처리하지 않음');
                }
                break;
        }
    }

    getPlayerList() {
        const players = Array.from(this.players.values());
        
        // 플레이어를 참가 순서대로 정렬
        // 호스트가 항상 첫 번째, 나머지는 이름 순으로 정렬
        return players.sort((a, b) => {
            // 호스트가 항상 첫 번째
            if (a.isHost && !b.isHost) return -1;
            if (!a.isHost && b.isHost) return 1;
            
            // 둘 다 호스트이거나 둘 다 게스트인 경우 이름 순으로 정렬
            return a.name.localeCompare(b.name);
        });
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
        this.peerConnections.forEach(connection => {
            connection.close();
        });
        this.peerConnections.clear();
        
        // 브로드캐스트 채널 닫기
        this.broadcastChannel.close();
        
        this.players.clear();
    }
}

// 메인 게임 컨트롤러 클래스
class GameController {
    constructor() {
        this.gameState = new GameState(this);
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
        this.isDrawingCard = false; // 카드 뽑기 중복 요청 방지
        this.isProcessingNoCycleAnswer = false; // 사이클 종료 시 정답 카드 추가 중복 처리 방지
        this.lastTurnChangeData = null; // 턴 변경 메시지 중복 처리 방지
        this.currentScreen = 'lobby';
        
        // 전역 접근을 위해 window에 설정
        window.gameController = this;
        
        // DOM이 완전히 로드된 후 초기화
        console.log('GameController 생성자 실행됨, document.readyState:', document.readyState);
        if (document.readyState === 'loading') {
            console.log('DOM 로딩 중, DOMContentLoaded 이벤트 대기');
            document.addEventListener('DOMContentLoaded', () => {
                console.log('DOMContentLoaded 이벤트 발생');
        this.initializeEventListeners();
                this.showLobby();
            });
        } else {
            console.log('DOM 로딩 완료, 즉시 초기화');
            this.initializeEventListeners();
            this.showLobby();
        }
    }

    initializeEventListeners() {
        console.log('initializeEventListeners 시작');
        // 안전한 이벤트 리스너 추가 헬퍼 함수
        const safeAddEventListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.warn(`Element with id '${id}' not found`);
            }
        };

        // 로비 관련
        safeAddEventListener('create-game-btn', 'click', () => {
            console.log('게임 시작하기 버튼 클릭됨');
            this.showGameSettings();
        });
        safeAddEventListener('join-game-btn', 'click', () => {
            console.log('게임 참여하기 버튼 클릭됨');
            this.showJoinModal();
        });
        
        // 게임 참여 모달
        safeAddEventListener('join-game-confirm', 'click', () => this.joinGame());
        safeAddEventListener('join-game-cancel', 'click', () => this.hideJoinModal());
        
        // 대기실 관련
        safeAddEventListener('copy-code-btn', 'click', () => this.copySessionCode());
        safeAddEventListener('change-settings-btn', 'click', () => this.showGameSettings());
        safeAddEventListener('start-multiplayer-game-btn', 'click', () => this.startMultiplayerGame());
        safeAddEventListener('toggle-ready-btn', 'click', () => this.toggleReady());
        safeAddEventListener('leave-room-btn', 'click', () => this.leaveRoom());

        // 모달 관련
        safeAddEventListener('start-game', 'click', () => this.startNewGame());
        safeAddEventListener('close-settings', 'click', () => this.hideSettingsModal());

        // 게임 액션
        safeAddEventListener('submit-expression', 'click', () => this.submitExpression());
        safeAddEventListener('clear-expression', 'click', () => this.resetTurn());
        safeAddEventListener('number-card-btn', 'click', () => this.drawCard('number'));
        safeAddEventListener('operator-card-btn', 'click', () => this.drawCard('operator'));
        safeAddEventListener('restart-game', 'click', () => this.restartGame());

        // 조커 선택 모달 관련
        safeAddEventListener('cancel-joker', 'click', () => this.cancelJokerSelection());
        
        // 조커 선택 버튼들은 지연 초기화
        setTimeout(() => {
            this.setupJokerSelection();
        }, 100);

        // 드래그 앤 드롭 이벤트
        this.setupDragAndDrop();
    }


    setupJokerSelection() {
        // 조커 선택 버튼들에 이벤트 리스너 추가
        const jokerOptions = document.querySelectorAll('.joker-option');
        if (jokerOptions.length > 0) {
            jokerOptions.forEach(button => {
                button.addEventListener('click', (e) => {
                    const selectedOperator = e.target.dataset.operator;
                    this.handleJokerSelection(selectedOperator);
                });
            });
        }
    }

    showJokerSelectionModal() {
        const modal = document.getElementById('joker-selection-modal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideJokerSelectionModal() {
        const modal = document.getElementById('joker-selection-modal');
        if (modal) {
            modal.style.display = 'none';
        }
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
    
    // 화면 전환 메서드들
    showLobby() {
        console.log('showLobby 호출됨');
        this.currentScreen = 'lobby';
        this.hideAllScreens();
        const lobbyScreen = document.getElementById('lobby-screen');
        if (lobbyScreen) {
            console.log('로비 화면 표시');
            lobbyScreen.style.display = 'flex';
        } else {
            console.error('로비 화면을 찾을 수 없습니다');
        }
    }

    showWaitingRoom() {
        this.currentScreen = 'waiting-room';
        this.hideAllScreens();
        const waitingRoomScreen = document.getElementById('waiting-room-screen');
        if (waitingRoomScreen) {
            waitingRoomScreen.style.display = 'flex';
            this.updateWaitingRoom();
        }
    }

    showGameScreen() {
        this.currentScreen = 'game';
        this.hideAllScreens();
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            gameScreen.style.display = 'block';
        }
    }

    hideAllScreens() {
        const lobbyScreen = document.getElementById('lobby-screen');
        const waitingRoomScreen = document.getElementById('waiting-room-screen');
        const gameScreen = document.getElementById('game-screen');
        
        if (lobbyScreen) lobbyScreen.style.display = 'none';
        if (waitingRoomScreen) waitingRoomScreen.style.display = 'none';
        if (gameScreen) gameScreen.style.display = 'none';
    }

    // 로비 관련 메서드들
    showGameSettings() {
        console.log('showGameSettings 호출됨');
        const modal = document.getElementById('settings-modal');
        
        if (modal) {
            console.log('설정 모달 표시');
            
            // 모달을 body로 이동 (부모가 숨겨져 있을 수 있으므로)
            if (modal.parentElement !== document.body) {
                console.log('모달을 body로 이동');
                document.body.appendChild(modal);
            }
            
            modal.style.display = 'block';
            modal.style.zIndex = '9999';
            modal.style.position = 'fixed';
            modal.style.left = '0';
            modal.style.top = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        } else {
            console.error('설정 모달을 찾을 수 없습니다');
        }
    }

    showJoinModal() {
        console.log('showJoinModal 호출됨');
        const modal = document.getElementById('join-game-modal');
        
        if (modal) {
            console.log('참여 모달 표시');
            
            // 모달을 body로 이동 (부모가 숨겨져 있을 수 있으므로)
            if (modal.parentElement !== document.body) {
                console.log('참여 모달을 body로 이동');
                document.body.appendChild(modal);
            }
            
            modal.style.display = 'block';
            modal.style.zIndex = '9999';
            modal.style.position = 'fixed';
            modal.style.left = '0';
            modal.style.top = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        } else {
            console.error('참여 모달을 찾을 수 없습니다');
        }
    }

    hideJoinModal() {
        const modal = document.getElementById('join-game-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }


    async joinGame() {
        const joinCodeElement = document.getElementById('join-code');
        const playerNameElement = document.getElementById('player-name');
        
        if (!joinCodeElement || !playerNameElement) {
            alert('입력 필드를 찾을 수 없습니다.');
            return;
        }
        
        const joinCode = joinCodeElement.value.trim();
        const playerName = playerNameElement.value.trim();

        if (!joinCode || joinCode.length !== 6) {
            alert('올바른 6자리 참여 코드를 입력해주세요.');
            return;
        }

        if (!playerName) {
            alert('플레이어 이름을 입력해주세요.');
            return;
        }

        try {
            this.isMultiplayer = true;
            await this.p2pManager.joinSession(joinCode, playerName);
            this.hideJoinModal();
            this.showWaitingRoom();
        } catch (error) {
            alert('게임 참여에 실패했습니다: ' + error.message);
        }
    }

    showSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 대기실 관련 메서드들
    updateWaitingRoom() {
        if (this.p2pManager.sessionCode) {
            const sessionCodeElement = document.getElementById('session-code');
            if (sessionCodeElement) {
                sessionCodeElement.textContent = this.p2pManager.sessionCode;
            }
        }

        const players = this.p2pManager.getPlayerList();
        
        const currentPlayersElement = document.getElementById('current-players');
        if (currentPlayersElement) {
            currentPlayersElement.textContent = players.length;
        }
        
        const maxPlayersElement = document.getElementById('max-players');
        if (maxPlayersElement) {
            maxPlayersElement.textContent = this.gameState.settings.playerCount;
        }

        this.updatePlayersList(players);
        this.updateWaitingRoomButtons();
    }

    updatePlayersList(players) {
        const container = document.getElementById('waiting-players');
        container.innerHTML = '';

        players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            if (player.isHost) {
                playerCard.classList.add('host');
            } else if (player.isReady) {
                playerCard.classList.add('ready');
            }

            playerCard.innerHTML = `
                <div class="player-name">${player.name}</div>
                <div class="player-status">
                    ${player.isHost ? '👑 호스트' : (player.isReady ? '✅ 준비완료' : '⏳ 대기중')}
                </div>
            `;

            container.appendChild(playerCard);
        });
    }

    updateWaitingRoomButtons() {
        const hostActions = document.getElementById('host-actions');
        const guestActions = document.getElementById('guest-actions');
        const startBtn = document.getElementById('start-multiplayer-game-btn');
        const readyBtn = document.getElementById('toggle-ready-btn');

        if (this.p2pManager.isHost) {
            hostActions.style.display = 'flex';
            guestActions.style.display = 'none';
            
            startBtn.disabled = !this.p2pManager.canStartGame();
        } else {
            hostActions.style.display = 'none';
            guestActions.style.display = 'flex';
            
            readyBtn.textContent = this.p2pManager.isReady ? '❌ 준비 취소' : '✋ 준비 완료';
            readyBtn.className = this.p2pManager.isReady ? 'action-btn secondary' : 'action-btn primary';
        }
    }

    copySessionCode() {
        const code = this.p2pManager.sessionCode;
        if (code) {
            navigator.clipboard.writeText(code).then(() => {
                const btn = document.getElementById('copy-code-btn');
                const originalText = btn.textContent;
                btn.textContent = '✅';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1000);
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = code;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('참여 코드가 복사되었습니다: ' + code);
            });
        }
    }

    toggleReady() {
        console.log('준비 상태 토글 시작, 현재 상태:', this.p2pManager.isReady);
        this.p2pManager.isReady = !this.p2pManager.isReady;
        console.log('새로운 준비 상태:', this.p2pManager.isReady);
        
        this.p2pManager.updatePlayerReady(this.p2pManager.playerName, this.p2pManager.isReady);
        console.log('로컬 플레이어 상태 업데이트 완료');
        
        this.p2pManager.broadcastMessage('player_ready', {
            playerId: this.p2pManager.playerName,
            isReady: this.p2pManager.isReady
        });
        console.log('준비 상태 브로드캐스트 전송 완료');
        
        this.updateWaitingRoom();
        console.log('대기실 UI 업데이트 완료');
    }

    startMultiplayerGame() {
        if (this.p2pManager.canStartGame()) {
            this.p2pManager.broadcastMessage('game_start', {
                settings: this.gameState.settings
            });
            this.initializeMultiplayerGame();
        }
    }

    leaveRoom() {
        this.p2pManager.disconnect();
        this.isMultiplayer = false;
        this.showLobby();
    }

    // P2P 연결 콜백
    onP2PConnected() {
        console.log('P2P 연결 완료');
        this.showWaitingRoom();
    }

    async initializeMultiplayerGame() {
        this.showGameScreen();
        
        if (this.p2pManager.isHost) {
            // 호스트: 게임 상태 생성 및 모든 플레이어에게 전송
            await this.initializeGameAsHost();
        } else {
            // 게스트: 호스트로부터 게임 상태를 받을 때까지 대기
            this.logMessage('호스트가 게임을 초기화하는 중...', 'info');
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

        // 멀티플레이어 모드 확인
        if (this.currentScreen === 'lobby') {
            // 로비에서 시작한 경우 - 호스트로 게임 생성
            const playerName = prompt('플레이어 이름을 입력하세요:', 'Player1');
            if (!playerName) return;
            
            this.isMultiplayer = true;
            const sessionCode = this.p2pManager.createSession(playerName, this.gameState.settings);
            console.log('세션 생성됨:', sessionCode);
            
            this.hideSettingsModal();
            this.showWaitingRoom();
            return;
        }

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

    async initializeGameAsHost() {
        console.log('호스트가 게임을 초기화합니다');
        
        // 호스트는 자신의 카드만 생성하고 관리
        const deck = this.gameState.createDeck();
        this.logMessage(`생성된 덱 크기: ${deck.length}`, 'info');
        
        // 호스트 자신의 카드만 배분
        this.dealCardsForHost(deck);
        
        // 첫 정답 생성
        this.gameState.generateNewTarget();
        
        // 게임 상태 활성화
        this.gameState.isGameActive = true;
        this.gameState.currentPlayer = 0;
        this.gameState.startNewCycle();
        
        // 턴 상태 초기화
        this.hasSubmittedAnswer = false;
        this.isAnswerSubmitted = false;

        // 게임 상태를 모든 플레이어에게 전송 (재시도 포함)
        await this.broadcastGameState();
        
        // UI 업데이트
        this.updateUI();
        this.logMessage('게임이 시작되었습니다!', 'info');
        this.logMessage(`가능한 정답: ${this.gameState.possibleAnswers.join(', ')}`, 'info');
    }

    dealCardsForHost(deck) {
        console.log('=== 호스트용 카드 배분 시작 ===');
        console.log('전체 덱 크기:', deck.length);
        console.log('게임 설정:', this.gameState.settings);
        console.log('요청된 숫자 카드 수:', this.gameState.settings.initialNumberCards);
        console.log('요청된 연산자 카드 수:', this.gameState.settings.initialOperatorCards);
        
        // 호스트는 자신의 카드만 생성
        const availableNumberCards = deck.filter(card => card.type === 'number');
        const availableOperatorCards = deck.filter(card => card.type === 'operator' || card.type === 'joker');
        
        console.log('덱의 숫자 카드 수:', availableNumberCards.length);
        console.log('덱의 연산자 카드 수:', availableOperatorCards.length);
        
        // 호스트 자신의 카드만 배분
        const hostPlayer = {
            id: 0,
            name: this.p2pManager.playerName,
            numberCards: [],
            operatorCards: []
        };

        // 숫자 카드 배분
        console.log('호스트 숫자 카드 배분 시작');
        for (let j = 0; j < this.gameState.settings.initialNumberCards && availableNumberCards.length > 0; j++) {
            const randomIndex = Math.floor(Math.random() * availableNumberCards.length);
            const card = availableNumberCards.splice(randomIndex, 1)[0];
            hostPlayer.numberCards.push(card);
            console.log(`호스트 숫자 카드 ${j+1}: ${card.value}, 남은 숫자 카드: ${availableNumberCards.length}`);
        }
        
        // 연산자 카드 배분
        console.log('호스트 연산자 카드 배분 시작');
        for (let j = 0; j < this.gameState.settings.initialOperatorCards && availableOperatorCards.length > 0; j++) {
            const randomIndex = Math.floor(Math.random() * availableOperatorCards.length);
            const card = availableOperatorCards.splice(randomIndex, 1)[0];
            hostPlayer.operatorCards.push(card);
            console.log(`호스트 연산자 카드 ${j+1}: ${card.value}, 남은 연산자 카드: ${availableOperatorCards.length}`);
        }

        // 모든 플레이어 정보를 players 배열에 추가 (호스트 + 게스트들)
        const allPlayers = [hostPlayer];
        
        // 게스트들의 빈 플레이어 정보 추가
        const p2pPlayers = this.p2pManager.getPlayerList();
        p2pPlayers.forEach((p2pPlayer, index) => {
            if (p2pPlayer.name !== this.p2pManager.playerName) {
                allPlayers.push({
                    id: index + 1,
                    name: p2pPlayer.name,
                    numberCards: [],
                    operatorCards: []
                });
            }
        });
        
        this.gameState.players = allPlayers;
        console.log('호스트 플레이어 배열 설정 완료:', this.gameState.players.map(p => p.name));
        
        // 남은 카드들로 덱 재구성
        this.gameState.remainingDeck = [...availableNumberCards, ...availableOperatorCards];
        
        console.log(`호스트 카드 배분 완료: 숫자 ${hostPlayer.numberCards.length}장, 연산자 ${hostPlayer.operatorCards.length}장`);
        console.log('남은 덱 크기:', this.gameState.remainingDeck.length);
        console.log('남은 덱의 숫자 카드 수:', this.gameState.remainingDeck.filter(card => card.type === 'number').length);
        console.log('남은 덱의 연산자 카드 수:', this.gameState.remainingDeck.filter(card => card.type === 'operator' || card.type === 'joker').length);
        console.log('=== 호스트용 카드 배분 완료 ===');
    }

    handlePlayerGameState(data) {
        console.log('=== 플레이어 게임 상태 수신 시작 ===');
        console.log('플레이어 게임 상태 수신:', data);
        console.log('수신된 플레이어 인덱스:', data.playerIndex);
        console.log('수신된 숫자 카드 수:', data.numberCards ? data.numberCards.length : 0);
        console.log('수신된 연산자 카드 수:', data.operatorCards ? data.operatorCards.length : 0);
        console.log('수신된 남은 패 수:', data.remainingDeck ? data.remainingDeck.length : 0);
        
        // 게스트는 자신의 카드 정보만 설정
        const players = this.p2pManager.getPlayerList();
        console.log('현재 플레이어 목록:', players);
        console.log('내 플레이어 이름:', this.p2pManager.playerName);
        
        const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
        console.log('내 플레이어 인덱스:', myIndex);
        
        // 플레이어 인덱스를 찾을 수 없는 경우, 수신된 인덱스를 사용
        if (myIndex === -1) {
            console.log('플레이어 목록에서 자신을 찾을 수 없음. 수신된 인덱스 사용:', data.playerIndex);
            
            // 카드 데이터 변환 과정 로깅
            console.log('원본 숫자 카드 데이터:', data.numberCards);
            console.log('원본 연산자 카드 데이터:', data.operatorCards);
            
            // 카드 데이터가 존재하는지 확인
            if (!data.numberCards || !Array.isArray(data.numberCards)) {
                console.error('숫자 카드 데이터가 없거나 배열이 아님:', data.numberCards);
                return;
            }
            
            if (!data.operatorCards || !Array.isArray(data.operatorCards)) {
                console.error('연산자 카드 데이터가 없거나 배열이 아님:', data.operatorCards);
                return;
            }
            
            // 카드 데이터를 Card 객체로 변환
            const numberCards = data.numberCards.map((cardData, index) => {
                console.log(`숫자 카드 ${index} 변환:`, cardData);
                if (!cardData || typeof cardData.value === 'undefined') {
                    console.error(`숫자 카드 ${index} 데이터가 올바르지 않음:`, cardData);
                    return null;
                }
                const card = new Card(cardData.type, cardData.value);
                console.log(`숫자 카드 ${index} 변환 결과:`, card);
                return card;
            }).filter(card => card !== null);
            
            const operatorCards = data.operatorCards.map((cardData, index) => {
                console.log(`연산자 카드 ${index} 변환:`, cardData);
                if (!cardData || typeof cardData.value === 'undefined') {
                    console.error(`연산자 카드 ${index} 데이터가 올바르지 않음:`, cardData);
                    return null;
                }
                const card = new Card(cardData.type, cardData.value);
                console.log(`연산자 카드 ${index} 변환 결과:`, card);
                return card;
            }).filter(card => card !== null);
            
            console.log('변환된 숫자 카드 수:', numberCards.length);
            console.log('변환된 연산자 카드 수:', operatorCards.length);
            
            // 게스트는 수신된 인덱스를 자신의 인덱스로 사용
            const myPlayer = {
                id: data.playerIndex,
                name: this.p2pManager.playerName,
                numberCards: numberCards,
                operatorCards: operatorCards,
                isHost: this.p2pManager.isHost
            };
            
            this.gameState.players = [myPlayer];
            console.log('내 카드 정보 설정 완료 (인덱스 불일치 해결):', myPlayer);
            console.log('숫자 카드 수:', myPlayer.numberCards.length);
            console.log('연산자 카드 수:', myPlayer.operatorCards.length);
            console.log('설정된 플레이어 배열:', this.gameState.players);
            console.log('플레이어 배열 길이:', this.gameState.players.length);
            
            // 남은 패 데이터 설정
            if (data.remainingDeck) {
                this.gameState.remainingDeck = data.remainingDeck.map(cardData => 
                    new Card(cardData.type, cardData.value)
                );
                console.log('남은 패 데이터 설정 완료:', this.gameState.remainingDeck.length, '장');
            }
            
            // 정답 숫자 및 게임 설정 설정
            if (data.targetAnswer !== undefined) {
                this.gameState.targetAnswer = data.targetAnswer;
                console.log('정답 숫자 설정:', data.targetAnswer);
            }
            if (data.targetCards) {
                this.gameState.targetCards = data.targetCards.map(cardData => {
                    const card = new Card(cardData.type, cardData.value);
                    card.id = cardData.id;
                    return card;
                });
                console.log('정답 카드 설정:', this.gameState.targetCards);
            }
            if (data.possibleAnswers) {
                this.gameState.possibleAnswers = data.possibleAnswers;
                console.log('가능한 정답들 설정:', data.possibleAnswers);
            }
            if (data.gameSettings) {
                this.gameState.settings = data.gameSettings;
                console.log('게임 설정 설정:', data.gameSettings);
            }
            if (data.fieldEquations) {
                this.gameState.fieldEquations = data.fieldEquations.map(equationData => ({
                    id: equationData.id,
                    cards: equationData.cards.map(cardData => {
                        const card = new Card(cardData.type, cardData.value);
                        card.id = cardData.id;
                        if (cardData.temporaryOperator) {
                            card.setTemporaryOperator(cardData.temporaryOperator);
                        }
                        return card;
                    }),
                    result: equationData.result,
                    isValid: equationData.isValid
                }));
                console.log('필드 등식 설정:', this.gameState.fieldEquations);
            }
            
            console.log('=== 플레이어 게임 상태 수신 완료 ===');
            this.updateUI();
            return;
        }
        
        if (myIndex === data.playerIndex) {
            // 카드 데이터를 Card 객체로 변환
            const numberCards = data.numberCards.map(cardData => {
                const card = new Card(cardData.type, cardData.value);
                card.id = cardData.id;
                return card;
            });
            const operatorCards = data.operatorCards.map(cardData => {
                const card = new Card(cardData.type, cardData.value);
                card.id = cardData.id;
                return card;
            });
            
            // 자신의 카드 정보만 설정
            const myPlayer = {
                id: myIndex,
                name: this.p2pManager.playerName,
                numberCards: numberCards,
                operatorCards: operatorCards,
                isHost: this.p2pManager.isHost
            };
            
            // 게스트는 자신만 players 배열에 추가
            this.gameState.players = [myPlayer];
            
            console.log('내 카드 정보 설정 완료:', myPlayer);
            console.log('게스트 플레이어 배열:', this.gameState.players);
            console.log('숫자 카드 수:', numberCards.length);
            console.log('연산자 카드 수:', operatorCards.length);
            console.log('설정된 플레이어 배열:', this.gameState.players);
            console.log('플레이어 배열 길이:', this.gameState.players.length);
            
            // 남은 패 데이터 설정
            if (data.remainingDeck) {
                this.gameState.remainingDeck = data.remainingDeck.map(cardData => {
                    const card = new Card(cardData.type, cardData.value);
                    card.id = cardData.id;
                    return card;
                });
                console.log('남은 패 데이터 설정 완료:', this.gameState.remainingDeck.length, '장');
            }
            
            console.log('=== 플레이어 게임 상태 수신 완료 (정상 케이스) ===');
            // UI 업데이트
            this.updateUI();
        } else {
            console.log('플레이어 인덱스 불일치:', myIndex, 'vs', data.playerIndex);
            console.log('수신된 데이터를 무시합니다.');
        }
    }

    handleCommonGameState(data) {
        console.log('공통 게임 상태 수신:', data);
        
        // 공통 게임 상태 설정
        this.gameState.settings = data.gameSettings;
        this.gameState.targetAnswer = data.targetAnswer;
        this.gameState.targetCards = data.targetCards ? data.targetCards.map(cardData => {
            const card = new Card(cardData.type, cardData.value);
            card.id = cardData.id;
            return card;
        }) : [];
        this.gameState.possibleAnswers = data.possibleAnswers;
        this.gameState.currentPlayer = data.currentPlayer;
        // 필드 등식 업데이트 (기존 등식 유지)
        if (data.fieldEquations && data.fieldEquations.length > 0) {
            this.gameState.fieldEquations = data.fieldEquations.map(equationData => ({
                id: equationData.id,
                cards: equationData.cards.map(cardData => {
                    const card = new Card(cardData.type, cardData.value);
                    card.id = cardData.id;
                    if (cardData.temporaryOperator) {
                        card.setTemporaryOperator(cardData.temporaryOperator);
                    }
                    return card;
                }),
                result: equationData.result,
                isValid: equationData.isValid
            }));
            console.log('공통 상태에서 필드 등식 업데이트:', this.gameState.fieldEquations.length, '개');
        } else {
            console.log('공통 상태에서 필드 등식 데이터가 없음, 기존 등식 유지');
        }
        this.gameState.isGameActive = data.isGameActive;
        
        // 남은 패 데이터 설정 (게스트만 업데이트)
        if (data.remainingDeck && !this.p2pManager.isHost) {
            this.gameState.remainingDeck = data.remainingDeck.map(cardData => {
                const card = new Card(cardData.type, cardData.value);
                card.id = cardData.id;
                return card;
            });
            console.log('공통 상태에서 남은 패 데이터 업데이트:', this.gameState.remainingDeck.length, '장');
        } else if (this.p2pManager.isHost) {
            console.log('호스트는 남은 패 데이터를 업데이트하지 않음 (이미 올바른 상태)');
        }
        
        // 턴 상태 초기화
        this.hasSubmittedAnswer = false;
        this.isAnswerSubmitted = false;
        
        // UI 업데이트
        this.updateUI();
        this.logMessage('게임 상태가 동기화되었습니다!', 'info');
        this.logMessage(`가능한 정답: ${this.gameState.possibleAnswers.join(', ')}`, 'info');
    }

    handleTurnChange(data) {
        // 중복 처리 방지: 동일한 턴 변경 메시지인지 확인
        if (this.lastTurnChangeData && 
            this.lastTurnChangeData.currentPlayer === data.currentPlayer &&
            this.lastTurnChangeData.cycleCompleted === data.cycleCompleted &&
            this.lastTurnChangeData.cycleAnswerFound === data.cycleAnswerFound &&
            this.lastTurnChangeData.timestamp === data.timestamp) {
            return;
        }
        
        this.lastTurnChangeData = { ...data };
        
        // 턴 상태 업데이트
        this.gameState.currentPlayer = data.currentPlayer;
        this.gameState.cycleAnswerFound = data.cycleAnswerFound;
        this.gameState.cycleCompleted = data.cycleCompleted;
        
        // 턴 상태 초기화
        this.hasSubmittedAnswer = false;
        this.isAnswerSubmitted = false;
        
        // 수식 영역 초기화
        this.clearExpression();
        
        // 사이클이 완료된 경우 처리 (게스트는 호스트가 이미 처리했으므로 제외)
        if (data.cycleCompleted && (!this.isMultiplayer || this.p2pManager.isHost)) {
            this.handleCycleCompletion();
        }
        
        this.updateUI();
        
        const newPlayer = this.gameState.getCurrentPlayer();
        if (newPlayer && newPlayer.name) {
            this.logMessage(`${newPlayer.name}의 턴입니다.`, 'info');
        }
    }

    async broadcastGameState() {
        console.log('게임 상태를 모든 플레이어에게 전송합니다');
        
        // 플레이어 목록 가져오기
        const players = this.p2pManager.getPlayerList();
        
        // 각 플레이어에게 개별 카드 생성 및 전송
        for (const [index, player] of players.entries()) {
            if (player.name !== this.p2pManager.playerName) {
                // 게스트용 카드 생성
                const guestCards = this.generateCardsForGuest();
                
                console.log(`${player.name}에게 카드 전송 시작: 숫자 ${guestCards.numberCards.length}장, 연산자 ${guestCards.operatorCards.length}장`);
                
                const success = await this.p2pManager.sendToPlayerWithRetry(player.name, 'game_state', {
                    playerIndex: index,
                    numberCards: guestCards.numberCards,
                    operatorCards: guestCards.operatorCards,
                    gameSettings: this.gameState.settings,
                    targetAnswer: this.gameState.targetAnswer,
                    targetCards: this.gameState.targetCards.map(card => ({
                        id: card.id,
                        value: card.value,
                        type: card.type
                    })),
                    possibleAnswers: this.gameState.possibleAnswers,
                    currentPlayer: this.gameState.currentPlayer,
                    fieldEquations: this.gameState.fieldEquations.map(equation => ({
                        id: equation.id,
                        cards: equation.cards.map(card => ({
                            id: card.id,
                            value: card.value,
                            type: card.type,
                            temporaryOperator: card.temporaryOperator
                        })),
                        result: equation.result,
                        isValid: equation.isValid() // 함수 호출로 결과값 전송
                    })),
                    remainingDeck: this.gameState.remainingDeck.map(card => ({
                        id: card.id,
                        value: card.value,
                        type: card.type
                    }))
                });
                
                if (success) {
                    console.log(`${player.name}에게 카드 전송 성공: 숫자 ${guestCards.numberCards.length}장, 연산자 ${guestCards.operatorCards.length}장`);
                } else {
                    console.error(`${player.name}에게 카드 전송 실패`);
                    
                    // WebRTC 실패 시 BroadcastChannel을 통한 대체 방안
                    console.log(`BroadcastChannel을 통한 대체 전송 시도: ${player.name}`);
                    this.p2pManager.broadcastMessage('game_state_fallback', {
                        targetPlayer: player.name,
                        playerIndex: index,
                        numberCards: guestCards.numberCards,
                        operatorCards: guestCards.operatorCards,
                        gameSettings: this.gameState.settings,
                        targetAnswer: this.gameState.targetAnswer,
                        targetCards: this.gameState.targetCards.map(card => ({
                            id: card.id,
                            value: card.value,
                            type: card.type
                        })),
                        possibleAnswers: this.gameState.possibleAnswers,
                        currentPlayer: this.gameState.currentPlayer,
                        fieldEquations: this.gameState.fieldEquations.map(equation => ({
                            id: equation.id,
                            cards: equation.cards.map(card => ({
                                id: card.id,
                                value: card.value,
                                type: card.type,
                                temporaryOperator: card.temporaryOperator
                            })),
                            result: equation.result,
                            isValid: equation.isValid
                        })),
                        remainingDeck: this.gameState.remainingDeck.map(card => ({
                            id: card.id,
                            value: card.value,
                            type: card.type
                        }))
                    });
                }
            } else {
                // 호스트 자신에게도 남은 패 데이터 동기화 (자신의 카드는 이미 있으므로 남은 패만)
                console.log('호스트 자신에게 남은 패 데이터 동기화');
                this.handleCommonGameState({
                    gameSettings: this.gameState.settings,
                    targetAnswer: this.gameState.targetAnswer,
                    targetCards: this.gameState.targetCards.map(card => ({
                        id: card.id,
                        value: card.value,
                        type: card.type
                    })),
                    possibleAnswers: this.gameState.possibleAnswers,
                    currentPlayer: this.gameState.currentPlayer,
                    fieldEquations: this.gameState.fieldEquations.map(equation => ({
                        id: equation.id,
                        cards: equation.cards.map(card => ({
                            id: card.id,
                            value: card.value,
                            type: card.type,
                            temporaryOperator: card.temporaryOperator
                        })),
                        result: equation.result,
                        isValid: equation.isValid() // 함수 호출로 결과값 전송
                    })),
                    isGameActive: this.gameState.isGameActive,
                    remainingDeck: this.gameState.remainingDeck.map(card => ({
                        id: card.id,
                        value: card.value,
                        type: card.type
                    }))
                });
            }
        }
        
        // 공통 게임 상태도 브로드캐스트
        this.p2pManager.broadcastMessage('game_state_common', {
            gameSettings: this.gameState.settings,
            targetAnswer: this.gameState.targetAnswer,
            targetCards: this.gameState.targetCards.map(card => ({
                id: card.id,
                value: card.value,
                type: card.type
            })),
            possibleAnswers: this.gameState.possibleAnswers,
            currentPlayer: this.gameState.currentPlayer,
            fieldEquations: this.gameState.fieldEquations.map(equation => ({
                id: equation.id,
                cards: equation.cards.map(card => ({
                    id: card.id,
                    value: card.value,
                    type: card.type,
                    temporaryOperator: card.temporaryOperator
                })),
                result: equation.result,
                isValid: equation.isValid() // 함수 호출로 결과값 전송
            })),
            isGameActive: this.gameState.isGameActive,
            remainingDeck: this.gameState.remainingDeck.map(card => ({
                id: card.id,
                value: card.value,
                type: card.type
            }))
        });
    }

    // 필드 등식 실시간 동기화
    broadcastFieldEquations() {
        if (this.isMultiplayer) {
            console.log('=== 필드 등식 동기화 전송 시작 ===');
            console.log('현재 필드 등식 수:', this.gameState.fieldEquations.length);
            console.log('필드 등식들:', this.gameState.fieldEquations.map(eq => ({id: eq.id, cards: eq.cards.length, display: eq.getDisplayString()})));
            
            // Equation 객체를 직렬화 가능한 데이터로 변환
            const serializedEquations = this.gameState.fieldEquations.map(equation => ({
                id: equation.id,
                cards: equation.cards.map(card => ({
                    id: card.id,
                    value: card.value,
                    type: card.type,
                    temporaryOperator: card.temporaryOperator
                })),
                result: equation.result,
                isValid: equation.isValid() // 함수 호출로 결과값 전송
            }));
            
            console.log('직렬화된 등식 데이터:', serializedEquations);
            
            this.p2pManager.broadcastMessage('field_equations_update', {
                fieldEquations: serializedEquations
            });
            
            console.log('=== 필드 등식 동기화 전송 완료 ===');
        }
    }

    // 필드 등식 업데이트 수신 처리
    handleFieldEquationsUpdate(data) {
        console.log('=== 필드 등식 업데이트 수신 시작 ===');
        console.log('수신된 데이터:', data);
        console.log('수신 전 필드 등식 수:', this.gameState.fieldEquations.length);
        
        // 필드 등식 데이터가 있는 경우에만 업데이트
        if (data.fieldEquations && data.fieldEquations.length > 0) {
            console.log('필드 등식 데이터 있음, 업데이트 진행');
            console.log('수신된 등식 수:', data.fieldEquations.length);
            
            this.gameState.fieldEquations = data.fieldEquations.map(equationData => {
                // 카드들을 Card 객체로 변환
                const cards = equationData.cards.map(cardData => {
                    const card = new Card(cardData.type, cardData.value);
                    card.id = cardData.id;
                    if (cardData.temporaryOperator) {
                        card.setTemporaryOperator(cardData.temporaryOperator);
                    }
                    return card;
                });
                
                // 등호를 기준으로 왼쪽과 오른쪽 분리
                const equalsIndex = cards.findIndex(card => card.type === 'equals');
                const leftSide = equalsIndex !== -1 ? cards.slice(0, equalsIndex) : [];
                const rightSide = equalsIndex !== -1 ? cards.slice(equalsIndex + 1) : [];
                
                // 새로운 Equation 객체 생성
                const equation = new Equation(leftSide, rightSide);
                equation.id = equationData.id; // ID 유지
                equation.result = equationData.result; // 결과 유지
                
                return equation;
            });
            
            console.log('필드 등식 업데이트 완료:', this.gameState.fieldEquations.length, '개');
            console.log('업데이트된 등식들:', this.gameState.fieldEquations.map(eq => ({id: eq.id, cards: eq.cards.length, display: eq.getDisplayString()})));
        } else {
            console.log('필드 등식 데이터가 없음, 기존 등식 유지');
            console.log('현재 필드 등식 수:', this.gameState.fieldEquations.length);
        }
        
        // UI 업데이트
        this.updateFieldEquations();
        
        // 등식박스 크기 재조절
        setTimeout(() => {
            this.gameState.fieldEquations.forEach(equation => {
                const equationElement = document.querySelector(`[data-equation-id="${equation.id}"]`);
                if (equationElement) {
                    this.adjustEquationBoxSize(equationElement, equation);
                }
            });
        }, 100);
        
        console.log('=== 필드 등식 동기화 완료 ===');
    }

    generateCardsForGuest() {
        console.log('=== 게스트용 카드 생성 시작 ===');
        console.log('현재 남은 덱 크기:', this.gameState.remainingDeck.length);
        console.log('게임 설정:', this.gameState.settings);
        console.log('요청된 숫자 카드 수:', this.gameState.settings.initialNumberCards);
        console.log('요청된 연산자 카드 수:', this.gameState.settings.initialOperatorCards);
        
        // 남은 덱의 카드 타입 분석
        const numberCardsInDeck = this.gameState.remainingDeck.filter(card => card.type === 'number');
        const operatorCardsInDeck = this.gameState.remainingDeck.filter(card => card.type === 'operator' || card.type === 'joker');
        console.log('남은 덱의 숫자 카드 수:', numberCardsInDeck.length);
        console.log('남은 덱의 연산자 카드 수:', operatorCardsInDeck.length);
        
        const guestCards = {
            numberCards: [],
            operatorCards: []
        };

        // 숫자 카드 배분
        console.log('숫자 카드 배분 시작');
        for (let j = 0; j < this.gameState.settings.initialNumberCards; j++) {
            const availableNumberCards = this.gameState.remainingDeck.filter(card => card.type === 'number');
            console.log(`숫자 카드 배분 ${j+1}/${this.gameState.settings.initialNumberCards}, 사용 가능한 숫자 카드: ${availableNumberCards.length}`);
            
            if (availableNumberCards.length === 0) {
                console.warn(`숫자 카드 부족! 요청: ${this.gameState.settings.initialNumberCards}, 배분 완료: ${j}`);
                break;
            }
            
            const randomIndex = Math.floor(Math.random() * availableNumberCards.length);
            const selectedCard = availableNumberCards[randomIndex];
            
            // 남은 덱에서 해당 카드 제거 (ID로 찾아서 제거)
            const deckIndex = this.gameState.remainingDeck.findIndex(card => card.id === selectedCard.id);
            if (deckIndex !== -1) {
                this.gameState.remainingDeck.splice(deckIndex, 1);
                guestCards.numberCards.push(selectedCard);
                console.log(`숫자 카드 제거: ${selectedCard.value}, 남은 덱 크기: ${this.gameState.remainingDeck.length}`);
            } else {
                console.error(`숫자 카드를 덱에서 찾을 수 없음: ${selectedCard.id}`);
            }
        }
        
        // 연산자 카드 배분
        console.log('연산자 카드 배분 시작');
        for (let j = 0; j < this.gameState.settings.initialOperatorCards; j++) {
            const availableOperatorCards = this.gameState.remainingDeck.filter(card => card.type === 'operator' || card.type === 'joker');
            console.log(`연산자 카드 배분 ${j+1}/${this.gameState.settings.initialOperatorCards}, 사용 가능한 연산자 카드: ${availableOperatorCards.length}`);
            
            if (availableOperatorCards.length === 0) {
                console.warn(`연산자 카드 부족! 요청: ${this.gameState.settings.initialOperatorCards}, 배분 완료: ${j}`);
                break;
            }
            
            const randomIndex = Math.floor(Math.random() * availableOperatorCards.length);
            const selectedCard = availableOperatorCards[randomIndex];
            
            // 남은 덱에서 해당 카드 제거 (ID로 찾아서 제거)
            const deckIndex = this.gameState.remainingDeck.findIndex(card => card.id === selectedCard.id);
            if (deckIndex !== -1) {
                this.gameState.remainingDeck.splice(deckIndex, 1);
                guestCards.operatorCards.push(selectedCard);
                console.log(`연산자 카드 제거: ${selectedCard.value}, 남은 덱 크기: ${this.gameState.remainingDeck.length}`);
            } else {
                console.error(`연산자 카드를 덱에서 찾을 수 없음: ${selectedCard.id}`);
            }
        }

        console.log(`게스트 카드 생성 완료: 숫자 ${guestCards.numberCards.length}장, 연산자 ${guestCards.operatorCards.length}장`);
        console.log('최종 남은 덱 크기:', this.gameState.remainingDeck.length);
        console.log('=== 게스트용 카드 생성 완료 ===');
        return guestCards;
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
        if (this.isMultiplayer) {
            // 멀티플레이어: 자신의 카드만 표시
            this.updateMyPlayerHand();
        } else {
            // 솔로플레이: 현재 플레이어의 카드 표시
            this.updateCurrentPlayerHand();
        }
    }

    updateMyPlayerHand() {
        console.log('=== updateMyPlayerHand 시작 ===');
        console.log('멀티플레이어 모드:', this.isMultiplayer);
        console.log('게임 상태 플레이어 수:', this.gameState.players.length);
        console.log('게임 상태 플레이어들:', this.gameState.players.map(p => ({name: p.name, numberCards: p.numberCards?.length, operatorCards: p.operatorCards?.length})));
        
        // 멀티플레이어에서 자신의 플레이어 정보 찾기
        if (this.gameState.players.length === 0) {
            console.log('플레이어 정보가 없습니다');
            return;
        }
        
        // 현재 턴이 자신의 턴인지 확인
        const players = this.p2pManager.getPlayerList();
        const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
        const isMyTurn = this.gameState.currentPlayer === myIndex;
        
        console.log('현재 턴:', this.gameState.currentPlayer, '내 인덱스:', myIndex, '내 턴인가?', isMyTurn);
        console.log('P2P 플레이어 목록:', players.map(p => p.name));
        console.log('내 이름:', this.p2pManager.playerName);
        console.log('호스트 여부:', this.p2pManager.isHost);
        
        // 자신의 플레이어 정보 찾기 (호스트/게스트 구분)
        let myPlayer;
        if (this.p2pManager.isHost) {
            // 호스트: 자신의 이름과 일치하는 플레이어 찾기
            myPlayer = this.gameState.players.find(p => p.name === this.p2pManager.playerName);
            console.log('호스트 모드: 자신의 플레이어 찾기');
        } else {
            // 게스트: 첫 번째 플레이어가 자신
            myPlayer = this.gameState.players[0];
            console.log('게스트 모드: 첫 번째 플레이어 사용');
        }
        
        if (!myPlayer) {
            console.log('자신의 플레이어 정보를 찾을 수 없습니다');
            console.log('사용 가능한 플레이어:', this.gameState.players.map(p => p.name));
            console.log('내 이름:', this.p2pManager.playerName);
            return;
        }
        
        console.log('찾은 내 플레이어:', myPlayer);
        console.log('내 플레이어 이름:', myPlayer.name);
        console.log('내 플레이어 숫자 카드 수:', myPlayer.numberCards ? myPlayer.numberCards.length : 'undefined');
        console.log('내 플레이어 연산자 카드 수:', myPlayer.operatorCards ? myPlayer.operatorCards.length : 'undefined');
        
        const handNumbers = document.getElementById('hand-numbers');
        const handOperators = document.getElementById('hand-operators');
        
        // 카드 수 업데이트
        document.getElementById('number-count').textContent = myPlayer.numberCards.length;
        document.getElementById('operator-count').textContent = myPlayer.operatorCards.length;

        // 숫자 카드 렌더링
        handNumbers.innerHTML = '';
        console.log('숫자 카드 렌더링 시작:', myPlayer.numberCards.length, '장');
        console.log('handNumbers 요소:', handNumbers);
        
        if (!myPlayer.numberCards || myPlayer.numberCards.length === 0) {
            console.log('숫자 카드가 없습니다.');
            // 숫자 카드가 없어도 연산자 카드는 렌더링해야 함
        } else {
        
            myPlayer.numberCards.forEach((card, index) => {
                console.log(`숫자 카드 ${index}:`, card);
                console.log(`카드 타입: ${card.type}, 값: ${card.value}, ID: ${card.id}`);
                
                if (!card || typeof card.createElement !== 'function') {
                    console.error(`숫자 카드 ${index}가 올바르지 않습니다:`, card);
                    return;
                }
                
                const element = card.createElement();
                console.log(`숫자 카드 ${index} 엘리먼트:`, element);
                console.log(`엘리먼트 클래스: ${element.className}`);
                console.log(`엘리먼트 텍스트: ${element.textContent}`);
                
                handNumbers.appendChild(element);
            });
        }

        // 연산자 카드 렌더링
        handOperators.innerHTML = '';
        console.log('연산자 카드 렌더링 시작:', myPlayer.operatorCards.length, '장');
        console.log('handOperators 요소:', handOperators);
        
        if (!myPlayer.operatorCards || myPlayer.operatorCards.length === 0) {
            console.log('연산자 카드가 없습니다.');
            // 연산자 카드가 없어도 숫자 카드는 렌더링해야 함
        } else {
        
            myPlayer.operatorCards.forEach((card, index) => {
                console.log(`연산자 카드 ${index}:`, card);
                console.log(`카드 타입: ${card.type}, 값: ${card.value}, ID: ${card.id}`);
                
                if (!card || typeof card.createElement !== 'function') {
                    console.error(`연산자 카드 ${index}가 올바르지 않습니다:`, card);
                    return;
                }
                
                const element = card.createElement();
                console.log(`연산자 카드 ${index} 엘리먼트:`, element);
                console.log(`엘리먼트 클래스: ${element.className}`);
                console.log(`엘리먼트 텍스트: ${element.textContent}`);
                
                handOperators.appendChild(element);
            });
        }
        
        console.log(`내 카드 표시 완료: 숫자 ${myPlayer.numberCards.length}장, 연산자 ${myPlayer.operatorCards.length}장`);
    }

    updateCurrentPlayerHand() {
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
        
        console.log('=== updateFieldEquations 시작 ===');
        console.log('현재 필드 등식 수:', this.gameState.fieldEquations.length);
        console.log('필드 등식들:', this.gameState.fieldEquations.map(eq => ({id: eq.id, cards: eq.cards.length})));
        
        // DOM 완전 초기화
        console.log('DOM 초기화 시작');
        fieldEquations.innerHTML = '';
        
        if (this.gameState.fieldEquations.length === 0) {
            console.log('등식이 없음, 빈 메시지 표시');
            fieldEquations.innerHTML = '<p class="no-equations">아직 등식이 없습니다.</p>';
            console.log('=== updateFieldEquations 완료 (등식 없음) ===');
            return;
        }

        console.log('등식 렌더링 시작');
        this.gameState.fieldEquations.forEach((equation, index) => {
            console.log(`등식 ${index} 렌더링:`, equation.id, equation.cards.length, '장');
            const equationElement = this.createEquationElement(equation);
            fieldEquations.appendChild(equationElement);
            
            // 등식박스 크기 자동 조절
            this.adjustEquationBoxSize(equationElement, equation);
        });
        
        console.log('렌더링된 등식 수:', fieldEquations.children.length);
        console.log('=== updateFieldEquations 완료 ===');
    }
    
    // 등식박스 크기 자동 조절
    adjustEquationBoxSize(equationElement, equation) {
        // 등식의 카드 수에 따라 박스 크기 조절
        const cardCount = equation.cards.length;
        const baseWidth = 100; // 기본 너비 (더 작게)
        const padding = 40; // 패딩 (여백 확보)
        
        // 카드 타입별로 다른 너비 적용 (새로운 카드 크기에 맞춤)
        let totalCardWidth = 0;
        equation.cards.forEach(card => {
            if (card.type === 'number') {
                totalCardWidth += 28; // 숫자 카드 너비 증가
            } else if (card.type === 'operator') {
                totalCardWidth += 25; // 연산자 카드 너비 증가
            } else if (card.type === 'joker') {
                totalCardWidth += 30; // 조커 카드 너비 증가
            } else if (card.type === 'equals') {
                totalCardWidth += 20; // 등호 너비 증가
            }
        });
        
        const calculatedWidth = baseWidth + totalCardWidth + padding;
        const maxWidth = 800; // 최대 너비 증가
        const minWidth = 180; // 최소 너비 증가
        
        const finalWidth = Math.max(minWidth, Math.min(calculatedWidth, maxWidth));
        
        console.log(`등식박스 크기 조절: 카드 수 ${cardCount}, 계산된 너비 ${calculatedWidth}px, 최종 너비 ${finalWidth}px`);
        
        equationElement.style.width = finalWidth + 'px';
        
        // 등식박스가 필드 영역을 벗어나지 않도록 조정
        this.constrainEquationBoxToField(equationElement);
    }
    
    // 등식박스가 필드 영역 내에 있도록 제한
    constrainEquationBoxToField(equationElement) {
        const fieldRect = document.getElementById('field-equations').getBoundingClientRect();
        const currentLeft = parseInt(equationElement.style.left) || 0;
        const currentTop = parseInt(equationElement.style.top) || 0;
        
        const maxX = fieldRect.width - equationElement.offsetWidth;
        const maxY = fieldRect.height - equationElement.offsetHeight;
        
        if (currentLeft > maxX) {
            equationElement.style.left = maxX + 'px';
        }
        if (currentTop > maxY) {
            equationElement.style.top = maxY + 'px';
        }
    }

    createEquationElement(equation) {
        const equationDiv = document.createElement('div');
        const validClass = equation.isValid() ? '' : 'invalid';
        equationDiv.className = `equation ${validClass}`.trim();
        equationDiv.dataset.equationId = equation.id;
        
        // 등식박스 드래그 앤 드롭 기능 추가
        this.setupEquationBoxDragAndDrop(equationDiv, equation);

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

        // 등식박스 위치 복원
        this.restoreEquationPosition(equationDiv, equation.id);

        return equationDiv;
    }

    // 등식박스 드래그 앤 드롭 기능 설정
    setupEquationBoxDragAndDrop(equationDiv, equation) {
        let isDragging = false;
        let startX, startY, initialX, initialY;
        let animationFrameId = null;
        
        // 마우스 이동 중 (requestAnimationFrame 사용으로 부드러운 드래그)
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            // 이전 애니메이션 프레임 취소
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            
            animationFrameId = requestAnimationFrame(() => {
                const fieldRect = document.getElementById('field-equations').getBoundingClientRect();
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                const newX = initialX + deltaX;
                const newY = initialY + deltaY;
                
                // 필드 영역 내에서만 이동 가능
                const maxX = fieldRect.width - equationDiv.offsetWidth;
                const maxY = fieldRect.height - equationDiv.offsetHeight;
                
                equationDiv.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
                equationDiv.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
            });
        };
        
        // 마우스 놓기
        const handleMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                equationDiv.classList.remove('dragging');
                
                // 애니메이션 프레임 취소
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
                
                // 등식박스 위치 저장
                this.saveEquationPosition(equation.id, {
                    x: parseInt(equationDiv.style.left) || 0,
                    y: parseInt(equationDiv.style.top) || 0
                });
                
                // 이벤트 리스너 제거
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };
        
        // 등식박스 드래그 시작
        equationDiv.addEventListener('mousedown', (e) => {
            // 카드 드래그가 아닌 경우에만 등식박스 드래그 허용
            if (e.target.classList.contains('equation-card')) {
                return;
            }
            
            // 멀티플레이어에서 내 차례가 아닌 경우 등식박스 드래그 방지
            if (this.isMultiplayer) {
                const players = this.p2pManager.getPlayerList();
                const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
                const isMyTurn = this.gameState.currentPlayer === myIndex;
                
                if (!isMyTurn) {
                    console.log('내 차례가 아니므로 등식박스 드래그를 방지합니다.');
                    return;
                }
            }
            
            isDragging = true;
            equationDiv.classList.add('dragging');
            
            // 현재 위치 저장
            const rect = equationDiv.getBoundingClientRect();
            const fieldRect = document.getElementById('field-equations').getBoundingClientRect();
            
            startX = e.clientX;
            startY = e.clientY;
            initialX = rect.left - fieldRect.left;
            initialY = rect.top - fieldRect.top;
            
            // 등식박스의 초기 위치 설정 (첫 번째 등식인 경우)
            if (!equationDiv.style.left && !equationDiv.style.top) {
                equationDiv.style.left = initialX + 'px';
                equationDiv.style.top = initialY + 'px';
            }
            
            // 이벤트 리스너 추가
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
        });
    }
    
    // 등식박스 위치 저장
    saveEquationPosition(equationId, position) {
        if (!this.equationPositions) {
            this.equationPositions = new Map();
        }
        this.equationPositions.set(equationId, position);
        
        // 멀티플레이어에서 위치 동기화
        if (this.isMultiplayer) {
            this.broadcastEquationPosition(equationId, position);
        }
    }
    
    // 등식박스 위치 브로드캐스트
    broadcastEquationPosition(equationId, position) {
        console.log('등식박스 위치 브로드캐스트:', equationId, position);
        this.p2pManager.broadcastMessage('equation_position_update', {
            equationId: equationId,
            position: position,
            playerName: this.p2pManager.playerName
        });
    }
    
    // 등식박스 위치 업데이트 수신 처리
    handleEquationPositionUpdate(data) {
        console.log('등식박스 위치 업데이트 수신:', data);
        
        // 자신의 위치 변경이 아닌 경우에만 처리
        if (data.playerName !== this.p2pManager.playerName) {
            // 등식박스 위치 업데이트
            const equationElement = document.querySelector(`[data-equation-id="${data.equationId}"]`);
            if (equationElement) {
                equationElement.style.left = data.position.x + 'px';
                equationElement.style.top = data.position.y + 'px';
                
                // 로컬 위치 저장소도 업데이트
                if (!this.equationPositions) {
                    this.equationPositions = new Map();
                }
                this.equationPositions.set(data.equationId, data.position);
                
                console.log('등식박스 위치 업데이트 완료:', data.equationId, data.position);
            } else {
                console.log('등식박스를 찾을 수 없음:', data.equationId);
            }
        }
    }
    
    // 등식박스 위치 복원
    restoreEquationPosition(equationDiv, equationId) {
        if (!this.equationPositions) {
            this.equationPositions = new Map();
        }
        
        const position = this.equationPositions.get(equationId);
        if (position) {
            equationDiv.style.left = position.x + 'px';
            equationDiv.style.top = position.y + 'px';
        } else {
            // 저장된 위치가 없으면 초기 위치 설정
            if (this.isMultiplayer && this.p2pManager.isHost) {
                // 호스트만 무작위 위치 생성하고 다른 플레이어에게 전송
                const fieldRect = document.getElementById('field-equations').getBoundingClientRect();
                const randomX = Math.random() * (fieldRect.width - 200);
                const randomY = Math.random() * (fieldRect.height - 100);
                
                equationDiv.style.left = randomX + 'px';
                equationDiv.style.top = randomY + 'px';
                
                // 새 위치 저장 및 다른 플레이어에게 전송
                this.saveEquationPosition(equationId, { x: randomX, y: randomY });
                this.broadcastEquationPosition(equationId, { x: randomX, y: randomY });
            } else if (!this.isMultiplayer) {
                // 솔로 플레이: 직접 무작위 위치 생성
                const fieldRect = document.getElementById('field-equations').getBoundingClientRect();
                const randomX = Math.random() * (fieldRect.width - 200);
                const randomY = Math.random() * (fieldRect.height - 100);
                
                equationDiv.style.left = randomX + 'px';
                equationDiv.style.top = randomY + 'px';
                
                // 새 위치 저장
                this.saveEquationPosition(equationId, { x: randomX, y: randomY });
            } else {
                // 게스트: 호스트가 위치를 전송할 때까지 기본 위치에 배치
                equationDiv.style.left = '50px';
                equationDiv.style.top = '50px';
            }
        }
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
                // 멀티플레이어에서 내 차례가 아닌 경우 드래그 방지
                if (window.gameController && window.gameController.isMultiplayer) {
                    const players = window.gameController.p2pManager.getPlayerList();
                    const myIndex = players.findIndex(p => p.name === window.gameController.p2pManager.playerName);
                    const isMyTurn = window.gameController.gameState.currentPlayer === myIndex;
                    
                    if (!isMyTurn) {
                        console.log('내 차례가 아니므로 등식 내부 카드 드래그를 방지합니다.');
                        e.preventDefault();
                        return;
                    }
                }
                
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

    updateExpressionTitle() {
        const expressionTitle = document.querySelector('.expression-area h3');
        if (expressionTitle) {
            if (this.isMultiplayer) {
                const currentPlayer = this.gameState.getCurrentPlayer();
                const players = this.p2pManager.getPlayerList();
                const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
                const isMyTurn = this.gameState.currentPlayer === myIndex;
                
                if (currentPlayer) {
                    if (isMyTurn) {
                        expressionTitle.textContent = '수식 구성';
                    } else {
                        expressionTitle.textContent = `수식 구성 (${currentPlayer.name}의 차례)`;
                    }
                } else {
                    expressionTitle.textContent = '수식 구성';
                }
            } else {
                expressionTitle.textContent = '수식 구성';
            }
        }
    }

    updateExpressionArea() {
        const expressionDisplay = document.getElementById('expression-display');
        expressionDisplay.innerHTML = '';
        
        // 수식 구성 영역 제목 업데이트
        this.updateExpressionTitle();
        
        // 멀티플레이어에서 자신의 턴인지 확인
        let isMyTurn = true;
        if (this.isMultiplayer) {
            const players = this.p2pManager.getPlayerList();
            const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
            isMyTurn = this.gameState.currentPlayer === myIndex;
        }
        
        if (this.expressionArea.cards.length === 0) {
            const placeholder = document.createElement('span');
            if (isMyTurn) {
            placeholder.textContent = '카드를 드래그해서 수식을 만드세요';
            } else {
                const currentPlayer = this.gameState.getCurrentPlayer();
                placeholder.textContent = `${currentPlayer ? currentPlayer.name : '다른 플레이어'}의 수식 구성 중...`;
            }
            placeholder.style.color = '#a0aec0';
            placeholder.style.fontStyle = 'italic';
            expressionDisplay.appendChild(placeholder);
        } else {
            // 각 카드를 개별 요소로 표시
            this.expressionArea.cards.forEach((card, index) => {
                const cardElement = this.createExpressionCardElement(card, index);
                
                // 다른 플레이어의 턴일 때는 카드를 읽기 전용으로 표시
                if (!isMyTurn) {
                    cardElement.style.opacity = '0.7';
                    cardElement.style.pointerEvents = 'none';
                }
                
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
            
            console.log('dragover 이벤트 발생:', e.target.className, e.target.id);
            
            for (const zone of dropZones) {
                if (e.target.classList.contains(zone.slice(1)) || 
                    e.target.closest(zone)) {
                    const element = e.target.closest(zone) || e.target;
                    element.classList.add('drop-zone');
                    console.log('드롭 존 활성화:', zone, element);
                    
                    // 수식 영역의 경우 정확한 삽입 위치 표시
                    if (zone === '.expression-display') {
                        console.log('수식 영역 드롭 인디케이터 표시');
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
            console.log('드롭 이벤트 발생:', e.target);
            
            // 모든 시각적 피드백 제거
            document.querySelectorAll('.drop-zone').forEach(el => el.classList.remove('drop-zone'));
            document.querySelectorAll('.drop-target-before, .drop-target-after').forEach(el => {
                el.classList.remove('drop-target-before', 'drop-target-after');
            });
            
            const cardId = e.dataTransfer.getData('text/plain');
            const source = e.dataTransfer.getData('source');
            console.log('드롭된 카드 ID:', cardId, '소스:', source);
            
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
            console.log('드롭 타겟 클래스:', e.target.className);
            console.log('드롭 타겟 태그:', e.target.tagName);
            console.log('드롭 타겟 ID:', e.target.id);
            
            if (e.target.classList.contains('expression-display') || 
                e.target.closest('.expression-display')) {
                console.log('수식 영역에 드롭 감지됨');
                // 수식 영역에 드롭 - 위치 계산
                const position = this.calculateDropPosition(e, 'expression');
                console.log('계산된 드롭 위치:', position);
                
                // 이미 수식 영역에 있는 카드인지 확인
                if (source === 'expression') {
                    // 수식 영역 내에서 위치 변경
                    this.moveCardInExpression(cardId, position);
                } else {
                    // 다른 곳에서 수식 영역으로 이동
                this.moveCardToExpression(cardId, source, position);
                }
            } else if (e.target.classList.contains('equation') || 
                      e.target.closest('.equation')) {
                console.log('등식에 드롭 감지됨');
                // 등식에 드롭 - 위치 계산
                const equationElement = e.target.closest('.equation');
                if (equationElement) {
                    const position = this.calculateDropPosition(e, 'equation');
                    this.moveCardToEquation(cardId, equationElement.dataset.equationId, source, position);
                }
            } else if (e.target.classList.contains('hand-numbers') || 
                      e.target.closest('.hand-numbers')) {
                console.log('숫자 카드 영역에 드롭 감지됨');
                // 플레이어 숫자 카드 영역에 드롭
                this.moveCardToPlayerHand(cardId, 'number', source);
            } else if (e.target.classList.contains('hand-operators') || 
                      e.target.closest('.hand-operators')) {
                console.log('연산자 카드 영역에 드롭 감지됨');
                // 플레이어 연산자 카드 영역에 드롭
                this.moveCardToPlayerHand(cardId, 'operator', source);
            } else {
                console.log('드롭 타겟을 찾을 수 없음:', e.target);
            }
        });

        // 수식 영역 클릭으로 카드 제거
        const expressionDisplay = document.getElementById('expression-display');
        if (expressionDisplay) {
            expressionDisplay.addEventListener('click', () => {
            this.removeLastCardFromExpression();
        });
        }
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
        console.log('moveCardToExpression 호출:', cardId, source, position);
        const card = this.findAndRemoveCard(cardId, source);
        if (card) {
            console.log('카드 찾음, 수식 영역에 추가:', card);
            this.expressionArea.addCard(card, position);
            console.log('수식 영역 카드 수:', this.expressionArea.cards.length);
            
            // 멀티플레이어에서 실시간 동기화
            if (this.isMultiplayer) {
                this.broadcastExpressionState();
            }
            
            this.updateUI();
        } else {
            console.log('카드를 찾을 수 없어서 수식 영역에 추가 실패');
        }
    }

    moveCardToEquation(cardId, equationId, source, position = null) {
        // 멀티플레이어에서 내 차례가 아닌 경우 등식 수정 방지
        if (this.isMultiplayer) {
            const players = this.p2pManager.getPlayerList();
            const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
            const isMyTurn = this.gameState.currentPlayer === myIndex;
            
            if (!isMyTurn) {
                console.log('내 차례가 아니므로 등식 수정을 방지합니다.');
                this.logMessage('다른 플레이어의 차례입니다. 등식을 수정할 수 없습니다.', 'error');
                return;
            }
        }
        
        const card = this.findAndRemoveCard(cardId, source);
        if (card) {
            const equation = this.gameState.fieldEquations.find(eq => eq.id === equationId);
            if (equation) {
                if (position !== null && position >= 0 && position <= equation.cards.length) {
                    equation.insertCard(card, position);
                } else {
                    equation.cards.push(card);
                }
                
                // 등식박스 크기 자동 조절
                const equationElement = document.querySelector(`[data-equation-id="${equationId}"]`);
                if (equationElement) {
                    this.adjustEquationBoxSize(equationElement, equation);
                }
                
                this.updateUI();
                
                // 멀티플레이어에서 실시간 동기화
                if (this.isMultiplayer) {
                    this.broadcastCardMove('equation', cardId, source, position, equationId);
                }
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
        // 멀티플레이어에서 내 차례가 아닌 경우 등식 수정 방지
        if (this.isMultiplayer) {
            const players = this.p2pManager.getPlayerList();
            const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
            const isMyTurn = this.gameState.currentPlayer === myIndex;
            
            if (!isMyTurn) {
                console.log('내 차례가 아니므로 등식 수정을 방지합니다.');
                this.logMessage('다른 플레이어의 차례입니다. 등식을 수정할 수 없습니다.', 'error');
                return;
            }
        }
        
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
        // 멀티플레이어에서 내 차례가 아닌 경우 카드 이동 방지
        if (this.isMultiplayer) {
            const players = this.p2pManager.getPlayerList();
            const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
            const isMyTurn = this.gameState.currentPlayer === myIndex;
            
            if (!isMyTurn) {
                console.log('내 차례가 아니므로 카드 이동을 방지합니다.');
                this.logMessage('다른 플레이어의 차례입니다. 카드를 이동할 수 없습니다.', 'error');
                return;
            }
        }
        
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
        // 멀티플레이어에서 내 차례가 아닌 경우 카드 이동 방지
        if (this.isMultiplayer) {
            const players = this.p2pManager.getPlayerList();
            const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
            const isMyTurn = this.gameState.currentPlayer === myIndex;
            
            if (!isMyTurn) {
                console.log('내 차례가 아니므로 카드 이동을 방지합니다.');
                this.logMessage('다른 플레이어의 차례입니다. 카드를 이동할 수 없습니다.', 'error');
                return;
            }
        }
        
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
                
                // 멀티플레이어에서 실시간 동기화
                if (this.isMultiplayer) {
                    this.broadcastExpressionState();
                }
                
                this.updateUI();
            }
        }
    }

    findAndRemoveCard(cardId, source) {
        console.log('findAndRemoveCard 호출:', cardId, source);
        const currentPlayer = this.gameState.getCurrentPlayer();
        console.log('현재 플레이어:', currentPlayer ? currentPlayer.name : 'null');
        
        // 수식 영역에서 찾기
        if (source === 'expression') {
            console.log('수식 영역에서 카드 제거 시도');
            return this.expressionArea.removeCard(cardId);
        }
        
        // 등식에서 찾기 (등식 내부 카드 드래그인 경우)
        if (source === 'equation') {
            console.log('등식에서 카드 제거 시도');
            for (let equation of this.gameState.fieldEquations) {
                const removedCard = equation.removeCard(cardId);
                if (removedCard) {
                    console.log('등식에서 카드 제거됨');
                    
                    // 등식박스 크기 자동 조절
                    const equationElement = document.querySelector(`[data-equation-id="${equation.id}"]`);
                    if (equationElement) {
                        this.adjustEquationBoxSize(equationElement, equation);
                    }
                    
                    return removedCard;
                }
            }
            console.log('등식에서 카드를 찾을 수 없음:', cardId);
            return null;
        }
        
        // 플레이어 카드에서 찾기 (손패에서 드래그인 경우)
        if (currentPlayer) {
            console.log('플레이어 카드에서 검색:', currentPlayer.numberCards.length, '숫자카드,', currentPlayer.operatorCards.length, '연산자카드');
            
            let index = currentPlayer.numberCards.findIndex(c => c.id === cardId);
            if (index !== -1) {
                console.log('숫자 카드에서 찾음:', index);
                return currentPlayer.numberCards.splice(index, 1)[0];
            }
            
            index = currentPlayer.operatorCards.findIndex(c => c.id === cardId);
            if (index !== -1) {
                console.log('연산자 카드에서 찾음:', index);
                return currentPlayer.operatorCards.splice(index, 1)[0];
            }
        }
        
        console.log('플레이어 카드에서 찾지 못함, 등식에서 검색');
        
        // 등식에서 찾기 (손패에서 찾지 못한 경우)
        for (let equation of this.gameState.fieldEquations) {
            const removedCard = equation.removeCard(cardId);
            if (removedCard) {
                console.log('등식에서 카드 제거됨');
                
                // 등식박스 크기 자동 조절
                const equationElement = document.querySelector(`[data-equation-id="${equation.id}"]`);
                if (equationElement) {
                    this.adjustEquationBoxSize(equationElement, equation);
                }
                
                return removedCard;
            }
        }
        
        console.log('카드를 찾을 수 없음:', cardId);
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
        
        // 플레이어 카드 복원 (멀티플레이어에서는 제외)
        if (this.originalPlayerCards && !this.isMultiplayer) {
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
            if (this.isMultiplayer) {
                // 멀티플레이어: 자신의 턴인지 확인
                const players = this.p2pManager.getPlayerList();
                const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
                const isMyTurn = this.gameState.currentPlayer === myIndex;
                
                if (isMyTurn) {
                    // 내 턴인 경우
            if (this.isAnswerSubmitted || this.hasSubmittedAnswer) {
                // 정답을 제출한 경우: 카드 뽑기 비활성화
                drawNumberBtn.disabled = true;
                drawOperatorBtn.disabled = true;
            } else {
                // 정답을 제출하지 않은 경우: 카드 뽑기 활성화
                drawNumberBtn.disabled = false;
                drawOperatorBtn.disabled = false;
            }
                } else {
                    // 내 턴이 아닌 경우: 모든 버튼 비활성화
                    drawNumberBtn.disabled = true;
                    drawOperatorBtn.disabled = true;
                }
            } else {
                // 솔로플레이: 기존 로직
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
    }

    clearExpression() {
        this.expressionArea.cards = [];
        
        // 멀티플레이어에서 실시간 동기화
        if (this.isMultiplayer) {
            this.broadcastExpressionState();
        }
        
        this.calculator.clear();
        this.updateExpressionResult();
    }

    submitExpression() {
        // 수식 유효성 검사
        if (!this.expressionArea.isValidExpression()) {
            this.logMessage('유효하지 않은 수식입니다. 연산자를 포함한 올바른 수식을 만들어주세요.', 'error');
            return;
        }
        
        const result = this.expressionArea.calculate();
        
        // 계산 결과가 '없음'인 경우
        if (result === '없음') {
            this.logMessage('유효하지 않은 수식입니다. 연산자를 포함한 올바른 수식을 만들어주세요.', 'error');
            return;
        }
        
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
        
        // 수식 영역의 카드들을 플레이어 손패에서 제거
        leftSideCards.forEach(card => {
            if (card.type === 'number') {
                const index = currentPlayer.numberCards.findIndex(c => c.id === card.id);
                if (index !== -1) {
                    currentPlayer.numberCards.splice(index, 1);
                    console.log('숫자 카드 제거됨:', card);
                }
            } else if (card.type === 'operator' || card.type === 'joker') {
                const index = currentPlayer.operatorCards.findIndex(c => c.id === card.id);
                if (index !== -1) {
                    currentPlayer.operatorCards.splice(index, 1);
                    console.log('연산자/조커 카드 제거됨:', card);
                }
            }
        });
        
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
        console.log('=== 깨진 등식 처리 확인 ===');
        console.log('사용된 필드 카드 수:', this.calculator.usedFieldCards.length);
        console.log('사용된 필드 카드들:', this.calculator.usedFieldCards.map(card => ({id: card.id, value: card.value, type: card.type})));
        
        if (this.calculator.usedFieldCards.length > 0) {
            const affectedEquations = this.findEquationsWithCards(this.calculator.usedFieldCards);
            console.log('영향받는 등식 수:', affectedEquations.length);
            console.log('영향받는 등식들:', affectedEquations.map(eq => ({id: eq.id, display: eq.getDisplayString()})));
            
            if (affectedEquations.length > 0) {
                console.log('깨진 등식 처리 시작');
            this.handleBrokenEquations(affectedEquations, currentPlayer);
            } else {
                console.log('영향받는 등식이 없음');
            }
        } else {
            console.log('사용된 필드 카드가 없음');
        }

        // 새 등식을 필드에 추가
        this.gameState.fieldEquations.push(newEquation);
        
        // 멀티플레이어에서 필드 등식 동기화
        if (this.isMultiplayer) {
            this.broadcastFieldEquations();
        }

        // 승리 조건 확인
        const victoryCheck = this.gameState.checkVictory(currentPlayer);
        if (victoryCheck.hasWon) {
            this.endGame(currentPlayer, victoryCheck);
            return;
        }

        // 정답을 맞혔으므로 현재 사이클에서 정답이 나왔음을 표시
        this.gameState.cycleAnswerFound = true;
        
        // 정답 카드를 덱으로 되돌리고 새 정답 생성
        this.gameState.generateNewTarget();
        
        // 멀티플레이어에서 새 정답 동기화
        if (this.isMultiplayer) {
            this.broadcastNewTarget();
        }
        
        // UI 업데이트
        this.updateUI();
        
        this.logMessage(`${currentPlayer.name}이(가) 정답을 맞혔습니다!`, 'success');
        this.logMessage(`새로운 등식이 필드에 추가되었습니다: ${newEquation.getDisplayString()}`, 'info');
        this.logMessage(`새로운 가능한 정답: ${this.gameState.possibleAnswers.join(', ')}`, 'info');
    }
    
    // 새 정답 브로드캐스트
    broadcastNewTarget() {
        const targetData = {
            targetCards: this.gameState.targetCards.map(card => ({
                id: card.id,
                value: card.value,
                type: card.type
            })),
            possibleAnswers: this.gameState.possibleAnswers,
            playerName: this.p2pManager.playerName
        };
        
        // BroadcastChannel을 통한 안정적인 전송
        this.p2pManager.broadcastMessage('new_target_update', targetData);
        
        // 추가 안정성을 위해 잠시 후 재전송
        setTimeout(() => {
            this.p2pManager.broadcastMessage('new_target_update', targetData);
        }, 500);
    }
    
    // 새 정답 업데이트 수신 처리
    handleNewTargetUpdate(data) {
        // 중복 처리 방지: 이미 동일한 정답 카드가 있는지 확인
        const currentTargetIds = this.gameState.targetCards.map(card => card.id).sort();
        const newTargetIds = data.targetCards.map(card => card.id).sort();
        
        if (JSON.stringify(currentTargetIds) === JSON.stringify(newTargetIds) && 
            JSON.stringify(this.gameState.possibleAnswers) === JSON.stringify(data.possibleAnswers)) {
            return;
        }
        
        // 정답 카드 업데이트 (모든 플레이어에게 적용)
        this.gameState.targetCards = data.targetCards.map(cardData => {
            const card = new Card(cardData.type, cardData.value);
            card.id = cardData.id;
            return card;
        });
        
        // 가능한 정답 업데이트
        this.gameState.possibleAnswers = data.possibleAnswers;
        
        // UI 업데이트
        this.updateUI();
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
        console.log('=== findEquationsWithCards 호출 ===');
        console.log('검색할 카드 수:', cards.length);
        console.log('검색할 카드들:', cards.map(card => ({id: card.id, value: card.value, type: card.type})));
        console.log('현재 필드 등식 수:', this.gameState.fieldEquations.length);
        
        const affectedEquations = this.gameState.fieldEquations.filter(equation => {
            const hasMatchingCard = equation.getAllCards().some(eqCard => 
                cards.some(usedCard => usedCard.id === eqCard.id)
            );
            console.log(`등식 ${equation.id} 매칭 카드 있음?`, hasMatchingCard);
            return hasMatchingCard;
        });
        
        console.log('영향받는 등식 수:', affectedEquations.length);
        console.log('영향받는 등식들:', affectedEquations.map(eq => ({id: eq.id, display: eq.getDisplayString()})));
        console.log('=== findEquationsWithCards 완료 ===');
        
        return affectedEquations;
    }

    handleBrokenEquations(brokenEquations, currentPlayer) {
        console.log('=== 깨진 등식 처리 시작 ===');
        console.log('깨진 등식 수:', brokenEquations.length);
        
        brokenEquations.forEach(equation => {
            console.log('깨진 등식 처리:', equation.id, equation.getDisplayString());
            
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
        
        console.log('깨진 등식 제거 후 필드 등식 수:', this.gameState.fieldEquations.length);
        
        // UI 즉시 업데이트 (로컬에서 먼저 반영)
        console.log('로컬 UI 업데이트 시작');
        this.updateFieldEquations();
        
        // 멀티플레이어에서 필드 등식 동기화 (깨진 등식 제거 후)
        if (this.isMultiplayer) {
            console.log('깨진 등식 제거 후 필드 등식 동기화 전송');
            this.broadcastFieldEquations();
        }
        
        console.log('=== 깨진 등식 처리 완료 ===');
    }

    drawCard(cardType) {
        const currentPlayer = this.gameState.getCurrentPlayer();
        if (!currentPlayer) {
            this.logMessage('유효하지 않은 플레이어입니다.', 'error');
            return;
        }

        console.log(`카드 뽑기 시도: ${cardType}, 현재 플레이어: ${currentPlayer.name}`);
        
        // 멀티플레이어 모드에서 게스트는 호스트에게 요청만 보냄
        if (this.isMultiplayer && !this.p2pManager.isHost) {
            // 이미 카드 뽑기 요청 중인 경우 중복 요청 방지
            if (this.isDrawingCard) {
                console.log('이미 카드 뽑기 요청 중입니다. 중복 요청을 방지합니다.');
                return;
            }
            
            this.isDrawingCard = true;
            console.log('게스트가 호스트에게 카드 뽑기 요청 전송');
            this.p2pManager.sendToPlayer(this.p2pManager.getPlayerList()[0].name, 'card_draw_request', {
                requestingPlayer: currentPlayer.name,
                cardType: cardType
            });
            return;
        }

        console.log('현재 남은 덱 크기:', this.gameState.remainingDeck ? this.gameState.remainingDeck.length : 'undefined');
        console.log('남은 덱 존재 여부:', !!this.gameState.remainingDeck);

        // 남은 덱이 없는 경우
        if (!this.gameState.remainingDeck || this.gameState.remainingDeck.length === 0) {
            this.logMessage('남은 카드가 없습니다. 게임 상태를 확인해주세요.', 'error');
            console.error('남은 덱이 비어있거나 존재하지 않음');
            return;
        }

        // 요청된 타입의 카드 찾기
        let availableCards = [];
        if (cardType === 'number') {
            availableCards = this.gameState.remainingDeck.filter(card => card.type === 'number');
        } else if (cardType === 'operator') {
            availableCards = this.gameState.remainingDeck.filter(card => card.type === 'operator' || card.type === 'joker');
        }

        console.log(`사용 가능한 ${cardType} 카드 수:`, availableCards.length);

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
        
        // 멀티플레이어인 경우 카드 뽑기 동기화
        if (this.isMultiplayer) {
            this.broadcastCardDraw(drawnCard, currentPlayer);
        }
        
        // UI 업데이트 (손패만 업데이트)
        this.updatePlayerHand();
        
        // 턴 초기화 후 턴 종료
        this.resetTurn();
        
        // 백업 초기화 후 턴 종료
        this.clearBackups();
        
        // 턴 상태 초기화
        this.hasSubmittedAnswer = false;
        
        this.passTurn();
    }

    broadcastCardDraw(drawnCard, currentPlayer) {
        console.log('카드 뽑기 동기화:', drawnCard, '플레이어:', currentPlayer.name);
        
        // 모든 플레이어에게 카드 뽑기 정보 전송 (자신 포함)
        this.p2pManager.broadcastMessage('card_draw', {
            playerName: currentPlayer.name,
            drawnCard: {
                id: drawnCard.id,
                value: drawnCard.value,
                type: drawnCard.type
            },
            remainingDeck: this.gameState.remainingDeck.map(card => ({
                id: card.id,
                value: card.value,
                type: card.type
            }))
        });
    }

    handleCardDraw(data) {
        console.log('=== handleCardDraw 호출됨 ===');
        console.log('수신된 데이터:', data);
        console.log('isMultiplayer:', this.isMultiplayer);
        console.log('isHost:', this.p2pManager ? this.p2pManager.isHost : 'N/A');
        console.log('내 이름:', this.p2pManager ? this.p2pManager.playerName : 'N/A');
        
        // 남은 패 업데이트 (모든 플레이어 공통)
        if (data.remainingDeck) {
            console.log('남은 덱 업데이트 전:', this.gameState.remainingDeck.length);
            this.gameState.remainingDeck = data.remainingDeck.map(cardData => {
                const card = new Card(cardData.type, cardData.value);
                card.id = cardData.id;
                return card;
            });
            console.log('남은 덱 업데이트 후:', this.gameState.remainingDeck.length);
        }
        
        // 카드를 뽑은 플레이어의 손패에 추가 (자신이 뽑은 경우가 아닌 경우에만)
        if (data.playerName !== this.p2pManager.playerName) {
            console.log('다른 플레이어가 카드를 뽑음, 손패에 추가');
            
            const targetPlayer = this.gameState.players.find(p => p.name === data.playerName);
            
            if (targetPlayer) {
                const drawnCard = new Card(data.drawnCard.type, data.drawnCard.value);
                drawnCard.id = data.drawnCard.id;
                
                // 중복 카드 추가 방지: 같은 ID의 카드가 이미 있는지 확인
                let isDuplicate = false;
                if (drawnCard.type === 'number') {
                    isDuplicate = targetPlayer.numberCards.some(card => card.id === drawnCard.id);
                    if (!isDuplicate) {
                        targetPlayer.numberCards.push(drawnCard);
                        console.log('숫자 카드 추가됨:', drawnCard);
                    } else {
                        console.log('중복 숫자 카드, 추가하지 않음:', drawnCard);
                    }
                } else {
                    isDuplicate = targetPlayer.operatorCards.some(card => card.id === drawnCard.id);
                    if (!isDuplicate) {
                        targetPlayer.operatorCards.push(drawnCard);
                        console.log('연산자 카드 추가됨:', drawnCard);
                    } else {
                        console.log('중복 연산자 카드, 추가하지 않음:', drawnCard);
                    }
                }
            } else {
                console.error('타겟 플레이어를 찾을 수 없음:', data.playerName);
            }
        } else {
            console.log('자신이 뽑은 카드이므로 handleCardDraw에서 추가하지 않음');
        }
        
        // 플레이어 손패 상태 확인
        console.log('=== 플레이어 손패 상태 확인 ===');
        this.gameState.players.forEach(player => {
            console.log(`${player.name}: 숫자 ${player.numberCards.length}장, 연산자 ${player.operatorCards.length}장`);
        });
        
        // 로그 메시지 표시
        const cardTypeName = data.drawnCard.type === 'number' ? '숫자' : 
                            data.drawnCard.type === 'joker' ? '조커' : '연산자';
        this.logMessage(`${data.playerName}이(가) ${cardTypeName} 카드를 뽑았습니다.`, 'info');
        
        // UI 업데이트 (손패만 업데이트)
        this.updatePlayerHand();
    }

    handleCardDrawRequest(data) {
        // 요청한 플레이어 찾기 (gameState.players에서)
        const requestingPlayer = this.gameState.players.find(p => p.name === data.requestingPlayer);
        if (!requestingPlayer) {
            return;
        }
        let availableCards = [];
        if (data.cardType === 'number') {
            availableCards = this.gameState.remainingDeck.filter(card => card.type === 'number');
        } else if (data.cardType === 'operator') {
            availableCards = this.gameState.remainingDeck.filter(card => card.type === 'operator' || card.type === 'joker');
        }
        
        if (availableCards.length === 0) {
            // 게스트에게 카드 부족 메시지 전송
            this.p2pManager.sendToPlayer(data.requestingPlayer, 'card_draw_response', {
                success: false,
                message: `더 이상 뽑을 ${data.cardType === 'number' ? '숫자' : '연산자'} 카드가 없습니다.`
            });
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
        
        // 요청한 플레이어에게 카드 추가
        if (drawnCard.type === 'number') {
            requestingPlayer.numberCards.push(drawnCard);
        } else {
            requestingPlayer.operatorCards.push(drawnCard);
        }
        
        // 게스트에게 성공 응답 전송
        this.p2pManager.sendToPlayer(data.requestingPlayer, 'card_draw_response', {
            success: true,
            drawnCard: {
                id: drawnCard.id,
                value: drawnCard.value,
                type: drawnCard.type
            },
            remainingDeck: this.gameState.remainingDeck.map(card => ({
                id: card.id,
                value: card.value,
                type: card.type
            }))
        });
        
        // 게스트 카드 뽑기는 broadcastCardDraw를 호출하지 않음 (중복 처리 방지)
        // 대신 직접 다른 플레이어들에게만 알림
        const otherPlayers = this.p2pManager.getPlayerList().filter(p => p.name !== data.requestingPlayer);
        otherPlayers.forEach(player => {
            this.p2pManager.sendToPlayer(player.name, 'card_draw', {
                playerName: data.requestingPlayer,
                drawnCard: {
                    id: drawnCard.id,
                    value: drawnCard.value,
                    type: drawnCard.type
                },
                remainingDeck: this.gameState.remainingDeck.map(card => ({
                    id: card.id,
                    value: card.value,
                    type: card.type
                }))
            });
        });
        
    }

    handleCardDrawResponse(data) {
        console.log('=== 호스트 카드 뽑기 응답 처리 시작 ===');
        console.log('응답 데이터:', data);
        
        if (!data.success) {
            console.log('카드 뽑기 실패:', data.message);
            this.logMessage(data.message, 'error');
            // 카드 뽑기 상태 리셋
            this.isDrawingCard = false;
            return;
        }
        
        // 내 플레이어 찾기
        const myPlayer = this.gameState.players[0];
        if (!myPlayer) {
            console.error('내 플레이어를 찾을 수 없음');
            return;
        }
        
        // 뽑은 카드를 내 플레이어에게 추가 (중복 방지)
        const drawnCard = new Card(data.drawnCard.type, data.drawnCard.value);
        drawnCard.id = data.drawnCard.id; // ID는 별도로 설정
        console.log('게스트가 받은 카드 정보:', {
            value: drawnCard.value,
            type: drawnCard.type,
            id: drawnCard.id,
            originalData: data.drawnCard
        });
        
        // 중복 카드 추가 방지
        let isDuplicate = false;
        if (drawnCard.type === 'number') {
            isDuplicate = myPlayer.numberCards.some(card => card.id === drawnCard.id);
            if (!isDuplicate) {
                myPlayer.numberCards.push(drawnCard);
                console.log('숫자 카드 추가됨:', drawnCard.value);
            } else {
                console.log('숫자 카드 중복 발견, 추가하지 않음:', drawnCard.value);
            }
        } else {
            isDuplicate = myPlayer.operatorCards.some(card => card.id === drawnCard.id);
            if (!isDuplicate) {
                myPlayer.operatorCards.push(drawnCard);
                console.log('연산자 카드 추가됨:', drawnCard.value);
            } else {
                console.log('연산자 카드 중복 발견, 추가하지 않음:', drawnCard.value);
            }
        }
        
        // 남은 패 업데이트
        if (data.remainingDeck) {
            this.gameState.remainingDeck = data.remainingDeck.map(cardData => {
                const card = new Card(cardData.type, cardData.value);
                card.id = cardData.id;
                return card;
            });
            console.log('남은 패 업데이트:', this.gameState.remainingDeck.length, '장');
        }
        
        const cardTypeName = drawnCard.type === 'number' ? '숫자' : 
                            drawnCard.type === 'joker' ? '조커' : '연산자';
        this.logMessage(`${myPlayer.name}이(가) ${cardTypeName} 카드를 뽑았습니다.`, 'info');
        
        // UI 업데이트 (손패만 업데이트)
        this.updatePlayerHand();
        
        // 카드 뽑기 상태 리셋
        this.isDrawingCard = false;
        
        // 턴 초기화 후 턴 종료
        this.resetTurn();
        
        // 백업 초기화 후 턴 종료
        this.clearBackups();
        
        // 턴 상태 초기화
        this.hasSubmittedAnswer = false;
        
        this.passTurn();
        
        console.log('=== 호스트 카드 뽑기 응답 처리 완료 ===');
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
        console.log('=== passTurn 호출됨 ===');
        console.log('현재 플레이어:', this.gameState.currentPlayer);
        console.log('hasSubmittedAnswer:', this.hasSubmittedAnswer);
        
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
        
        // 멀티플레이어에서 턴 변경을 모든 플레이어에게 동기화
        if (this.isMultiplayer) {
            const turnChangeData = {
                currentPlayer: this.gameState.currentPlayer,
                cycleCompleted: cycleCompleted,
                cycleAnswerFound: this.gameState.cycleAnswerFound,
                timestamp: Date.now()
            };
            
            this.p2pManager.broadcastMessage('turn_change', turnChangeData);
        }
        
        // 사이클이 완료된 경우 처리
        if (cycleCompleted) {
            this.handleCycleCompletion();
        }
        
        this.updateUI();
        
        const newPlayer = this.gameState.getCurrentPlayer();
        this.logMessage(`${newPlayer.name}의 턴입니다.`, 'info');
    }

    // 수식 영역에서 카드 위치 변경
    moveCardInExpression(cardId, newPosition) {
        const card = this.expressionArea.removeCard(cardId);
        if (card) {
            this.expressionArea.addCard(card, newPosition);
            
            // 멀티플레이어에서 실시간 동기화
            if (this.isMultiplayer) {
                this.broadcastExpressionState();
            }
            
            this.updateUI();
        }
    }

    // 수식 영역 전체 상태 브로드캐스트
    broadcastExpressionState() {
        if (this.isMultiplayer) {
            const expressionData = this.expressionArea.cards.map(card => ({
                id: card.id,
                value: card.value,
                type: card.type,
                temporaryOperator: card.temporaryOperator
            }));
            
            this.p2pManager.broadcastMessage('expression_state', {
                cards: expressionData,
                playerName: this.p2pManager.playerName
            });
        }
    }

    broadcastCardMove(targetType, cardId, source, position = null, equationId = null, handType = null) {
        console.log('카드 이동 브로드캐스트:', { targetType, cardId, source, position, equationId, handType });
        
        this.p2pManager.broadcastMessage('card_move', {
            targetType: targetType,
            cardId: cardId,
            source: source,
            position: position,
            equationId: equationId,
            handType: handType,
            playerName: this.p2pManager.playerName
        });
    }

    handleCardMove(data) {
        console.log('카드 이동 수신:', data);
        
        // 자신의 카드 이동이 아닌 경우에만 처리
        if (data.playerName !== this.p2pManager.playerName) {
            const card = this.findCardById(data.cardId);
            if (card) {
                // 카드를 원래 위치에서 제거
                this.findAndRemoveCard(data.cardId, data.source);
                
                // 새 위치에 추가
                if (data.targetType === 'expression') {
                    this.expressionArea.addCard(card, data.position);
                } else if (data.targetType === 'equation') {
                    const equation = this.gameState.fieldEquations.find(eq => eq.id === data.equationId);
                    if (equation) {
                        if (data.position !== null && data.position >= 0 && data.position <= equation.cards.length) {
                            equation.insertCard(card, data.position);
                        } else {
                            equation.cards.push(card);
                        }
                    }
                } else if (data.targetType === 'hand') {
                    // 손패로 이동하는 경우
                    const currentPlayer = this.gameState.getCurrentPlayer();
                    if (currentPlayer && data.handType) {
                        if (data.handType === 'number' && card.type === 'number') {
                            currentPlayer.numberCards.push(card);
                        } else if (data.handType === 'operator' && (card.type === 'operator' || card.type === 'joker')) {
                            currentPlayer.operatorCards.push(card);
                        }
                    }
                } else if (data.targetType === 'expression_reorder') {
                    // 수식 영역에서 카드 위치 변경
                    this.expressionArea.removeCard(data.cardId);
                    this.expressionArea.addCard(card, data.position);
                }
                
                // UI 업데이트 (자신의 턴이 아닐 때는 수식 영역만 업데이트)
                this.updateExpressionArea();
                this.updateExpressionResult();
            }
        }
    }

    handleExpressionState(data) {
        console.log('수식 영역 상태 수신:', data);
        
        // 자신의 수식 상태가 아닌 경우에만 처리
        if (data.playerName !== this.p2pManager.playerName) {
            // 수식 영역 초기화
            this.expressionArea.cards = [];
            
            // 수신된 카드들을 수식 영역에 추가
            data.cards.forEach(cardData => {
                const card = new Card(cardData.type, cardData.value);
                card.id = cardData.id;
                if (cardData.temporaryOperator) {
                    card.setTemporaryOperator(cardData.temporaryOperator);
                }
                this.expressionArea.cards.push(card);
            });
            
            console.log('수식 영역 상태 동기화 완료:', this.expressionArea.cards.length, '장');
            
            // UI 업데이트
            this.updateExpressionArea();
            this.updateExpressionResult();
        }
    }

    // 새로운 사이클 및 정답 카드 처리 시스템
    handleCycleCompletion() {
        if (!this.gameState.cycleCompleted) {
            return; // 사이클이 완료되지 않았으면 아무것도 하지 않음
        }
        
        console.log('=== 사이클 완료 처리 시작 ===');
        console.log('사이클에서 정답 발견 여부:', this.gameState.cycleAnswerFound);
        console.log('isMultiplayer:', this.isMultiplayer);
        console.log('isHost:', this.p2pManager ? this.p2pManager.isHost : 'N/A');
        
        if (this.gameState.cycleAnswerFound) {
            // 정답이 발견된 경우: 새로운 사이클 시작
            console.log('정답이 발견되어 새로운 사이클 시작');
            this.startNewCycle();
        } else {
            // 정답이 발견되지 않은 경우: 정답 카드 추가
            console.log('정답이 발견되지 않아 정답 카드 추가');
            if (this.isMultiplayer && !this.p2pManager.isHost) {
                // 게스트: 호스트에게 정답카드 추가 요청
                console.log('게스트가 호스트에게 정답카드 추가 요청');
                this.requestAddTargetCard();
            } else {
                // 호스트 또는 솔로: 직접 정답카드 추가
                console.log('호스트/솔로에서 직접 정답카드 추가');
                this.addNewTargetCard();
            }
        }
        
        // UI 업데이트
        this.updateUI();
    }
    
    addNewTargetCard() {
        console.log('=== 새로운 정답 카드 추가 ===');
        
        // 새로운 정답 카드 추가
        const beforeCount = this.gameState.targetCards.length;
        this.gameState.addTargetCard();
        const afterCount = this.gameState.targetCards.length;
        
        if (afterCount > beforeCount) {
            const newCard = this.gameState.targetCards[afterCount - 1];
            console.log('새로 추가된 정답 카드:', newCard);
            
            // 새로운 정답 생성
            this.gameState.generateTargetAnswers();
            console.log('새로운 가능한 정답들:', this.gameState.possibleAnswers);
            
            // 멀티플레이어에서 새 정답 동기화
            if (this.isMultiplayer) {
                this.broadcastNewTarget();
            }
            
            this.logMessage(`새로운 정답 카드가 추가되었습니다: ${newCard.value}`, 'success');
            this.logMessage(`새로운 가능한 정답: ${this.gameState.possibleAnswers.join(', ')}`, 'info');
        }
        
        // 새로운 사이클 시작
        this.startNewCycle();
    }
    
    startNewCycle() {
        console.log('=== 새로운 사이클 시작 ===');
        this.gameState.startNewCycle();
        
        // 멀티플레이어에서 사이클 시작 동기화
        if (this.isMultiplayer) {
            this.p2pManager.broadcastMessage('cycle_start', {
                cycleStartPlayer: this.gameState.cycleStartPlayer,
                timestamp: Date.now()
            });
        }
        
        this.logMessage(`새로운 사이클이 시작되었습니다. 시작 플레이어: ${this.gameState.getCurrentPlayer().name}`, 'info');
    }
    
    // 게스트에서 호스트에게 정답카드 추가 요청
    requestAddTargetCard() {
        const hostPlayer = this.p2pManager.getPlayerList().find(p => p.isHost);
        if (hostPlayer) {
            console.log('호스트에게 정답카드 추가 요청 전송:', hostPlayer.name);
            this.p2pManager.sendToPlayer(hostPlayer.name, 'add_target_card_request', {
                requestingPlayer: this.p2pManager.playerName,
                timestamp: Date.now()
            });
        } else {
            console.error('호스트를 찾을 수 없습니다.');
        }
    }
    
    handleCycleStart(data) {
        console.log('=== 사이클 시작 메시지 수신 ===');
        this.gameState.cycleStartPlayer = data.cycleStartPlayer;
        this.gameState.cycleCompleted = false;
        this.gameState.cycleAnswerFound = false;
        
        this.logMessage(`새로운 사이클이 시작되었습니다. 시작 플레이어: ${this.gameState.getCurrentPlayer().name}`, 'info');
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
        
        if (this.isMultiplayer) {
            // 멀티플레이어 게임의 경우 로비로 돌아가기
            this.leaveRoom();
        } else {
            // 싱글플레이어 게임의 경우 설정 모달 표시
        this.showSettingsModal();
        }
    }

    updateSubmitButton() {
        const submitBtn = document.getElementById('submit-expression');
        if (!submitBtn) return; // 요소가 없으면 종료
        
        // 멀티플레이어에서 자신의 턴인지 확인
        let isMyTurn = true;
        if (this.isMultiplayer) {
            const players = this.p2pManager.getPlayerList();
            const myIndex = players.findIndex(p => p.name === this.p2pManager.playerName);
            isMyTurn = this.gameState.currentPlayer === myIndex;
        }
        
        if (!isMyTurn) {
            // 내 턴이 아닌 경우: 버튼 비활성화
            submitBtn.textContent = '다른 플레이어의 턴';
            submitBtn.disabled = true;
            submitBtn.className = 'action-btn submit-btn disabled';
            submitBtn.onclick = null;
            return;
        }
        
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
        if (this.gameState.cycleAnswerFound) {
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

