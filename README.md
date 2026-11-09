# منظومة القرطاسية · Stationery Store System

Inventory, point of sale, invoices, and customers/suppliers for a stationery shop.
Arabic (RTL) interface built with plain **HTML, CSS and vanilla JavaScript**. No frameworks, no build step, no server.

**Live:** https://fix-07.github.io/qartasia/

## Run locally

Download the three files into one folder and open `index.html` in a browser.

## What it does

- **Dashboard**: stock totals, today's sales with a 7-day chart, low-stock alerts
- **Inventory**: searchable, sortable table; add / edit / delete / restock with form validation
- **Point of sale**: cart with automatic totals and discount, printable invoice
- **Invoices**: sales log, reprint, cancel an invoice and return its quantities to stock
- **Customers and suppliers**: one table each
- **Settings**: shop details, JSON backup and restore

All data is stored in the browser's `localStorage` on the device that opens the page. Use Settings → backup to keep a copy.

## Files

| File | Contents |
| --- | --- |
| `index.html` | Markup, icons, dialogs |
| `style.css` | Layout and components (logical properties, responsive, print) |
| `app.js` | State, storage, rendering, validation |
