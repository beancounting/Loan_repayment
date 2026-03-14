# Loan Repayment Calculator

A client-side loan repayment calculator that helps you understand and visualize your loan payments over time. Built with vanilla HTML, CSS, and JavaScript — no backend required.

## Features

### Single Loan Calculator
- Calculate payments for any loan amount, interest rate, and term
- Supports **Principal & Interest** and **Interest Only** loan types
- Payment frequency options: Monthly, Bi-weekly, or Weekly
- **Extra payments** — add recurring extra amounts per period or one-time lump sums to see how much interest you save
- Loan amount input formats automatically with commas (e.g. `200,000`)
- Default values pre-filled for quick calculation

### Interactive Balance Graph
- Line chart showing **remaining balance**, **cumulative principal paid**, and **cumulative interest paid** over the life of the loan
- Hover tooltips with formatted dollar amounts
- Responsive — adapts to mobile screen sizes
- Powered by [Chart.js](https://www.chartjs.org/)

### Amortization Schedule
- Full payment-by-payment breakdown with dates
- Shows principal, interest, extra payment, and remaining balance per period
- Exportable to **CSV** for use in spreadsheets
- Lazy-loaded rows with a "Show All" option for long schedules

### Loan Comparison
- Compare up to **3 loans** side by side
- Displays key metrics: payment amount, total interest, total paid, number of payments, and payoff date
- Visual bar charts comparing total interest and total cost

## Usage

Open `index.html` in any modern web browser. No installation or build step required.

1. Enter your loan details (or use the pre-filled defaults)
2. Click **Calculate** to see results, the balance graph, and amortization schedule
3. Optionally expand **Extra Payments** to model additional principal payments
4. Use the **Loan Comparison** tab to compare different loan scenarios
5. Click **Download CSV** to export the amortization schedule

## Project Structure

```
index.html       — Page structure and layout
calculator.js    — Calculation engine, DOM rendering, and event handling
styles.css       — Responsive styling with CSS variables
```

## Formulas

**Principal & Interest:**

```
M = P × [r(1+r)^n] / [(1+r)^n − 1]
```

**Interest Only:**

```
M = P × r
```

Where **P** = principal, **r** = per-period interest rate, **n** = total number of payments.

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled. Chart.js is loaded from a CDN.
