const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public')); // هذا للملفات الثابتة مثل index.html

// قراءة مفتاح API من متغيرات البيئة
const API_KEY = process.env.AVIATIONSTACK_KEY || '29371284e19bc35fa6de600358b2c48e';

// هذا هو المسار المهم - تأكد أنه مكتوب بالضبط '/api/flights'
app.get('/api/flights', async (req, res) => {
    console.log('📡 تم استقبال طلب للرحلات');
    try {
        const response = await fetch(`http://api.aviationstack.com/v1/flights?access_key=${API_KEY}&limit=100`);
        const data = await response.json();
        console.log('✅ تم جلب البيانات بنجاح');
        res.json(data);
    } catch (error) {
        console.error('❌ خطأ في جلب البيانات:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// مسار للتأكد من عمل السيرفر
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
    console.log(`🔑 حالة المفتاح: ${API_KEY ? 'موجود' : 'غير موجود'}`);
});
