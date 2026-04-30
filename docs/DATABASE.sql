-- ============================================================================
-- Elparaiso Garden Kisii - Complete Database Schema
-- ============================================================================
-- This SQL file contains the complete schema for the Elparaiso Garden Kisii
-- hospitality management system. It includes all tables, indexes, and
-- constraints needed for production deployment.
--
-- Database: MySQL 8.0+ or MariaDB 10.5+
-- Created: April 2026
-- ============================================================================

-- ============================================================================
-- USERS TABLE - Authentication and Role Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `openId` VARCHAR(64) NOT NULL UNIQUE,
  `name` TEXT,
  `email` VARCHAR(320),
  `loginMethod` VARCHAR(64),
  `role` ENUM('user', 'admin', 'manager', 'editor') NOT NULL DEFAULT 'user',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_openId (openId),
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SITE SETTINGS TABLE - Business Configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS `site_settings` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(128) NOT NULL UNIQUE,
  `value` TEXT,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default settings
INSERT IGNORE INTO `site_settings` (`key`, `value`) VALUES
('businessName', 'Elparaiso Garden Kisii'),
('phone', '0791 224513'),
('whatsapp', '254791224513'),
('email', 'info@elparaiso.com'),
('address', 'County Government Street, Kisii, Kenya'),
('maps_embed', ''),
('maps_link', 'https://maps.google.com/?q=Kisii+Kenya'),
('description', 'Kisii\'s 24/7 Bar, Grill & Chill Spot'),
('instagram', 'https://instagram.com/elparaiso'),
('facebook', 'https://facebook.com/elparaiso'),
('twitter', 'https://twitter.com/elparaiso'),
('openingHours', '{"monday":"24/7","tuesday":"24/7","wednesday":"24/7","thursday":"24/7","friday":"24/7","saturday":"24/7","sunday":"24/7"}'),
('features', '{"delivery":true,"dineIn":true,"takeaway":true,"reservations":true}'),
('paymentMethods', '{"cash":true,"mpesa":false,"card":false}');

-- ============================================================================
-- SEO SETTINGS TABLE - Per-Page SEO Metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS `seo_settings` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `page` VARCHAR(64) NOT NULL UNIQUE,
  `seoTitle` VARCHAR(255),
  `metaDescription` TEXT,
  `ogTitle` VARCHAR(255),
  `ogDescription` TEXT,
  `ogImage` TEXT,
  `canonicalUrl` TEXT,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_page (page)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default SEO settings
INSERT IGNORE INTO `seo_settings` (`page`, `seoTitle`, `metaDescription`, `ogTitle`, `ogDescription`) VALUES
('home', 'Elparaiso Garden Kisii - 24/7 Bar, Grill & Restaurant', 'Experience Kisii\'s finest 24/7 bar and grill. Nyama choma, cocktails, live music, and unforgettable vibes.', 'Elparaiso Garden Kisii', 'Kisii\'s 24/7 Bar, Grill & Chill Spot'),
('menu', 'Menu - Elparaiso Garden Kisii', 'Browse our full menu of grills, drinks, and local favorites. Order online or visit us today.', 'Menu', 'Delicious food and drinks'),
('about', 'About Us - Elparaiso Garden Kisii', 'Learn about Elparaiso Garden Kisii and our commitment to great food and hospitality.', 'About Elparaiso', 'Our Story'),
('gallery', 'Gallery - Elparaiso Garden Kisii', 'View photos of our restaurant, food, and events at Elparaiso Garden Kisii.', 'Gallery', 'Beautiful moments at Elparaiso'),
('contact', 'Contact Us - Elparaiso Garden Kisii', 'Get in touch with Elparaiso Garden Kisii. Find our location, hours, and contact information.', 'Contact', 'Reach out to us'),
('events', 'Events & Specials - Elparaiso Garden Kisii', 'Check out our upcoming events, promotions, and special offers.', 'Events', 'Special events and promotions'),
('reservations', 'Book a Table - Elparaiso Garden Kisii', 'Reserve your table at Elparaiso Garden Kisii for the perfect dining experience.', 'Reservations', 'Book your table today');

