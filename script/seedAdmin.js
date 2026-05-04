/**
 * Admin Seeder Script
 *
 * This script creates initial admin users for the system.
 *
 * Usage: node backend/script/seedAdmin.js
 *
 * Make sure MongoDB is running and the database is connected before running this script.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

// Import Admin model and database connection
const Admin = require("../src/admin/adminModels.js");
const { connectDB } = require("../src/config/db.js");

// Admin users to seed
const adminUsers = [
  {
    name: "Super Admin",
    email: "superadmin@example.com",
    password: "SuperAdmin@123",
    role: "superadmin",
    status: "active",
    permissions: [
      "view_dashboard",
      "manage_users",
      "manage_admins",
      "view_transactions",
      "manage_families",
      "view_reports",
      "manage_settings",
    ],
  },
  {
    name: "Admin User",
    email: "admin@example.com",
    password: "Admin@123",
    role: "admin",
    status: "active",
    permissions: [
      "view_dashboard",
      "manage_users",
      "view_transactions",
      "manage_families",
      "view_reports",
    ],
  },
  {
    name: "Moderator",
    email: "moderator@example.com",
    password: "Moderator@123",
    role: "moderator",
    status: "active",
    permissions: ["view_dashboard", "manage_users", "view_transactions"],
  },
];

// Seed admin users
const seedAdmins = async () => {
  try {
    console.log("\n📝 Starting Admin Seeder...\n");

    // Check if admins already exist
    const existingAdmins = await Admin.countDocuments();
    if (existingAdmins > 0) {
      console.log(
        `⚠️  Found ${existingAdmins} existing admin(s). Skipping seeding to avoid duplicates.`,
      );
      console.log("\nTo delete all admins and reseed, run:");
      console.log("  db.admins.deleteMany({})");
      console.log("Then run this script again.\n");
      return;
    }

    // Hash passwords and create admins
    for (const adminData of adminUsers) {
      const hashedPassword = await bcrypt.hash(adminData.password, 10);

      const admin = new Admin({
        ...adminData,
        password: hashedPassword,
      });

      await admin.save();
      console.log(`✓ Created admin: ${adminData.email} (${adminData.role})`);
      console.log(`  Password: ${adminData.password}`);
    }

    console.log("\n✓ Admin seeding completed successfully!\n");
    console.log("📋 Created Admins:");
    console.log("─".repeat(60));

    adminUsers.forEach((admin) => {
      console.log(`\nEmail: ${admin.email}`);
      console.log(`Password: ${admin.password}`);
      console.log(`Role: ${admin.role}`);
    });

    console.log("\n─".repeat(60));
    console.log(
      "\n⚠️  IMPORTANT: Change these default passwords in production!",
    );
    console.log("\nYou can now log in to the admin panel at /admin-sign-in\n");
  } catch (error) {
    console.error("✗ Error during seeding:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("✓ Database connection closed");
  }
};

// Run seeder
const run = async () => {
  await connectDB();
  await seedAdmins();
};

run();
