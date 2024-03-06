const http = require('http');
const httpProxy = require('http-proxy');

require('dotenv').config();

const servers = [
    { target: process.env.SERVER_1 },
    { target: process.env.SERVER_2 },
    { target: process.env.SERVER_3 }
];

let currentServer = 0;

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
    const target = servers[currentServer].target;
    currentServer = (currentServer + 1) % servers.length;

    console.log(`Redirigiendo la solicitud a: ${target}`);

    proxy.web(req, res, { target }, (error) => {
        console.error(`Error al conectar con el servidor ${target}: ${error.message}`);
        res.writeHead(502);
        res.end(`Error al conectar con el servidor ${target}`);
    });
});

server.listen(8010, () => {
    console.log('Load balancer listening on port 8000');
});
