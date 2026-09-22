FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S calora && adduser -S calora -G calora
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/index.html /app/admin.html ./
COPY --from=build /app/css ./css
COPY --from=build /app/js ./js
COPY scripts/api-entrypoint.sh /api-entrypoint.sh
RUN chmod +x /api-entrypoint.sh && chown -R calora:calora /app
USER calora
EXPOSE 3005
ENTRYPOINT ["/api-entrypoint.sh"]
