# 1. Build Go Server binary
FROM golang:1.24-alpine AS builder

WORKDIR /src
RUN apk add --no-cache ca-certificates git

COPY server/go.mod ./
COPY server/ .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /src/server ./cmd/server
RUN chmod +x /src/server

# 2. Minimal Alpine container
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

COPY --from=builder /src/server /app/server
COPY data /app/data
RUN chmod +x /app/server

ENV PORT=8080
EXPOSE 8080

CMD ["/app/server"]