-- ============================================================================
-- MENU CATEGORIES TABLE - Menu Organization
-- ============================================================================
CREATE TABLE IF NOT EXISTS `menu_categories` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `sortOrder` INT DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sortOrder (sortOrder),
  INDEX idx_isActive (isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default categories
INSERT IGNORE INTO `menu_categories` (`name`, `description`, `sortOrder`) VALUES
('Grills & Nyama Choma', 'Authentic Kenyan grilled meats and specialties', 1),
('Cocktails & Mixers', 'Premium cocktails and mixed drinks', 2),
('Beers & Spirits', 'Local and international beers, wines, and spirits', 3),
('Soft Drinks', 'Juices, sodas, and non-alcoholic beverages', 4),
('Appetizers', 'Starters and small bites', 5),
('Platters', 'Sharing platters and combo meals', 6),
('Desserts', 'Sweet treats and desserts', 7);

-- ============================================================================
-- MENU ITEMS TABLE - Food and Drink Items
-- ============================================================================
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `categoryId` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(10, 2) NOT NULL,
  `imageUrl` TEXT,
  `altText` VARCHAR(255),
  `isAvailable` BOOLEAN NOT NULL DEFAULT TRUE,
  `isFeatured` BOOLEAN NOT NULL DEFAULT FALSE,
  `sortOrder` INT DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoryId) REFERENCES menu_categories(id) ON DELETE CASCADE,
  INDEX idx_categoryId (categoryId),
  INDEX idx_isFeatured (isFeatured),
  INDEX idx_isAvailable (isAvailable),
  INDEX idx_sortOrder (sortOrder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- RESERVATIONS TABLE - Table Booking Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS `reservations` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `customerName` VARCHAR(255) NOT NULL,
  `customerPhone` VARCHAR(20) NOT NULL,
  `customerEmail` VARCHAR(320),
  `date` DATE NOT NULL,
  `time` TIME NOT NULL,
  `partySize` INT NOT NULL,
  `specialRequests` TEXT,
  `status` ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date (date),
  INDEX idx_status (status),
  INDEX idx_customerPhone (customerPhone),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ORDERS TABLE - Order Tracking and Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `orderNumber` VARCHAR(20) NOT NULL UNIQUE,
  `customerName` VARCHAR(255) NOT NULL,
  `customerPhone` VARCHAR(20) NOT NULL,
  `customerEmail` VARCHAR(320),
  `deliveryAddress` TEXT,
  `items` JSON NOT NULL,
  `totalAmount` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('pending', 'preparing', 'ready', 'out-for-delivery', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `orderType` ENUM('dine-in', 'takeaway', 'delivery', 'drive-through') NOT NULL DEFAULT 'delivery',
  `specialInstructions` TEXT,
  `paymentStatus` ENUM('pending', 'paid', 'partial') NOT NULL DEFAULT 'pending',
  `paymentMethod` VARCHAR(50),
  `estimatedDeliveryTime` DATETIME,
  `actualDeliveryTime` DATETIME,
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_orderNumber (orderNumber),
  INDEX idx_customerPhone (customerPhone),
  INDEX idx_status (status),
  INDEX idx_orderType (orderType),
  INDEX idx_createdAt (createdAt),
  INDEX idx_paymentStatus (paymentStatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- EVENTS TABLE - Special Events and Promotions
-- ============================================================================
CREATE TABLE IF NOT EXISTS `events` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `subtitle` VARCHAR(255),
  `description` TEXT,
  `imageUrl` TEXT,
  `altText` VARCHAR(255),
  `eventDate` DATE,
  `startTime` TIME,
  `endTime` TIME,
  `ctaLabel` VARCHAR(100),
  `ctaUrl` TEXT,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `showOnHomepage` BOOLEAN NOT NULL DEFAULT FALSE,
  `sortOrder` INT DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_isActive (isActive),
  INDEX idx_showOnHomepage (showOnHomepage),
  INDEX idx_eventDate (eventDate),
  INDEX idx_sortOrder (sortOrder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- GALLERY IMAGES TABLE - Photo Gallery Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS `gallery_images` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `imageUrl` TEXT NOT NULL,
  `altText` VARCHAR(255),
  `category` VARCHAR(100),
  `isFeatured` BOOLEAN NOT NULL DEFAULT FALSE,
  `sortOrder` INT DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_isFeatured (isFeatured),
  INDEX idx_sortOrder (sortOrder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TESTIMONIALS TABLE - Customer Reviews and Ratings
-- ============================================================================
CREATE TABLE IF NOT EXISTS `testimonials` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `reviewerName` VARCHAR(255) NOT NULL,
  `rating` INT NOT NULL DEFAULT 5,
  `reviewText` TEXT NOT NULL,
  `sourceLabel` VARCHAR(64) DEFAULT 'Google',
  `isFeatured` BOOLEAN NOT NULL DEFAULT TRUE,
  `sortOrder` INT DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_isFeatured (isFeatured),
  INDEX idx_rating (rating),
  INDEX idx_sortOrder (sortOrder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CONTACT MESSAGES TABLE - Contact Form Submissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(320),
  `inquiryType` VARCHAR(100) DEFAULT 'General Inquiry',
  `message` TEXT NOT NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT FALSE,
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_isRead (isRead),
  INDEX idx_phone (phone),
  INDEX idx_createdAt (createdAt),
  INDEX idx_inquiryType (inquiryType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ACTIVITY LOGS TABLE - Admin Action Audit Trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `action` TEXT NOT NULL,
  `category` VARCHAR(100),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId),
  INDEX idx_category (category),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Composite indexes for common queries
ALTER TABLE `menu_items` ADD INDEX idx_category_featured (categoryId, isFeatured);
ALTER TABLE `orders` ADD INDEX idx_phone_status (customerPhone, status);
ALTER TABLE `reservations` ADD INDEX idx_date_status (date, status);
ALTER TABLE `contact_messages` ADD INDEX idx_read_created (isRead, createdAt);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Featured Menu Items
CREATE OR REPLACE VIEW featured_menu_items AS
SELECT 
  mi.id,
  mi.name,
  mi.description,
  mi.price,
  mi.imageUrl,
  mc.name as categoryName,
  mi.sortOrder
FROM menu_items mi
JOIN menu_categories mc ON mi.categoryId = mc.id
WHERE mi.isFeatured = TRUE AND mi.isAvailable = TRUE
ORDER BY mi.sortOrder ASC;

-- View: Active Events
CREATE OR REPLACE VIEW active_events AS
SELECT 
  id,
  title,
  subtitle,
  description,
  imageUrl,
  eventDate,
  startTime,
  endTime,
  ctaLabel,
  ctaUrl,
  sortOrder
FROM events
WHERE isActive = TRUE
ORDER BY eventDate ASC, sortOrder ASC;

-- View: Unread Messages Count
CREATE OR REPLACE VIEW unread_messages_count AS
SELECT COUNT(*) as count FROM contact_messages WHERE isRead = FALSE;

-- View: Today's Reservations
CREATE OR REPLACE VIEW todays_reservations AS
SELECT 
  id,
  customerName,
  customerPhone,
  date,
  time,
  partySize,
  status
FROM reservations
WHERE date = CURDATE()
ORDER BY time ASC;

-- View: Pending Orders
CREATE OR REPLACE VIEW pending_orders AS
SELECT 
  id,
  orderNumber,
  customerName,
  customerPhone,
  status,
  totalAmount,
  createdAt
FROM orders
WHERE status IN ('pending', 'preparing', 'ready', 'out-for-delivery')
ORDER BY createdAt ASC;

-- ============================================================================
-- STORED PROCEDURES FOR COMMON OPERATIONS
-- ============================================================================

-- Procedure: Get Dashboard Stats
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS get_dashboard_stats()
BEGIN
  SELECT 
    (SELECT COUNT(*) FROM reservations WHERE date = CURDATE()) as reservations_today,
    (SELECT COUNT(*) FROM reservations WHERE status = 'pending') as pending_reservations,
    (SELECT COUNT(*) FROM contact_messages WHERE isRead = FALSE) as new_messages,
    (SELECT COUNT(*) FROM events WHERE isActive = TRUE) as active_events,
    (SELECT COUNT(*) FROM menu_items WHERE isFeatured = TRUE) as featured_menu_items,
    (SELECT COUNT(*) FROM gallery_images) as gallery_count;
END$$
DELIMITER ;

-- Procedure: Get Order Stats
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS get_order_stats()
BEGIN
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as preparing,
    SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
    SUM(CASE WHEN status = 'out-for-delivery' THEN 1 ELSE 0 END) as out_for_delivery,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
  FROM orders;
END$$
DELIMITER ;

-- Procedure: Archive Old Orders (Run monthly)
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS archive_old_orders()
BEGIN
  DELETE FROM orders 
  WHERE status IN ('completed', 'cancelled') 
  AND createdAt < DATE_SUB(NOW(), INTERVAL 6 MONTH);
END$$
DELIMITER ;

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Sample menu items
INSERT IGNORE INTO `menu_items` (`categoryId`, `name`, `description`, `price`, `isFeatured`, `isAvailable`, `sortOrder`) VALUES
(1, 'Nyama Choma Platter', 'Grilled beef, goat, and chicken with ugali and vegetables', 1500.00, TRUE, TRUE, 1),
(1, 'Mutura Special', 'Traditional Kenyan sausage with spicy sauce', 800.00, TRUE, TRUE, 2),
(2, 'Elparaiso Cocktail', 'Signature cocktail with vodka, lime, and local herbs', 600.00, TRUE, TRUE, 1),
(3, 'Tusker Beer', 'Local Kenyan lager beer', 300.00, FALSE, TRUE, 1),
(4, 'Fresh Mango Juice', 'Freshly squeezed mango juice', 250.00, FALSE, TRUE, 1),
(5, 'Samosas', 'Crispy pastry with meat filling', 150.00, FALSE, TRUE, 1),
(6, 'Family Platter', 'Mix of grilled meats, sides, and drinks for 4 people', 3500.00, TRUE, TRUE, 1);

-- Sample testimonials
INSERT IGNORE INTO `testimonials` (`reviewerName`, `rating`, `reviewText`, `sourceLabel`, `isFeatured`, `sortOrder`) VALUES
('John Mwangi', 5, 'Amazing food and service! The grilled meat is absolutely delicious. Highly recommend!', 'Google', TRUE, 1),
('Sarah Kipchoge', 5, 'Best nyama choma in Kisii. Great atmosphere and friendly staff. Will definitely come back!', 'Facebook', TRUE, 2),
('Peter Ochieng', 4, 'Good food and reasonable prices. The cocktails are excellent. 24/7 service is very convenient.', 'Google', TRUE, 3),
('Grace Wanjiru', 5, 'Perfect place for celebrations! The staff made our event memorable. Highly recommended!', 'Facebook', TRUE, 4);

-- Sample events
INSERT IGNORE INTO `events` (`title`, `subtitle`, `description`, `eventDate`, `startTime`, `endTime`, `ctaLabel`, `ctaUrl`, `isActive`, `showOnHomepage`, `sortOrder`) VALUES
('Live DJ Night', 'Every Friday & Saturday', 'Join us for an amazing night of music and dancing with our resident DJ', '2026-04-18', '20:00:00', '04:00:00', 'Reserve Table', '/reservations', TRUE, TRUE, 1),
('Happy Hour Specials', 'Daily 5-7 PM', 'Get 50% off on selected cocktails and beers during happy hour', '2026-04-15', '17:00:00', '19:00:00', 'View Menu', '/menu', TRUE, TRUE, 2),
('Easter Celebration', 'April 20-21', 'Special Easter menu and family packages available. Book your table now!', '2026-04-20', '12:00:00', '23:59:00', 'Book Now', '/reservations', TRUE, TRUE, 3);

-- ============================================================================
-- GRANTS AND PERMISSIONS (for production database user)
-- ============================================================================
-- Create a dedicated database user for the application (run as root):
-- CREATE USER 'elparaiso_app'@'%' IDENTIFIED BY 'strong_password_here';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON elparaiso.* TO 'elparaiso_app'@'%';
-- FLUSH PRIVILEGES;

-- ============================================================================
-- BACKUP AND RECOVERY RECOMMENDATIONS
-- ============================================================================
-- Daily backup: mysqldump -u root -p elparaiso > backup_$(date +%Y%m%d).sql
-- Restore: mysql -u root -p elparaiso < backup_20260415.sql
-- 
-- For production, use managed backups:
-- - AWS RDS: Automated backups with 35-day retention
-- - PlanetScale: Automatic backups included
-- - DigitalOcean: Enable automated backups ($5/month)

-- ============================================================================
-- END OF DATABASE SCHEMA
-- ============================================================================
