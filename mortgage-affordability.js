/* ============================================================
   Mortgage Affordability Calculator — mortgage-affordability.js
   ============================================================ */

// ── Utilities ────────────────────────────────────────────────

function formatCurrency(value) {
  return '$' + Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatCurrencyWhole(value) {
  return '$' + Math.round(Math.abs(value)).toLocaleString('en-US');
}

function parseCurrencyInput(str) {
  return parseFloat(String(str).replace(/,/g, ''));
}

function formatCurrencyInputValue(value) {
  var num = parseCurrencyInput(value);
  if (isNaN(num)) return value;
  return Math.round(num).toLocaleString('en-US');
}

// ── Core Calculations ────────────────────────────────────────

var FRONT_END_DTI_LIMIT = 0.28;
var BACK_END_DTI_LIMIT = 0.36;
var PMI_ANNUAL_RATE = 0.007;

function calculateMonthlyPI(principal, annualRate, termYears) {
  var r = (annualRate / 100) / 12;
  var n = termYears * 12;
  if (r === 0) return principal / n;
  var factor = Math.pow(1 + r, n);
  return principal * (r * factor) / (factor - 1);
}

function maxLoanFromPayment(maxMonthlyPI, annualRate, termYears) {
  var r = (annualRate / 100) / 12;
  var n = termYears * 12;
  if (r === 0) return maxMonthlyPI * n;
  var factor = Math.pow(1 + r, n);
  return maxMonthlyPI * (factor - 1) / (r * factor);
}

function calculateAffordability(inputs) {
  var monthlyGross = inputs.annualIncome / 12;
  var totalMonthlyDebts = inputs.debtCar + inputs.debtStudent + inputs.debtCredit + inputs.debtOther;

  var maxHousingFrontEnd = FRONT_END_DTI_LIMIT * monthlyGross;
  var maxHousingBackEnd = BACK_END_DTI_LIMIT * monthlyGross - totalMonthlyDebts;
  var maxHousingCost = Math.min(maxHousingFrontEnd, Math.max(0, maxHousingBackEnd));

  var monthlyInsurance = inputs.homeInsurance / 12;
  var monthlyHOA = inputs.hoaFees;

  // Two-pass: first assume PMI, then check if it's actually needed
  for (var pass = 0; pass < 2; pass++) {
    var needsPMI = (pass === 0) ? (inputs.downPaymentType === 'percent' ? inputs.downPayment < 20 : true) : false;

    // Available for P&I + tax + PMI after subtracting insurance and HOA
    var availableForPITaxPMI = maxHousingCost - monthlyInsurance - monthlyHOA;
    if (availableForPITaxPMI <= 0) {
      return buildResult(0, 0, 0, inputs, monthlyGross, totalMonthlyDebts);
    }

    // Tax and PMI are proportional to home price, so we solve algebraically.
    // Let H = home price, D = down payment, L = loan amount = H - D
    // Monthly tax = H * taxRate / 12
    // Monthly PMI = L * PMI_RATE / 12 (if applicable)
    // Monthly P&I = f(L) via amortization formula
    //
    // For percentage down payment: D = H * pct/100, L = H * (1 - pct/100)
    // For dollar down payment: D = fixed, L = H - D
    //
    // We need: P&I + tax + PMI <= availableForPITaxPMI
    // Use iteration since P&I is non-linear relative to H

    var maxHomePrice = solveMaxHomePrice(
      availableForPITaxPMI,
      inputs.annualRate,
      inputs.loanTerm,
      inputs.propertyTaxRate,
      inputs.downPayment,
      inputs.downPaymentType,
      needsPMI
    );

    var downPaymentAmount, loanAmount;
    if (inputs.downPaymentType === 'percent') {
      downPaymentAmount = maxHomePrice * (inputs.downPayment / 100);
      loanAmount = maxHomePrice - downPaymentAmount;
    } else {
      downPaymentAmount = inputs.downPayment;
      loanAmount = maxHomePrice - downPaymentAmount;
    }

    // Check if PMI is actually needed after solving
    var ltv = maxHomePrice > 0 ? (loanAmount / maxHomePrice) : 0;
    if (pass === 0 && ltv <= 0.80) {
      // PMI not needed, recalculate without it
      continue;
    }

    var actualPMI = ltv > 0.80 ? (loanAmount * PMI_ANNUAL_RATE / 12) : 0;
    return buildResult(maxHomePrice, loanAmount, downPaymentAmount, inputs, monthlyGross, totalMonthlyDebts, actualPMI);
  }

  // Final pass without PMI
  var maxHomePrice = solveMaxHomePrice(
    maxHousingCost - monthlyInsurance - monthlyHOA,
    inputs.annualRate,
    inputs.loanTerm,
    inputs.propertyTaxRate,
    inputs.downPayment,
    inputs.downPaymentType,
    false
  );

  var downPaymentAmount, loanAmount;
  if (inputs.downPaymentType === 'percent') {
    downPaymentAmount = maxHomePrice * (inputs.downPayment / 100);
    loanAmount = maxHomePrice - downPaymentAmount;
  } else {
    downPaymentAmount = inputs.downPayment;
    loanAmount = maxHomePrice - downPaymentAmount;
  }

  return buildResult(maxHomePrice, loanAmount, downPaymentAmount, inputs, monthlyGross, totalMonthlyDebts, 0);
}

function solveMaxHomePrice(availableMonthly, annualRate, termYears, taxRate, downPayment, downPaymentType, includePMI) {
  // Binary search for max home price
  var lo = 0;
  var hi = 5000000;

  for (var i = 0; i < 50; i++) {
    var mid = (lo + hi) / 2;
    var cost = housingCostForPrice(mid, annualRate, termYears, taxRate, downPayment, downPaymentType, includePMI);
    if (cost <= availableMonthly) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return Math.floor(lo);
}

function housingCostForPrice(homePrice, annualRate, termYears, taxRate, downPayment, downPaymentType, includePMI) {
  var loanAmount;
  if (downPaymentType === 'percent') {
    loanAmount = homePrice * (1 - downPayment / 100);
  } else {
    loanAmount = Math.max(0, homePrice - downPayment);
  }

  var monthlyPI = calculateMonthlyPI(loanAmount, annualRate, termYears);
  var monthlyTax = homePrice * (taxRate / 100) / 12;
  var monthlyPMI = 0;

  if (includePMI && homePrice > 0) {
    var ltv = loanAmount / homePrice;
    if (ltv > 0.80) {
      monthlyPMI = loanAmount * PMI_ANNUAL_RATE / 12;
    }
  }

  return monthlyPI + monthlyTax + monthlyPMI;
}

function buildResult(maxHomePrice, loanAmount, downPaymentAmount, inputs, monthlyGross, totalMonthlyDebts, monthlyPMI) {
  if (!monthlyPMI) monthlyPMI = 0;

  var monthlyPI = loanAmount > 0 ? calculateMonthlyPI(loanAmount, inputs.annualRate, inputs.loanTerm) : 0;
  var monthlyTax = maxHomePrice * (inputs.propertyTaxRate / 100) / 12;
  var monthlyInsurance = inputs.homeInsurance / 12;
  var monthlyHOA = inputs.hoaFees;
  var totalMonthlyHousing = monthlyPI + monthlyTax + monthlyInsurance + monthlyHOA + monthlyPMI;

  var frontEndDTI = monthlyGross > 0 ? (totalMonthlyHousing / monthlyGross * 100) : 0;
  var backEndDTI = monthlyGross > 0 ? ((totalMonthlyHousing + totalMonthlyDebts) / monthlyGross * 100) : 0;
  var downPaymentPercent = maxHomePrice > 0 ? (downPaymentAmount / maxHomePrice * 100) : 0;

  return {
    maxHomePrice: maxHomePrice,
    loanAmount: loanAmount,
    downPaymentAmount: downPaymentAmount,
    downPaymentPercent: downPaymentPercent,
    monthlyPI: monthlyPI,
    monthlyTax: monthlyTax,
    monthlyInsurance: monthlyInsurance,
    monthlyHOA: monthlyHOA,
    monthlyPMI: monthlyPMI,
    totalMonthlyPayment: totalMonthlyHousing,
    frontEndDTI: frontEndDTI,
    backEndDTI: backEndDTI,
    totalMonthlyDebts: totalMonthlyDebts
  };
}

// ── DOM Rendering ────────────────────────────────────────────

var paymentChart = null;

function renderResults(result) {
  var html = '<div class="summary-grid">';
  html += summaryItem('Max Home Price', formatCurrencyWhole(result.maxHomePrice));
  html += summaryItem('Max Loan Amount', formatCurrencyWhole(result.loanAmount));
  html += summaryItem('Down Payment', formatCurrencyWhole(result.downPaymentAmount) + ' (' + result.downPaymentPercent.toFixed(1) + '%)');
  html += summaryItem('Monthly Payment', formatCurrency(result.totalMonthlyPayment));

  var feDTIClass = result.frontEndDTI <= 28 ? 'dti-good' : result.frontEndDTI <= 31 ? 'dti-warning' : 'dti-over';
  var beDTIClass = result.backEndDTI <= 36 ? 'dti-good' : result.backEndDTI <= 43 ? 'dti-warning' : 'dti-over';
  html += '<div class="summary-item"><div class="label">Front-End DTI</div><div class="value ' + feDTIClass + '">' + result.frontEndDTI.toFixed(1) + '%</div></div>';
  html += '<div class="summary-item"><div class="label">Back-End DTI</div><div class="value ' + beDTIClass + '">' + result.backEndDTI.toFixed(1) + '%</div></div>';
  html += '</div>';

  // DTI guidance banner
  var withinLimits = result.frontEndDTI <= 28 && result.backEndDTI <= 36;
  if (withinLimits) {
    html += '<div class="savings-banner"><div class="label">Qualification</div>';
    html += '<div class="value">Within conventional lending guidelines</div></div>';
  } else {
    html += '<div class="savings-banner" style="background:#fef3c7;border-color:#fde68a"><div class="label" style="color:#d97706">Note</div>';
    html += '<div class="value" style="color:#92400e">At the maximum price, DTI ratios are at conventional limits. Some lenders may have stricter requirements.</div></div>';
  }

  if (result.monthlyPMI > 0) {
    html += '<div class="savings-banner" style="background:#fef3c7;border-color:#fde68a;margin-top:0.5rem"><div class="label" style="color:#d97706">PMI Required</div>';
    html += '<div class="value" style="color:#92400e">Down payment is under 20% &mdash; PMI of ' + formatCurrency(result.monthlyPMI) + '/mo is included.</div></div>';
  }

  document.getElementById('results-summary').innerHTML = html;
}

function summaryItem(label, value) {
  return '<div class="summary-item"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
}

function renderPaymentChart(result) {
  var section = document.getElementById('breakdown-section');
  if (result.totalMonthlyPayment <= 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  var labels = ['Principal & Interest', 'Property Tax', 'Insurance'];
  var data = [result.monthlyPI, result.monthlyTax, result.monthlyInsurance];
  var colors = ['#2563eb', '#7c3aed', '#ea580c'];

  if (result.monthlyHOA > 0) {
    labels.push('HOA');
    data.push(result.monthlyHOA);
    colors.push('#16a34a');
  }
  if (result.monthlyPMI > 0) {
    labels.push('PMI');
    data.push(result.monthlyPMI);
    colors.push('#8b5cf6');
  }

  var ctx = document.getElementById('payment-chart').getContext('2d');

  if (paymentChart) {
    paymentChart.destroy();
  }

  paymentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 12,
            font: { size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              var total = context.dataset.data.reduce(function(a, b) { return a + b; }, 0);
              var pct = (context.parsed / total * 100).toFixed(1);
              return context.label + ': ' + formatCurrency(context.parsed) + ' (' + pct + '%)';
            }
          }
        }
      }
    }
  });

  // Breakdown table
  var tableHtml = '<table class="breakdown-table">';
  for (var i = 0; i < labels.length; i++) {
    tableHtml += '<tr><td>' + labels[i] + '</td><td>' + formatCurrency(data[i]) + '</td></tr>';
  }
  tableHtml += '<tr class="total-row"><td>Total Monthly</td><td>' + formatCurrency(result.totalMonthlyPayment) + '</td></tr>';
  tableHtml += '</table>';

  document.getElementById('breakdown-table-container').innerHTML = tableHtml;
}

