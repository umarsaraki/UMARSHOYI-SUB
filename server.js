import express from 'express';
import cors from 'cors';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Wannan zai serve index.html

// API
app.all('/', async (req, res) => {
    const type = req.query.type;
    if(type == 'get_history') return res.json({data: []});
    if(type == 'data_plans') return res.json({data: []});
    res.json({status: 'success', message: 'API working'});
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
