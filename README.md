# Friends Nearby

A Snapchat-style app for seeing which friends are nearby in real time.

- `infra/` – AWS infrastructure (Terraform). See [infra/README.md](infra/README.md).
- `backend/` – Go backend (Lambdas) and local runner. See [backend/README.md](backend/README.md).
- `frontend/` – React web app (currently mock data). See [frontend/README.md](frontend/README.md).

Deploy: `infra/scripts/build-lambdas.sh`, then `terraform apply` in `infra/`.
