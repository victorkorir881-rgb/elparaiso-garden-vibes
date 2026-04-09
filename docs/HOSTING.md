# Hosting & Deployment Guide

This guide covers deploying Elparaiso Garden Kisii to both local development and production environments. The project supports two primary deployment targets: **Manus Platform** (recommended) and **Vercel** (for maximum flexibility).

---

## Local Development

### Prerequisites

Ensure you have the following installed on your machine:

- **Node.js 22+** — Download from [nodejs.org](https://nodejs.org)
- **pnpm 10+** — Install with `npm install -g pnpm`
- **MySQL 8.0+** or **MariaDB 10.5+** — For local database
- **Git** — For version control

### Step 1: Clone the Repository

```bash
git clone <repository-url> elparaiso-garden
cd elparaiso-garden
```

### Step 2: Install Dependencies

```bash
pnpm install
```

This installs all frontend and backend dependencies defined in `package.json`.

### Step 3: Set Up Local Database

**Option A: Using Docker (Recommended)**

If you have Docker installed, run a MySQL container:

```bash
docker run --name elparaiso-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=elparaiso \
  -p 3306:3306 \
  -d mysql:8.0
```

**Option B: Using Local MySQL Installation**

Create a new database:

```bash
mysql -u root -p
CREATE DATABASE elparaiso;
CREATE USER 'elparaiso_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON elparaiso.* TO 'elparaiso_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Step 4: Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Database Configuration
DATABASE_URL=mysql://elparaiso_user:secure_password@localhost:3306/elparaiso

# Manus OAuth Configuration
VITE_APP_ID=your_manus_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
JWT_SECRET=your_jwt_secret_key_min_32_chars

# Owner Information
OWNER_NAME=Your Name
OWNER_OPEN_ID=your_manus_open_id

# Manus Built-in APIs
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your_server_api_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=your_frontend_api_key

# Analytics (Optional)
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com
VITE_ANALYTICS_WEBSITE_ID=your_website_id
```

**Getting Manus OAuth Credentials:**

1. Log in to [Manus Dashboard](https://dashboard.manus.im)
2. Create a new OAuth application
3. Set redirect URI to `http://localhost:3000/api/oauth/callback`
4. Copy the App ID and API keys to your `.env.local`

### Step 5: Run Database Migrations

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

This creates all database tables defined in `drizzle/schema.ts`.

### Step 6: Start Development Server

```bash
pnpm dev
```

The application will be available at:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3000/api/trpc

### Step 7: Access Admin Panel

1. Navigate to http://localhost:3000/admin
2. Click "Login with Manus"
3. Complete OAuth flow
4. You'll be redirected to the admin dashboard

---

## Production Deployment

### Option 1: Manus Platform (Recommended)

Manus provides managed hosting with automatic scaling, SSL, CDN, and custom domains.

#### Prerequisites

- Active Manus account with project created
- Custom domain (optional; auto-generated domain available)

#### Deployment Steps

**1. Build the project locally:**

```bash
pnpm build
```

This creates optimized production builds in `dist/` directory.

**2. Deploy via Manus UI:**

- Log in to [Manus Dashboard](https://dashboard.manus.im)
- Select your project
- Click "Publish" button
- Review environment variables
- Confirm deployment

**3. Configure custom domain (optional):**

- In Manus dashboard, go to Settings → Domains
- Add your custom domain (e.g., `elparaiso.com`)
- Update DNS records as instructed
- SSL certificate is automatically provisioned

**4. Verify deployment:**

- Visit your production URL
- Test login flow
- Verify admin panel access
- Check order tracking and reservations

#### Environment Variables for Production

Set these in Manus dashboard under Settings → Secrets:

```env
DATABASE_URL=mysql://prod_user:prod_password@prod_host:3306/elparaiso_prod
VITE_APP_ID=your_production_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
JWT_SECRET=your_production_jwt_secret_min_32_chars
OWNER_NAME=Your Name
OWNER_OPEN_ID=your_open_id
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your_production_api_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=your_production_frontend_key
```

#### Manus Platform Benefits

- **Zero Configuration** — Deploy directly from the UI
- **Automatic Scaling** — Handles traffic spikes automatically
- **SSL/TLS** — Free HTTPS with auto-renewal
- **CDN** — Global content delivery for fast load times
- **Custom Domains** — Bind multiple domains to your app
- **Environment Management** — Separate dev/staging/production
- **Monitoring** — Built-in analytics and error tracking
- **Backups** — Automatic database backups

---

### Option 2: Vercel Deployment

Vercel is ideal if you want maximum control and flexibility. Vercel specializes in frontend hosting but can also run Node.js backends.

#### Prerequisites

- GitHub account with repository
- Vercel account (free tier available)
- Production database (e.g., PlanetScale, AWS RDS, or cloud provider)

#### Step 1: Push Code to GitHub

```bash
git remote add origin https://github.com/yourusername/elparaiso-garden.git
git branch -M main
git push -u origin main
```

#### Step 2: Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Select "Import Git Repository"
4. Choose your GitHub repository
5. Click "Import"

#### Step 3: Configure Environment Variables

In Vercel dashboard:

1. Go to Settings → Environment Variables
2. Add all variables from `.env.local`:

```
DATABASE_URL=mysql://prod_user:prod_password@prod_host:3306/elparaiso
VITE_APP_ID=your_production_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
JWT_SECRET=your_production_jwt_secret
OWNER_NAME=Your Name
OWNER_OPEN_ID=your_open_id
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your_production_api_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=your_production_frontend_key
```

3. Click "Save"

#### Step 4: Deploy

1. Click "Deploy" button
2. Vercel builds and deploys your project
3. Your app is live at `<project-name>.vercel.app`

#### Step 5: Configure Custom Domain

1. Go to Settings → Domains
2. Add your custom domain (e.g., `elparaiso.com`)
3. Update DNS records as instructed
4. SSL is automatically provisioned

#### Step 6: Set Up Continuous Deployment

By default, Vercel deploys on every push to `main` branch:

- Push changes to GitHub
- Vercel automatically builds and deploys
- Preview deployments for pull requests
- Production deployment on merge to main

#### Vercel Configuration File

Create `vercel.json` in project root for custom build settings:

```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "vite",
  "functions": {
    "server/_core/index.ts": {
      "runtime": "nodejs18.x"
    }
  }
}
```

#### Production Database Setup for Vercel

For production, use a managed database service:

**Option A: PlanetScale (MySQL-compatible)**

1. Create account at [planetscale.com](https://planetscale.com)
2. Create new database
3. Copy connection string
4. Update `DATABASE_URL` in Vercel environment variables

**Option B: AWS RDS**

1. Create RDS MySQL instance
2. Configure security groups for Vercel IP ranges
3. Copy connection string
4. Update `DATABASE_URL` in Vercel environment variables

**Option C: DigitalOcean Managed Database**

1. Create managed MySQL database
2. Configure firewall rules
3. Copy connection string
4. Update `DATABASE_URL` in Vercel environment variables

#### Vercel vs Manus Comparison

| Feature | Vercel | Manus |
|---------|--------|-------|
| **Setup Complexity** | Moderate | Minimal |
| **Pricing** | Free tier + pay-as-you-go | Included in platform |
| **Database Hosting** | External (PlanetScale, RDS) | Included |
| **SSL/TLS** | Automatic | Automatic |
| **Custom Domain** | Yes | Yes |
| **Auto-scaling** | Yes | Yes |
| **CDN** | Yes | Yes |
| **Monitoring** | Basic | Advanced |
| **Support** | Community | Dedicated |

---

## Database Hosting Options

### Local Development

Use Docker or local MySQL installation as described in the Local Development section.

### Production

| Provider | Type | Pricing | Best For |
|----------|------|---------|----------|
| **PlanetScale** | MySQL-compatible | Free tier + $29/month | Startups, low traffic |
| **AWS RDS** | Managed MySQL | $15-100+/month | Enterprise, high traffic |
| **DigitalOcean** | Managed MySQL | $15-100+/month | Developers, scalability |
| **Manus** | Included | Included in platform | Simplicity, all-in-one |
| **Supabase** | PostgreSQL | Free tier + $25/month | PostgreSQL preference |

### Recommended Setup

For Elparaiso Garden Kisii:

- **Development:** Local MySQL via Docker
- **Staging:** PlanetScale free tier or DigitalOcean
- **Production:** AWS RDS or DigitalOcean (for reliability and support)

---

## Monitoring & Maintenance

### Health Checks

After deployment, verify the application is running:

```bash
curl https://yourdomain.com/api/trpc/auth.me
```

Should return a JSON response (may be error if not authenticated, which is normal).

### Logs

**Manus Platform:**
- View logs in dashboard under Logs section
- Real-time streaming of server output

**Vercel:**
- View logs in dashboard under Deployments
- Function logs for serverless execution

### Database Backups

**Manus:** Automatic daily backups, retention for 30 days

**Vercel + External DB:**
- Set up automated backups with your database provider
- PlanetScale: Automatic backups included
- AWS RDS: Configure automated backups in console
- DigitalOcean: Enable automated backups ($5/month)

### Performance Monitoring

Monitor key metrics:

- **Response Time** — Should be <500ms for most requests
- **Error Rate** — Should be <0.1% in production
- **Database Connections** — Monitor connection pool usage
- **Disk Space** — Monitor database size growth

---

## Scaling Considerations

### Horizontal Scaling

Both Manus and Vercel handle horizontal scaling automatically:

- **Manus:** Automatic load balancing across instances
- **Vercel:** Automatic scaling based on traffic

### Vertical Scaling

If you hit database limits:

1. **Upgrade database tier** — More CPU/RAM/storage
2. **Add caching layer** — Redis for frequently accessed data
3. **Optimize queries** — Use database indexes, avoid N+1 queries
4. **Archive old data** — Move historical orders/messages to archive table

### Database Optimization

- Add indexes on frequently queried columns (done in schema)
- Use connection pooling (configured in Drizzle)
- Monitor slow queries using `EXPLAIN`
- Archive old orders/messages after 6 months

---

## Troubleshooting

### Build Fails on Deployment

**Error:** `pnpm: command not found`

**Solution:** Ensure `pnpm` is installed globally and Node.js version is 18+

```bash
npm install -g pnpm
node --version  # Should be v18+
```

### Database Connection Error

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:3306`

**Solution:** Verify database is running and `DATABASE_URL` is correct

```bash
# Check if MySQL is running
mysql -u root -p -e "SELECT 1"

# Verify connection string format
# mysql://username:password@host:port/database
```

### OAuth Login Not Working

**Error:** `Redirect URI mismatch` or `Invalid App ID`

**Solution:** 

1. Verify `VITE_APP_ID` matches Manus dashboard
2. Update redirect URI in Manus dashboard to match deployment domain
3. For local: `http://localhost:3000/api/oauth/callback`
4. For production: `https://yourdomain.com/api/oauth/callback`

### Images Not Uploading

**Error:** `403 Forbidden` or `Access Denied` on image upload

**Solution:**

1. Verify S3 credentials are configured
2. Check S3 bucket policy allows public read access
3. Ensure bucket CORS is configured for your domain

### Admin Pages Show 403

**Error:** `Forbidden - Admin access required`

**Solution:**

1. Verify your user role is `admin` or `manager`
2. Contact site owner to promote your account
3. Check JWT token hasn't expired (try logging out and back in)

---

## Security Checklist

Before going to production, verify:

- [ ] `JWT_SECRET` is a strong random string (32+ characters)
- [ ] Database credentials are strong and unique
- [ ] Environment variables are not committed to Git
- [ ] HTTPS is enabled on custom domain
- [ ] Database backups are configured
- [ ] Admin users have strong passwords
- [ ] OAuth redirect URIs are correct
- [ ] S3 bucket policy restricts access appropriately
- [ ] Database firewall allows only necessary IPs
- [ ] Rate limiting is enabled on API endpoints
- [ ] Error messages don't expose sensitive info
- [ ] Database is regularly backed up

---

## Rollback & Recovery

### Rollback Deployment

**Manus:**
1. Go to dashboard → Version History
2. Select previous version
3. Click "Rollback"
4. Confirm rollback

**Vercel:**
1. Go to Deployments
2. Find previous deployment
3. Click "Redeploy"

### Database Recovery

If data is corrupted:

1. Stop the application
2. Restore from latest backup
3. Verify data integrity
4. Restart application

For Manus: Use dashboard backup restore
For external DB: Use provider's restore feature

---

## Performance Optimization

### Frontend

- Images are lazy-loaded and optimized
- CSS is minified and tree-shaken
- JavaScript is bundled and minified
- Tailwind CSS is purged for production

### Backend

- Database queries use indexes
- Pagination limits result sets
- Caching headers are set for static assets
- Compression is enabled for responses

### Database

- Indexes on frequently queried columns
- Connection pooling reduces overhead
- Query optimization via Drizzle ORM
- Archive old data to maintain performance

---

## Support

For deployment issues:

1. Check this guide for common solutions
2. Review application logs for error messages
3. Verify environment variables are correct
4. Test database connectivity
5. Contact Manus support or Vercel support

---

**Last Updated:** April 2026
