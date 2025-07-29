FROM node:current-slim
RUN whoami
RUN mkdir -p /app/node_modules
WORKDIR /app
COPY package*.json ./
RUN chown -R node:node /app

USER node
RUN whoami
RUN ls -l
RUN npm install
COPY --chown=node:node . .
EXPOSE 3000
CMD ["node", "server.js"]
