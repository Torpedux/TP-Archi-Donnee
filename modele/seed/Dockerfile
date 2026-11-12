# Image du service `seed` : Python (générateur, importer.py) + client psql (charger.sql).
FROM python:3.12.8-slim-bookworm
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*
COPY modele/neo4j/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
