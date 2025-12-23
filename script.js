// Конфигурация
const API_BASE_URL = window.location.origin;
let userData = null;
let currentGame = 'slots';

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    setupEventListeners();
    loadGames();
    
    // Проверка Telegram Web App
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        initTelegramWebApp();
    }
    
    // Скрыть прелоадер
    setTimeout(() => {
        document.getElementById('preloader').style.display = 'none';
    }, 1000);
});

// Инициализация приложения
async function initApp() {
    const token = localStorage.getItem('casino_token');
    
    if (token) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                userData = await response.json();
                updateUserInfo();
                loadUserData();
            } else {
                localStorage.removeItem('casino_token');
            }
        } catch (error) {
            console.error('Auth error:', error);
        }
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Навигация
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            switchPage(page);
        });
    });
    
    // Быстрые действия
    document.getElementById('quickDeposit').addEventListener('click', () => showDepositModal());
    document.getElementById('quickWithdraw').addEventListener('click', () => switchPage('wallet'));
    document.getElementById('quickSlots').addEventListener('click', () => {
        switchPage('games');
        setTimeout(() => switchGame('slots'), 100);
    });
    document.getElementById('quickDice').addEventListener('click', () => {
        switchPage('games');
        setTimeout(() => switchGame('dice'), 100);
    });
    
    // Подключение Telegram
    document.getElementById('connectTelegram').addEventListener('click', () => {
        showTelegramModal();
    });
    
    // Обновление баланса
    document.getElementById('refreshBalance').addEventListener('click', loadUserData);
    
    // Фильтры игр
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            switchGame(filter);
        });
    });
    
    // Инициализация игр
    initSlotsGame();
    initDiceGame();
    initRouletteGame();
    initBlackjackGame();
    
    // Платежи
    document.getElementById('depositButton').addEventListener('click', processDeposit);
    document.getElementById('withdrawButton').addEventListener('click', processWithdrawal);
}

// Переключение страниц
function switchPage(page) {
    // Обновить навигацию
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // Обновить заголовок
    document.querySelector('.page-title').textContent = getPageTitle(page);
    
    // Показать нужную страницу
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page).classList.add('active');
}

function getPageTitle(page) {
    const titles = {
        'dashboard': 'Главная',
        'games': 'Игры',
        'wallet': 'Кошелёк',
        'history': 'История',
        'leaderboard': 'Топ игроков'
    };
    return titles[page] || 'Главная';
}

