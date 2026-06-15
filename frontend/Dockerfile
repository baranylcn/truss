FROM node:20-alpine AS builder
WORKDIR /app

# Build-time variables (Vite inlines these into the bundle)
ARG VITE_AUTH_PROVIDER=local
ARG VITE_API_BASE_URL=http://localhost:8000/api
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=

ENV VITE_AUTH_PROVIDER=$VITE_AUTH_PROVIDER
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
