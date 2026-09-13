FROM node:24-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY provider-simulator.mjs ./provider-simulator.mjs
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 3443
ENTRYPOINT ["./entrypoint.sh"]
