FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm install typescript && npx tsc && npm uninstall typescript

ENV PORT=3100
EXPOSE 3100

CMD ["node", "dist/index.js"]
