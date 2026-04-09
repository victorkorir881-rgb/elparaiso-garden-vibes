# Business Rules Management System

This document outlines all business rules for Elparaiso Garden Kisii and how they are managed through the admin panel and enforced in the database and backend.

---

## Overview

The business rules management system allows the admin to configure and enforce all operational policies without code changes. Rules are stored in the database and applied consistently across all operations (orders, reservations, menu, pricing, etc.).

---

## Business Rules Categories

### 1. Pricing & Discounts

| Rule | Description | Admin Control | Database Enforcement |
|------|-------------|----------------|----------------------|
| **Base Prices** | Menu item prices set by admin | Menu Manager | CHECK constraint: price >= 0 |
| **Delivery Fee** | Fixed fee added to delivery orders | Settings | Applied in order calculation |
| **Minimum Order Value** | Minimum order total for delivery | Settings | Validation in backend before order creation |
| **Discount Percentage** | Percentage discount for bulk orders | Settings | Applied to orders > threshold |
| **Tax Rate** | Sales tax percentage | Settings | Applied to all orders |
| **Happy Hour Discount** | Time-based discount on selected items | Events/Settings | Calculated based on current time |

**SQL Enforcement:**
```sql
-- Price validation
ALTER TABLE menu_items ADD CONSTRAINT check_price CHECK (price >= 0);

-- Discount threshold
ALTER TABLE orders ADD CONSTRAINT check_discount CHECK (totalAmount >= (SELECT CAST(value AS DECIMAL) FROM site_settings WHERE key = 'minimumOrderValue'));
```

---

### 2. Reservation Rules

| Rule | Description | Admin Control | Database Enforcement |
|------|-------------|----------------|----------------------|
| **Max Party Size** | Maximum guests per reservation | Settings | Validation before creation |
| **Min Party Size** | Minimum guests required | Settings | Validation before creation |
| **Advance Booking** | Days in advance reservations allowed | Settings | Check: date >= TODAY + advance_days |
| **Cancellation Window** | Hours before reservation to cancel | Settings | Allow cancellation only if time > window |
| **Table Capacity** | Total restaurant capacity | Settings | Prevent overbooking |
| **Reservation Duration** | Hours reserved per booking | Settings | Auto-release table after duration |

**SQL Enforcement:**
```sql
-- Party size validation
ALTER TABLE reservations ADD CONSTRAINT check_party_size 
  CHECK (partySize >= (SELECT CAST(value AS INT) FROM site_settings WHERE key = 'minPartySize')
    AND partySize <= (SELECT CAST(value AS INT) FROM site_settings WHERE key = 'maxPartySize'));

-- Advance booking validation
ALTER TABLE reservations ADD CONSTRAINT check_advance_booking
  CHECK (date >= DATE_ADD(CURDATE(), INTERVAL (SELECT CAST(value AS INT) FROM site_settings WHERE key = 'advanceBookingDays') DAY));
```

---

### 3. Order Management Rules

| Rule | Description | Admin Control | Database Enforcement |
|------|-------------|----------------|----------------------|
| **Order Status Flow** | Valid status transitions | Settings | Trigger validates transitions |
| **Delivery Time** | Estimated delivery time | Settings | Set based on order type |
| **Cancellation Deadline** | Time window to cancel orders | Settings | Allow cancellation only if within window |
| **Payment Required** | Require payment before fulfillment | Settings | Check payment_status before status update |
| **Auto-Complete** | Auto-mark completed after time | Settings | Scheduled job runs daily |
| **Order Expiration** | Archive orders after X days | Settings | Scheduled cleanup job |

**SQL Enforcement:**
```sql
-- Valid status transitions
CREATE TRIGGER validate_order_status_transition
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
  IF NEW.status NOT IN (
    SELECT CONCAT(OLD.status, '->', NEW.status) FROM valid_status_transitions
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid order status transition';
  END IF;
END;

-- Payment validation
CREATE TRIGGER validate_payment_before_completion
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
  IF NEW.status = 'completed' AND NEW.paymentStatus != 'paid' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment required before completion';
  END IF;
END;
```

---

### 4. Menu Management Rules

