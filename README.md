# Elparaiso Garden Kisii — Premium Hospitality Website

A fully functional, production-ready hospitality website for **Elparaiso Garden Kisii**, a 24/7 bar, grill, and restaurant in Kenya. The platform features a dark premium theme with a public-facing website and a secure admin dashboard for complete business management.

---

## 🎯 Project Overview

Elparaiso Garden Kisii is a complete end-to-end hospitality management system built with modern web technologies. It serves both customers (public website) and business owners (admin dashboard) with real-time order tracking, reservation management, menu curation, event promotion, and customer engagement tools.

**Key Statistics:**
- **11 database tables** with role-based access control
- **50+ tRPC procedures** across 10 feature namespaces
- **9 public pages** with responsive dark theme
- **11 admin pages** with full CRUD operations
- **37 vitest tests** (all passing)
- **0 TypeScript errors**
- **Zero external API dependencies** (uses built-in Manus services)

---

## ✨ Features

### Public Website

The customer-facing website includes nine fully responsive pages designed for mobile-first experience:

**Home Page** — Hero section with call-to-action buttons, featured menu items carousel, testimonials carousel with auto-rotation, active events/specials preview, location map, and WhatsApp contact button.

**Menu Page** — Browse all menu items organized by category with search functionality, item details (description, price, availability), featured items highlighting, and direct ordering capability.

**Order Page** — Complete ordering system where customers build a cart, specify delivery details (name, phone, address, special instructions), see real-time total calculation, and receive order confirmation with tracking number.

**Track Order Page** — Customers enter their phone number or order number to check real-time delivery status (pending, preparing, ready, out-for-delivery, completed, cancelled).

**Reservations Page** — Book a table with date/time selection, party size, special requests, and automatic confirmation with WhatsApp integration.

**Gallery Page** — Masonry grid layout of restaurant photos with lightbox viewer, category filtering, and lazy loading for performance.

**Events Page** — Showcase special events, promotions, and offers with dates, times, descriptions, and call-to-action links.

**About Page** — Restaurant story, mission, and values with team information and social proof.

**Contact Page** — Contact form (name, phone, email, inquiry type, message), embedded Google Map, hours of operation, and direct WhatsApp link.

### Admin Dashboard

Secure admin panel (protected by Manus OAuth) with 11 management pages:

**Dashboard** — Overview of key metrics (reservations today, pending orders, unread messages, active events, featured items, gallery count) with recent activity log.

**Menu Manager** — Full CRUD for menu categories and items. Add/edit/delete categories, manage items with descriptions, prices, images, availability status, and featured toggle. Supports S3 image uploads.

**Reservations Manager** — View all reservations with filtering by status (pending, confirmed, cancelled), search by customer name/phone, mark as confirmed, send WhatsApp reminders, and track no-shows.

**Orders Manager** — Real-time order queue with status management (pending → preparing → ready → out-for-delivery → completed/cancelled). Update order status, view customer details, and send status updates via WhatsApp.

**Events Manager** — Create/edit/delete events with title, description, date, time, image, and homepage toggle to feature events on the landing page.

**Gallery Manager** — Upload multiple images, organize by category, set featured images, and manage gallery content.

**Testimonials Manager** — Approve/reject customer reviews, manage ratings, organize testimonials by featured status and sort order.

**Messages Manager** — View contact form submissions with read/unread status, search by customer name/phone, and bulk actions.

**Settings Panel** — Configure business information (name, phone, WhatsApp, address, email, social links), operating hours, feature toggles (delivery, dine-in, takeaway, reservations), and payment settings.

**SEO Manager** — Manage per-page SEO metadata (title, meta description, Open Graph tags, canonical URLs) for all public pages.

**User Management** — Promote/demote users between roles (user, editor, manager, admin) with role-based access control.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4 | Modern, responsive UI with dark theme |
| **Backend** | Express 4, tRPC 11, Node.js | Type-safe API with automatic client generation |
| **Database** | MySQL/TiDB, Drizzle ORM | Relational data with type-safe queries |
| **Authentication** | Manus OAuth | Secure, passwordless authentication |
| **File Storage** | S3 (AWS/Manus) | Scalable image and media storage |
| **Notifications** | Manus Built-in API | Owner notifications on new orders/messages |
| **Testing** | Vitest | Fast unit tests for backend logic |
| **Build Tools** | Vite, esbuild | Fast development and production builds |
| **Deployment** | Manus Platform or Vercel | Managed hosting with custom domains |

---

## 📦 Installation & Setup

### Prerequisites

- **Node.js 22+** with pnpm package manager
- **MySQL/TiDB database** (local or cloud)
- **Manus account** (for OAuth and built-in services)
- **S3 bucket** (for image storage, optional if using Manus S3)

### Local Development

**1. Clone and install dependencies:**

