FROM python:3.12-slim

WORKDIR /app

COPY services/pattern-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY protos ./protos
COPY services/pattern-service/src ./src

ENV PYTHONPATH=/app/src
ENV PATTERN_GRPC_HOST=0.0.0.0
ENV PATTERN_GRPC_PORT=50051

EXPOSE 50051

CMD ["python", "-m", "pattern_service.server"]