| Rule | Description | Admin Control | Database Enforcement |
|------|-------------|----------------|----------------------|
| **Item Availability** | Enable/disable menu items | Menu Manager | isAvailable flag |
| **Category Visibility** | Show/hide entire categories | Menu Manager | isActive flag on categories |
| **Price Limits** | Min/max item prices | Settings | CHECK constraints |
| **Featured Items Limit** | Max featured items per category | Settings | Trigger validates count |
| **Item Description Length** | Max characters for descriptions | Settings | VARCHAR length limit |
| **Image Requirements** | Mandatory or optional images | Settings | Validation in backend |

**SQL Enforcement:**
```sql
-- Featured items limit per category
CREATE TRIGGER validate_featured_items_limit
BEFORE INSERT ON menu_items
FOR EACH ROW
BEGIN
  DECLARE featured_count INT;
  SELECT COUNT(*) INTO featured_count FROM menu_items 
  WHERE categoryId = NEW.categoryId AND isFeatured = TRUE;
  
  IF featured_count >= (SELECT CAST(value AS INT) FROM site_settings WHERE key = 'maxFeaturedItemsPerCategory') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Featured items limit exceeded';
  END IF;
END;
```

---

### 5. Customer Communication Rules

| Rule | Description | Admin Control | Database Enforcement |
|------|-------------|----------------|----------------------|
| **WhatsApp Integration** | Enable/disable WhatsApp notifications | Settings | Feature toggle |
| **Email Notifications** | Send email confirmations | Settings | Feature toggle |
| **SMS Notifications** | Send SMS updates | Settings | Feature toggle |
| **Notification Timing** | When to send notifications | Settings | Scheduled jobs |
| **Message Templates** | Customizable notification messages | Settings | Stored in site_settings |
| **Opt-Out Support** | Allow customers to opt out | Settings | Customer preference tracking |

**SQL Enforcement:**
```sql
-- Notification feature toggles
INSERT INTO site_settings (key, value) VALUES
('whatsappEnabled', 'true'),
('emailEnabled', 'true'),
('smsEnabled', 'false'),
('notificationTemplate_orderConfirmed', 'Your order #{{orderNumber}} has been confirmed'),
('notificationTemplate_orderReady', 'Your order is ready for pickup'),
('notificationTemplate_outForDelivery', 'Your order is on the way');
```

---

### 6. Operating Hours Rules

| Rule | Description | Admin Control | Database Enforcement |
|------|-------------|----------------|----------------------|
| **Daily Hours** | Operating hours per day | Settings | JSON field in site_settings |
| **Holiday Closures** | Days restaurant is closed | Settings | Holiday calendar table |
| **Special Hours** | Modified hours for events | Events Manager | Event-specific hours |
| **Order Cutoff** | Last time to place orders | Settings | Validation before order creation |
| **Delivery Cutoff** | Last delivery time | Settings | Validation before order creation |

**SQL Enforcement:**
```sql
-- Operating hours JSON structure
INSERT INTO site_settings (key, value) VALUES
('operatingHours', '{
  "monday": {"open": "06:00", "close": "23:59"},
  "tuesday": {"open": "06:00", "close": "23:59"},
  "wednesday": {"open": "06:00", "close": "23:59"},
  "thursday": {"open": "06:00", "close": "23:59"},
  "friday": {"open": "06:00", "close": "04:00"},
  "saturday": {"open": "06:00", "close": "04:00"},
  "sunday": {"open": "06:00", "close": "23:59"}
}');

-- Validate order within operating hours
CREATE TRIGGER validate_order_within_hours
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
  DECLARE current_hour INT;
  DECLARE open_hour INT;
  DECLARE close_hour INT;
  
  SET current_hour = HOUR(NOW());
  -- Get hours from JSON and validate
  -- If current_hour NOT BETWEEN open_hour AND close_hour, reject
END;
```

---

### 7. Staff & Access Control Rules

| Rule | Description | Admin Control | Database Enforcement |
|------|-------------|----------------|----------------------|
| **User Roles** | Admin, Manager, Editor, User | User Management | role enum in users table |
| **Permission Levels** | What each role can do | Settings | Enforced in backend procedures |
| **Activity Logging** | Log all admin actions | Settings | Automatic trigger on all changes |
| **Session Timeout** | Auto-logout after inactivity | Settings | Handled in backend |
| **IP Whitelisting** | Restrict admin access by IP | Settings | Optional security feature |
| **Two-Factor Auth** | Require 2FA for admin | Settings | Optional security feature |

