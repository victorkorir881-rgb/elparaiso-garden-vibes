/**
 * siteConfig.ts — Single source of truth for all business metadata.
 * Update this file when any business detail changes; all components
 * derive their values from here.
 */

export const SITE_CONFIG = {
  business: {
    name: "Elparaiso Garden Kisii",
    shortName: "ELPARAISO",
    tagline: "Garden Kisii",
    description:
      "The ultimate chill spot in Kisii. Great food, cool music, and good vibes—open 24 hours.",
    hours: "Open 24/7",
    hoursDisplay: "Open 24 hours a day, 7 days a week",
  },

  contact: {
    /** Raw number for tel: links — no spaces */
    phoneRaw: "0791224513",
    /** Human-readable display format */
    phoneDisplay: "0791 224513",
    /** Full tel: href */
    phoneTelHref: "tel:0791224513",
    /** WhatsApp deep-link — update with country code if needed */
    whatsappHref: "https://wa.me/254791224513",
  },

  location: {
    streetAddress: "County Government Street, Kisii",
    plusCode: "8QCF+4R Kisii, Kenya",
    city: "Kisii",
    country: "Kenya",
    /**
     * TODO: Replace with the precise Google Maps embed URL for the venue.
     * Current URL points to central Kisii — needs validation with actual
     * place_id from Google Maps for Elparaiso Garden.
     */
    googleMapsEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.819449635268!2d34.76606!3d-0.67895!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182a907a6d11f00d%3A0x88e9ca0a5e2e9a00!2sKisii%2C%20Kenya!5e0!3m2!1sen!2sus!4v1690000000000!5m2!1sen!2sus",
  },

  /**
   * Navigation links — shared by Navbar and Footer to prevent anchor mismatch.
   * href values are the authoritative anchors; section id attributes must match.
   */
  navLinks: [
    { label: "Home", href: "#home" },
    { label: "The Vibe", href: "#vibe" },
    { label: "Menu", href: "#menu" },
    { label: "Reviews", href: "#reviews" },
    { label: "Contact", href: "#contact" },
  ] as const,

  /**
   * Social links — set href to real URLs when available.
   * Set enabled: false to hide an icon rather than render a dead # link.
   */
  socialLinks: [
    {
      label: "Facebook",
      /** TODO: Replace with actual Facebook page URL */
      href: null,
      enabled: false,
    },
    {
      label: "Instagram",
      /** TODO: Replace with actual Instagram profile URL */
      href: null,
      enabled: false,
    },
    {
      label: "X",
      /** TODO: Replace with actual X (Twitter) profile URL */
      href: null,
      enabled: false,
    },
  ] as const,
} as const;

export type NavLink = (typeof SITE_CONFIG.navLinks)[number];
export type SocialLink = (typeof SITE_CONFIG.socialLinks)[number];
