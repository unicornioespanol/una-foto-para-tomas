FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --cache /tmp/npm-cache
COPY . .
RUN npm run build
FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --cache /tmp/npm-cache
COPY --from=build /app/dist ./dist
COPY server ./server
USER node
EXPOSE 3000
CMD ["node","server/index.mjs"]
