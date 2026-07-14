const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Wannan zai bawa index.html damar loading

// Wannan shine zai magance API calls
app.all('/', async (req, res) => {
    const type = req.query.type;
    console.log("API Type:", type);
    
    if(type == 'get_history'){
        return res.json({data: []}); // Na sanya empty na wucin gadi
    }
    if(type == 'data_plans'){
        return res.json({data: []});
    }
    
    res.json({status: 'success', message: 'API working'});
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
