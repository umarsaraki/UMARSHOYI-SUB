const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// GET KEYS FROM RENDER ENVIRONMENT VARIABLES
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;
const SUPABASE_PUB = process.env.SUPABASE_PUBLISHABLE;
const FLW_PUBLIC = process.env.FLW_PUBLIC_KEY;
const FLW_SECRET = process.env.FLW_SECRET_KEY;

// CONNECT TO SUPABASE ON BACKEND
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET);

app.use(express.static(__dirname));
app.use(express.json());

// ROUTE 1: SHOW index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ROUTE 2: SEND KEYS TO FRONTEND SAFELY
app.get('/config', (req, res) => {
    res.json({
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_PUB,
        flwPublic: FLW_PUBLIC
    });
});

// ROUTE 3: VERIFY FLUTTERWAVE PAYMENT
app.post('/verify-payment', async (req, res) => {
    try {
        const { tx_ref } = req.body;
        const response = await axios.get(`https://api.flutterwave.com/v3/transactions/${tx_ref}/verify`, {
            headers: { Authorization: `Bearer ${FLW_SECRET}` }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
