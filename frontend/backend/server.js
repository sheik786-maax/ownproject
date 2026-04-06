require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// Database connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Sheik123',
    database: 'millennium_billing',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Initialize Database Function
async function initDb() {
    try {
        const tempPool = mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: 'Sheik123',
        });
        await tempPool.query(`CREATE DATABASE IF NOT EXISTS millennium_billing;`);
        await tempPool.end();

        const dbPool = mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: 'Sheik123',
            database: 'millennium_billing'
        });

        await dbPool.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_no VARCHAR(50) NOT NULL UNIQUE,
                invoice_date DATE,
                customer_name VARCHAR(255),
                customer_address TEXT,
                customer_phone VARCHAR(50),
                customer_gstin VARCHAR(50),
                total_taxable_value DECIMAL(10,2),
                total_cgst DECIMAL(10,2),
                total_sgst DECIMAL(10,2),
                total_igst DECIMAL(10,2),
                grand_total DECIMAL(10,2),
                total_in_words VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await dbPool.query(`
            CREATE TABLE IF NOT EXISTS invoice_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id INT,
                product_name VARCHAR(255),
                hsn_sac VARCHAR(50),
                qty INT,
                rate DECIMAL(10,2),
                taxable_value DECIMAL(10,2),
                cgst_percent DECIMAL(5,2),
                cgst_amount DECIMAL(10,2),
                sgst_percent DECIMAL(5,2),
                sgst_amount DECIMAL(10,2),
                igst_percent DECIMAL(5,2),
                igst_amount DECIMAL(10,2),
                total DECIMAL(10,2),
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            );
        `);
        
        // Ensure migration happens for existing data
        try { await dbPool.query(`ALTER TABLE invoices ADD COLUMN total_igst DECIMAL(10,2);`); } catch(e){}
        try { await dbPool.query(`ALTER TABLE invoice_items ADD COLUMN igst_percent DECIMAL(5,2), ADD COLUMN igst_amount DECIMAL(10,2);`); } catch(e){}
        
        console.log("Database & tables initialized successfully.");
        await dbPool.end();
    } catch (err) {
        console.error("Failed to initialize database:", err);
    }
}

// Next Invoice Number Generator
app.get('/api/invoices/next-number', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT invoice_no FROM invoices ORDER BY id DESC LIMIT 1');
        let nextNumber = 'MH-2026-0001'; // Default
        if (rows.length > 0) {
            const lastNo = rows[0].invoice_no; // e.g., MH-2026-0005
            const parts = lastNo.split('-');
            if (parts.length === 3) {
                const seq = parseInt(parts[2], 10) + 1;
                nextNumber = `MH-2026-${seq.toString().padStart(4, '0')}`;
            }
        }
        res.json({ nextInvoiceNo: nextNumber });
    } catch (error) {
        console.error("Error getting next invoice no:", error);
        res.status(500).json({ error: 'Failed to fetch next invoice number' });
    }
});

// Fetch Customer Details by GSTIN
app.get('/api/customers/:gstin', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT customer_name, customer_address, customer_phone FROM invoices WHERE customer_gstin = ? ORDER BY id DESC LIMIT 1', 
            [req.params.gstin]
        );
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'Customer not found' });
        }
    } catch (error) {
        console.error("Error getting customer by GSTIN:", error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// Create Invoice
app.post('/api/invoices', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const {
            invoice_no, invoice_date, customer_name, customer_address, 
            customer_phone, customer_gstin, items, 
            total_taxable_value, total_cgst, total_sgst, total_igst, grand_total, total_in_words
        } = req.body;

        const [result] = await conn.query(
            `INSERT INTO invoices (invoice_no, invoice_date, customer_name, customer_address, customer_phone, customer_gstin, total_taxable_value, total_cgst, total_sgst, total_igst, grand_total, total_in_words) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [invoice_no, invoice_date || new Date(), customer_name, customer_address, customer_phone, customer_gstin, total_taxable_value, total_cgst, total_sgst, total_igst, grand_total, total_in_words]
        );

        const invoiceId = result.insertId;

        for (const item of items) {
            await conn.query(
                `INSERT INTO invoice_items (invoice_id, product_name, hsn_sac, qty, rate, taxable_value, cgst_percent, cgst_amount, sgst_percent, sgst_amount, igst_percent, igst_amount, total)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [invoiceId, item.product_name, item.hsn_sac, item.qty, item.rate, item.taxable_value, item.cgst_percent, item.cgst_amount, item.sgst_percent, item.sgst_amount, item.igst_percent, item.igst_amount, item.total]
            );
        }

        await conn.commit();
        res.status(201).json({ message: 'Invoice created successfully', invoiceId });
    } catch (error) {
        await conn.rollback();
        console.error("Transaction error:", error);
        res.status(500).json({ error: 'Failed to create invoice' });
    } finally {
        conn.release();
    }
});

// Start Server Wrapper
async function start() {
    await initDb();
    app.listen(PORT, () => {
        console.log(`Backend API running on http://localhost:${PORT}`);
    });
}
start();
