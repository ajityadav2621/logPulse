# LogPulse backend — Go/Gin API + WebSocket log stream.
#
# Multi-stage build: compile a static binary in a full Go image, then run it
# in a minimal distroless-style image with no toolchain, shell, or package
# manager. Keeps the runtime image small and reduces attack surface.

FROM golang:1.25-alpine AS build
WORKDIR /src

# Cache module downloads separately from source so an edit-only rebuild
# doesn't re-fetch every dependency.
COPY go.mod go.sum ./
RUN go mod download

COPY cmd cmd
COPY internal internal

# CGO_ENABLED=0 -> static binary, no libc dependency in the final image.
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/logpulse ./cmd/server

FROM alpine:3.20
WORKDIR /app

# ca-certificates: needed for outbound TLS calls to Google/GitHub OAuth
# token endpoints. wget: used by the container HEALTHCHECK below.
RUN apk add --no-cache ca-certificates wget

COPY --from=build /out/logpulse ./logpulse

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -q -O - http://localhost:8080/health >/dev/null || exit 1

ENTRYPOINT ["./logpulse"]
