const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const DB_FILE = path.join(__dirname, "data.json");

function loadDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch {
        return {
            products: [
                { id: 1, name: "Laptop", price: 15000, stock: 10 },
                { id: 2, name: "Mouse", price: 250, stock: 50 },
                { id: 3, name: "Keyboard", price: 600, stock: 30 }
            ],
            orders: [],
            nextProductId: 4,
            nextOrderId: 1
        };
    }
}

const db = loadDB();

function save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const isNonEmptyString = (value) =>
    typeof value === "string" && value.trim().length > 0;

function validateProduct(body, partial = false) {
    const errors = [];

    if (!partial || body.name !== undefined) {
        if (!isNonEmptyString(body.name)) errors.push("name is required");
    }

    if (!partial || body.price !== undefined) {
        if (typeof body.price !== "number" || body.price < 0) {
            errors.push("price must be a non-negative number");
        }
    }

    if (!partial || body.stock !== undefined) {
        if (!Number.isInteger(body.stock) || body.stock < 0) {
            errors.push("stock must be a non-negative integer");
        }
    }

    return errors;
}

const findProduct = (id) => db.products.find((p) => p.id === Number(id));
const findOrder = (id) => db.orders.find((o) => o.id === Number(id));

/* Products */

// Get all products
app.get("/api/products", (req, res) => {
    const search = req.query.search;

    if (!search) {
        return res.json(db.products);
    }

    const result = db.products.filter((product) =>
        product.name.toLowerCase().includes(search.toLowerCase())
    );

    res.json(result);
});

// Get one product
app.get("/api/products/:id", (req, res) => {
    const product = findProduct(req.params.id);

    if (!product) {
        return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
});

// Add product
app.post("/api/products", (req, res) => {
    const errors = validateProduct(req.body);

    if (errors.length) {
        return res.status(400).json({ errors });
    }

    const product = {
        id: db.nextProductId++,
        name: req.body.name,
        price: req.body.price,
        stock: req.body.stock
    };

    db.products.push(product);
    save();

    res.status(201).json(product);
});

// Update product
app.put("/api/products/:id", (req, res) => {
    const product = findProduct(req.params.id);

    if (!product) {
        return res.status(404).json({ error: "Product not found" });
    }

    const errors = validateProduct(req.body);

    if (errors.length) {
        return res.status(400).json({ errors });
    }

    product.name = req.body.name;
    product.price = req.body.price;
    product.stock = req.body.stock;

    save();
    res.json(product);
});

// Delete product
app.delete("/api/products/:id", (req, res) => {
    const index = db.products.findIndex((p) => p.id === Number(req.params.id));

    if (index === -1) {
        return res.status(404).json({ error: "Product not found" });
    }

    const deleted = db.products.splice(index, 1)[0];
    save();

    res.json(deleted);
});

/* Orders */

const transitions = {
    pending: ["paid", "cancelled"],
    paid: ["shipped", "cancelled"],
    shipped: [],
    cancelled: []
};

// Create order
app.post("/api/orders", (req, res) => {
    const { customerName, items } = req.body;

    if (!isNonEmptyString(customerName)) {
        return res.status(400).json({ error: "customerName is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items must be a non-empty array" });
    }

    const mergedItems = {};

    for (const item of items) {
        if (!Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity <= 0) {
            return res.status(400).json({
                error: "Each item needs a valid productId and positive integer quantity"
            });
        }

        mergedItems[item.productId] =
            (mergedItems[item.productId] || 0) + item.quantity;
    }

    const orderItems = [];
    let total = 0;

    for (const [productId, quantity] of Object.entries(mergedItems)) {
        const product = findProduct(productId);

        if (!product) {
            return res.status(404).json({
                error: `Product ${productId} not found`
            });
        }

        if (product.stock < quantity) {
            return res.status(409).json({
                error: `Insufficient stock for product ${product.id}`
            });
        }

        const itemTotal = product.price * quantity;

        orderItems.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity,
            total: itemTotal
        });

        total += itemTotal;
    }

    for (const item of orderItems) {
        const product = findProduct(item.productId);
        product.stock -= item.quantity;
    }

    const order = {
        id: db.nextOrderId++,
        customerName,
        items: orderItems,
        total,
        status: "pending",
        createdAt: new Date().toISOString()
    };

    db.orders.push(order);
    save();

    res.status(201).json(order);
});

// Get orders
app.get("/api/orders", (req, res) => {
    const { status } = req.query;

    if (!status) {
        return res.json(db.orders);
    }

    res.json(db.orders.filter((order) => order.status === status));
});

// Get one order
app.get("/api/orders/:id", (req, res) => {
    const order = findOrder(req.params.id);

    if (!order) {
        return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
});

// Update order status
app.patch("/api/orders/:id/status", (req, res) => {
    const order = findOrder(req.params.id);

    if (!order) {
        return res.status(404).json({ error: "Order not found" });
    }

    const newStatus = req.body.status;

    if (!transitions[order.status] || !transitions[order.status].includes(newStatus)) {
        return res.status(400).json({
            error: `Cannot change status from ${order.status} to ${newStatus}`
        });
    }

    if (newStatus === "cancelled") {
        for (const item of order.items) {
            const product = findProduct(item.productId);

            if (product) {
                product.stock += item.quantity;
            }
        }
    }

    order.status = newStatus;
    save();

    res.json(order);
});

/* 404 */
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

/* Error handler */
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        error: "Internal server error"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Store API running on http://localhost:${PORT}`);
});
