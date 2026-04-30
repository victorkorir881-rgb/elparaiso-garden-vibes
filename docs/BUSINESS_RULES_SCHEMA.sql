-- ============================================================================
-- BUSINESS RULES ENFORCEMENT SCHEMA
-- ============================================================================
-- This SQL file extends the main schema with business rules tables, triggers,
-- and constraints to enforce all business logic at the database level.
-- Run this AFTER the main DATABASE.sql file.
--
-- Database: MySQL 8.0+ or MariaDB 10.5+
-- Created: April 2026
-- ============================================================================

-- ============================================================================
-- BUSINESS RULES AUDIT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS `business_rules_audit` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `ruleKey` VARCHAR(128) NOT NULL,
  `oldValue` TEXT,
  `newValue` TEXT,
  `changedBy` INT,
  `changedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (changedBy) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_ruleKey (ruleKey),
  INDEX idx_changedAt (changedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VALID ORDER STATUS TRANSITIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS `valid_status_transitions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `fromStatus` ENUM('pending', 'preparing', 'ready', 'out-for-delivery', 'completed', 'cancelled') NOT NULL,
  `toStatus` ENUM('pending', 'preparing', 'ready', 'out-for-delivery', 'completed', 'cancelled') NOT NULL,
  UNIQUE KEY unique_transition (fromStatus, toStatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert valid order status transitions
INSERT IGNORE INTO `valid_status_transitions` (fromStatus, toStatus) VALUES
('pending', 'preparing'),
('pending', 'cancelled'),
('preparing', 'ready'),
('preparing', 'cancelled'),
('ready', 'out-for-delivery'),
('ready', 'completed'),
('ready', 'cancelled'),
('out-for-delivery', 'completed'),
('out-for-delivery', 'cancelled');

-- ============================================================================
-- ROLE PERMISSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `role` ENUM('user', 'admin', 'manager', 'editor') NOT NULL,
  `permission` VARCHAR(100) NOT NULL,
  UNIQUE KEY unique_role_permission (role, permission)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert role-based permissions
INSERT IGNORE INTO `role_permissions` (role, permission) VALUES
-- Admin: Full access
('admin', 'manage_all'),
('admin', 'manage_users'),
('admin', 'manage_settings'),
('admin', 'manage_business_rules'),
('admin', 'view_analytics'),
('admin', 'view_audit_logs'),

-- Manager: Operational management
('manager', 'manage_orders'),
('manager', 'manage_reservations'),
('manager', 'manage_events'),
('manager', 'manage_testimonials'),
('manager', 'view_messages'),
('manager', 'manage_gallery'),

-- Editor: Content management
('editor', 'manage_menu'),
('editor', 'manage_gallery'),
('editor', 'manage_events'),
('editor', 'manage_testimonials'),

-- User: Read-only access
('user', 'view_public');

-- ============================================================================
-- COUPONS TABLE FOR PROMOTIONAL RULES
-- ============================================================================
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `description` TEXT,
  `discountType` ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  `discountValue` DECIMAL(10, 2) NOT NULL,
  `validFrom` DATE NOT NULL,
  `validTo` DATE NOT NULL,
  `maxUses` INT,
  `usedCount` INT DEFAULT 0,
  `minOrderValue` DECIMAL(10, 2) DEFAULT 0,
  `applicableCategories` JSON,
  `isActive` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_isActive (isActive),
  INDEX idx_validFrom (validFrom),
  INDEX idx_validTo (validTo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- HOLIDAYS TABLE FOR OPERATING HOURS RULES
-- ============================================================================
CREATE TABLE IF NOT EXISTS `holidays` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `date` DATE NOT NULL UNIQUE,
  `isClosed` BOOLEAN DEFAULT TRUE,
  `specialHours` JSON,
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date (date),
  INDEX idx_isClosed (isClosed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CUSTOMER PREFERENCES TABLE FOR COMMUNICATION RULES
-- ============================================================================
CREATE TABLE IF NOT EXISTS `customer_preferences` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(20) NOT NULL UNIQUE,
  `email` VARCHAR(320),
  `whatsappOptIn` BOOLEAN DEFAULT TRUE,
  `emailOptIn` BOOLEAN DEFAULT TRUE,
  `smsOptIn` BOOLEAN DEFAULT FALSE,
  `preferredLanguage` VARCHAR(10) DEFAULT 'en',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- LOYALTY POINTS TABLE FOR REWARDS RULES
-- ============================================================================
CREATE TABLE IF NOT EXISTS `loyalty_points` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(20) NOT NULL,
  `points` INT DEFAULT 0,
  `totalSpent` DECIMAL(10, 2) DEFAULT 0,
  `totalOrders` INT DEFAULT 0,
  `lastOrderDate` DATETIME,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_phone (phone),
  INDEX idx_points (points)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- LOYALTY TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS `loyalty_transactions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(20) NOT NULL,
  `points` INT NOT NULL,
  `type` ENUM('earn', 'redeem') NOT NULL,
  `orderId` INT,
  `description` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_phone (phone),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- INVENTORY TRACKING TABLE
-- ============================================================================
ALTER TABLE `menu_items` ADD COLUMN IF NOT EXISTS `quantity` INT DEFAULT 999;
ALTER TABLE `menu_items` ADD COLUMN IF NOT EXISTS `lowStockThreshold` INT DEFAULT 10;
ALTER TABLE `menu_items` ADD COLUMN IF NOT EXISTS `reorderQuantity` INT DEFAULT 50;

-- ============================================================================
-- INVENTORY TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS `inventory_transactions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `menuItemId` INT NOT NULL,
  `quantity` INT NOT NULL,
  `type` ENUM('sale', 'restock', 'adjustment', 'damage') NOT NULL,
  `orderId` INT,
  `notes` TEXT,
  `recordedBy` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menuItemId) REFERENCES menu_items(id) ON DELETE CASCADE,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (recordedBy) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_menuItemId (menuItemId),
  INDEX idx_type (type),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- NOTIFICATIONS TABLE FOR SYSTEM ALERTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT,
  `relatedEntityType` VARCHAR(50),
  `relatedEntityId` INT,
  `isRead` BOOLEAN DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_isRead (isRead),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CONSTRAINTS FOR BUSINESS RULES
-- ============================================================================

-- Menu items: Price validation
ALTER TABLE `menu_items` ADD CONSTRAINT check_price CHECK (price >= 0);

-- Menu items: Sort order validation
ALTER TABLE `menu_items` ADD CONSTRAINT check_sort_order CHECK (sortOrder >= 0);

-- Reservations: Party size validation (will be enforced in backend)
-- ALTER TABLE `reservations` ADD CONSTRAINT check_party_size CHECK (partySize > 0);

-- Orders: Total amount validation
ALTER TABLE `orders` ADD CONSTRAINT check_order_total CHECK (totalAmount >= 0);

-- Coupons: Discount value validation
ALTER TABLE `coupons` ADD CONSTRAINT check_discount_value CHECK (discountValue > 0);
ALTER TABLE `coupons` ADD CONSTRAINT check_coupon_dates CHECK (validFrom <= validTo);
ALTER TABLE `coupons` ADD CONSTRAINT check_coupon_uses CHECK (usedCount <= maxUses OR maxUses IS NULL);

-- Loyalty points: Non-negative points
ALTER TABLE `loyalty_points` ADD CONSTRAINT check_points CHECK (points >= 0);
ALTER TABLE `loyalty_points` ADD CONSTRAINT check_total_spent CHECK (totalSpent >= 0);

-- Inventory: Non-negative quantities
ALTER TABLE `menu_items` ADD CONSTRAINT check_quantity CHECK (quantity >= 0);
ALTER TABLE `inventory_transactions` ADD CONSTRAINT check_inventory_qty CHECK (quantity != 0);

-- ============================================================================
-- TRIGGERS FOR BUSINESS RULES ENFORCEMENT
-- ============================================================================

-- TRIGGER 1: Validate order status transitions
DELIMITER $$
CREATE TRIGGER validate_order_status_transition
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
  IF NEW.status != OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM valid_status_transitions 
      WHERE fromStatus = OLD.status AND toStatus = NEW.status
    ) THEN
      SIGNAL SQLSTATE '45000' 
      SET MESSAGE_TEXT = CONCAT('Invalid status transition from ', OLD.status, ' to ', NEW.status);
    END IF;
  END IF;
END$$
DELIMITER ;

-- TRIGGER 2: Validate payment before order completion
DELIMITER $$
CREATE TRIGGER validate_payment_before_completion
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
  IF NEW.status = 'completed' AND NEW.paymentStatus != 'paid' THEN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Payment required before marking order as completed';
  END IF;
END$$
DELIMITER ;

-- TRIGGER 3: Auto-disable menu items when out of stock
DELIMITER $$
CREATE TRIGGER auto_disable_out_of_stock
AFTER UPDATE ON menu_items
FOR EACH ROW
BEGIN
  IF NEW.quantity <= 0 AND OLD.isAvailable = TRUE THEN
    UPDATE menu_items SET isAvailable = FALSE WHERE id = NEW.id;
    INSERT INTO notifications (type, title, message) 
    VALUES ('out_of_stock', CONCAT(NEW.name, ' is out of stock'), 
            CONCAT('Menu item ', NEW.name, ' has been automatically disabled'));
  END IF;
END$$
DELIMITER ;

-- TRIGGER 4: Alert when inventory is low
DELIMITER $$
CREATE TRIGGER alert_low_stock
AFTER UPDATE ON menu_items
FOR EACH ROW
BEGIN
  IF NEW.quantity <= NEW.lowStockThreshold AND OLD.quantity > NEW.lowStockThreshold THEN
    INSERT INTO notifications (type, title, message) 
    VALUES ('low_stock', CONCAT(NEW.name, ' low stock'), 
            CONCAT(NEW.name, ' is below reorder threshold (', NEW.lowStockThreshold, ' units)'));
  END IF;
END$$
DELIMITER ;

-- TRIGGER 5: Log business rule changes
DELIMITER $$
CREATE TRIGGER log_business_rule_changes
AFTER UPDATE ON site_settings
FOR EACH ROW
BEGIN
  IF OLD.value != NEW.value THEN
    INSERT INTO business_rules_audit (ruleKey, oldValue, newValue) 
    VALUES (NEW.key, OLD.value, NEW.value);
  END IF;
END$$
DELIMITER ;

-- TRIGGER 6: Validate coupon usage
DELIMITER $$
CREATE TRIGGER validate_coupon_usage
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
  IF NEW.couponCode IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM coupons 
      WHERE code = NEW.couponCode 
      AND isActive = TRUE 
      AND CURDATE() BETWEEN validFrom AND validTo
      AND (maxUses IS NULL OR usedCount < maxUses)
      AND NEW.totalAmount >= minOrderValue
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid or expired coupon code';
    END IF;
  END IF;
END$$
DELIMITER ;

-- TRIGGER 7: Increment coupon usage count
DELIMITER $$
CREATE TRIGGER increment_coupon_usage
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  IF NEW.couponCode IS NOT NULL THEN
    UPDATE coupons SET usedCount = usedCount + 1 WHERE code = NEW.couponCode;
  END IF;
END$$
DELIMITER ;

-- TRIGGER 8: Track inventory on order creation
DELIMITER $$
CREATE TRIGGER track_inventory_on_order
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  DECLARE item_id INT;
  DECLARE item_qty INT;
  DECLARE idx INT DEFAULT 0;
  DECLARE json_length INT;
  
  SET json_length = JSON_LENGTH(NEW.items);
  
  WHILE idx < json_length DO
    SET item_id = JSON_EXTRACT(NEW.items, CONCAT('$[', idx, '].id'));
    SET item_qty = JSON_EXTRACT(NEW.items, CONCAT('$[', idx, '].quantity'));
    
    UPDATE menu_items SET quantity = quantity - item_qty WHERE id = item_id;
    
    INSERT INTO inventory_transactions (menuItemId, quantity, type, orderId) 
    VALUES (item_id, -item_qty, 'sale', NEW.id);
    
    SET idx = idx + 1;
  END WHILE;
END$$
DELIMITER ;

-- TRIGGER 9: Update loyalty points on order completion
DELIMITER $$
CREATE TRIGGER update_loyalty_points_on_order
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  DECLARE points_earned INT;
  DECLARE points_per_unit DECIMAL(5, 2) DEFAULT 1;
  
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SET points_earned = FLOOR(NEW.totalAmount * points_per_unit);
    
    INSERT INTO loyalty_points (phone, points, totalSpent, totalOrders, lastOrderDate)
    VALUES (NEW.customerPhone, points_earned, NEW.totalAmount, 1, NOW())
    ON DUPLICATE KEY UPDATE 
      points = points + VALUES(points),
      totalSpent = totalSpent + VALUES(totalSpent),
      totalOrders = totalOrders + 1,
      lastOrderDate = NOW();
    
    INSERT INTO loyalty_transactions (phone, points, type, orderId, description)
    VALUES (NEW.customerPhone, points_earned, 'earn', NEW.id, CONCAT('Order #', NEW.orderNumber));
  END IF;
END$$
DELIMITER ;

-- TRIGGER 10: Log activity on menu changes
DELIMITER $$
CREATE TRIGGER log_menu_item_creation
AFTER INSERT ON menu_items
FOR EACH ROW
BEGIN
  INSERT INTO activity_logs (userId, action, category) 
  VALUES (NULL, CONCAT('Added menu item: ', NEW.name, ' (', NEW.price, ')'), 'menu');
END$$
DELIMITER ;

-- TRIGGER 11: Log activity on menu item updates
DELIMITER $$
CREATE TRIGGER log_menu_item_update
AFTER UPDATE ON menu_items
FOR EACH ROW
BEGIN
  IF OLD.name != NEW.name OR OLD.price != NEW.price OR OLD.isAvailable != NEW.isAvailable THEN
    INSERT INTO activity_logs (userId, action, category) 
    VALUES (NULL, CONCAT('Updated menu item: ', NEW.name), 'menu');
  END IF;
END$$
DELIMITER ;

-- TRIGGER 12: Log activity on reservation creation
DELIMITER $$
CREATE TRIGGER log_reservation_creation
AFTER INSERT ON reservations
FOR EACH ROW
BEGIN
  INSERT INTO activity_logs (userId, action, category) 
  VALUES (NULL, CONCAT('New reservation: ', NEW.customerName, ' for ', NEW.partySize, ' people on ', NEW.date), 'reservations');
END$$
DELIMITER ;

-- TRIGGER 13: Log activity on order creation
DELIMITER $$
CREATE TRIGGER log_order_creation
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  INSERT INTO activity_logs (userId, action, category) 
  VALUES (NULL, CONCAT('New order: #', NEW.orderNumber, ' from ', NEW.customerName, ' (', NEW.totalAmount, ')'), 'orders');
END$$
DELIMITER ;

-- TRIGGER 14: Validate reservation date is in future
DELIMITER $$
CREATE TRIGGER validate_reservation_date
BEFORE INSERT ON reservations
FOR EACH ROW
BEGIN
  IF NEW.date < CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reservation date must be in the future';
  END IF;
END$$
DELIMITER ;

-- ============================================================================
-- SCHEDULED EVENTS FOR BUSINESS RULES
-- ============================================================================

-- EVENT 1: Archive old orders monthly
DELIMITER $$
CREATE EVENT IF NOT EXISTS archive_old_orders
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  DELETE FROM orders 
  WHERE status IN ('completed', 'cancelled') 
  AND createdAt < DATE_SUB(NOW(), INTERVAL 6 MONTH);
END$$
DELIMITER ;

-- EVENT 2: Archive old messages monthly
DELIMITER $$
CREATE EVENT IF NOT EXISTS archive_old_messages
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  DELETE FROM contact_messages 
  WHERE isRead = TRUE 
  AND createdAt < DATE_SUB(NOW(), INTERVAL 3 MONTH);
END$$
DELIMITER ;

-- EVENT 3: Expire old coupons daily
DELIMITER $$
CREATE EVENT IF NOT EXISTS expire_old_coupons
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  UPDATE coupons SET isActive = FALSE WHERE validTo < CURDATE();
END$$
DELIMITER ;

-- EVENT 4: Clean up old activity logs monthly
DELIMITER $$
CREATE EVENT IF NOT EXISTS cleanup_old_activity_logs
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  DELETE FROM activity_logs WHERE createdAt < DATE_SUB(NOW(), INTERVAL 1 YEAR);
END$$
DELIMITER ;

-- ============================================================================
-- STORED PROCEDURES FOR BUSINESS RULES
-- ============================================================================

-- PROCEDURE 1: Get all active business rules
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS get_all_business_rules()
BEGIN
  SELECT * FROM site_settings WHERE key NOT LIKE 'template_%' ORDER BY key;
END$$
DELIMITER ;

-- PROCEDURE 2: Update business rule
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS update_business_rule(
  IN p_key VARCHAR(128),
  IN p_value TEXT
)
BEGIN
  UPDATE site_settings SET value = p_value WHERE key = p_key;
END$$
DELIMITER ;

-- PROCEDURE 3: Check if customer can place order
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS check_order_eligibility(
  IN p_phone VARCHAR(20),
  IN p_total DECIMAL(10, 2),
  OUT p_eligible BOOLEAN,
  OUT p_reason TEXT
)
BEGIN
  DECLARE min_order DECIMAL(10, 2);
  DECLARE is_within_hours BOOLEAN;
  
  SET p_eligible = TRUE;
  SET p_reason = '';
  
  SELECT CAST(value AS DECIMAL) INTO min_order FROM site_settings WHERE key = 'minimumOrderValue';
  
  IF p_total < min_order THEN
    SET p_eligible = FALSE;
    SET p_reason = CONCAT('Order below minimum value of ', min_order);
  END IF;
  
  -- Add more checks as needed
END$$
DELIMITER ;

-- PROCEDURE 4: Apply loyalty points discount
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS apply_loyalty_discount(
  IN p_phone VARCHAR(20),
  IN p_points_to_redeem INT,
  OUT p_discount DECIMAL(10, 2)
)
BEGIN
  DECLARE available_points INT;
  DECLARE points_value DECIMAL(5, 2) DEFAULT 0.10;
  
  SELECT points INTO available_points FROM loyalty_points WHERE phone = p_phone;
  
  IF available_points >= p_points_to_redeem THEN
    SET p_discount = p_points_to_redeem * points_value;
    UPDATE loyalty_points SET points = points - p_points_to_redeem WHERE phone = p_phone;
    INSERT INTO loyalty_transactions (phone, points, type, description)
    VALUES (p_phone, -p_points_to_redeem, 'redeem', CONCAT('Redeemed ', p_points_to_redeem, ' points'));
  ELSE
    SET p_discount = 0;
  END IF;
END$$
DELIMITER ;

-- ============================================================================
-- VIEWS FOR BUSINESS RULES REPORTING
-- ============================================================================

-- VIEW 1: Current inventory status
CREATE OR REPLACE VIEW inventory_status AS
SELECT 
  id,
  name,
  quantity,
  lowStockThreshold,
  CASE 
    WHEN quantity <= 0 THEN 'Out of Stock'
    WHEN quantity <= lowStockThreshold THEN 'Low Stock'
    ELSE 'In Stock'
  END as stock_status,
  isAvailable
FROM menu_items
ORDER BY quantity ASC;

-- VIEW 2: Coupon usage report
CREATE OR REPLACE VIEW coupon_usage_report AS
SELECT 
  code,
  description,
  discountValue,
  discountType,
  validFrom,
  validTo,
  maxUses,
  usedCount,
  CASE WHEN usedCount >= maxUses THEN 'Exhausted' ELSE 'Active' END as status
FROM coupons
ORDER BY validTo DESC;

-- VIEW 3: Customer loyalty status
CREATE OR REPLACE VIEW customer_loyalty_status AS
SELECT 
  phone,
  points,
  totalSpent,
  totalOrders,
  lastOrderDate,
  CASE 
    WHEN points >= 500 THEN 'Gold'
    WHEN points >= 250 THEN 'Silver'
    WHEN points >= 100 THEN 'Bronze'
    ELSE 'Regular'
  END as tier
FROM loyalty_points
ORDER BY points DESC;

-- VIEW 4: Business rules audit trail
CREATE OR REPLACE VIEW business_rules_changes AS
SELECT 
  ruleKey,
  oldValue,
  newValue,
  changedAt,
  TIMEDIFF(changedAt, LAG(changedAt) OVER (PARTITION BY ruleKey ORDER BY changedAt)) as time_since_last_change
FROM business_rules_audit
ORDER BY changedAt DESC;

-- ============================================================================
-- DEFAULT BUSINESS RULES
-- ============================================================================

-- Insert default business rules if they don't exist
INSERT IGNORE INTO `site_settings` (`key`, `value`) VALUES
-- Pricing rules
('minimumOrderValue', '500'),
('deliveryFee', '100'),
('taxRate', '16'),
('discountPercentage', '10'),
('discountThreshold', '5000'),

-- Reservation rules
('minPartySize', '1'),
('maxPartySize', '50'),
('advanceBookingDays', '30'),
('cancellationWindowHours', '2'),
('reservationDurationHours', '2'),

-- Order rules
('orderCancellationWindowMinutes', '15'),
('estimatedDeliveryMinutes', '45'),
('autoCompleteOrdersAfterHours', '24'),

-- Menu rules
('maxFeaturedItemsPerCategory', '5'),
('maxDescriptionLength', '500'),

-- Communication rules
('whatsappEnabled', 'true'),
('emailEnabled', 'true'),
('smsEnabled', 'false'),
('notificationTemplate_orderConfirmed', 'Your order #{{orderNumber}} has been confirmed! Estimated delivery: {{estimatedTime}}'),
('notificationTemplate_orderReady', 'Your order #{{orderNumber}} is ready for pickup!'),
('notificationTemplate_outForDelivery', 'Your order #{{orderNumber}} is on the way! Driver: {{driverName}}'),

-- Data retention rules
('orderRetentionDays', '180'),
('messageRetentionDays', '90'),
('customerDataRetentionDays', '365'),

-- Inventory rules
('trackInventory', 'true'),
('lowStockThreshold', '10'),

-- Loyalty rules
('loyaltyPointsPerUnit', '1'),
('loyaltyPointValue', '0.10');

-- ============================================================================
-- END OF BUSINESS RULES SCHEMA
-- ============================================================================
