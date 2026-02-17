# Setup Production (Deployment)

Panduan deployment ke VPS (API + n8n) dan S3/CloudFront (Frontend).

## 1. Persiapan Server (VPS)

Pastikan VPS sudah terinstall:
- Docker & Docker Compose
- Git
- (Opsional) Nginx sebagai Reverse Proxy / SSL Termination

## 2. Deploy API & n8n

1.  **Clone Repo di VPS:**
    ```bash
    git clone https://github.com/your-org/siedu.git
    cd siedu
    ```

2.  **Setup Environment:**
    ```bash
    cp .env.example .env
    nano .env
    ```
    Isi variable production:
    - `NODE_ENV=production`
    - `DATABASE_URL` (Supabase Connection String)
    - `REDIS_URL` (Redis Service Name atau External)
    - `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` (S3)
    - `N8N_ENCRYPTION_KEY` (Generate random string)

3.  **Jalankan Docker Production:**
    ```bash
    npm run prod
    # Atau manual: docker compose -f docker-compose.yml up -d --build
    ```
    Ini akan menjalankan container **API** dan **n8n** yang teroptimasi.

## 3. Deploy Frontend (Dashboard)

Frontend adalah Static Site (SPA), jadi **tidak perlu server Node.js**. Cukup hosting file statis.

1.  **Build di Lokal/CI:**
    ```bash
    cd apps/dashboard
    npm install
    npm run build
    ```
    Output ada di folder `dist/`.

2.  **Upload ke S3:**
    ```bash
    aws s3 sync dist/ s3://your-frontend-bucket --delete
    ```

3.  **Invalidate CloudFront Cache:**
    ```bash
    aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
    ```

## 4. Migrasi Database

Karena Production menggunakan Supabase (bukan Docker), jalankan migrasi manual atau via CI/CD:

```bash
# Dari lokal (jika punya akses ke DB Supabase)
psql $SUPABASE_DB_URL -f packages/database/v1_simplified_handoff.sql
```