// ── Input Validation ─────────────────────────────────────────

function validateField(input, min, max) {
  var val = parseCurrencyInput(input.value);
  var err = input.parentElement.querySelector('.error-msg');
  if (!err) err = input.parentElement.parentElement.querySelector('.error-msg');
  if (isNaN(val) || val < min || (max !== undefined && val > max)) {
    input.classList.add('invalid');
    if (err) err.textContent = 'Enter a valid number' + (max !== undefined ? ' (' + min + '–' + max + ')' : ' (min ' + min + ')');
    return NaN;
  }
  input.classList.remove('invalid');
  if (err) err.textContent = '';
  return val;
}

// ── Event Handlers ───────────────────────────────────────────

function handleCalculate(e) {
  e.preventDefault();

  var incomeInput = document.getElementById('annual-income');
  incomeInput.value = formatCurrencyInputValue(incomeInput.value);
  var annualIncome = validateField(incomeInput, 1);
  var annualRate = validateField(document.getElementById('interest-rate'), 0, 20);

  if (isNaN(annualIncome) || isNaN(annualRate)) return;

  var downPaymentType = document.getElementById('down-payment-type').value;
  var downPaymentInput = document.getElementById('down-payment');
  var downPayment;
  if (downPaymentType === 'dollar') {
    downPaymentInput.value = formatCurrencyInputValue(downPaymentInput.value);
    downPayment = validateField(downPaymentInput, 0);
  } else {
    downPayment = validateField(downPaymentInput, 0, 99);
  }
  if (isNaN(downPayment)) return;

  var inputs = {
    annualIncome: annualIncome,
    debtCar: parseFloat(document.getElementById('debt-car').value) || 0,
    debtStudent: parseFloat(document.getElementById('debt-student').value) || 0,
    debtCredit: parseFloat(document.getElementById('debt-credit').value) || 0,
    debtOther: parseFloat(document.getElementById('debt-other').value) || 0,
    downPayment: downPayment,
    downPaymentType: downPaymentType,
    annualRate: annualRate,
    loanTerm: parseInt(document.getElementById('loan-term').value),
    propertyTaxRate: parseFloat(document.getElementById('property-tax-rate').value) || 0,
    homeInsurance: parseFloat(document.getElementById('home-insurance').value) || 0,
    hoaFees: parseFloat(document.getElementById('hoa-fees').value) || 0
  };

  var result = calculateAffordability(inputs);
  renderResults(result);
  renderPaymentChart(result);
}

function handleDownPaymentTypeChange() {
  var type = document.getElementById('down-payment-type').value;
  var input = document.getElementById('down-payment');
  if (type === 'percent') {
    input.placeholder = '20';
    input.value = '20';
  } else {
    input.placeholder = '40,000';
    input.value = '40,000';
  }
}

// ── Initialization ───────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('affordability-form').addEventListener('submit', handleCalculate);
  document.getElementById('down-payment-type').addEventListener('change', handleDownPaymentTypeChange);

  document.getElementById('annual-income').addEventListener('blur', function() {
    this.value = formatCurrencyInputValue(this.value);
  });

  document.getElementById('down-payment').addEventListener('blur', function() {
    if (document.getElementById('down-payment-type').value === 'dollar') {
      this.value = formatCurrencyInputValue(this.value);
    }
  });
});
