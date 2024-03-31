const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data');
const cors = require('cors');
const multer = require('multer');
const upload = multer();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let servers = [];

app.get('/register', (req, res) => {
    const serverUrl = req.query.serverUrl;
    if (serverUrl) {
        servers.push({ url: serverUrl, active: true, failCount: 0, healthCheckStarted: true, retryAttempted: false });
        console.log(`Nuevo servidor registrado: ${serverUrl}`);
        console.log('Lista de servidores: ', servers);
        res.status(200).send('Servidor registrado exitosamente');
    } else {
        res.status(400).send('Falta la URL del servidor');
    }
});

let currentServer = 0;

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

function checkServerHealth() {
    servers.forEach(async (server, index) => {
        if (server.healthCheckStarted) {
            try {
                const response = await fetch(server.url + '/health', { timeout: 5000 });
                if (!response.ok) throw new Error('Health check failed');
                servers[index].failCount = 0;
                servers[index].active = true; // Reactivar el servidor si la comprobación de salud es exitosa
                servers[index].retryAttempted = false;
            } catch (error) {
                if (error.message === 'socket hang up' && !servers[index].retryAttempted) {
                    console.log(`Reintentando la conexión con el servidor ${server.url}...`);
                    servers[index].retryAttempted = true;
                } else {
                    servers[index].failCount += 1;
                    console.error(`Error en health check para el servidor ${server.url}: ${error.message}`);
                    if (servers[index].failCount >= 3) {
                        servers[index].active = false;
                        setTimeout(() => { // Volver a comprobar la salud del servidor después de 30 segundos
                            servers[index].healthCheckStarted = true;
                        }, 30000);
                    }
                }
            }
        }
    });
}

setInterval(checkServerHealth, 2000);

app.all('*', upload.any(), async (req, res) => {
    let attempt = 0;
    let responseSent = false;

    while (attempt < servers.length) {
        const serverIndex = getNextActiveServer(currentServer);
        if (serverIndex === -1) {
            res.status(502).send('Todos los servidores están inactivos.');
            return;
        }

        const server = servers[serverIndex];
        currentServer = serverIndex;

        try {
            console.log(`[${req.method}] - Solicitud del cliente ${req.socket.remoteAddress} redirigida a ${server.url + req.url}`);
            const requestOptions = {
                method: req.method,
                headers: {
                    ...req.headers,
                    'host': new URL(server.url).host
                },
            };

            if (req.is('multipart/form-data')) {
                const formData = new FormData();
                req.files.forEach(file => {
                    formData.append(file.fieldname, file.buffer, file.originalname);
                });
                Object.keys(req.body).forEach(key => {
                    formData.append(key, req.body[key]);
                });
                requestOptions.body = formData;
                requestOptions.headers = {
                    ...requestOptions.headers,
                    ...formData.getHeaders()
                };
            } else if (req.method !== 'GET' && req.method !== 'HEAD') {
                requestOptions.body = JSON.stringify(req.body);
            }

            const response = await fetch(server.url + req.url, {
                ...requestOptions,
                timeout: 10000,
            });

            if (response.ok) {
                response.body.pipe(res);
                responseSent = true;
                break;
            }
        } catch (error) {
            console.error(`Error al conectar con el servidor ${server.url}: ${error.message}`);
            if (error.message === 'socket hang up' && !server.retryAttempted) {
                server.retryAttempted = true;
                attempt--;
            } else {
                servers[serverIndex].active = false;
            }
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
