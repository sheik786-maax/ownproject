require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// Middleware
app.use(cors());
app.use(express.json());

// ================= DATABASE CONNECTION =================
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
// ================= HOME ROUTE =================
app.get("/", (req, res) => {
  res.json({
    message: "Billing Backend Running 🚀",
    status: "OK",
  });
});

// ================= NEXT INVOICE =================
app.get("/api/invoices/next-number", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT invoice_no FROM invoices ORDER BY id DESC LIMIT 1"
    );

    let nextNumber = "MH-2026-0001";

    if (rows.length > 0 && rows[0].invoice_no) {
      const parts = rows[0].invoice_no.split("-");
      const seq = parseInt(parts[2], 10) + 1;
      nextNumber = `MH-2026-${seq.toString().padStart(4, "0")}`;
    }

    res.json({ nextInvoiceNo: nextNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get invoice number" });
  }
});

// ================= CREATE INVOICE =================


app.get("/api/invoices", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM invoices ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});




app.post("/api/invoices", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const {
      invoice_no,
      invoice_date,
      customer_name,
      customer_address,
      customer_phone,
      customer_gstin,
      items,
      total_taxable_value,
      total_cgst,
      total_sgst,
      total_igst,
      grand_total,
      total_in_words,
    } = req.body;

    const [result] = await conn.query(
      `INSERT INTO invoices 
      (invoice_no, invoice_date, customer_name, customer_address, customer_phone, customer_gstin, total_taxable_value, total_cgst, total_sgst, total_igst, grand_total, total_in_words)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice_no,
        invoice_date || new Date(),
        customer_name,
        customer_address,
        customer_phone,
        customer_gstin,
        total_taxable_value,
        total_cgst,
        total_sgst,
        total_igst,
        grand_total,
        total_in_words,
      ]
    );

    const invoiceId = result.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO invoice_items 
        (invoice_id, product_name, hsn_sac, qty, rate, taxable_value, cgst_percent, cgst_amount, sgst_percent, sgst_amount, igst_percent, igst_amount, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.product_name,
          item.hsn_sac,
          item.qty,
          item.rate,
          item.taxable_value,
          item.cgst_percent,
          item.cgst_amount,
          item.sgst_percent,
          item.sgst_amount,
          item.igst_percent,
          item.igst_amount,
          item.total,
        ]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: "Invoice created successfully",
      invoiceId,
    });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: "Failed to create invoice" });
  } finally {
    conn.release();
  }
});

// ================= 404 =================
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}




);