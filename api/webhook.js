import { db } from '../lib/db.js';
import crypto from 'crypto';

const CRYPTOBOT_TOKEN = process.env.CRYPTOBOT_TOKEN;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Проверка подписи (опционально, если настроен secret_token в CryptoBot)
    const signature = req.headers['crypto-pay-api-signature'];
    
    try {
        const update = req.body;
        
        // Обработка оплаты инвойса
        if (update.payload) {
            const payload = JSON.parse(update.payload);
            
            if (payload.type === 'deposit') {
                // Найти транзакцию по invoice_id
                const txResult = await db.query(
                    `SELECT * FROM transactions 
                     WHERE invoice_id = $1 AND status = 'pending'`,
                    [update.invoice_id]
                );
                
                if (txResult.rows.length > 0) {
                    const transaction = txResult.rows[0];
                    
                    // Обновить баланс пользователя
                    await db.query(
                        `UPDATE users 
                         SET balance = balance + $1,
                             total_deposits = total_deposits + $1
                         WHERE id = $2`,
                        [transaction.amount, transaction.user_id]
                    );
                    
                    // Обновить статус транзакции
                    await db.query(
                        `UPDATE transactions 
                         SET status = 'completed',
                             tx_hash = $1,
                             completed_at = NOW()
                         WHERE id = $2`,
                        [update.hash || null, transaction.id]
                    );
                    
                    // Отправить уведомление в Telegram
                    const userResult = await db.query(
                        `SELECT telegram_id FROM users WHERE id = $1`,
                        [transaction.user_id]
                    );
                    
                    if (userResult.rows[0]?.telegram_id) {
                        await sendTelegramNotification(
                            userResult.rows[0].telegram_id,
                            `✅ Ваш баланс пополнен на ${transaction.amount} USDT! Новый баланс: ${transaction.amount} USDT`
                        );
                    }
                    
                    console.log(`Deposit completed for user ${transaction.user_id}: ${transaction.amount} USDT`);
                }
            }
        }
        
        // Всегда возвращаем 200 OK для CryptoBot
        res.status(200).json({ ok: true });
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(200).json({ ok: true }); // Все равно возвращаем 200
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
