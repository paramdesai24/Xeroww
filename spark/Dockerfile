FROM apache/spark:3.5.9-scala2.12-java17-python3-ubuntu

USER root

RUN python3 -m pip install --no-cache-dir "pytest>=8.0,<10.0"

WORKDIR /app
COPY spark /app/spark

RUN mkdir -p /opt/spark/checkpoints /opt/spark/ivy /opt/spark/output /opt/spark/work && \
    chown -R 185:185 /app /opt/spark/checkpoints /opt/spark/ivy /opt/spark/output /opt/spark/work

USER 185
