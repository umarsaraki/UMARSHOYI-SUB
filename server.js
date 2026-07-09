const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

// Wannan yana bawa server damar karbar bayanai daga frontend
app.use(express.json()); 
app.use(express.static('public')); // inda index.html yake

// TOKEN DIN PEYFLEX NAKA - KADA KA BAYAWA WANI
const PEYFLEX_TOKEN = "46a1a698f4d973b1f8ce1f94c6459d57bea3d43f";

// WANNAN ROUTE ZAI BUDA SHAFIN GIDA
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ROUTE NA 1: DON JAWO PLANS DAGA PEYFLEX
// Misali: /get-plans?type=data&biller=mtn
app.get('/get-plans', async (req, res) => {
    try {
        const { type, biller } = req.query; // type = data, tv, electricity
        
        let url = `https://api.peyflex.com.ng/api/v1/${type}/plans`;
        if(biller) url += `?service=${biller}`; // Idan DSTV ko MTN
        
        // Ana kira Peyflex don dauko plans
        const response = await fetch(url, {
            headers: { "Authorization": "Bearer " + PEYFLEX_TOKEN }
        });
        const data = await response.json();
        res.json(data); // Muna mayar da plans ga frontend
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// ROUTE NA 2: DON SAYEN DATA KO BILL
app.post('/buy-service', async (req, res) => {
    try {
        const { type, plan_id, phone } = req.body; 
        
        // MATSAKI 1: ANAN ZAKA CIRE KUÐI DAGA WALLET NA USER
        // await cireKudiDagaWallet(userId, price);
        
        // MATSAKI 2: YANZU MU KIRA PEYFLEX MU SAYAR
        const response = await fetch(`https://api.peyflex.com.ng/api/v1/${type}/order`, {
            method: 'POST',
            headers: { 
                "Authorization": "Bearer " + PEYFLEX_TOKEN,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                plan: plan_id,  // lambar plan
                phone: phone    // number na user
            })
        });
        const result = await response.json();
        res.json(result); // Muna mayar da amsa ga user
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// BUDA SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server yana aiki a port ${PORT}`));
