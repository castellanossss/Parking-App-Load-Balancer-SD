# Utilizar la imagen de Node.js versión 20
FROM node:20.11.1

# Instalar PowerShell
#RUN apt-get update && \
#    apt-get install -y wget apt-transport-https software-properties-common && \
#    wget -q "https://packages.microsoft.com/config/debian/10/packages-microsoft-prod.deb" && \
#    dpkg -i packages-microsoft-prod.deb && \
#    apt-get update && \
#    apt-get install -y powershell

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar el archivo de definición de dependencias del proyecto
COPY package*.json ./

# Instalar las dependencias del proyecto
RUN npm install

# Copiar los archivos fuente del proyecto al contenedor
COPY . .

# Exponer el puerto en el que tu aplicación se ejecutará
EXPOSE 8010

# Comando para ejecutar la aplicación
CMD ["node", "load_balancer.js"]