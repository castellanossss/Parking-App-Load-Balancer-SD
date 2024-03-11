const cors = require('cors');
const http = require('http');
const axios = require('axios');

app.use(cors());

const servers = [
    { target: process.env.SERVER_1 },
    { target: process.env.SERVER_2 },
    { target: process.env.SERVER_3 }
];

let currentServer = 0;

const server = http.createServer(async (req, res) => {
    const target = servers[currentServer].target;
    const clientIp = req.socket.remoteAddress;

    console.log(`Solicitud del cliente ${clientIp} redirigida a ${target}`);

    currentServer = (currentServer + 1) % servers.length;

    try {
        const response = await axios({
            method: req.method,
            url: target + req.url,
            headers: req.headers,
            data: req.body
        });

        res.writeHead(response.status, response.headers);
        res.end(response.data);
    } catch (error) {
        console.error(`Error al conectar con el servidor ${target}: ${error.message}`);
        res.writeHead(502);
        res.end(`Error al conectar con el servidor ${target}`);
    }
});

server.listen(8010, () => {
    console.log('Load balancer listening on port 8010');
});
