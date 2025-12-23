// Конфигурация
const CRYPTOBOT_API_URL = 'https://pay.crypt.bot/api';
const CRYPTOBOT_TOKEN = '369197:AAC06ytgeDacntgpQNfOs3b7LomyOknLG3N'; // Замените на ваш токен

// Состояние игры
let balance = 1000;
let gameHistory = [];

// Элементы DOM
const balanceEl = document.getElementById('balance');
const gameCards = document.querySelectorAll('.game-card');
const games = document.querySelectorAll('.game');
const notification = document.getElementById('notification');

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    updateBalance();
    loadGameHistory();
    setupEventListeners();
    showNotification('Добро пожаловать в Crypto Casino!', 'success');
});

// Настройка обработчиков событий
function setupEventListeners() {
    // Переключение игр
    gameCards.forEach(card => {
        card.addEventListener('click', () => {
            const game = card.dataset.game;
            switchGame(game);
        });
    });

    // Слот-машина
    const spinBtn = document.getElementById('spinBtn');
    const slotsBetInput = document.getElementById('slotsBet');
    const betBtns = document.querySelectorAll('.bet-btn');
    
    spinBtn.addEventListener('click', playSlots);
    
    betBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const change = parseInt(e.target.dataset.change);
            const currentBet = parseInt(slotsBetInput.value);
            const newBet = Math.max(10, Math.min(1000, currentBet + change));
            slotsBetInput.value = newBet;
        });
    });

    // Кости
    const rollDiceBtn = document.getElementById('rollDiceBtn');
    const choiceBtns = document.querySelectorAll('.choice-btn');
    
    rollDiceBtn.addEventListener('click', rollDice);
    
    choiceBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            choiceBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Рулетка
    const spinRouletteBtn = document.getElementById('spinRouletteBtn');
    spinRouletteBtn.addEventListener('click', spinRoulette);

    // Платежи
    const depositBtn = document.getElementById('depositBtn');
    depositBtn.addEventListener('click', createInvoice);
}

// Переключение между играми
function switchGame(gameId) {
    games.forEach(game => {
        game.classList.remove('active');
        if (game.id === `${gameId}-game`) {
            game.classList.add('active');
        }
    });
    
    gameCards.forEach(card => {
        card.style.borderColor = card.dataset.game === gameId ? '#ffd700' : 'transparent';
    });
}

// Слот-машина
async function playSlots() {
    const bet = parseInt(document.getElementById('slotsBet').value);
    
    if (bet > balance) {
        showNotification('Недостаточно средств!', 'error');
        return;
    }
    
    if (bet < 10) {
        showNotification('Минимальная ставка: 10 ₿', 'error');
        return;
    }
    
    // Спин анимация
    const reels = document.querySelectorAll('.slot-reel');
    const spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = true;
    
    reels.forEach(reel => reel.classList.add('spinning'));
    
    // Вычитаем ставку
    balance -= bet;
    updateBalance();
    
    // Имитация вращения
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    reels.forEach(reel => reel.classList.remove('spinning'));
    
    // Генерация результатов
    const symbols = ['🍒', '🍋', '🍊', '7️⃣', '💎', '⭐'];
    const results = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
    ];
    
    // Отображение результатов
    reels.forEach((reel, index) => {
        reel.textContent = results[index];
    });
    
    // Проверка выигрыша
    let winMultiplier = 0;
    const resultEl = document.getElementById('slotsResult');
    
    if (results[0] === results[1] && results[1] === results[2]) {
        if (results[0] === '7️⃣') {
            winMultiplier = 10;
            resultEl.innerHTML = `<span style="color: #ffd700">🎉 ДЖЕКПОТ! 7-7-7! Выигрыш: ${bet * winMultiplier} ₿</span>`;
        } else {
            winMultiplier = 5;
            resultEl.innerHTML = `<span style="color: #00ff00">🎊 Три в ряд! Выигрыш: ${bet * winMultiplier} ₿</span>`;
        }
    } else if (results[0] === results[1] || results[1] === results[2]) {
        winMultiplier = 2;
        resultEl.innerHTML = `<span style="color: #00ff00">🎊 Два в ряд! Выигрыш: ${bet * winMultiplier} ₿</span>`;
    } else {
        resultEl.innerHTML = `<span style="color: #ff4444">😔 Повезёт в следующий раз!</span>`;
    }
    
    if (winMultiplier > 0) {
        const winAmount = bet * winMultiplier;
        balance += winAmount;
        updateBalance();
        showNotification(`Вы выиграли ${winAmount} ₿!`, 'success');
        addToHistory('Слоты', bet, winAmount);
    } else {
        addToHistory('Слоты', bet, 0);
    }
    
    spinBtn.disabled = false;
}