// Переключение игр
function switchGame(game) {
    if (game === 'all') game = 'slots';
    
    document.querySelectorAll('.game-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const gameSection = document.getElementById(`game-${game}`);
    if (gameSection) {
        gameSection.classList.add('active');
        currentGame = game;
    }
}

// Обновление информации о пользователе
function updateUserInfo() {
    if (!userData) return;
    
    document.getElementById('userName').textContent = userData.username || 'Гость';
    document.getElementById('userBalance').textContent = parseFloat(userData.balance || 0).toFixed(2);
    document.getElementById('balanceStat').textContent = `${parseFloat(userData.balance || 0).toFixed(2)} USDT`;
    document.getElementById('walletBalance').textContent = parseFloat(userData.balance || 0).toFixed(2);
}

// Загрузка данных пользователя
async function loadUserData() {
    try {
        const token = localStorage.getItem('casino_token');
        if (!token) return;
        
        const response = await fetch(`${API_BASE_URL}/api/balance`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            userData = { ...userData, ...data };
            updateUserInfo();
            
            // Загрузить последние игры
            loadRecentGames();
            // Загрузить транзакции
            loadTransactions();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// ИГРА: Слоты
function initSlotsGame() {
    const spinButton = document.getElementById('spinButton');
    const betOptions = document.querySelectorAll('.bet-option');
    const customBetInput = document.getElementById('customBet');
    
    let currentBet = 10;
    let isSpinning = false;
    
    // Выбор ставки
    betOptions.forEach(option => {
        option.addEventListener('click', () => {
            betOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            currentBet = parseInt(option.dataset.bet);
            updateBetInfo();
        });
    });
    
    // Кастомная ставка
    customBetInput.addEventListener('change', () => {
        const value = parseInt(customBetInput.value);
        if (value >= 1 && value <= 1000) {
            currentBet = value;
            betOptions.forEach(opt => opt.classList.remove('active'));
            updateBetInfo();
        }
    });
    
    // Кнопка вращения
    spinButton.addEventListener('click', async () => {
        if (isSpinning) return;
        
        // Проверка баланса
        if (userData && currentBet > userData.balance) {
            showNotification('Недостаточно средств!', 'error');
            return;
        }
        
        isSpinning = true;
        spinButton.disabled = true;
        
        // Анимация вращения
        const reels = document.querySelectorAll('.reel');
        reels.forEach(reel => reel.classList.add('spinning'));
        
        try {
            // Отправка запроса на сервер
            const response = await fetch(`${API_BASE_URL}/api/games/slots`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('casino_token')}`
                },
                body: JSON.stringify({
                    bet: currentBet
                })
            });
            
            const result = await response.json();
            
            // Остановка вращения через 2 секунды
            setTimeout(() => {
                reels.forEach((reel, index) => {
                    reel.classList.remove('spinning');
                    const symbol = result.symbols[index] || '🍒';
                    reel.querySelector('.symbol').textContent = symbol;
                });
                
                // Показать результат
                if (result.win > 0) {
                    showNotification(`🎉 Вы выиграли ${result.win} USDT!`, 'success');
                    userData.balance += result.win;
                    updateUserInfo();
                } else {
                    showNotification('😔 Попробуйте ещё раз!', 'info');
                }
                
                isSpinning = false;
                spinButton.disabled = false;
                
                // Обновить историю
                addGameToHistory('slots', currentBet, result.win, result.combination);
                
            }, 2000);
            
        } catch (error) {
            console.error('Slots error:', error);
            showNotification('Ошибка при игре в слоты', 'error');
            isSpinning = false;
            spinButton.disabled = false;
        }
    });
    
    function updateBetInfo() {
        document.getElementById('currentBet').textContent = `${currentBet} USDT`;
        document.getElementById('potentialWin').textContent = `${currentBet * 1000} USDT`;
    }
}

// ИГРА: Кости
function initDiceGame() {
    const rollButton = document.getElementById('rollDice');
    const betButtons = document.querySelectorAll('.dice-bet-btn');
    const amountInput = document.getElementById('diceBetAmount');
    const amountButtons = document.querySelectorAll('.amount-btn');
    
    let selectedBetType = null;
    let betAmount = 10;
    let exactNumber = null;
    
    // Выбор типа ставки
    betButtons.forEach(button => {
        button.addEventListener('click', () => {
            betButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedBetType = button.dataset.bet;
            
            // Сбросить точное число
            if (selectedBetType !== 'exact') {
                document.getElementById('exactNumber').value = '';
                exactNumber = null;
            }
        });
    });
    
    // Точное число
    document.getElementById('exactNumber').addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        if (value >= 2 && value <= 12) {
            exactNumber = value;
            selectedBetType = 'exact';
            betButtons.forEach(btn => btn.classList.remove('active'));
        }
    });
    
    // Изменение суммы ставки
    amountButtons.forEach(button => {
        button.addEventListener('click', () => {
            const change = parseInt(button.dataset.change);
            betAmount = Math.max(1, Math.min(1000, betAmount + change));
            amountInput.value = betAmount;
        });
    });
    
    amountInput.addEventListener('change', () => {
        betAmount = Math.max(1, Math.min(1000, parseInt(amountInput.value) || 10));
        amountInput.value = betAmount;
    });
    
    // Бросок костей
    rollButton.addEventListener('click', async () => {
        if (!selectedBetType) {
            showNotification('Выберите тип ставки!', 'error');
            return;
        }
        
        if (userData && betAmount > userData.balance) {
            showNotification('Недостаточно средств!', 'error');
            return;
        }
        
        // Анимация броска
        const dice1 = document.getElementById('dice1');
        const dice2 = document.getElementById('dice2');
        
        dice1.style.animation = 'shake 0.5s ease-in-out';
        dice2.style.animation = 'shake 0.5s ease-in-out';
        
        rollButton.disabled = true;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/games/dice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('casino_token')}`
                },
                body: JSON.stringify({
                    bet: betAmount,
                    betType: selectedBetType,
                    exactNumber: exactNumber
                })
            });
            
            const result = await response.json();
            
            setTimeout(() => {
                // Остановить анимацию
                dice1.style.animation = '';
                dice2.style.animation = '';
                
                // Показать результат
                dice1.querySelector('.dice-face').textContent = getDiceSymbol(result.dice1);
                dice2.querySelector('.dice-face').textContent = getDiceSymbol(result.dice2);
                document.getElementById('diceSum').textContent = result.sum;
                
                if (result.win > 0) {
                    showNotification(`🎲 Выигрыш: ${result.win} USDT!`, 'success');
                    userData.balance += result.win;
                    updateUserInfo();
                } else {
                    showNotification(`Сумма: ${result.sum}. Попробуйте ещё!`, 'info');
                }
                
                rollButton.disabled = false;
                
                // Добавить в историю
                addGameToHistory('dice', betAmount, result.win, 
                    `${result.dice1}+${result.dice2}=${result.sum}`);
                
            }, 1000);
            
        } catch (error) {
            console.error('Dice error:', error);
            showNotification('Ошибка при игре в кости', 'error');
            rollButton.disabled = false;
        }
    });
}

function getDiceSymbol(number) {
    const symbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return symbols[number - 1] || '⚀';
}

// ИГРА: Рулетка
function initRouletteGame() {
    // Создать колесо рулетки
    createRouletteWheel();
    
    const spinButton = document.getElementById('spinRoulette');
    const clearButton = document.getElementById('clearRoulette');
    const chips = document.querySelectorAll('.chip');
    const outsideBets = document.querySelectorAll('.outside-bet');
    
    let currentChipValue = 10;
    let placedBets = [];
    
    // Выбор фишки
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentChipValue = parseInt(chip.dataset.value);
        });
    });
    
    // Внешние ставки
    outsideBets.forEach(bet => {
        bet.addEventListener('click', () => {
            if (userData && currentChipValue > userData.balance) {
                showNotification('Недостаточно средств!', 'error');
                return;
            }
            
            const betType = bet.dataset.bet;
            placedBets.push({
                type: betType,
                amount: currentChipValue,
                payout: 2
            });
            
            userData.balance -= currentChipValue;
            updateUserInfo();
            
            showNotification(`Ставка ${currentChipValue} USDT на ${betType}`, 'info');
        });
    });
    
    // Очистка ставок
    clearButton.addEventListener('click', () => {
        placedBets.forEach(bet => {
            userData.balance += bet.amount;
        });
        placedBets = [];
        updateUserInfo();
        showNotification('Ставки очищены', 'info');
    });
    
    // Вращение рулетки
    spinButton.addEventListener('click', async () => {
        if (placedBets.length === 0) {
            showNotification('Сделайте ставки!', 'error');
            return;
        }
        
        spinButton.disabled = true;
        const wheel = document.getElementById('rouletteWheel');
        
        // Анимация вращения
        wheel.style.transition = 'transform 0s';
        wheel.style.transform = 'rotate(0deg)';
        
        setTimeout(() => {
            const spins = 5 + Math.random() * 5; // 5-10 полных оборотов
            const randomAngle = Math.floor(Math.random() * 360);
            const totalRotation = spins * 360 + randomAngle;
            
            wheel.style.transition = 'transform 5s cubic-bezier(0.1, 0.2, 0.3, 1)';
            wheel.style.transform = `rotate(${totalRotation}deg)`;
            
            // Определить выигрышное число
            setTimeout(async () => {
                const winningNumber = Math.floor(randomAngle / 9.73); // 37 чисел на 360 градусов
                const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(winningNumber);
                const isBlack = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35].includes(winningNumber);
                const isGreen = winningNumber === 0;
                
                // Показать результат
                document.getElementById('rouletteNumber').textContent = winningNumber;
                const colorEl = document.getElementById('rouletteColor');
                colorEl.textContent = isRed ? 'Красное' : isBlack ? 'Чёрное' : 'Зелёное';
                colorEl.style.color = isRed ? '#ff4444' : isBlack ? '#000' : '#00ff00';
                
                try {
                    // Отправить результат на сервер
                    const response = await fetch(`${API_BASE_URL}/api/games/roulette`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('casino_token')}`
                        },
                        body: JSON.stringify({
                            bets: placedBets,
                            winningNumber: winningNumber
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.win > 0) {
                        showNotification(`🎰 Выигрыш: ${result.win} USDT!`, 'success');
                        userData.balance += result.win;
                        updateUserInfo();
                    }
                    
                    // Добавить в историю
                    addGameToHistory('roulette', 
                        placedBets.reduce((sum, bet) => sum + bet.amount, 0),
                        result.win,
                        `Число: ${winningNumber}`
                    );
                    
                    // Сбросить ставки
                    placedBets = [];
                    
                } catch (error) {
                    console.error('Roulette error:', error);
                    showNotification('Ошибка при игре в рулетку', 'error');
                }
                
                spinButton.disabled = false;
                
            }, 5000); // После завершения вращения
            
        }, 100);
    });
}

function createRouletteWheel() {
    const wheel = document.querySelector('.wheel-numbers');
    const numbers = [
        { num: 0, color: 'green' },
        { num: 32, color: 'red' }, { num: 15, color: 'black' }, { num: 19, color: 'red' },
        // ... все остальные числа европейской рулетки
    ];
    
    numbers.forEach((numObj, index) => {
        const segment = document.createElement('div');
        segment.className = `wheel-segment ${numObj.color}`;
        segment.style.transform = `rotate(${index * (360/37)}deg)`;
        segment.innerHTML = `<span>${numObj.num}</span>`;
        wheel.appendChild(segment);
    });
}

// ИГРА: Блэкджек
function initBlackjackGame() {
    const dealButton = document.getElementById('dealButton');
    const hitButton = document.getElementById('hitButton');
    const standButton = document.getElementById('standButton');
    const doubleButton = document.getElementById('doubleButton');
    
    let gameActive = false;
    let currentBet = 10;
    
    dealButton.addEventListener('click', async () => {
        if (userData && currentBet > userData.balance) {
            showNotification('Недостаточно средств!', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/games/blackjack/deal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('casino_token')}`
                },
                body: JSON.stringify({
                    bet: currentBet
                })
            });
            
            const result = await response.json();
            
            // Показать карты
            displayCards('player', result.playerCards);
            displayCards('dealer', result.dealerCards, true);
            
            // Обновить счёт
            document.getElementById('playerScore').textContent = result.playerScore;
            document.getElementById('dealerScore').textContent = '?';
            
            gameActive = true;
            updateButtons(true);
            
            userData.balance -= currentBet;
            updateUserInfo();
            
        } catch (error) {
            console.error('Blackjack error:', error);
        }
    });
    
    hitButton.addEventListener('click', async () => {
        if (!gameActive) return;
        
        const response = await fetch(`${API_BASE_URL}/api/games/blackjack/hit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('casino_token')}`
            }
        });
        
        const result = await response.json();
        
        if (result.busted) {
            endGame('Вы проиграли! Перебор.');
        } else {
            displayCards('player', [result.newCard]);
            document.getElementById('playerScore').textContent = result.newScore;
        }
    });
    
    standButton.addEventListener('click', async () => {
        if (!gameActive) return;
        
        const response = await fetch(`${API_BASE_URL}/api/games/blackjack/stand`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('casino_token')}`
            }
        });
        
        const result = await response.json();
        
        // Показать карты дилера
        displayCards('dealer', result.dealerCards, false);
        document.getElementById('dealerScore').textContent = result.dealerScore;
        
        // Определить победителя
        if (result.winner === 'player') {
            const winAmount = currentBet * 2;
            endGame(`Вы выиграли ${winAmount} USDT!`);
            userData.balance += winAmount;
        } else if (result.winner === 'dealer') {
            endGame('Дилер выиграл!');
        } else {
            endGame('Ничья! Возврат ставки.');
            userData.balance += currentBet;
        }
        
        updateUserInfo();
    });
    
    function displayCards(player, cards, hideFirst = false) {
        const container = document.getElementById(`${player}Cards`);
        
        cards.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            
            if (hideFirst && index === 0) {
                cardEl.textContent = '?';
                cardEl.style.background = '#2d3436';
            } else {
                cardEl.textContent = card;
                cardEl.style.color = ['♥', '♦'].includes(card.slice(-1)) ? '#d63031' : '#000';
            }
            
            container.appendChild(cardEl);
        });
    }
    
    function endGame(message) {
        showNotification(message, 'info');
        gameActive = false;
        updateButtons(false);
        
        // Очистить карты через 3 секунды
        setTimeout(() => {
            document.getElementById('playerCards').innerHTML = '';
            document.getElementById('dealerCards').innerHTML = '';
            document.getElementById('playerScore').textContent = '0';
            document.getElementById('dealerScore').textContent = '0';
        }, 3000);
    }
    
    function updateButtons(active) {
        hitButton.disabled = !active;
        standButton.disabled = !active;
        doubleButton.disabled = !active;
        dealButton.disabled = active;
    }
}

// Платежи: Пополнение
async function processDeposit() {
    const amount = document.getElementById('customDeposit').value || 100;
    
    if (amount < 10) {
        showNotification('Минимальное пополнение: 10 USDT', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/create-invoice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('casino_token')}`
            },
            body: JSON.stringify({
                amount: amount,
                currency: 'USDT'
            })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            showDepositModal(result.result);
        } else {
            showNotification('Ошибка при создании счёта', 'error');
        }
    } catch (error) {
        console.error('Deposit error:', error);
        showNotification('Ошибка соединения', 'error');
    }
}

