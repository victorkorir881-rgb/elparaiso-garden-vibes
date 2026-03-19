# Elparaiso Garden Vibes

A modern, responsive landing page for **Elparaiso Garden Kisii** — a 24/7 chill spot in Kisii, Kenya featuring great food, nyama choma, mutura, cocktails, music, garden vibes, and a unique **car wash & dine** experience.

**Live Site:** https://elparaisogardens.vercel.app/  
**Repository:** https://github.com/victorkorir881-rgb/elparaiso-garden-vibes

---

## Overview

**Elparaiso Garden Vibes** is a production-ready React + TypeScript marketing website built for **Elparaiso Garden Kisii**.

The site is designed to:
- Showcase the venue’s brand and atmosphere
- Highlight signature menu items
- Display amenities and social proof
- Help guests quickly **call**, **reserve**, or **visit**
- Provide a polished mobile-first experience for local customers

This project uses a clean single-page layout with anchored navigation and strong call-to-actions tailored for a hospitality/nightlife/restaurant business.

---

## Business Details

- **Business Name:** Elparaiso Garden Kisii
- **Brand Name:** ELPARAISO
- **Tagline:** Garden Kisii
- **Description:** The ultimate chill spot in Kisii. Great food, cool music, and good vibes—open 24 hours.
- **Hours:** Open 24/7
- **Phone:** `0791 224513`
- **Call Link:** `tel:0791224513`
- **WhatsApp:** `https://wa.me/254791224513`
- **Address:** County Government Street, Kisii
- **Plus Code:** `8QCF+4R Kisii, Kenya`
- **City:** Kisii
- **Country:** Kenya

> All core business metadata is centralized in:
>
> `src/config/siteConfig.ts`

---

## Features

### Core Website Sections
- **Sticky Navbar**
  - Desktop + mobile menu
  - Smooth anchor navigation
  - Quick “Call Now” action

- **Hero Section**
  - Strong brand-first landing experience
  - 24-hour badge
  - Primary CTAs:
    - Make a Reservation
    - View Menu Highlights

- **The Vibe / Experience Section**
  - Highlights the Elparaiso atmosphere
  - Promotes:
    - Dine-In
    - Takeaway
    - Delivery
    - Drive-Through
  - Features the unique **Car Wash & Dine Experience**

- **Menu Highlights Section**
  - Signature offerings:
    - Great Choma
    - Delicious Mutura
    - Drinks & Cocktails
  - Includes pricing ranges and service options

- **Guest Reviews Section**
  - Curated testimonial cards
  - Mobile review carousel
  - “Based on Google Reviews” style social proof

- **Amenities & Features Section**
  - Open 24 Hours
  - Wheelchair Accessible
  - Free Ample Parking
  - NFC & Card Payments
  - Full Table Service
  - Reservations Accepted
  - Live Music & DJ
  - Garden Atmosphere

- **Contact + Reservation Section**
  - Contact details
  - Embedded Google Map
  - Reservation form with validation

- **Footer**
  - Quick links
  - Contact info
  - Brand summary
  - Optional social links (hidden until configured)

- **Floating CTA**
  - Persistent mobile-friendly action buttons
  - Call Now
  - Reserve

---

## Reservation Form (Important)

The reservation form is **fully built on the frontend** and includes validation using **Zod + React Hook Form**, but:

> ⚠️ **It is NOT connected to a real backend yet.**

### Current status
The form currently uses a **client-side async stub** in:

`src/services/reservationService.ts`

It simulates a network request for UI testing purposes.

### Validation rules currently implemented
- **Name:** 2–100 characters
- **Phone:** Valid Kenyan number only  
  Accepted formats:
  - `07XXXXXXXX`
  - `+2547XXXXXXXX`
- **Date & Time:** Must be in the future
- **Notes:** Optional, max 500 characters

### Recommended production integrations
Replace the current stub with one of these:
- **Supabase** (recommended)
- **Resend / Email API**
- **EmailJS**
- **WhatsApp Business API**
- **Webhook / custom backend endpoint**

---

## Tech Stack

This project is built with:

- **Vite**
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Radix UI**
- **React Hook Form**
- **Zod**
- **React Router DOM**
- **TanStack React Query**
- **Lucide React**
- **Vitest**
- **ESLint**

---

## Project Structure

```bash
elparaiso-garden-vibes/
├── docs/                      # Project docs / supporting documentation
├── public/                    # Static public assets (robots.txt, etc.)
├── src/
│   ├── assets/                # Images and media assets
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── HeroSection.tsx
│   │   ├── VibeSection.tsx
│   │   ├── MenuSection.tsx
│   │   ├── ReviewsSection.tsx
│   │   ├── AmenitiesSection.tsx
│   │   ├── ContactSection.tsx
│   │   ├── Footer.tsx
│   │   ├── FloatingCTA.tsx
│   │   └── ui/                # shadcn/ui components
│   ├── config/
│   │   └── siteConfig.ts      # Single source of truth for business metadata
│   ├── hooks/
│   │   └── use-toast.ts
│   ├── pages/
│   │   ├── Index.tsx
│   │   └── NotFound.tsx
│   ├── services/
│   │   └── reservationService.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── components.json            # shadcn/ui config
├── package.json
├── tailwind.config.ts
├── vite.config.ts
├── netlify.toml               # SPA fallback config (legacy/optional)
└── README.md
