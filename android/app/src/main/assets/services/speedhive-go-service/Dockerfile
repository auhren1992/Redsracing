# Build Go-based Speedhive API service for Cloud Run

# Build stage
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Minimal runtime image
FROM gcr.io/distroless/base-debian12
WORKDIR /srv
COPY --from=build /app/server /srv/server
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/srv/server"]