// Платежи: Вывод
async function processWithdrawal() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const address = document.getElementById('withdrawAddress').value.trim();
    
    if (!userData) {
        showNotification('Сначала войдите в систему', 'error');
        return;
    }
    
    if (amount < 50) {
        showNotification('Минимальный вывод: 50 USDT', 'error');
        return;
    }
    
    if (amount > userData.balance) {
        showNotification('Недостаточно средств', 'error');
        return;
    }
    
    if (!address || !address.startsWith('T')) {
        showNotification('Введите корректный адрес TRC20', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('casino_token')}`
            },
            body: JSON.stringify({
                amount: amount,
                address: address,
                currency: 'USDT'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Запрос на вывод отправлен!', 'success');
            userData.balance -= amount;
            updateUserInfo();
            
            // Отправить уведомление в Telegram
            if (userData.telegram_id) {
                sendTelegramNotification(userData.telegram_id, 
                    `Запрос на вывод ${amount} USDT отправлен. Статус: в обработке.`);
            }
        } else {
            showNotification(result.error || 'Ошибка при выводе', 'error');
        }
    } catch (error) {
        console.error('Withdrawal error:', error);
        showNotification('Ошибка соединения', 'error');
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const colors = {
        success: '#00b894',
        error: '#d63031',
        info: '#0984e3',
        warning: '#fdcb6e'
    };
    
    notification.textContent = message;
    notification.style.background = colors[type] || colors.info;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Модальные окна
function showTelegramModal() {
    document.getElementById('telegramModal').style.display = 'block';
}

function showDepositModal(invoice) {
    const modal = document.getElementById('depositModal');
    const infoDiv = document.getElementById('paymentInfo');
    const qrDiv = document.getElementById('qrCode');
    
    infoDiv.innerHTML = `
        <h4>Счёт на оплату создан</h4>
        <p>Сумма: <strong>${invoice.amount} USDT</strong></p>
        <p>Ссылка для оплаты: <a href="${invoice.pay_url}" target="_blank">${invoice.pay_url}</a></p>
        <p>ID счёта: ${invoice.invoice_id}</p>
        <p><small>Оплатите в течение 1 часа</small></p>
    `;
    
    // Генерация QR кода
    qrDiv.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoice.pay_url)}" alt="QR Code">`;
    
    modal.style.display = 'block';
}

