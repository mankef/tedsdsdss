import { db } from '../lib/db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        
        if (req.method === 'POST') {
            const { game } = req.query;
            
            switch (game) {
                case 'slots':
                    return handleSlots(req, res, userId);
                case 'dice':
                    return handleDice(req, res, userId);
                case 'roulette':
                    return handleRoulette(req, res, userId);
                case 'blackjack':
                    return handleBlackjack(req, res, userId);
                default:
                    return res.status(400).json({ error: 'Invalid game' });
            }
        } else if (req.method === 'GET') {
            if (req.query.type === 'recent') {
                // Получить последние игры
                const result = await db.query(
                    `SELECT * FROM games 
                     WHERE user_id = $1 
                     ORDER BY created_at DESC 
                     LIMIT 10`,
                    [userId]
                );
                
                return res.status(200).json(result.rows);
            } else if (req.query.type === 'history') {
                // Получить историю игр с фильтрами
                const { period, gameType, resultType } = req.query;
                let query = `SELECT * FROM games WHERE user_id = $1`;
                const params = [userId];
                let paramIndex = 2;
                
                if (period !== 'all') {
                    const date = new Date();
                    if (period === 'today') {
                        date.setHours(0, 0, 0, 0);
                    } else if (period === 'week') {
                        date.setDate(date.getDate() - 7);
                    } else if (period === 'month') {
                        date.setMonth(date.getMonth() - 1);
                    }
                    query += ` AND created_at >= $${paramIndex}`;
                    params.push(date.toISOString());
                    paramIndex++;
                }
                
                if (gameType !== 'all') {
                    query += ` AND game_type = $${paramIndex}`;
                    params.push(gameType);
                    paramIndex++;
                }
                
                if (resultType === 'win') {
                    query += ` AND win_amount > 0`;
                } else if (resultType === 'loss') {
                    query += ` AND win_amount = 0`;
                }
                
                query += ` ORDER BY created_at DESC LIMIT 100`;
                
                const result = await db.query(query, params);
                return res.status(200).json(result.rows);
            }
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Games API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Обработка игры в слоты
async function handleSlots(req, res, userId) {
    const { bet } = req.body;
    
    if (bet < 1 || bet > 1000) {
        return res.status(400).json({ error: 'Invalid bet amount' });
    }
    
    try {
        // Проверить баланс
        const userResult = await db.query(
            `SELECT balance FROM users WHERE id = $1`,
            [userId]
        );
        
        if (userResult.rows[0].balance < bet) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Снять ставку
        await db.query(
            `UPDATE users SET balance = balance - $1 WHERE id = $2`,
            [bet, userId]
        );
        
        // Записать ставку
        await db.query(
            `INSERT INTO transactions (user_id, type, amount, status, description)
             VALUES ($1, 'bet', $2, 'completed', 'Slots game bet')`,
            [userId, bet]
        );
        
        // Генерация результата
        const symbols = ['🍒', '🍋', '🍊', '7️⃣', '💎', '⭐'];
        const reels = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];
        
        // Проверка выигрыша
        let winMultiplier = 0;
        let winAmount = 0;
        let combination = '';
        
        // Проверка на джекпот (5 семёрок)
        if (reels.every(symbol => symbol === '7️⃣')) {
            winMultiplier = 1000;
            combination = 'JACKPOT! 5x 7️⃣';
        }
        // Проверка других комбинаций
        else {
            const counts = {};
            reels.forEach(symbol => {
                counts[symbol] = (counts[symbol] || 0) + 1;
            });
            
            for (const [symbol, count] of Object.entries(counts)) {
                if (count >= 3) {
                    const multipliers = {
                        '💎': { 3: 50, 4: 100, 5: 500 },
                        '⭐': { 3: 25, 4: 50, 5: 250 },
                        '7️⃣': { 3: 100, 4: 250, 5: 1000 },
                        '🍒': { 3: 10, 4: 25, 5: 100 },
                        '🍋': { 3: 5, 4: 10, 5: 50 },
                        '🍊': { 3: 3, 4: 5, 5: 25 }
                    };
                    
                    if (multipliers[symbol] && multipliers[symbol][count]) {
                        winMultiplier = multipliers[symbol][count];
                        combination = `${count}x ${symbol}`;
                        break;
                    }
                }
            }
        }
        
        winAmount = bet * winMultiplier;
        
        // Записать результат игры
        await db.query(
            `INSERT INTO games (user_id, game_type, bet_amount, win_amount, game_data, result)
             VALUES ($1, 'slots', $2, $3, $4, $5)`,
            [userId, bet, winAmount, JSON.stringify({ reels }), combination]
        );
        
        if (winAmount > 0) {
            // Зачислить выигрыш
            await db.query(
                `UPDATE users 
                 SET balance = balance + $1,
                     total_wins = total_wins + $1
                 WHERE id = $2`,
                [winAmount, userId]
            );
            
            // Записать транзакцию выигрыша
            await db.query(
                `INSERT INTO transactions (user_id, type, amount, status, description)
                 VALUES ($1, 'win', $2, 'completed', 'Slots win')`,
                [userId, winAmount]
            );
            
            // Отправить уведомление о крупном выигрыше
            if (winAmount >= 100) {
                await sendTelegramNotification(
                    userId,
                    `🎰 КРУПНЫЙ ВЫИГРЫШ! Вы выиграли ${winAmount} USDT в слотах!`
                );
            }
        }
        
        res.status(200).json({
            symbols: reels,
            win: winAmount,
            multiplier: winMultiplier,
            combination: combination
        });
        
    } catch (error) {
        console.error('Slots error:', error);
        res.status(500).json({ error: 'Game error' });
    }
}

