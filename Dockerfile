FROM node:24-alpine AS build

WORKDIR /app

ARG SUPABASE_URL
ARG SUPABASE_PUBLISHABLE_KEY

RUN if ! printenv SUPABASE_URL | grep -q .; then \
      echo "SUPABASE_URL build argument is required" >&2; exit 1; \
    fi && \
    if ! printenv SUPABASE_PUBLISHABLE_KEY | grep -q .; then \
      echo "SUPABASE_PUBLISHABLE_KEY build argument is required" >&2; exit 1; \
    fi

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY . .

RUN yarn typecheck && yarn build

FROM nginx:alpine AS runtime

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
