import { db } from '../lib/db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const CRYPTOBOT_TOKEN = process.env.CRYPTOBOT_TOKEN;
const CRYPTOBOT_URL = 'https://pay.crypt.bot/api';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { amount, address, currency = 'USDT' } = req.body;
        
        // Проверка минимальной суммы
        if (amount < 50) {
            return res.status(400).json({ error: 'Minimum withdrawal is 50 USDT' });
        }
        
        // Проверка баланса
        const userResult = await db.query(
            `SELECT balance, telegram_id FROM users WHERE id = $1`,
            [decoded.userId]
        );
        
        if (userResult.rows[0].balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Комиссия сети
        const fee = 1; // 1 USDT комиссия
        const netAmount = amount - fee;
        
        // Снять средства
        await db.query(
            `UPDATE users SET balance = balance - $1 WHERE id = $2`,
            [amount, decoded.userId]
        );
        
        // Создать запрос на вывод
        const withdrawal = await db.query(
            `INSERT INTO withdrawals (user_id, amount, address, currency, status)
             VALUES ($1, $2, $3, $4, 'pending')
             RETURNING *`,
            [decoded.userId, netAmount, address, currency]
        );
        
        // Создать транзакцию
        await db.query(
            `INSERT INTO transactions (user_id, type, amount, status, description)
             VALUES ($1, 'withdraw', $2, 'pending', 'Withdrawal request')`,
            [decoded.userId, amount]
        );
        
        // Отправить в CryptoBot (в реальном приложении)
        /*
        const response = await fetch(`${CRYPTOBOT_URL}/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Crypto-Pay-API-Token': CRYPTOBOT_TOKEN
            },
            body: JSON.stringify({
                asset: currency,
                amount: netAmount.toString(),
                user_id: userResult.rows[0].telegram_id,
                spend_id: `withdraw_${withdrawal.rows[0].id}`,
                comment: `Withdrawal for user ${decoded.userId}`
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            // Обновить статус вывода
            await db.query(
                `UPDATE withdrawals 
                 SET status = 'processing', tx_hash = $1
                 WHERE id = $2`,
                [data.result.hash, withdrawal.rows[0].id]
            );
        }
        */
        
        // Отправить уведомление в Telegram
        if (userResult.rows[0].telegram_id) {
            await sendTelegramNotification(
                userResult.rows[0].telegram_id,
                `🔄 Запрос на вывод ${amount} USDT получен.\n` +
                `💰 К получению: ${netAmount} USDT (комиссия: ${fee} USDT)\n` +
                `📝 Статус: в обработке\n` +
                `⏳ Время обработки: 1-24 часа`
            );
        }
        
        res.status(200).json({
            success: true,
            withdrawalId: withdrawal.rows[0].id,
            amount: netAmount,
            fee: fee,
            message: 'Withdrawal request submitted'
        });
        
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function sendTelegramNotification(chatId, message) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!TELEGRAM_BOT_TOKEN) return;
    
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (error) {
        console.error('Telegram notification error:', error);
    }
}
