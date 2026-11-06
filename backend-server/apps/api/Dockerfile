FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY packages/shared/ packages/shared/
RUN npm ci --include=dev --workspace apps/api
COPY apps/api/src/ ./apps/api/src/
RUN npm run build --workspace apps/api
RUN npm ci --omit=dev --workspace apps/api

FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
EXPOSE 4000
ENV NODE_ENV=production \
    PORT=4000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/package.json ./package.json
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://localhost:4000/health').then(r => process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
USER node
CMD ["node", "apps/api/dist/index.js"]
