<p align="center">
  <img src="frontend/public/truss_logo.png" alt="Truss" height="72" />
</p>

<p align="center">
  <strong>Build ML models without writing a single line of code.</strong>
</p>

<p align="center">
  <a href="https://truss.run">truss.run</a> &nbsp;&bull;&nbsp;
  <a href="#getting-started">Self-host</a> &nbsp;&bull;&nbsp;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/github/license/PracticalMind/truss" />
  <img alt="Python" src="https://img.shields.io/badge/python-3.11+-blue" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.128+-green" />
  <img alt="React" src="https://img.shields.io/badge/React-18-61dafb" />
</p>

---

Truss is an open-source, no-code machine learning platform. Upload a CSV, clean your data, train a model, and export the results without touching a line of Python. It runs as a hosted service at [truss.run](https://truss.run) and can be self-hosted in minutes with Docker Compose.

## Features

**Data preparation**

- Column-level statistics and type inference on upload
- Missing value imputation: mean, median, mode, custom per-column, or drop
- Outlier handling: IQR and z-score methods with clip or drop actions
- Row filtering with string, numeric, and boolean operators
- Feature engineering: arithmetic expressions across columns
- Feature selection with correlation-based ranking

**Encoding and scaling**

- Label, one-hot, and ordinal encoding with per-column overrides
- Standard, min-max, and robust scaling with per-column overrides
- Interactive correlation matrix

**Training and evaluation**

- Algorithms: Linear Regression, Logistic Regression, Random Forest, XGBoost
- Tasks: classification and regression, auto-detected from target column
- Evaluation metrics: accuracy, precision, recall, F1, AUC-ROC, R2, RMSE, MAE
- k-fold and stratified cross-validation
- Grid-search hyperparameter optimization

**Export**

- Download trained model as a `.pkl` file
- Export predictions as a `.csv` file
- Batch prediction on new datasets
- Full pipeline history with replay

**Two workflow modes**

- **Guided mode** steps you through each stage in order: upload, analyze, clean, encode, scale, train, evaluate, export.
- **Freestyle mode** gives you a side-panel interface where you can run any step in any order, jump back, and experiment freely.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2 (async), PostgreSQL |
| ML | scikit-learn, XGBoost, pandas, NumPy, joblib |
| Cache | Redis (Upstash in production, local in Docker) |
| Auth | Supabase JWT (production) or local HS256 (self-hosted) |
| Storage | Supabase Storage (production) or local filesystem (self-hosted) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Deployment | Render (backend), Vercel (frontend), Docker Compose (self-hosted) |

## Getting started

### Hosted

Go to [truss.run](https://truss.run) and create a free account. No setup required.

### Self-hosted with Docker Compose

**Prerequisites:** Docker and Docker Compose installed.

```bash
git clone https://github.com/PracticalMind/truss.git
cd truss
```

Generate a JWT secret:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Open `docker-compose.yml` and set `LOCAL_JWT_SECRET` to the value above, then start the stack:

```bash
docker compose up --build
```

The app will be available at `http://localhost` and the API at `http://localhost:8000`.

### Local development

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -e .
cp .env.example .env
# Edit .env with your values, then:
uvicorn app.main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env           # set VITE_API_BASE_URL=http://localhost:8000/api
npm run dev
```

## Configuration

All backend configuration is done through environment variables (or a `.env` file). See `backend/.env.example` for the full list.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | required | PostgreSQL connection string |
| `AUTH_PROVIDER` | `supabase` | `supabase` or `local` |
| `STORAGE_PROVIDER` | `supabase` | `supabase` or `local` |
| `LOCAL_JWT_SECRET` | required in local mode | Secret for signing JWTs. Min 32 chars, not the default value. |
| `LOCAL_STORAGE_PATH` | `./data/uploads` | Path for local file storage |
| `REDIS_URL` | optional | Redis connection string. Caching is skipped if blank. |
| `BACKEND_CORS_ORIGINS` | required | Comma-separated list of allowed origins |
| `SUPABASE_URL` | required in supabase mode | Your Supabase project URL |
| `SUPABASE_JWT_SECRET` | required in supabase mode | Supabase JWT secret |
| `SUPABASE_SERVICE_ROLE_KEY` | required in supabase mode | Supabase service role key |
| `SUPABASE_STORAGE_BUCKET` | required in supabase mode | Storage bucket name |

Frontend variables (prefix `VITE_`) are baked in at build time:

| Variable | Description |
|---|---|
| `VITE_AUTH_PROVIDER` | `supabase` or `local`, must match backend |
| `VITE_API_BASE_URL` | Base URL for the backend API |
| `VITE_SUPABASE_URL` | Supabase project URL (supabase mode only) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (supabase mode only) |

## Project structure

```
truss/
  backend/
    app/
      api/routes/       # FastAPI route handlers
      core/             # Config, auth, Redis, storage, rate limiting
      schemas/          # Pydantic request/response models
      services/         # Database models and ML pipeline logic
  frontend/
    src/
      pages/            # Step-by-step guided mode pages
      freestyle/        # Freestyle mode layout and panels
      contexts/         # Auth context
      components/       # Shared UI components
  docker-compose.yml
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

MIT License. See [LICENSE](LICENSE) for details.
