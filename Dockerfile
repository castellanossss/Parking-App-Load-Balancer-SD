# Utilizar la imagen de Node.js versión 20
FROM node:20.11.1

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