#!/bin/bash

ServerUrl=$1

imageName="backend-image"
networkName="parking-service-net"
imageServerUrl="image-server-container:3008"

timestamp=$(date +"%Y%m%d%H%M%S")
containerName="backend-container-$timestamp"

# Looks for an available port
startPort=3004
endPort=3100
containerPort=$startPort
usedPorts=$(docker ps --format "{{.Ports}}" | grep -o '[0-9]*:[0-9]*' | cut -d: -f2)

while [[ " $usedPorts " =~ " $containerPort " ]] && [[ $containerPort -le $endPort ]]; do
    ((containerPort++))
done

if [[ $containerPort -gt $endPort ]]; then
    echo "No hay puertos disponibles en el rango $startPort-$endPort."
    exit 1
fi

# Run the container with the specified port, network, and environment variable
docker run --name $containerName -d --network $networkName -e IMAGES_SERVER_URL=$imageServerUrl -p ${containerPort}:3001 $imageName

echo "Contenedor $containerName creado y ejecutado exitosamente en el puerto $containerPort."

# After the container is up
backendUrl="http://${containerName}:3001"
curl "http://192.168.1.4:8010/register?serverUrl=$backendUrl" -X GET

monitoringServerUrl="http://192.168.1.4:4000/addServer"
curl -X POST -H "Content-Type: application/json" -d "{\"serverUrl\":\"http://${containerName}:3001/checkHealth\"}" $monitoringServerUrl

# Confirmation message for updating the load balancer configuration
echo "Configuración del balanceador de carga actualizada con el nuevo servidor: $containerName en el puerto $containerPort."

# Confirmation message for updating the monitoring server configuration
echo "Configuración del servidor de monitoreo actualizada con el nuevo servidor: $containerName en el puerto $containerPort."
