#xzzpig/aliddnsingress:latest
FROM node:12.18.3-alpine AS src

WORKDIR /src

COPY . /src

RUN npm install --registry=https://registry.npm.taobao.org
RUN npm install --registry=https://registry.npm.taobao.org -g typescript
RUN tsc

FROM node:12.18.3-alpine

WORKDIR /app

COPY --from=src /src/dist /app/dist
COPY . /app

RUN npm install --registry=https://registry.npm.taobao.org

CMD [ "node","dist/index.js" ]
