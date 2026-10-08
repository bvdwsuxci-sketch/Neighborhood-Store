# Neighborhood Store

A small store system for managing products and customer orders using Node.js and Express.

## Features

- Add, view, update, and delete products.
- Search products by name.
- Create customer orders.
- Calculate order totals.
- Check product stock before creating an order.
- Automatically reduce stock when an order is created.
- Manage order status:
  - pending -> paid
  - paid -> shipped
  - pending -> cancelled
  - paid -> cancelled
- Restore stock when an order is cancelled.
- JSON file-based data persistence.
- Input validation and error handling.

## Technologies

- Node.js
- Express.js
- JavaScript
- REST API
- JSON

## Installation

Make sure Node.js 18+ is installed.

```bash
npm install
```

## Run

```bash
npm start
```

For development:

```bash
npm run dev
```

The API runs on:

```text
http://localhost:3000
```

## Main Endpoints

### Products

```text
GET    /api/products
GET    /api/products/:id
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
```

Product search:

```text
GET /api/products?search=laptop
```

### Orders

```text
POST  /api/orders
GET   /api/orders
GET   /api/orders/:id
PATCH /api/orders/:id/status
```

Filter orders by status:

```text
GET /api/orders?status=pending
```

## Data

The application stores its data in `data.json`.

The file is created automatically when the server first runs.

`data.json` is ignored by Git so local runtime data is not committed to the repository.

## Example Order

```json
{
  "customerName": "Saif",
  "items": [
    {
      "productId": 1,
      "quantity": 1
    }
  ]
}
```
