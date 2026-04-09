# Elparaiso Garden Kisii — Project TODO

## Phase 1: Database & Schema
- [x] Define Drizzle schema for all 11 tables
- [x] Run migration and apply to database
- [x] Seed default site_settings entries

## Phase 2: Theme, Layout & Routing
- [x] Dark premium theme CSS variables (charcoal/gold/ivory)
- [x] Google Fonts (Playfair Display + Inter)
- [x] Public layout with sticky header, mobile drawer, footer
- [x] Admin layout with sidebar navigation and auth guard
- [x] App.tsx routing for all public + admin pages

## Phase 3: Backend tRPC Routers
- [x] site_settings router (get/update)
- [x] menu_categories router (CRUD)
- [x] menu_items router (CRUD, featured toggle, availability, image upload)
- [x] reservations router (create public, CRUD admin)
- [x] events router (CRUD, toggle active/homepage, image upload)
- [x] gallery router (CRUD, upload, category)
- [x] testimonials router (CRUD, featured toggle)
- [x] contact_messages router (create public, list/update/delete admin)
- [x] seo_settings router (get/update per page)
- [x] admin_users router (list, role management)
- [x] activity_log router (write/read)
- [x] Owner notification on new reservation/contact

## Phase 4: Public Pages
- [x] Home page (Hero, Features, Featured Menu, Gallery Preview, Events Preview, Testimonials, Location CTA)
- [x] Menu page (category tabs, search, dietary filters, item cards)
- [x] About page (brand story, values, team, stats)
- [x] Gallery page (masonry grid, lightbox, category filter)
- [x] Contact page (form, map embed, WhatsApp CTA)
- [x] Reservations page (form, confirmation state)
- [x] Events page (event cards, offer badges)
- [x] Privacy Policy page
- [x] Terms page
- [x] WhatsApp floating CTA on all public pages

## Phase 5: Admin Panel
- [x] Admin login page (Manus OAuth)
- [x] Admin dashboard (stats cards, recent reservations, activity log, quick actions)
- [x] Menu manager (categories + items CRUD, image upload, featured/availability toggles)
- [x] Reservations manager (table, filter by status/date, search, status update, WhatsApp link)
- [x] Events manager (CRUD, active/featured/homepage toggles, image upload)
- [x] Gallery manager (image upload, categories, featured toggle, delete)
- [x] Testimonials manager (CRUD, rating, featured toggle)
- [x] Messages manager (list, read/unread, reply via email/WhatsApp, delete)
- [x] Business settings panel (6 tabs: general, contact, social, hours, features, hero)
- [x] SEO settings panel (per-page metadata, OG tags, preview)
- [x] Users/roles panel (admin only)

## Phase 6: Documentation
- [x] docs/supabase_schema.sql — Complete PostgreSQL schema with RLS policies
- [x] docs/INTEGRATION.md — Full integration and setup guide

## Phase 7: QA & Delivery
- [x] Vitest tests: 21 tests passing (2 test files)
- [x] TypeScript: 0 errors
- [x] CSS @import order fixed
- [x] Checkpoint and deliver

## Post-Deployment Tasks (Owner)
- [ ] Configure real business data in Admin → Settings
- [ ] Set WhatsApp number in Settings → Contact
- [ ] Upload gallery photos via Admin → Gallery
- [ ] Add menu categories and items via Admin → Menu
- [ ] Publish via Manus UI Publish button


## Order Tracking Feature (Complete)
- [x] Add Orders table to Drizzle schema
- [x] Run migration for Orders table
- [x] Add order management query helpers in server/db.ts
- [x] Add orders tRPC router (create, list, update, tracking by phone)
- [x] Build OrderTrackingPage (public, phone lookup, status display)
- [x] Build OrderTrackingAdmin page (staff dashboard to manage orders)
- [x] Add order tracking tests (5 tests passing)
- [x] Update documentation with order tracking feature
- [ ] Save checkpoint


## Order Placement Feature (Complete)
- [x] Create OrderPage component with menu browser and cart
- [x] Add cart context for state management
- [x] Add route to App.tsx
- [x] Link from public pages navigation
- [x] Test end-to-end order flow (6 new tests, all passing)
- [x] Save checkpoint


## Bug Fixes
- [x] Fix navbar item overlap - ensure proper spacing in header layout


## Testimonials Carousel Feature (Complete)
- [x] Add testimonials backend query helpers in server/db.ts
- [x] Add testimonials tRPC router (list, create, update, delete, approve)
- [x] Build TestimonialsCarousel component with auto-rotation
- [x] Integrate carousel into HomePage
- [x] Write testimonials tests (5 tests passing)
- [ ] Save checkpoint


## Business Rules Management (Complete)
- [x] Document all business rules in BUSINESS_RULES.md
- [x] Create business_rules table in database schema
- [x] Add SQL constraints and triggers for rule enforcement
- [x] Create AdminBusinessRules page for managing all business rules
- [x] Update backend routers to enforce rules from database
- [x] Add business rule validation to all CRUD operations
- [x] Write tests for business rule enforcement
- [ ] Save checkpoint


## Bug Fixes (Current)
- [x] Fix /admin/menu 404 routing error - changed Route path to /admin/* with wildcard matching


## M-Pesa Payment Integration (In Progress)
- [ ] Add Payments table to Drizzle schema
- [ ] Run migration for Payments table
- [ ] Create Flutterwave payment backend with tRPC routers
- [ ] Add payment UI to OrderPage checkout
- [ ] Add payment UI to ReservationsPage checkout
- [ ] Implement webhook handling for payment status updates
- [ ] Add payment tracking and status management
- [ ] Write payment integration tests
- [ ] Save checkpoint