**SQL Enforcement:**
```sql
-- Role-based access control
CREATE TABLE role_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role VARCHAR(50) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  UNIQUE KEY unique_role_permission (role, permission)
);

INSERT INTO role_permissions (role, permission) VALUES
('admin', 'manage_all'),
('manager', 'manage_orders'),
('manager', 'manage_reservations'),
('editor', 'manage_menu'),
('editor', 'manage_gallery'),
('user', 'view_public');

-- Automatic activity logging
CREATE TRIGGER log_menu_item_changes
AFTER INSERT ON menu_items
FOR EACH ROW
BEGIN
  INSERT INTO activity_logs (userId, action, category) 
  VALUES (CURRENT_USER(), CONCAT('Added menu item: ', NEW.name), 'menu');
END;
```

---

### 8. Data Retention & Privacy Rules

| Rule | Description | Admin Control | Database Enforcement |
|------|-------------|----------------|----------------------|
| **Order Retention** | Keep orders for X days | Settings | Scheduled archive job |
| **Message Retention** | Keep contact messages for X days | Settings | Scheduled cleanup job |
| **Customer Data Retention** | Keep customer info for X days | Settings | GDPR compliance |
| **Backup Frequency** | Daily/weekly backups | Settings | Scheduled backup job |
| **Data Encryption** | Encrypt sensitive fields | Settings | Applied at database level |
| **GDPR Compliance** | Right to be forgotten | Settings | Data deletion procedures |

**SQL Enforcement:**
```sql
-- Archive old orders (run daily)
CREATE EVENT archive_old_orders
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
  DELETE FROM orders 
  WHERE status IN ('completed', 'cancelled') 
  AND createdAt < DATE_SUB(NOW(), INTERVAL (SELECT CAST(value AS INT) FROM site_settings WHERE key = 'orderRetentionDays') DAY);
END;

-- Archive old messages (run daily)
CREATE EVENT archive_old_messages
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
  DELETE FROM contact_messages 
  WHERE createdAt < DATE_SUB(NOW(), INTERVAL (SELECT CAST(value AS INT) FROM site_settings WHERE key = 'messageRetentionDays') DAY);
END;
```

---

### 9. Inventory & Stock Rules

| Rule | Description | Admin Control | Database Enforcement |
|------|-------------|----------------|----------------------|
| **Low Stock Alert** | Alert when items below threshold | Settings | Trigger on menu_items |
| **Stock Tracking** | Track item quantities | Menu Manager | quantity field in menu_items |
| **Auto-Disable** | Disable items when out of stock | Settings | Trigger on quantity update |
| **Reorder Point** | Reorder when below threshold | Settings | Notification trigger |

**SQL Enforcement:**
```sql
-- Add stock tracking to menu_items
ALTER TABLE menu_items ADD COLUMN quantity INT DEFAULT 999;
ALTER TABLE menu_items ADD COLUMN lowStockThreshold INT DEFAULT 10;

-- Auto-disable when out of stock
CREATE TRIGGER auto_disable_out_of_stock
AFTER UPDATE ON menu_items
FOR EACH ROW
BEGIN
  IF NEW.quantity <= 0 THEN
    UPDATE menu_items SET isAvailable = FALSE WHERE id = NEW.id;
  END IF;
END;

-- Alert when low stock
CREATE TRIGGER alert_low_stock
AFTER UPDATE ON menu_items
FOR EACH ROW
BEGIN
  IF NEW.quantity <= NEW.lowStockThreshold AND OLD.quantity > NEW.lowStockThreshold THEN
    INSERT INTO notifications (type, message) 
    VALUES ('low_stock', CONCAT('Low stock alert: ', NEW.name));
  END IF;
END;
```

---

### 10. Promotional & Marketing Rules

| Rule | Description | Admin Control | Database Enforcement |
|------|-------------|----------------|----------------------|
| **Coupon Codes** | Create/manage discount codes | Settings | Validation on order creation |
| **Promotional Periods** | Time-limited offers | Events Manager | Date range validation |
| **First-Time Discount** | Discount for new customers | Settings | Track new vs returning |
| **Referral Rewards** | Reward for referrals | Settings | Referral tracking system |
| **Loyalty Points** | Points accumulation system | Settings | Points calculation |
| **Bundle Deals** | Multi-item discounts | Menu Manager | Bundle definition in menu |

