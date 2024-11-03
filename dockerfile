FROM node:18-alpine as build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg

RUN addgroup -g 1027 appgroup && adduser -u 100 -G appgroup -s /bin/sh -D appuser

COPY --from=build /app/dist /app/dist
COPY --from=build /app/node_modules /app/node_modules
COPY package.json ./

ENV outputPath=/export

RUN npm install -g .

ENTRYPOINT ["playlist-export"]

USER appuser