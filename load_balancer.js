const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const servers = [
    { url: process.env.SERVER_1, active: true },
    { url: process.env.SERVER_2, active: true },
    { url: process.env.SERVER_3, active: true }
];

let currentServer = 0;

// Función para encontrar el próximo servidor activo
function getNextActiveServer(currentIndex) {
    const start = currentIndex;
    do {
        currentIndex = (currentIndex + 1) % servers.length;
        if (servers[currentIndex].active) {
            return currentIndex;
        }
    } while (currentIndex !== start);

    return -1;
}

// Esta función se llama regularmente para verificar la salud de los servidores.
function checkServerHealth() {
    servers.forEach(async (server, index) => {
        try {
            const response = await fetch(server.url + '/health');
            if (!response.ok) throw new Error('Health check failed');
            servers[index].active = true;
        } catch (error) {
            servers[index].active = false;
            console.error(`Error en health check para el servidor ${server.url}: ${error.message}`);
        }
    });
}

// Establece el intervalo para las comprobaciones de salud.
setInterval(checkServerHealth, 6000);

app.all('*', async (req, res) => {
    let attempt = 0;
    let responseSent = false;

    while (attempt < servers.length) {
        const serverIndex = getNextActiveServer(currentServer);
        if (serverIndex === -1) {
            res.status(502).send('Todos los servidores están inactivos.');
            return;
        }

        const server = servers[serverIndex];
        currentServer = serverIndex; // Actualiza el índice para el siguiente intento.

        try {
            const response = await fetch(server.url + req.url, {
                method: req.method,
                headers: { ...req.headers, 'Content-Type': 'application/json' },
                body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
            });

            if (response.ok) {
                response.body.pipe(res);
                responseSent = true;
                break;
            }
        } catch (error) {
            console.error(`Error al conectar con el servidor ${server.url}: ${error.message}`);
            servers[serverIndex].active = false; // Marca el servidor como inactivo si hay un error de red.
        }

        attempt++;
    }

    if (!responseSent) {
        res.status(502).send('No se pudo procesar la solicitud.');
    }
});

const PORT = process.env.PORT || 8010;
app.listen(PORT, () => {
    console.log(`Balanceador de carga escuchando en el puerto ${PORT}`);
    checkServerHealth();
});