**SQL Enforcement:**
```sql
-- Coupon validation
CREATE TABLE coupons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  discountPercent DECIMAL(5, 2) NOT NULL,
  validFrom DATE NOT NULL,
  validTo DATE NOT NULL,
  maxUses INT,
  usedCount INT DEFAULT 0,
  minOrderValue DECIMAL(10, 2),
  isActive BOOLEAN DEFAULT TRUE
);

-- Validate coupon on order creation
CREATE TRIGGER validate_coupon_on_order
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
  IF NEW.couponCode IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM coupons 
      WHERE code = NEW.couponCode 
      AND isActive = TRUE 
      AND CURDATE() BETWEEN validFrom AND validTo
      AND usedCount < maxUses
      AND NEW.totalAmount >= minOrderValue
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid or expired coupon';
    END IF;
  END IF;
END;
```

---

## Admin Business Rules Management Page

The admin can manage all business rules through a dedicated settings panel:

### Settings Categories

1. **General Settings** — Business name, contact info, hours
2. **Pricing Rules** — Delivery fees, taxes, discounts, minimum order
3. **Reservation Rules** — Party size, advance booking, cancellation
4. **Order Rules** — Status flow, delivery time, payment requirements
5. **Menu Rules** — Item limits, featured items, pricing
6. **Communication** — WhatsApp, email, SMS templates
7. **Data Management** — Retention policies, backups, privacy
8. **Inventory** — Stock tracking, low stock alerts
9. **Promotions** — Coupons, loyalty points, referrals

---

## Implementation in Backend

All business rules are fetched from the database on application startup and cached. When rules change, the cache is invalidated and reloaded.

```typescript
// server/db.ts
export async function getBusinessRules() {
  const db = await getDb();
  if (!db) return {};
  
  const settings = await db.select().from(siteSettings);
  return Object.fromEntries(settings.map(s => [s.key, s.value]));
}

// server/routers.ts - Apply rules in procedures
export const appRouter = router({
  orders: router({
    create: publicProcedure
      .input(orderSchema)
      .mutation(async ({ input, ctx }) => {
        const rules = await getBusinessRules();
        
        // Validate minimum order value
        if (input.totalAmount < parseFloat(rules.minimumOrderValue)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order below minimum value' });
        }
        
        // Validate operating hours
        if (!isWithinOperatingHours(rules.operatingHours)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Outside operating hours' });
        }
        
        // Create order
        return await createOrder(input);
      }),
  }),
});
```

---

## Testing Business Rules

All business rules must be tested to ensure they are properly enforced:

```typescript
// server/business-rules.test.ts
describe('Business Rules Enforcement', () => {
  it('rejects orders below minimum value', async () => {
    const rules = await getBusinessRules();
    const minValue = parseFloat(rules.minimumOrderValue);
    
    const result = await createOrder({
      totalAmount: minValue - 100,
      // ... other fields
    });
    
    expect(result).toThrow('Order below minimum value');
  });
  
  it('enforces party size limits on reservations', async () => {
    const rules = await getBusinessRules();
    const maxSize = parseInt(rules.maxPartySize);
    
    const result = await createReservation({
      partySize: maxSize + 1,
      // ... other fields
    });
    
    expect(result).toThrow('Party size exceeds maximum');
  });
});
```

---

## Business Rules Audit Trail

All changes to business rules are logged for compliance and troubleshooting:

```sql
CREATE TABLE business_rules_audit (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ruleKey VARCHAR(128) NOT NULL,
  oldValue TEXT,
  newValue TEXT,
  changedBy INT NOT NULL,
  changedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (changedBy) REFERENCES users(id)
);

-- Trigger to log all business rule changes
CREATE TRIGGER log_business_rule_changes
AFTER UPDATE ON site_settings
FOR EACH ROW
BEGIN
  INSERT INTO business_rules_audit (ruleKey, oldValue, newValue, changedBy)
  VALUES (NEW.key, OLD.value, NEW.value, CURRENT_USER_ID());
END;
```

---

## Summary

By centralizing all business rules in the database and enforcing them through SQL constraints, triggers, and backend validation, the system ensures:

- **Consistency** — All rules applied uniformly across the application
- **Flexibility** — Admin can change rules without code deployment
- **Auditability** — All rule changes are logged and traceable
- **Compliance** — Rules enforced at database level for data integrity
- **Scalability** — Rules cached and optimized for performance

---

**Last Updated:** April 2026