// Обработка игры в кости
async function handleDice(req, res, userId) {
    const { bet, betType, exactNumber } = req.body;
    
    if (bet < 1 || bet > 1000) {
        return res.status(400).json({ error: 'Invalid bet amount' });
    }
    
    try {
        // Проверить баланс
        const userResult = await db.query(
            `SELECT balance FROM users WHERE id = $1`,
            [userId]
        );
        
        if (userResult.rows[0].balance < bet) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Снять ставку
        await db.query(
            `UPDATE users SET balance = balance - $1 WHERE id = $2`,
            [bet, userId]
        );
        
        // Бросить кости
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        const sum = dice1 + dice2;
        
        // Проверить выигрыш
        let win = 0;
        let multiplier = 0;
        let result = '';
        
        switch (betType) {
            case 'even':
                multiplier = 1.95;
                win = sum % 2 === 0 ? bet * multiplier : 0;
                result = `Чётное (${sum} = ${sum % 2 === 0 ? 'чёт' : 'нечёт'})`;
                break;
            case 'odd':
                multiplier = 1.95;
                win = sum % 2 === 1 ? bet * multiplier : 0;
                result = `Нечётное (${sum} = ${sum % 2 === 1 ? 'нечёт' : 'чёт'})`;
                break;
            case 'high':
                multiplier = 1.95;
                win = sum >= 7 ? bet * multiplier : 0;
                result = `Высокое (${sum} ${sum >= 7 ? '≥7' : '<7'})`;
                break;
            case 'low':
                multiplier = 1.95;
                win = sum <= 6 ? bet * multiplier : 0;
                result = `Низкое (${sum} ${sum <= 6 ? '≤6' : '>6'})`;
                break;
            case 'exact':
                if (exactNumber >= 2 && exactNumber <= 12) {
                    multiplier = 5.8;
                    win = sum === exactNumber ? bet * multiplier : 0;
                    result = `Точное число (${sum} ${sum === exactNumber ? '=' : '≠'} ${exactNumber})`;
                }
                break;
        }
        
        // Записать игру
        await db.query(
            `INSERT INTO games (user_id, game_type, bet_amount, win_amount, game_data, result)
             VALUES ($1, 'dice', $2, $3, $4, $5)`,
            [userId, bet, win, JSON.stringify({ dice1, dice2, sum, betType }), result]
        );
        
        if (win > 0) {
            // Зачислить выигрыш
            await db.query(
                `UPDATE users 
                 SET balance = balance + $1,
                     total_wins = total_wins + $1
                 WHERE id = $2`,
                [win, userId]
            );
        }
        
        res.status(200).json({
            dice1,
            dice2,
            sum,
            win,
            result
        });
        
    } catch (error) {
        console.error('Dice error:', error);
        res.status(500).json({ error: 'Game error' });
    }
}

// Обработка рулетки
async function handleRoulette(req, res, userId) {
    const { bets, winningNumber } = req.body;
    
    try {
        const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
        
        // Проверить баланс
        const userResult = await db.query(
            `SELECT balance FROM users WHERE id = $1`,
            [userId]
        );
        
        if (userResult.rows[0].balance < totalBet) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Снять ставки
        await db.query(
            `UPDATE users SET balance = balance - $1 WHERE id = $2`,
            [totalBet, userId]
        );
        
        // Проверить выигрыши
        let totalWin = 0;
        const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(winningNumber);
        const isBlack = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35].includes(winningNumber);
        const isEven = winningNumber % 2 === 0 && winningNumber !== 0;
        const isLow = winningNumber >= 1 && winningNumber <= 18;
        
        for (const bet of bets) {
            let win = 0;
            
            switch (bet.type) {
                case 'red':
                    win = isRed ? bet.amount * 2 : 0;
                    break;
                case 'black':
                    win = isBlack ? bet.amount * 2 : 0;
                    break;
                case 'even':
                    win = isEven ? bet.amount * 2 : 0;
                    break;
                case 'odd':
                    win = !isEven && winningNumber !== 0 ? bet.amount * 2 : 0;
                    break;
                case '1-18':
                    win = isLow ? bet.amount * 2 : 0;
                    break;
                case '19-36':
                    win = !isLow && winningNumber !== 0 ? bet.amount * 2 : 0;
                    break;
            }
            
            totalWin += win;
        }
        
        // Записать игру
        await db.query(
            `INSERT INTO games (user_id, game_type, bet_amount, win_amount, game_data, result)
             VALUES ($1, 'roulette', $2, $3, $4, $5)`,
            [userId, totalBet, totalWin, JSON.stringify({ bets, winningNumber }), `Число: ${winningNumber}`]
        );
        
        if (totalWin > 0) {
            // Зачислить выигрыш
            await db.query(
                `UPDATE users 
                 SET balance = balance + $1,
                     total_wins = total_wins + $1
                 WHERE id = $2`,
                [totalWin, userId]
            );
        }
        
        res.status(200).json({
            win: totalWin,
            winningNumber,
            color: isRed ? 'red' : isBlack ? 'black' : 'green'
        });
        
    } catch (error) {
        console.error('Roulette error:', error);
        res.status(500).json({ error: 'Game error' });
    }
}
