# Siedu Dashboard

Dashboard administrasi untuk platform AI Chatbot Siedu.

## Tech Stack
- **React 18** + **Vite**
- **Vanilla CSS**
- Hosting: **AWS CloudFront + S3**

## Setup Development

```bash
npm install
npm run dev
```

## Deploy ke Produksi

```bash
cp .env.example .env
# Edit .env lalu:
bash deploy.sh
```

## Environment Variables

| Variable | Deskripsi |
|:---|:---|
| `VITE_API_BASE` | URL API backend |
| `S3_FRONTEND_BUCKET` | Nama S3 Bucket |
| `CLOUDFRONT_DISTRIBUTION_ID` | ID CloudFront |
