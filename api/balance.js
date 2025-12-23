import { db } from '../lib/db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Получить баланс и статистику
        const result = await db.query(
            `SELECT 
                u.balance,
                u.total_deposits,
                u.total_wins,
                COUNT(DISTINCT g.id) as total_games,
                SUM(CASE WHEN g.win_amount > 0 THEN 1 ELSE 0 END) as win_count,
                MAX(g.win_amount) as biggest_win
             FROM users u
             LEFT JOIN games g ON u.id = g.user_id
             WHERE u.id = $1
             GROUP BY u.id, u.balance, u.total_deposits, u.total_wins`,
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.status(200).json(result.rows[0]);
        
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
