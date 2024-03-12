const cors = require('cors');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(cors());

const servers = [
    { target: process.env.SERVER_1 },
    { target: process.env.SERVER_2 },
    { target: process.env.SERVER_3 }
];

let currentServer = 0;

app.all('*', async (req, res) => {
    const target = servers[currentServer].target;
    console.log(`Solicitud del cliente ${req.socket.remoteAddress} redirigida a ${target}`);
    currentServer = (currentServer + 1) % servers.length;

    try {
        const response = await axios({
            method: req.method,
            url: target + req.url,
            headers: req.headers,
            data: req.body,
            timeout: 30000
        });

        res.setHeader('Access-Control-Allow-Origin', '*'); // Set CORS headers if needed
        response.data.pipe(res);
    } catch (error) {
        console.error(`Error al conectar con el servidor ${target}: ${error.message}`);
        res.status(502).send(`Error al conectar con el servidor ${target}`);
    }
});

const PORT = process.env.PORT || 8010;
app.listen(PORT, () => {
    console.log(`Load balancer listening on port ${PORT}`);
});