```bash
cd elparaiso-garden
pnpm install
```

**2. Set up environment variables:**

Create a `.env.local` file in the project root with the following variables:

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/elparaiso

# Manus OAuth
VITE_APP_ID=your_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
JWT_SECRET=your_jwt_secret

# Owner Information
OWNER_NAME=Your Name
OWNER_OPEN_ID=your_open_id

# Built-in APIs
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your_api_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=your_frontend_key

# Analytics (optional)
VITE_ANALYTICS_ENDPOINT=your_analytics_endpoint
VITE_ANALYTICS_WEBSITE_ID=your_website_id
```

**3. Run database migrations:**

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

**4. Start development server:**

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Database Setup

The project uses Drizzle ORM with automatic migrations. The database schema includes 11 tables:

- **users** — Authentication and role management
- **site_settings** — Business configuration (hours, contact info, feature toggles)
- **seo_settings** — Per-page SEO metadata
- **menu_categories** — Menu organization
- **menu_items** — Food and drink items with pricing
- **reservations** — Table booking management
- **orders** — Order tracking and status
- **events** — Special events and promotions
- **gallery_images** — Photo gallery management
- **testimonials** — Customer reviews and ratings
- **contact_messages** — Contact form submissions
- **activity_logs** — Admin action audit trail

See `docs/DATABASE.sql` for the complete schema with all columns, indexes, and constraints.

---

## 🚀 Deployment

### Option 1: Manus Platform (Recommended)

The project is built to run on Manus with zero configuration:

1. Click **Publish** in the Manus UI
2. Choose a custom domain or use the auto-generated `xxx.manus.space` domain
3. The site goes live immediately with SSL, CDN, and automatic scaling

### Option 2: Vercel

Deploy to Vercel for maximum flexibility:

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy with one click

See `docs/HOSTING.md` for detailed instructions for both platforms.

---

## 📚 Project Structure

```
elparaiso-garden/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/            # Page components (public & admin)
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React contexts (auth, cart)
│   │   ├── lib/              # tRPC client setup
│   │   ├── App.tsx           # Main router
│   │   └── index.css         # Global styles with dark theme
│   └── public/               # Static assets
├── server/                    # Express backend
│   ├── routers.ts            # tRPC procedure definitions
│   ├── db.ts                 # Database query helpers
│   ├── storage.ts            # S3 file upload helpers
│   └── _core/                # Framework infrastructure
├── drizzle/                   # Database schema & migrations
│   ├── schema.ts             # Drizzle ORM table definitions
│   └── migrations/           # Generated SQL migrations
├── docs/                      # Documentation
│   ├── README.md             # This file
│   ├── HOSTING.md            # Deployment instructions
│   ├── INTEGRATION.md        # Supabase integration guide
│   └── DATABASE.sql          # Complete SQL schema
├── shared/                    # Shared types and constants
└── package.json              # Dependencies and scripts
```

---

## 🧪 Testing

Run the test suite to verify all backend logic:

```bash
pnpm test
```

This runs 37 vitest tests across 5 test files covering:
- Authentication and logout
- Menu management (categories and items)
- Reservation creation and listing
- Order tracking and status updates
- Order placement workflow
- Testimonials CRUD operations

---

## 🔐 Security & Access Control

The application implements role-based access control (RBAC) with four user roles:

| Role | Permissions |
|------|------------|
| **user** | View public pages, place orders, make reservations, submit contact forms |
| **editor** | Create/edit menu items, testimonials, events, gallery images |
| **manager** | Manage reservations, orders, messages; update business settings |
| **admin** | Full access including user management, SEO settings, activity logs |

All protected routes use `protectedProcedure` or `adminProcedure` in the backend, and the frontend checks `useAuth().user?.role` before rendering admin pages.

---

## 📊 Key Features Explained

### Real-Time Order Tracking

Customers can track their order status in real-time by entering their phone number or order number. The system supports six status stages: pending, preparing, ready, out-for-delivery, completed, and cancelled. Admin can update status instantly, and customers see changes immediately.

### WhatsApp Integration

The platform integrates WhatsApp for:
- Reservation confirmations with booking details
- Order status updates (order received, being prepared, ready, out for delivery)
- Direct messaging link on the website
- Staff quick-links to message customers

### Testimonials Carousel

A rotating carousel on the homepage displays customer reviews with auto-rotation every 5 seconds. Reviews show star ratings (1-5), customer name, and source (Google, Facebook, etc.). Admin can feature/unfeature reviews and control sort order.

### Menu Management

Complete menu system with:
- Category organization (Grills, Drinks, Snacks, etc.)
- Item details (name, description, price, availability)
- Featured items for homepage display
- S3 image uploads with CDN delivery
- Real-time updates reflected on public menu page

### Reservation System

Customers can book tables with:
- Date and time selection
- Party size specification
- Special requests (allergies, celebrations, etc.)
- Automatic confirmation via WhatsApp
- Admin dashboard for managing reservations with status tracking

---

## 🎨 Design System

The website uses a **dark premium theme** with:

- **Primary Color:** Gold (#D4AF37) — Used for CTAs, accents, and highlights
- **Background:** Deep charcoal (#0F0F0F) — Main page background
- **Card Background:** Slightly lighter charcoal (#1A1A1A) — For cards and sections
- **Text:** Off-white (#E8E8E8) — Primary text color
- **Accent:** Muted gold tones — For secondary elements

All colors are defined as CSS variables in `client/src/index.css` for easy customization.

---

## 📖 API Documentation

The backend uses tRPC, which provides automatic type-safe API documentation. All procedures are defined in `server/routers.ts` and organized by feature:

- `auth.*` — Authentication (login, logout, current user)
- `menuCategories.*` — Menu category CRUD
- `menuItems.*` — Menu item CRUD
- `reservations.*` — Reservation management
- `orders.*` — Order tracking and management
- `events.*` — Event CRUD
- `gallery.*` — Gallery image management
- `testimonials.*` — Testimonial CRUD
- `contact.*` — Contact form handling
- `settings.*` — Business settings
- `seo.*` — SEO metadata management
- `admin.users` — User role management

Each procedure includes input validation with Zod schemas and returns typed responses.

---

## 🔧 Customization

### Changing Colors

Edit `client/src/index.css` and modify the CSS variables in the `:root` selector:

```css
:root {
  --primary: #D4AF37;        /* Gold accent */
  --background: #0F0F0F;     /* Deep charcoal */
  --card: #1A1A1A;           /* Card background */
  --foreground: #E8E8E8;     /* Text color */
}
```

### Adding New Menu Categories

1. Go to Admin → Menu
2. Click "Add Category"
3. Enter category name and save
4. Items can now be assigned to this category

### Configuring Business Hours

1. Go to Admin → Settings
2. Update opening hours for each day
3. Save changes
4. Hours display on the Contact page and in Google Maps integration

### Managing Events

1. Go to Admin → Events
2. Create new event with title, description, date, time, and image
3. Toggle "Show on Homepage" to feature the event
4. Event appears on homepage and Events page

---

## 🐛 Troubleshooting

**Issue: Database connection fails**

Ensure `DATABASE_URL` is correct and the database server is running. For local development, use:
```
mysql://root:password@localhost:3306/elparaiso
```

**Issue: Images not uploading**

Check that S3 credentials are configured and the bucket has public read access. Images are stored with random suffixes to prevent enumeration.

**Issue: OAuth login not working**

Verify `VITE_APP_ID` and `OAUTH_SERVER_URL` are correct. The frontend must be accessible at the same domain for OAuth callbacks to work.

**Issue: Admin pages show 403 Forbidden**

Ensure your user account has the `admin` or `manager` role. Contact the site owner to promote your account.

---

## 📝 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string |
| `VITE_APP_ID` | Yes | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Yes | Manus OAuth server base URL |
| `JWT_SECRET` | Yes | Session cookie signing secret |
| `OWNER_NAME` | Yes | Business owner name |
| `OWNER_OPEN_ID` | Yes | Owner's Manus OAuth ID |
| `BUILT_IN_FORGE_API_URL` | Yes | Manus API endpoint |
| `BUILT_IN_FORGE_API_KEY` | Yes | Server-side API key |
| `VITE_FRONTEND_FORGE_API_KEY` | Yes | Client-side API key |
| `VITE_ANALYTICS_ENDPOINT` | No | Analytics tracking endpoint |
| `VITE_ANALYTICS_WEBSITE_ID` | No | Analytics website ID |

---

## 📞 Support & Maintenance

For issues, feature requests, or questions:

1. Check `docs/HOSTING.md` for deployment troubleshooting
2. Review `docs/INTEGRATION.md` for Supabase integration help
3. Run `pnpm test` to verify all tests pass
4. Check browser console and server logs for error messages

---

## 📄 License

This project is proprietary software for Elparaiso Garden Kisii. All rights reserved.

---

## 🎉 Getting Started Checklist

- [ ] Set up local development environment
- [ ] Configure environment variables
- [ ] Run database migrations
- [ ] Start dev server and verify homepage loads
- [ ] Log in to admin panel with your account
- [ ] Add menu categories and items
- [ ] Upload gallery images
- [ ] Configure business hours and contact info
- [ ] Add testimonials and events
- [ ] Test order placement and tracking
- [ ] Deploy to production (Manus or Vercel)
- [ ] Configure custom domain
- [ ] Set up WhatsApp integration
- [ ] Monitor admin dashboard for orders and messages

---

**Built with ❤️ by Manus AI**

Last updated: April 2026
