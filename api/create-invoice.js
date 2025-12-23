import { db } from '../lib/db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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
        const { amount, currency = 'USDT' } = req.body;
        
        if (amount < 10) {
            return res.status(400).json({ error: 'Minimum deposit is 10 USDT' });
        }
        
        // Создать invoice в CryptoBot
        const invoiceId = `deposit_${decoded.userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        
        const response = await fetch(`${CRYPTOBOT_URL}/createInvoice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Crypto-Pay-API-Token': CRYPTOBOT_TOKEN
            },
            body: JSON.stringify({
                asset: currency,
                amount: amount.toString(),
                description: `Deposit for user ${decoded.userId}`,
                hidden_message: 'Thank you for your deposit!',
                paid_btn_name: 'viewItem',
                paid_btn_url: process.env.APP_URL,
                payload: JSON.stringify({ 
                    userId: decoded.userId, 
                    type: 'deposit',
                    invoiceId: invoiceId
                }),
                allow_comments: true,
                allow_anonymous: false,
                expires_in: 3600
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            // Сохранить транзакцию в БД
            await db.query(
                `INSERT INTO transactions (user_id, type, amount, currency, status, 
                                          invoice_id, description)
                 VALUES ($1, 'deposit', $2, $3, 'pending', $4, 'Deposit via CryptoBot')`,
                [decoded.userId, amount, currency, data.result.invoice_id]
            );
            
            res.status(200).json({
                ok: true,
                result: {
                    ...data.result,
                    invoiceId: invoiceId
                }
            });
        } else {
            res.status(400).json(data);
        }
        
    } catch (error) {
        console.error('Create invoice error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
