param (
    [string]$ServerUrl
)

$imageName = "backend-image"
$networkName = "parking-service-net"
$imageServerUrl = "image-server-container:3008"

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$containerName = "backend-container-$timestamp"

# Looks for an available port
$usedPorts = docker ps --format "{{.Ports}}" | Select-String -Pattern "\d+:\d+" -AllMatches | ForEach-Object { $_.Matches } | ForEach-Object { $_.Value.Split(":")[1] }
$startPort = 3004
$endPort = 3100
$containerPort = $startPort

while ($usedPorts -contains $containerPort.ToString() -and $containerPort -le $endPort) {
    $containerPort++
}

if ($containerPort -gt $endPort) {
    Write-Host "No hay puertos disponibles en el rango $startPort-$endPort."
    exit 1
}

# Run the container with the specified port, network, and environment variable
docker run --name $containerName -d --network $networkName -e IMAGES_SERVER_URL=$imageServerUrl -p ${containerPort}:3001 $imageName

# Show a confirmation message
Write-Host "Contenedor $containerName creado y ejecutado exitosamente en el puerto $containerPort."

# Después de levantar el contenedor
$backendUrl = "http://${containerName}:3001"
Invoke-RestMethod -Uri "http://192.168.1.4:8010/register?serverUrl=$backendUrl" -Method Get

$monitoringServerUrl = "http://192.168.1.4:4000/addServer"
$body = @{ serverUrl = "http://${containerName}:3001/checkHealth" } | ConvertTo-Json
Invoke-RestMethod -Uri $monitoringServerUrl -Method Post -Body $body -ContentType "application/json"

# Confirmation message for updating the load balancer configuration
Write-Host "Configuración del balanceador de carga actualizada con el nuevo servidor: $containerName en el puerto $containerPort."

# Confirmation message for updating the monitoring server configuration
Write-Host "Configuración del servidor de monitoreo actualizada con el nuevo servidor: $containerName en el puerto $containerPort."
