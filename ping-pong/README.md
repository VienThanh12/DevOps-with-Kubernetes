# Ping-pong (Serverless)

This folder contains a simple HTTP server that increments a counter in Postgres and responds to `/pingpong` and `/count`. It is ready for Knative Serving (serverless) — listens on the port provided by `PORT` and defaults to 8080 in Kubernetes.

## Prerequisites

- Kubernetes cluster
- Knative Serving installed (CRDs + core) and Kourier as the networking layer.
- A `postgres-secret` containing `POSTGRES_PASSWORD` in the `exercises` namespace.
- The `ping-pong-config` ConfigMap applied (provides DB connection info).

### Install Knative (from this repo)

Apply CRDs, core, and Kourier (adjust namespaces as needed):

```bash
kubectl apply -f serving-crds.yaml
kubectl apply -f serving-core.yaml
kubectl apply -f kourier.yaml
# Optionally configure DNS / domain-mapping per your environment
```

## Deploy Ping-pong as Knative Service

```bash
# Ensure the namespace exists
kubectl create namespace exercises --dry-run=client -o yaml | kubectl apply -f -

# Apply DB config and secret (secret must already exist)
kubectl apply -f ping-pong/manifests/ping-pong-config.yaml

# Deploy the Knative Service
kubectl apply -f ping-pong/manifests/knative-service.yaml

# Watch the service become ready
kubectl get ksvc -n exercises ping-pong -w
```

## Access

- Get the URL assigned by Knative:

```bash
kubectl get ksvc -n exercises ping-pong
```

- Then curl the endpoints:

```bash
curl -s "$(kubectl get ksvc -n exercises ping-pong -o jsonpath='{.status.url}')/pingpong"
curl -s "$(kubectl get ksvc -n exercises ping-pong -o jsonpath='{.status.url}')/count"
```

## Notes

- For traditional Deployment-based usage, `deployment.yaml` and `service.yaml` remain available; they now use port 8080 for consistency.
- Avoid setting `PORT` for Knative; Knative injects `PORT=8080` automatically.