// Игра в кости
async function rollDice() {
    const bet = parseInt(document.getElementById('diceBet').value);
    const selectedChoice = document.querySelector('.choice-btn.active');
    
    if (!selectedChoice) {
        showNotification('Выберите тип ставки!', 'error');
        return;
    }
    
    if (bet > balance) {
        showNotification('Недостаточно средств!', 'error');
        return;
    }
    
    if (bet < 10) {
        showNotification('Минимальная ставка: 10 ₿', 'error');
        return;
    }
    
    // Вычитаем ставку
    balance -= bet;
    updateBalance();
    
    // Анимация броска
    const dice1 = document.getElementById('dice1');
    const dice2 = document.getElementById('dice2');
    const rollBtn = document.getElementById('rollDiceBtn');
    rollBtn.disabled = true;
    
    // Имитация броска
    for (let i = 0; i < 10; i++) {
        dice1.textContent = getDiceFace(Math.floor(Math.random() * 6) + 1);
        dice2.textContent = getDiceFace(Math.floor(Math.random() * 6) + 1);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Финальные результаты
    const dice1Value = Math.floor(Math.random() * 6) + 1;
    const dice2Value = Math.floor(Math.random() * 6) + 1;
    const total = dice1Value + dice2Value;
    
    dice1.textContent = getDiceFace(dice1Value);
    dice2.textContent = getDiceFace(dice2Value);
    
    // Проверка выигрыша
    const choice = selectedChoice.dataset.choice;
    let win = false;
    
    switch (choice) {
        case 'even':
            win = total % 2 === 0;
            break;
        case 'odd':
            win = total % 2 === 1;
            break;
        case 'high':
            win = total >= 7;
            break;
        case 'low':
            win = total <= 7;
            break;
    }
    
    const resultEl = document.getElementById('diceResult');
    
    if (win) {
        const winAmount = bet * 2;
        balance += winAmount;
        updateBalance();
        resultEl.innerHTML = `<span style="color: #00ff00">🎊 Выигрыш! Сумма: ${total}. Вы выиграли ${winAmount} ₿!</span>`;
        showNotification(`Вы выиграли ${winAmount} ₿!`, 'success');
        addToHistory('Кости', bet, winAmount);
    } else {
        resultEl.innerHTML = `<span style="color: #ff4444">😔 Проигрыш! Сумма: ${total}. Попробуйте ещё раз!</span>`;
        addToHistory('Кости', bet, 0);
    }
    
    rollBtn.disabled = false;
}

function getDiceFace(value) {
    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return faces[value - 1];
}

// Рулетка
async function spinRoulette() {
    const bet = parseInt(document.getElementById('rouletteBet').value);
    const numberBet = document.getElementById('numberBet').value;
    const colorBet = document.querySelector('.color-btn.active');
    
    if (!numberBet && !colorBet) {
        showNotification('Сделайте ставку на число или цвет!', 'error');
        return;
    }
    
    if (bet > balance) {
        showNotification('Недостаточно средств!', 'error');
        return;
    }
    
    // Вычитаем ставку
    balance -= bet;
    updateBalance();
    
    // Анимация вращения
    const wheel = document.getElementById('rouletteWheel');
    const spinBtn = document.getElementById('spinRouletteBtn');
    spinBtn.disabled = true;
    
    wheel.style.animation = 'spin 0.1s linear infinite';
    
    // Имитация вращения
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    wheel.style.animation = 'none';
    
    // Генерация результата
    const result = Math.floor(Math.random() * 37); // 0-36
    const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(result);
    const isBlack = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35].includes(result);
    const isGreen = result === 0;
    
    // Отображение результата
    const wheelCenter = document.querySelector('.wheel-center');
    wheelCenter.textContent = result;
    wheelCenter.style.color = isRed ? '#ff4444' : isBlack ? '#000' : '#00ff00';
    wheelCenter.style.backgroundColor = isRed ? '#ff4444' : isBlack ? '#000' : '#00ff00';
    
    // Проверка выигрыша
    const resultEl = document.getElementById('rouletteResult');
    let winMultiplier = 0;
    
    if (numberBet && parseInt(numberBet) === result) {
        winMultiplier = 36;
        resultEl.innerHTML = `<span style="color: #ffd700">🎉 ДЖЕКПОТ! Число ${result}! Выигрыш: ${bet * winMultiplier} ₿</span>`;
    } else if (colorBet) {
        const color = colorBet.dataset.color;
        if ((color === 'red' && isRed) || (color === 'black' && isBlack) || (color === 'green' && isGreen)) {
            winMultiplier = color === 'green' ? 14 : 2;
            resultEl.innerHTML = `<span style="color: #00ff00">🎊 Цвет ${color === 'red' ? 'красный' : color === 'black' ? 'чёрный' : 'зелёный'}! Выигрыш: ${bet * winMultiplier} ₿</span>`;
        }
    }
    
    if (winMultiplier > 0) {
        const winAmount = bet * winMultiplier;
        balance += winAmount;
        updateBalance();
        showNotification(`Вы выиграли ${winAmount} ₿!`, 'success');
        addToHistory('Рулетка', bet, winAmount);
    } else {
        resultEl.innerHTML = resultEl.innerHTML || `<span style="color: #ff4444">😔 Выпало ${result}. Попробуйте ещё раз!</span>`;
        addToHistory('Рулетка', bet, 0);
    }
    
    spinBtn.disabled = false;
}

