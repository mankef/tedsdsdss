export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { amount, userId } = req.body;
        
        // Ваш CryptoBot API токен (добавьте в переменные окружения Vercel)
        const CRYPTOBOT_TOKEN = process.env.CRYPTOBOT_TOKEN;
        
        const response = await fetch('https://pay.crypt.bot/api/createInvoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Crypto-Pay-API-Token': CRYPTOBOT_TOKEN
            },
            body: JSON.stringify({
                asset: 'USDT', // Можете изменить на нужную валюту
                amount: amount.toString(),
                description: `Пополнение баланса для пользователя ${userId}`,
                hidden_message: 'Спасибо за оплату!',
                paid_btn_name: 'viewItem',
                paid_btn_url: 'https://ваш-сайт.com',
                payload: JSON.stringify({ userId, amount }),
                allow_comments: true,
                allow_anonymous: false,
                expires_in: 3600
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            // Здесь можно сохранить invoice в базу данных
            res.status(200).json(data);
        } else {
            res.status(400).json(data);
        }
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}