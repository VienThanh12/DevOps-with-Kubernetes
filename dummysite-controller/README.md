# DummySite CRD & Controller

This adds a `DummySite` Custom Resource that fetches an external URL and serves a static copy via an in-cluster `nginx` Deployment.

## Resources
- CRD: `dummysites.stable.dwk` defines `spec.website_url`
- Controller: runs in-cluster, watches `DummySite` and creates:
  - ConfigMap `dummysite-<name>` containing `index.html`
  - Deployment `dummysite-<name>` serving the HTML via `nginx`
  - Service `dummysite-<name>` exposing port 80

## Deploy
```bash
# Apply CRD
kubectl apply -f dummysite-controller/manifests/resourcedefinition.yaml

# RBAC + controller code + deployment
kubectl apply -f dummysite-controller/manifests/serviceaccount.yaml
kubectl apply -f dummysite-controller/manifests/clusterrole.yaml
kubectl apply -f dummysite-controller/manifests/clusterrolebinding.yaml
kubectl apply -f dummysite-controller/manifests/controller-configmap.yaml
kubectl apply -f dummysite-controller/manifests/deployment.yaml

# Create a DummySite
kubectl apply -f dummysite-controller/manifests/dummysite.yaml
```

## Verify
```bash
kubectl get dummysites
kubectl get deploy,svc | grep dummysite-

# Port-forward and view
kubectl port-forward svc/dummysite-example-copy 8080:80
curl -s http://localhost:8080 | head -n 20
```

## Cleanup
```bash
kubectl delete -f dummysite-controller/manifests/dummysite.yaml
kubectl delete -f dummysite-controller/manifests/deployment.yaml
kubectl delete -f dummysite-controller/manifests/controller-configmap.yaml
kubectl delete -f dummysite-controller/manifests/clusterrolebinding.yaml
kubectl delete -f dummysite-controller/manifests/clusterrole.yaml
kubectl delete -f dummysite-controller/manifests/serviceaccount.yaml
kubectl delete -f dummysite-controller/manifests/resourcedefinition.yaml
```
