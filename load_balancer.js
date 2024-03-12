const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const servers = [
    process.env.SERVER_1,
    process.env.SERVER_2,
    process.env.SERVER_3
];
let currentServer = 0;

app.all('*', async (req, res) => {
    const body = req.method !== 'GET' ? JSON.stringify(req.body) : undefined;
    const headers = {
        ...req.headers,
        'Content-Type': 'application/json'
    };

    const target = servers[currentServer];
    currentServer = (currentServer + 1) % servers.length;

    console.log(`Redirigiendo solicitud a ${target}`);

    try {
        const response = await fetch(target + req.url, {
            method: req.method,
            headers: headers,
            body: body
        });

        if (!response.ok) {
            throw new Error(`Error al realizar la solicitud a ${target}: ${response.statusText}`);
        }

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error(error.message);
        res.status(502).send("Error en el balanceador de carga al conectar con el backend.");
    }
});

const PORT = process.env.PORT || 8010;
app.listen(PORT, () => {
    console.log(`Balanceador de carga escuchando en el puerto ${PORT}`);
});
