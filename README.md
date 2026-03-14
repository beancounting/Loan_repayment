# Loan Calculator Suite

A collection of client-side financial calculators that help you understand and plan your loans and home purchases. Built with vanilla HTML, CSS, and JavaScript — no backend required.

## Calculators

### Loan Repayment Calculator (`index.html`)

Calculate and visualize loan repayment schedules.

- Calculate payments for any loan amount, interest rate, and term
- Supports **Principal & Interest** and **Interest Only** loan types
- Payment frequency options: Monthly, Bi-weekly, or Weekly
- **Extra payments** — add recurring extra amounts per period or one-time lump sums to see how much interest you save
- **Interactive balance graph** — line chart showing remaining balance, cumulative principal, and cumulative interest over time
- **Amortization schedule** — full payment-by-payment breakdown, exportable to CSV
- **Loan comparison** — compare up to 3 loans side by side with visual charts

### Mortgage Affordability Calculator (`mortgage-affordability.html`)

Find out how much house you can afford based on your income and debts.

- **Inputs:** Annual income, monthly debts (car, student loans, credit cards, other), down payment ($ or %), interest rate, loan term, property tax rate, homeowner's insurance, HOA fees
- **DTI analysis** — calculates front-end (28%) and back-end (36%) debt-to-income ratios with color-coded indicators
- **PMI detection** — automatically includes private mortgage insurance when down payment is under 20%
- **Payment breakdown** — doughnut chart and itemized table showing P&I, taxes, insurance, HOA, and PMI
- Shows max affordable home price, loan amount, and estimated monthly payment

## Usage

Open any calculator page in a modern web browser. No installation or build step required. Use the navigation bar at the top to switch between calculators.

**Loan Repayment:**
1. Enter loan details (or use the pre-filled defaults)
2. Click **Calculate** to see results, balance graph, and amortization schedule
3. Optionally expand **Extra Payments** to model additional principal payments
4. Use the **Loan Comparison** tab to compare different scenarios

**Mortgage Affordability:**
1. Enter your income, debts, down payment, and property cost details
2. Click **Calculate** to see your maximum affordable home price
3. Review the DTI ratios and monthly payment breakdown chart

## Project Structure

```
index.html                  — Loan repayment calculator page
calculator.js               — Loan repayment calculation engine and UI
mortgage-affordability.html — Mortgage affordability calculator page
mortgage-affordability.js   — Affordability calculation engine and UI
styles.css                  — Shared responsive styling with CSS variables
```

## Formulas

**Amortization (P&I):**

```
M = P × [r(1+r)^n] / [(1+r)^n − 1]
```

**Interest Only:**

```
M = P × r
```

**Max Loan from Payment:**

```
P = M × [(1+r)^n − 1] / [r(1+r)^n]
```

Where **P** = principal, **M** = payment, **r** = per-period interest rate, **n** = total number of payments.

**DTI Ratios:**
- Front-end: Housing costs / Gross monthly income ≤ 28%
- Back-end: (Housing costs + All debts) / Gross monthly income ≤ 36%

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled. Chart.js is loaded from a CDN.
