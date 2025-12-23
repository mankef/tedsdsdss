export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const update = req.body;
        
        // Проверяем, что это обновление об оплате
        if (update.payload) {
            const payload = JSON.parse(update.payload);
            const { userId, amount } = payload;
            
            // Здесь обновите баланс пользователя в вашей базе данных
            // Например: await updateUserBalance(userId, amount);
            
            console.log(`Пополнение баланса: пользователь ${userId}, сумма ${amount}`);
        }
        
        // Всегда возвращаем 200 OK для CryptoBot
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(200).json({ ok: true }); // Все равно возвращаем 200
    }
}