// Закрытие модальных окон
document.querySelectorAll('.modal-close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        closeBtn.closest('.modal').style.display = 'none';
    });
});

// Инициализация Telegram Web App
function initTelegramWebApp() {
    const tg = window.Telegram.WebApp;
    
    // Получить данные пользователя
    const user = tg.initDataUnsafe?.user;
    if (user) {
        userData = {
            telegram_id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name
        };
        
        // Авторизовать пользователя
        authenticateTelegramUser(user);
    }
    
    // Настроить интерфейс
    tg.setHeaderColor('#6c5ce7');
    tg.setBackgroundColor('#1a1a2e');
    tg.enableClosingConfirmation();
}

async function authenticateTelegramUser(user) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/telegram`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: user.id,
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name
            })
        });
        
        const result = await response.json();
        
        if (result.token) {
            localStorage.setItem('casino_token', result.token);
            userData = { ...userData, ...result.user };
            updateUserInfo();
            loadUserData();
            
            showNotification(`Добро пожаловать, ${user.first_name}!`, 'success');
        }
    } catch (error) {
        console.error('Telegram auth error:', error);
    }
}

async function sendTelegramNotification(chatId, message) {
    try {
        await fetch(`${API_BASE_URL}/api/telegram/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chatId: chatId,
                message: message
            })
        });
    } catch (error) {
        console.error('Telegram notification error:', error);
    }
}

