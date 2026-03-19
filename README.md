# 🌿 Elparaiso Garden Vibes

<p align="center">
  <strong>A modern, responsive business website for Elparaiso Garden Kisii</strong><br/>
  A premium restaurant & lifestyle landing page built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui.
</p>

<p align="center">
  <a href="https://elparaisogardens.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Site-Vercel-000?style=for-the-badge&logo=vercel" alt="Live Site" />
  </a>
  <a href="https://github.com/victorkorir881-rgb/elparaiso-garden-vibes" target="_blank">
    <img src="https://img.shields.io/badge/Source%20Code-GitHub-181717?style=for-the-badge&logo=github" alt="GitHub Repo" />
  </a>
  <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-UI-06B6D4?style=for-the-badge&logo=tailwindcss" alt="Tailwind CSS" />
</p>

---

## 📌 Overview

**Elparaiso Garden Vibes** is a polished, mobile-first, single-page business website built for **Elparaiso Garden Kisii** — a vibrant 24/7 chill spot in Kisii, Kenya.

The website is designed to:
- attract local customers
- showcase the venue’s atmosphere and signature offerings
- highlight amenities and social proof
- encourage fast mobile conversion through **call**, **reserve**, and **visit** actions
- present the brand as modern, premium, and trustworthy

It blends a **restaurant/nightlife aesthetic** with strong UX patterns tailored for local hospitality businesses.

---

## 🌍 Live Project

- **Live Site:** https://elparaisogardens.vercel.app/
- **Repository:** https://github.com/victorkorir881-rgb/elparaiso-garden-vibes

---

## 🏢 Business Context

This project is built for:

### **Elparaiso Garden Kisii**
A lifestyle restaurant and entertainment destination in **Kisii, Kenya**, offering:
- great food
- nyama choma
- mutura
- drinks & cocktails
- garden ambiance
- live vibes
- car wash & dine convenience
- 24-hour availability

### Key Business Details
- **Business Name:** Elparaiso Garden Kisii
- **Brand Name:** ELPARAISO
- **Hours:** Open 24/7
- **Location:** County Government Street, Kisii
- **Phone:** `0791 224513`
- **WhatsApp:** `+254 791 224513`

> Business metadata is centralized in:  
> `src/config/siteConfig.ts`

---

## ✨ Features

### Core Website Experience
- ✅ Sticky responsive navigation bar
- ✅ Mobile hamburger menu
- ✅ Smooth-scroll section navigation
- ✅ Branded hero section with strong CTA hierarchy
- ✅ “24 Hours” business positioning
- ✅ Signature vibe / brand experience section
- ✅ Menu highlights with featured items
- ✅ Social proof / reviews section
- ✅ Amenities & service features
- ✅ Contact section with map embed
- ✅ Reservation form with validation
- ✅ Floating call-to-action buttons
- ✅ Mobile-first layout and responsive design
- ✅ Dark premium visual theme with warm accent colors

---

## 🧩 Main Sections

The homepage is structured as a modern single-page experience:

1. **Navbar**
2. **Hero Section**
3. **The Vibe / Experience**
4. **Menu Highlights**
5. **Reviews / Testimonials**
6. **Amenities**
7. **Contact + Reservation**
8. **Footer**
9. **Floating CTA**

---

## 🍽️ What the Site Promotes

### Service Modes
- Dine-In
- Takeaway
- Delivery
- Drive-Through

### Signature Highlights
- Great Choma
- Delicious Mutura
- Drinks & Cocktails
- Garden Atmosphere
- Live Music / DJ energy
- Car Wash & Dine Experience

---

## 🛠️ Tech Stack

This project is built using:

- **Vite**
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Radix UI**
- **React Router DOM**
- **React Hook Form**
- **Zod**
- **TanStack React Query**
- **Lucide React**
- **Vitest**
- **ESLint**

---

## 📁 Project Structure

```bash id="5r7q1x"
elparaiso-garden-vibes/
├── docs/                      # Supporting documentation
├── public/                    # Static assets (robots.txt, etc.)
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
│   │   └── siteConfig.ts      # Centralized business/site configuration
│   ├── hooks/
│   ├── pages/
│   │   ├── Index.tsx
│   │   └── NotFound.tsx
│   ├── services/
│   │   └── reservationService.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── components.json
├── package.json
├── tailwind.config.ts
├── vite.config.ts
├── netlify.toml
└── README.md
