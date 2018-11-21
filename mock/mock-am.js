const express = require('express');
const app = express();
app.use(express.urlencoded({extended: false}));
app.post('/mock-token', function (req, res) {
    res.send({
        logged: req.body.username === 'tom',
        expires_in: 3600
    });
});
app.listen(4000);

