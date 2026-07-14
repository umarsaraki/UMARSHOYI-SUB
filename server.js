const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Wannan zai bawa HTML dinka damar loading

app.post('/', async (req, res) => {
    const type = req.query.type;
    // Anan ne za mu sanya logic na buy_data, buy_airtime etc
    res.json({status: 'success', message: 'API working'});
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
