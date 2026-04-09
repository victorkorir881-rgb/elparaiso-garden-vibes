# Elparaiso Garden Kisii — Integration & Setup Guide

**Version:** 1.0.0  
**Stack:** React 19 · Tailwind 4 · tRPC 11 · Express 4 · Drizzle ORM · MySQL/TiDB (built-in) · Manus OAuth

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Built-in Database (Default Setup)](#2-built-in-database-default-setup)
3. [Supabase Migration (Optional)](#3-supabase-migration-optional)
4. [Authentication & Admin Access](#4-authentication--admin-access)
5. [File Storage (Images & Media)](#5-file-storage-images--media)
6. [Email Notifications](#6-email-notifications)
7. [WhatsApp Integration](#7-whatsapp-integration)
8. [SEO Configuration](#8-seo-configuration)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [Admin Panel Guide](#10-admin-panel-guide)
11. [Deployment](#11-deployment)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Elparaiso Garden App                    │
│                                                          │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │  React 19    │────▶│  tRPC API    │                  │
│  │  Frontend    │     │  (Express)   │                  │
│  └──────────────┘     └──────┬───────┘                  │
│                              │                           │
│                    ┌─────────▼──────────┐               │
│                    │  Drizzle ORM       │               │
│                    │  MySQL / TiDB      │               │
│                    └────────────────────┘               │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Manus S3 Storage  │  Manus OAuth  │  Notify API │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

The application uses a **built-in MySQL/TiDB database** managed by the Manus platform. All 11 tables are created via Drizzle ORM migrations. The Supabase schema provided in `supabase_schema.sql` is an optional migration path for teams who prefer Supabase (PostgreSQL).

---

## 2. Built-in Database (Default Setup)

The app ships with a fully configured database. No manual setup is required — all tables are created automatically when the app starts for the first time.

### Database Tables

| Table | Purpose |
|---|---|
| `users` | Authenticated users with role-based access |
| `site_settings` | Key-value store for all site configuration |
| `seo_settings` | Per-page SEO metadata and Open Graph tags |
| `menu_categories` | Menu category definitions |
| `menu_items` | Individual menu items with pricing and images |
| `reservations` | Customer reservation requests |
| `events` | Events, offers, and promotions |
| `gallery_images` | Photo gallery with S3 references |
| `testimonials` | Customer reviews and ratings |
| `contact_messages` | Contact form submissions |
| `orders` | Customer orders with delivery tracking |
| `activity_logs` | Admin action audit trail |

### Seeding Default Data

After first deployment, seed the menu with sample data by navigating to `/admin` and using the Menu Manager to add categories and items. Alternatively, you can insert records directly via the Manus Database UI.

---

## 3. Order Tracking Feature

The app includes a **live order tracking system** where customers can check their delivery status by phone number or order number.

### Public Order Tracking Page

**URL:** `/track`

Customers can:
- Search orders by **phone number** to see all their orders
- Search orders by **order number** (format: `ORD-YYYYMMDD-XXXXX`) for a specific order
- View real-time status: pending → confirmed → preparing → ready → out-for-delivery → completed
- See estimated delivery time and order items
- Check payment status

### Admin Order Management

**URL:** `/admin/orders` (requires manager or admin role)

Staff can:
- View all orders with filtering by status, type (dine-in/takeaway/delivery), and search
- Update order status and estimated time
- Add internal admin notes
- View order statistics (total, pending, preparing, ready, out-for-delivery, completed, cancelled)
- Delete orders if needed

### Order Creation Flow

When a customer places an order (via API or future order form):

1. Order is created with status `pending`
2. System generates unique order number: `ORD-YYYYMMDD-XXXXX`
3. Owner receives push notification with order details
4. Customer can track order immediately using phone number or order number
5. Staff updates status as order progresses through kitchen and delivery
6. Customer sees real-time status updates on tracking page

### Order Statuses

| Status | Meaning |
|---|---|
| `pending` | Order received, awaiting confirmation |
| `confirmed` | Order confirmed, ready to prepare |
| `preparing` | Kitchen is preparing the order |
| `ready` | Order ready for pickup/delivery |
| `out-for-delivery` | Driver is en route (delivery orders only) |
| `completed` | Order delivered or picked up |
| `cancelled` | Order cancelled by customer or staff |

### API Endpoints

**Public (no auth required):**
- `POST /api/trpc/orders.create` — Create a new order
- `GET /api/trpc/orders.trackByPhone` — Get orders by customer phone
- `GET /api/trpc/orders.trackByNumber` — Get specific order by order number

**Manager/Admin only:**
- `GET /api/trpc/orders.list` — List all orders with filters
- `POST /api/trpc/orders.update` — Update order status and notes
- `POST /api/trpc/orders.delete` — Delete an order
- `GET /api/trpc/orders.stats` — Get order statistics

---

## 4. Supabase Migration (Optional)

If you prefer to use Supabase as your database backend, follow these steps.

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon/service_role keys**.

### Step 2: Run the Schema SQL

1. Open your Supabase project dashboard.
2. Navigate to **SQL Editor** → **New Query**.
3. Copy the entire contents of `docs/supabase_schema.sql` and paste it into the editor.
4. Click **Run** to execute all statements.

> **Important:** Run the schema in a single execution. The trigger creation block uses a `DO $$` anonymous block that must be executed atomically.

### Step 3: Configure Storage Bucket

1. In your Supabase dashboard, go to **Storage** → **New Bucket**.
2. Name it `elparaiso-media` and set it to **Public**.
3. Add the following storage policies in **Storage → Policies**:
   - **Public read:** Allow `SELECT` for all users on `elparaiso-media`.
   - **Admin write:** Allow `INSERT`, `UPDATE`, `DELETE` only for authenticated admin users.

### Step 4: Update the Application

To point the app at Supabase instead of the built-in database:

1. Install the Supabase client:
   ```bash
   pnpm add @supabase/supabase-js
   ```

2. Create `server/supabase.ts`:
   ```typescript
   import { createClient } from "@supabase/supabase-js";

   export const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   );
   ```

3. Add secrets via the Manus Secrets panel:
   - `SUPABASE_URL` — your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — your service role key (server-side only)
   - `VITE_SUPABASE_URL` — same project URL (for client-side if needed)
   - `VITE_SUPABASE_ANON_KEY` — your anon/public key

4. Replace the Drizzle query helpers in `server/db.ts` with Supabase client calls. The SQL schema uses snake_case column names; map them to camelCase in your TypeScript types.

### Column Name Mapping

The built-in MySQL schema uses camelCase; the Supabase schema uses snake_case. The mapping is:

| MySQL (camelCase) | Supabase (snake_case) |
|---|---|
| `openId` | `open_id` |
| `loginMethod` | `login_method` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
| `isActive` | `is_active` |
| `isFeatured` | `is_featured` |
| `isAvailable` | `is_available` |
| `imageUrl` | `image_url` |
| `imageKey` | `image_key` |
| `categoryId` | `category_id` |
| `sortOrder` | `sort_order` |
| `reviewerName` | `reviewer_name` |
| `reviewText` | `review_text` |
| `sourceLabel` | `source_label` |
| `isRead` | `is_read` |
| `adminNotes` | `admin_notes` |
| `inquiryType` | `inquiry_type` |
| `specialRequest` | `special_request` |
| `eventType` | `event_type` |
| `startDate` | `start_date` |
| `endDate` | `end_date` |
| `showOnHomepage` | `show_on_homepage` |
| `ctaLabel` | `cta_label` |
| `ctaUrl` | `cta_url` |
| `seoTitle` | `seo_title` |
| `metaDescription` | `meta_description` |
| `ogTitle` | `og_title` |
| `ogDescription` | `og_description` |
| `ogImage` | `og_image` |
| `canonicalUrl` | `canonical_url` |
| `lastSignedIn` | `last_signed_in` |
| `userId` | `user_id` |
| `entityType` | `entity_type` |
| `entityId` | `entity_id` |

---

## 5. Authentication & Admin Access

### How Authentication Works

The app uses **Manus OAuth** for authentication. When a user clicks "Sign In," they are redirected to the Manus OAuth portal. After successful login, a session cookie is set and the user's profile is upserted into the `users` table.

### Role System

| Role | Access Level |
|---|---|
| `user` | No admin access |
| `editor` | Can manage content (menu, gallery, events, testimonials) |
| `manager` | Editor + reservations + messages + settings |
| `admin` | Full access including user management |

### Promoting a User to Admin

The first user to log in via the Manus OAuth is automatically assigned the `admin` role if their `openId` matches the `OWNER_OPEN_ID` environment variable.

To promote any other user:

1. Go to the **Manus Database UI** in the Management panel.
2. Find the user in the `users` table.
3. Change their `role` field to `admin`, `manager`, or `editor`.
4. Save the change.

Alternatively, use the **Admin Panel → Users** page (requires `admin` role) to change roles via the UI.

### Protecting Routes

All admin routes (`/admin/*`) are protected by the `AdminLayout` component, which checks:
1. The user is authenticated (`isAuthenticated === true`).
2. The user has a qualifying role (`admin`, `manager`, or `editor`).

Non-authenticated users are redirected to `/admin/login`.

---

## 6. File Storage (Images & Media)

All images are stored in **Manus S3 storage** and served via CDN. The app never stores image bytes in the database — only the CDN URL and storage key are persisted.

### Upload Flow

1. The admin selects an image file in the admin panel.
2. The file is base64-encoded on the client and sent to the tRPC mutation.
3. The server calls `uploadBase64Image()` which uses `storagePut()` to upload to S3.
4. The returned CDN URL is stored in the database alongside the storage key.

### Image Deletion

When an admin deletes a menu item, gallery image, or event, the associated S3 object is also deleted via `storageDelete()`. This prevents orphaned files from accumulating in storage.

### Supported Formats

- **Images:** JPEG, PNG, WebP, GIF
- **Maximum size:** 5 MB per image (enforced client-side)
- **Recommended dimensions:** 1200×800px for hero images, 800×600px for menu items

---

## 7. Email Notifications

The app uses the **Manus Owner Notification API** to send real-time alerts to the business owner. Notifications are triggered for:

- **New reservation submitted** — includes customer name, date, time, guest count, and special requests.
- **New contact message received** — includes customer name, phone, inquiry type, and message.

Notifications appear in the Manus platform's notification center. No external email service configuration is required.

### Customising Notifications

To add additional notification triggers, call `notifyOwner()` from any tRPC mutation:

```typescript
import { notifyOwner } from "./_core/notification";

await notifyOwner({
  title: "New Event Booking",
  content: `${customer.name} booked the ${event.title} event for ${date}.`,
});
```

---

## 8. WhatsApp Integration

WhatsApp links are generated dynamically throughout the app using the international phone number stored in `site_settings.whatsapp`.

### Format

The WhatsApp number must be in **international format without the `+` prefix**:
- Kenya example: `254791224513` (not `+254791224513` or `0791224513`)

### Where WhatsApp Links Appear

| Location | Trigger |
|---|---|
| Homepage | Floating WhatsApp button |
| Contact page | "Chat on WhatsApp" button |
| Reservations confirmation | "Confirm via WhatsApp" link |
| Admin → Reservations | "WhatsApp Customer" action button |
| Admin → Messages | "WhatsApp Customer" action button |

### Updating the WhatsApp Number

Go to **Admin Panel → Settings → Contact** and update the "WhatsApp Number" field. The number will propagate to all WhatsApp links site-wide immediately.

---

## 9. SEO Configuration

### Per-Page SEO

Each public page has its own SEO settings managed via **Admin Panel → SEO Manager**:

| Field | Description | Recommended Length |
|---|---|---|
| Title | Browser tab and search result title | 50–60 characters |
| Meta Description | Search result snippet | 120–160 characters |
| Keywords | Comma-separated keywords | 5–10 keywords |
| OG Title | Social share title (defaults to title) | 50–60 characters |
| OG Description | Social share description | 120–160 characters |
| OG Image | Social share preview image URL | 1200×630px recommended |

### Structured Data

The homepage includes JSON-LD structured data for the restaurant, automatically populated from `site_settings`. This helps search engines understand the business type, location, opening hours, and contact information.

### Sitemap

A basic sitemap is served at `/sitemap.xml`. To customise it, edit `server/routers.ts` and add a dedicated Express route.

---

## 10. Environment Variables Reference

All environment variables are managed by the Manus platform. Do not hardcode these values or commit `.env` files.

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string | Yes |
| `JWT_SECRET` | Session cookie signing secret | Yes |
| `VITE_APP_ID` | Manus OAuth application ID | Yes |
| `OAUTH_SERVER_URL` | Manus OAuth backend URL | Yes |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL | Yes |
| `OWNER_OPEN_ID` | Owner's Manus OpenID (auto-admin) | Yes |
| `OWNER_NAME` | Owner's display name | Yes |
| `BUILT_IN_FORGE_API_URL` | Manus built-in APIs URL | Yes |
| `BUILT_IN_FORGE_API_KEY` | Server-side API key | Yes |
| `VITE_FRONTEND_FORGE_API_KEY` | Client-side API key | Yes |
| `VITE_FRONTEND_FORGE_API_URL` | Client-side API URL | Yes |

### Optional (for Supabase migration)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `VITE_SUPABASE_URL` | Supabase project URL (client-side) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (client-side) |

---

## 11. Admin Panel Guide

Access the admin panel at `/admin`. You must be logged in with a qualifying role.

### Navigation

| Section | Path | Access |
|---|---|---|
| Dashboard | `/admin` | Editor+ |
| Menu Manager | `/admin/menu` | Editor+ |
| Reservations | `/admin/reservations` | Manager+ |
| Events & Offers | `/admin/events` | Editor+ |
| Gallery | `/admin/gallery` | Editor+ |
| Testimonials | `/admin/testimonials` | Editor+ |
| Messages | `/admin/messages` | Manager+ |
| Settings | `/admin/settings` | Manager+ |
| SEO Manager | `/admin/seo` | Manager+ |
| Users | `/admin/users` | Admin only |

### Menu Manager

The Menu Manager has two tabs: **Categories** and **Items**.

- **Categories:** Create, reorder, and deactivate menu categories. Each category requires a unique slug (auto-generated from the name).
- **Items:** Add menu items with name, description, price, category, dietary flags (vegetarian, spicy), and an optional image. Toggle items as "Featured" to highlight them on the homepage.

### Reservation Management

Reservations arrive with `pending` status. The workflow is:

1. **Review** the reservation details.
2. **Confirm** or **Cancel** using the status dropdown.
3. **WhatsApp the customer** using the action button to communicate the confirmation.
4. After the visit, mark as **Completed**.

Reservations can be filtered by status, date, and searched by customer name or phone.

### Gallery Manager

Upload photos by dragging and dropping or clicking the upload area. Each image can be assigned a category (food, drinks, ambiance, events, team, general) and toggled as featured. Featured images appear on the homepage gallery section.

### Settings Panel

The Settings panel is divided into six tabs:

- **General:** Site name, tagline, description, announcement bar.
- **Contact:** Phone numbers, email, WhatsApp, address, Google Maps URL.
- **Social:** Links to Facebook, Instagram, Twitter/X, TikTok, YouTube.
- **Hours:** Opening hours for each day of the week with closed toggle.
- **Features:** Enable/disable reservations, gallery, events, and testimonials sections.
- **Hero:** Customise the homepage hero title, subtitle, and CTA button.

---

## 12. Deployment

### Publishing via Manus

1. Ensure all features are working correctly in the preview.
2. Click the **Publish** button in the Management UI header.
3. The app will be deployed to your Manus subdomain (e.g., `elparaiso-garden.manus.space`).

### Custom Domain

1. Go to **Management UI → Settings → Domains**.
2. Either purchase a new domain directly within Manus or bind an existing domain.
3. Follow the DNS configuration instructions shown in the UI.

### Pre-deployment Checklist

- [ ] All admin pages tested with real data
- [ ] Reservation form submits and sends owner notification
- [ ] Contact form submits and sends owner notification
- [ ] Gallery images upload and display correctly
- [ ] Menu items display with correct prices and categories
- [ ] Mobile responsive layout verified on phone
- [ ] SEO metadata configured for all pages
- [ ] Site settings (phone, address, hours) updated with real business data
- [ ] WhatsApp number set in Settings → Contact
- [ ] Admin user role confirmed in Users panel

---

*Documentation generated for Elparaiso Garden Kisii — Version 1.0.0*
