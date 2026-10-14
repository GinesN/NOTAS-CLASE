FROM node:24.19.0-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci
COPY tsconfig.json index.html ./
COPY src ./src
COPY server/courses.json ./server/courses.json
COPY docs/gpt-instructions.md ./docs/gpt-instructions.md
COPY public ./public
RUN npm run build

FROM python:3.12-slim-bookworm
WORKDIR /app
COPY requirements.txt ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export PIP_CERT=/run/secrets/build_ca; fi; \
    pip install --no-cache-dir -r requirements.txt \
    && useradd --uid 10001 --create-home aula \
    && mkdir /data && chown aula:aula /data
COPY --chown=aula:aula server ./server
COPY --chown=aula:aula --from=frontend /build/dist ./dist
ENV AULA_HOST=0.0.0.0 AULA_PORT=4173 AULA_DATA_DIR=/data PYTHONUNBUFFERED=1
USER aula
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4173/api/health', timeout=3)"
CMD ["python", "server/app.py"]
