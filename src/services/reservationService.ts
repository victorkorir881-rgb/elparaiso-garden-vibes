/**
 * reservationService.ts
 *
 * Service layer for reservation form submissions.
 * Currently implements a client-side stub that simulates network latency.
 *
 * TODO: Replace `submitReservation` body with a real integration:
 *   - Option A: Supabase insert → supabase.from('reservations').insert(data)
 *   - Option B: POST to an email API (e.g. Resend, EmailJS)
 *   - Option C: WhatsApp Business API / webhook
 *
 * The form component (ContactSection) calls this function and handles
 * success/failure UI — no changes to the form are needed when wiring a backend.
 */

import { z } from "zod";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const reservationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters." })
    .max(100, { message: "Name must be less than 100 characters." }),

  phone: z
    .string()
    .trim()
    .min(9, { message: "Enter a valid Kenyan phone number." })
    .max(15, { message: "Phone number is too long." })
    .regex(/^(?:\+254|0)[17]\d{8}$/, {
      message: "Enter a valid Kenyan number (e.g. 0712 345678 or +254712345678).",
    }),

  datetime: z
    .string()
    .min(1, { message: "Please select a date and time." })
    .refine(
      (val) => {
        const selected = new Date(val);
        return selected > new Date();
      },
      { message: "Reservation must be in the future." },
    ),

  notes: z
    .string()
    .trim()
    .max(500, { message: "Notes must be less than 500 characters." })
    .optional(),
});

export type ReservationFormData = z.infer<typeof reservationSchema>;

// ─── Service function ─────────────────────────────────────────────────────────

/**
 * Submit a reservation request.
 *
 * @param data - Validated form data conforming to ReservationFormData
 * @throws  Will throw if the submission fails
 */
export async function submitReservation(data: ReservationFormData): Promise<void> {
  // TODO: Replace this stub with a real backend call (see file header).
  // Simulating async network delay for UI testing purposes.
  await new Promise<void>((resolve) => setTimeout(resolve, 1200));

  // Uncomment to simulate a server-side failure during development:
  // throw new Error("Simulated server error");

  // In production: log to an observability service, not the console.
  // console.log("[reservationService] Submitted:", data);
  void data; // suppress unused-variable warning until real impl lands
}