// Работа с балансом
function updateBalance() {
    balanceEl.textContent = balance;
    localStorage.setItem('casinoBalance', balance);
}

function loadBalance() {
    const saved = localStorage.getItem('casinoBalance');
    if (saved) balance = parseInt(saved);
    updateBalance();
}

// История игр
function addToHistory(game, bet, win) {
    const time = new Date().toLocaleTimeString();
    const item = {
        game,
        bet,
        win,
        time,
        profit: win - bet
    };
    
    gameHistory.unshift(item);
    if (gameHistory.length > 10) gameHistory.pop();
    
    saveHistory();
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const container = document.getElementById('gameHistory');
    container.innerHTML = gameHistory.map(item => `
        <div class="history-item">
            <strong>${item.game}</strong> | Ставка: ${item.bet} ₿ | 
            Выигрыш: <span style="color: ${item.win > 0 ? '#00ff00' : '#ff4444'}">${item.win} ₿</span> |
            Время: ${item.time}
        </div>
    `).join('');
}

function saveHistory() {
    localStorage.setItem('casinoHistory', JSON.stringify(gameHistory));
}

function loadGameHistory() {
    const saved = localStorage.getItem('casinoHistory');
    if (saved) {
        gameHistory = JSON.parse(saved);
        updateHistoryDisplay();
    }
}

// Платежи через CryptoBot
async function createInvoice() {
    const amount = parseInt(document.getElementById('depositAmount').value);
    
    if (amount < 100) {
        showNotification('Минимальный депозит: 100 ₿', 'error');
        return;
    }
    
    try {
        showNotification('Создание инвойса...', 'info');
        
        // В реальном приложении используйте серверный endpoint
        const invoice = await createInvoiceAPI(amount);
        
        if (invoice.ok) {
            const paymentInfo = document.getElementById('paymentInfo');
            paymentInfo.innerHTML = `
                <h4>Инвойс создан!</h4>
                <p>Сумма: ${amount} ₿</p>
                <p>Ссылка для оплаты: <a href="${invoice.result.pay_url}" target="_blank">${invoice.result.pay_url}</a></p>
                <p>ID инвойса: ${invoice.result.invoice_id}</p>
                <p><small>После оплаты баланс пополнится автоматически</small></p>
            `;
            paymentInfo.style.display = 'block';
            
            // В реальном приложении здесь должен быть polling для проверки статуса
            // или использование вебхуков
            
            showNotification('Инвойс создан! Перейдите по ссылке для оплаты.', 'success');
        } else {
            showNotification('Ошибка при создании инвойса', 'error');
        }
    } catch (error) {
        console.error('Error creating invoice:', error);
        showNotification('Ошибка соединения с платежной системой', 'error');
    }
}

// Имитация API вызова (замените на реальный)
async function createInvoiceAPI(amount) {
    // В реальном приложении здесь должен быть fetch к вашему серверному endpoint
    // который будет вызывать CryptoBot API
    
    // Пример реального запроса (не работает без серверной части):
    /*
    const response = await fetch('/api/create-invoice', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            amount: amount,
            currency: 'USD', // или другая валюта
            userId: document.getElementById('userId').textContent
        })
    });
    
    return await response.json();
    */
    
    // Заглушка для демо
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                ok: true,
                result: {
                    invoice_id: Math.floor(Math.random() * 1000000),
                    pay_url: `https://t.me/CryptoBot?start=invoice_${Date.now()}`,
                    amount: amount,
                    status: 'active'
                }
            });
        }, 1000);
    });
}

// Уведомления
function showNotification(message, type = 'info') {
    const colors = {
        success: '#00ff00',
        error: '#ff4444',
        info: '#ffd700',
        warning: '#ff8c00'
    };
    
    notification.textContent = message;
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Добавьте эти обработчики для рулетки
document.addEventListener('DOMContentLoaded', () => {
    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            colorBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('numberBet').value = '';
        });
    });
    
    const numberBet = document.getElementById('numberBet');
    numberBet.addEventListener('input', () => {
        const value = parseInt(numberBet.value);
        if (value < 0) numberBet.value = 0;
        if (value > 36) numberBet.value = 36;
        
        if (numberBet.value !== '') {
            colorBtns.forEach(b => b.classList.remove('active'));
        }
    });
});