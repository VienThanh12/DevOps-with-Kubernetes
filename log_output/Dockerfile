FROM node:20-alpine

WORKDIR /app

# Install curl for proxy-aware image fetching
RUN apk add --no-cache curl

COPY index.js .

CMD ["node", "index.js"]