// Загрузка последних игр
async function loadRecentGames() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/recent`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('casino_token')}`
            }
        });
        
        if (response.ok) {
            const games = await response.json();
            const container = document.getElementById('recentGames');
            
            container.innerHTML = games.map(game => `
                <div class="game-item">
                    <div class="game-type">${getGameIcon(game.game_type)}</div>
                    <div class="game-info">
                        <span class="game-name">${getGameName(game.game_type)}</span>
                        <span class="game-time">${new Date(game.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div class="game-result ${game.win_amount > 0 ? 'win' : 'loss'}">
                        ${game.win_amount > 0 ? '+' : ''}${game.win_amount} USDT
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading recent games:', error);
    }
}

// Загрузка транзакций
async function loadTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('casino_token')}`
            }
        });
        
        if (response.ok) {
            const transactions = await response.json();
            const container = document.getElementById('transactionsList');
            
            container.innerHTML = transactions.map(tx => `
                <div class="transaction-item">
                    <div class="tx-type ${tx.type}">
                        <i class="fas ${getTransactionIcon(tx.type)}"></i>
                    </div>
                    <div class="tx-info">
                        <span class="tx-desc">${getTransactionDescription(tx)}</span>
                        <span class="tx-time">${new Date(tx.created_at).toLocaleString()}</span>
                    </div>
                    <div class="tx-amount ${tx.amount > 0 ? 'positive' : 'negative'}">
                        ${tx.amount > 0 ? '+' : ''}${tx.amount} USDT
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// Вспомогательные функции
function getGameIcon(type) {
    const icons = {
        'slots': '🎰',
        'dice': '🎲',
        'roulette': '🎡',
        'blackjack': '🃏'
    };
    return icons[type] || '🎮';
}

function getGameName(type) {
    const names = {
        'slots': 'Слоты',
        'dice': 'Кости',
        'roulette': 'Рулетка',
        'blackjack': 'Блэкджек'
    };
    return names[type] || 'Игра';
}

function getTransactionIcon(type) {
    const icons = {
        'deposit': 'fa-arrow-down',
        'withdraw': 'fa-arrow-up',
        'win': 'fa-trophy',
        'bet': 'fa-coins'
    };
    return icons[type] || 'fa-exchange-alt';
}

function getTransactionDescription(tx) {
    const descriptions = {
        'deposit': 'Пополнение баланса',
        'withdraw': 'Вывод средств',
        'win': 'Выигрыш',
        'bet': 'Ставка в игре'
    };
    return descriptions[tx.type] || 'Транзакция';
}

async function addGameToHistory(gameType, bet, win, result) {
    // Обновить UI истории
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <div class="history-game">${getGameName(gameType)}</div>
        <div class="history-bet">${bet} USDT</div>
        <div class="history-win ${win > 0 ? 'positive' : 'negative'}">
            ${win > 0 ? '+' : ''}${win} USDT
        </div>
        <div class="history-result">${result}</div>
    `;
    
    document.getElementById('recentGames').prepend(historyItem);
}
