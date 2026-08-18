FROM node:20-alpine
WORKDIR /app
COPY server.js .
ARG APP_VERSION=v1
ENV APP_VERSION=${APP_VERSION}
EXPOSE 8080
CMD ["node", "server.js"]
