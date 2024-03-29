const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data');
const cors = require('cors');
const multer = require('multer');
const upload = multer();
const app = express();
const { exec } = require('child_process');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let servers = [
    { url: process.env.SERVER_1, active: true, failCount: 0 },
    { url: process.env.SERVER_2, active: true, failCount: 0 },
    { url: process.env.SERVER_3, active: true, failCount: 0 }
];

app.get('/register', (req, res) => {
    const serverUrl = req.query.serverUrl;
    if (serverUrl) {
        servers.push({ url: serverUrl, active: true, failCount: 0 });
        console.log(`Nuevo servidor registrado: ${serverUrl}`);
        console.log('Lista de servidores: ', servers)
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
        try {
            const response = await fetch(server.url + '/health');
            if (!response.ok) throw new Error('Health check failed');
            servers[index].active = true;
            servers[index].failCount = 0;
        } catch (error) {
            servers[index].active = false;
            servers[index].failCount += 1;
            console.error(`Error en health check para el servidor ${server.url}: ${error.message}`);

            if (servers[index].failCount >= 3) {
                launchNewInstance(server.url);
            }
        }
    });
}

function launchNewInstance(serverUrl) {
    const scriptPath = '/scripts/deploy_new_backend_container.ps1';
    const command = `pwsh -File ${scriptPath}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error al ejecutar el script: ${error}`);
            return;
        }
        console.log(`Script ejecutado exitosamente: ${stdout}`);
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

            const response = await fetch(server.url + req.url, requestOptions);

            if (response.ok) {
                response.body.pipe(res);
                responseSent = true;
                break;
            }
        } catch (error) {
            console.error(`Error al conectar con el servidor ${server.url}: ${error.message}`);
            servers[serverIndex].active = false;
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
