import { db } from '../lib/db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { id, username, first_name, last_name } = req.body;
        
        try {
            // Найти или создать пользователя
            let user = await db.query(
                `SELECT * FROM users WHERE telegram_id = $1`,
                [id]
            );
            
            if (user.rows.length === 0) {
                user = await db.query(
                    `INSERT INTO users (telegram_id, username, first_name, last_name, balance)
                     VALUES ($1, $2, $3, $4, 10)
                     RETURNING *`,
                    [id, username, first_name, last_name]
                );
                
                // Бонус за регистрацию
                await db.query(
                    `INSERT INTO transactions (user_id, type, amount, status, description)
                     VALUES ($1, 'deposit', 10, 'completed', 'Бонус за регистрацию')`,
                    [user.rows[0].id]
                );
            } else {
                // Обновить последний вход
                await db.query(
                    `UPDATE users SET last_login = NOW() WHERE telegram_id = $1`,
                    [id]
                );
            }
            
            // Создать JWT токен
            const token = jwt.sign(
                { userId: user.rows[0].id, telegramId: id },
                JWT_SECRET,
                { expiresIn: '30d' }
            );
            
            res.status(200).json({
                token,
                user: user.rows[0]
            });
            
        } catch (error) {
            console.error('Auth error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    } else if (req.method === 'GET') {
        // Проверка токена
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            
            const user = await db.query(
                `SELECT id, telegram_id, username, first_name, last_name, balance, 
                        total_deposits, total_wins, created_at
                 FROM users WHERE id = $1`,
                [decoded.userId]
            );
            
            if (user.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.status(200).json(user.rows[0]);
            
        } catch (error) {
            console.error('Token verification error:', error);
            res.status(401).json({ error: 'Invalid token' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
