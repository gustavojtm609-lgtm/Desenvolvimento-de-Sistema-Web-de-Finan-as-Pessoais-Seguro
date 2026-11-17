FROM node:24-bookworm-slim
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund \
    && npm run build \
    && rm -rf node_modules \
    && npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm start"]
