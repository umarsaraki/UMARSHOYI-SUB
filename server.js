const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(__dirname));

// Wannan zai nuna index.html dinka a matsayin gidan shafin
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Wannan ne port din da Render yake bukata
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server yana gudana a port ${PORT}`);
});
