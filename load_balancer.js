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

app.post('/updateServerStatus', (req, res) => {
    const { serverUrl, isActive } = req.body;
    const server = servers.find(s => s.url === serverUrl);
    if (server) {
        server.active = isActive;
        console.log(`Estado del servidor actualizado: ${serverUrl} - Activo: ${isActive}`);
        res.status(200).send('Estado del servidor actualizado');
    } else {
        res.status(404).send('Servidor no encontrado');
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

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

            requestOptions.signal = controller.signal; 

            const response = await fetch(server.url + req.url, requestOptions);
            clearTimeout(timeoutId); 

            if (response.ok) {
                response.body.pipe(res);
                responseSent = true;
                break;
            }
        } catch (error) {
            clearTimeout(timeoutId); 
            console.error(`Error al conectar con el servidor ${server.url}: ${error.message}`);
            if (error.name === 'AbortError') {
                console.log(`La solicitud al servidor ${server.url} se canceló por tiempo de espera`);
            } else if (error.message === 'socket hang up' && !server.retryAttempted) {
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
});
