/* ============================================================
   Loan Repayment Calculator — calculator.js
   Pure calculation functions + DOM rendering + event handling
   ============================================================ */

// ── Utilities ────────────────────────────────────────────────

function formatCurrency(value) {
  return '$' + Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getPeriodsPerYear(frequency) {
  switch (frequency) {
    case 'biweekly': return 26;
    case 'weekly':   return 52;
    default:         return 12;
  }
}

function addPeriods(startDate, paymentNumber, frequency) {
  const d = new Date(startDate);
  if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + paymentNumber);
  } else if (frequency === 'biweekly') {
    d.setDate(d.getDate() + paymentNumber * 14);
  } else {
    d.setDate(d.getDate() + paymentNumber * 7);
  }
  return d;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ── Core Calculations ────────────────────────────────────────

function calculatePayment(principal, perPeriodRate, totalPayments, loanType) {
  if (loanType === 'io') {
    return principal * perPeriodRate;
  }
  if (perPeriodRate === 0) {
    return principal / totalPayments;
  }
  const factor = Math.pow(1 + perPeriodRate, totalPayments);
  return principal * (perPeriodRate * factor) / (factor - 1);
}

function generateAmortizationSchedule(principal, annualRate, termYears, frequency, loanType, extraPerPeriod, oneTimeExtras) {
  const periodsPerYear = getPeriodsPerYear(frequency);
  const perPeriodRate = (annualRate / 100) / periodsPerYear;
  const totalPayments = Math.round(termYears * periodsPerYear);
  const regularPayment = calculatePayment(principal, perPeriodRate, totalPayments, loanType);
  const startDate = new Date();
  startDate.setDate(1);
  startDate.setMonth(startDate.getMonth() + 1);

  const oneTimeMap = {};
  if (oneTimeExtras) {
    oneTimeExtras.forEach(function(e) { oneTimeMap[e.paymentNumber] = (oneTimeMap[e.paymentNumber] || 0) + e.amount; });
  }

  const rows = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  let totalExtraPaid = 0;

  for (let i = 1; i <= totalPayments && balance > 0.005; i++) {
    const interestPortion = balance * perPeriodRate;
    let principalPortion;
    let payment;

    if (loanType === 'io') {
      principalPortion = 0;
      payment = interestPortion;
    } else {
      principalPortion = regularPayment - interestPortion;
      payment = regularPayment;
    }

    let extra = (extraPerPeriod || 0) + (oneTimeMap[i] || 0);

    // Ensure we don't overpay
    if (principalPortion + extra > balance) {
      if (principalPortion > balance) {
        principalPortion = balance;
        payment = principalPortion + interestPortion;
        extra = 0;
      } else {
        extra = balance - principalPortion;
      }
    }

    balance -= (principalPortion + extra);
    if (balance < 0.005) balance = 0;

    totalInterest += interestPortion;
    totalPaid += payment + extra;
    totalExtraPaid += extra;

    rows.push({
      paymentNumber: i,
      date: formatDate(addPeriods(startDate, i, frequency)),
      paymentAmount: payment + extra,
      principal: principalPortion,
      interest: interestPortion,
      extra: extra,
      balance: balance
    });
  }

  // For IO loans, add the balloon payment at the end
  if (loanType === 'io' && balance > 0.005) {
    totalPaid += balance;
    rows.push({
      paymentNumber: rows.length + 1,
      date: formatDate(addPeriods(startDate, rows.length + 1, frequency)),
      paymentAmount: balance,
      principal: balance,
      interest: 0,
      extra: 0,
      balance: 0
    });
    balance = 0;
  }

  return {
    rows: rows,
    summary: {
      regularPayment: regularPayment,
      totalInterest: totalInterest,
      totalPaid: totalPaid,
      totalPayments: rows.length,
      totalExtraPaid: totalExtraPaid,
      payoffDate: rows.length > 0 ? rows[rows.length - 1].date : 'N/A',
      loanType: loanType
    }
  };
}

function scheduleToCSV(schedule) {
  var csv = 'Payment #,Date,Payment,Principal,Interest,Extra,Balance\n';
  schedule.rows.forEach(function(r) {
    csv += r.paymentNumber + ',' + r.date + ',' +
      r.paymentAmount.toFixed(2) + ',' + r.principal.toFixed(2) + ',' +
      r.interest.toFixed(2) + ',' + r.extra.toFixed(2) + ',' +
      r.balance.toFixed(2) + '\n';
  });
  return csv;
}

// ── DOM Rendering ────────────────────────────────────────────

var fullSchedule = null;
var oneTimeExtras = [];
var loanChart = null;

function renderLoanGraph(rows) {
  var section = document.getElementById('loan-graph-section');
  if (!rows || rows.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  // Sample data points to keep chart readable (max ~60 points)
  var step = Math.max(1, Math.floor(rows.length / 60));
  var labels = [];
  var balanceData = [];
  var cumulativePrincipalData = [];
  var cumulativeInterestData = [];
  var cumPrincipal = 0;
  var cumInterest = 0;

  for (var i = 0; i < rows.length; i++) {
    cumPrincipal += rows[i].principal + rows[i].extra;
    cumInterest += rows[i].interest;
    if (i % step === 0 || i === rows.length - 1) {
      labels.push(rows[i].date);
      balanceData.push(parseFloat(rows[i].balance.toFixed(2)));
      cumulativePrincipalData.push(parseFloat(cumPrincipal.toFixed(2)));
      cumulativeInterestData.push(parseFloat(cumInterest.toFixed(2)));
    }
  }

  var ctx = document.getElementById('loan-graph').getContext('2d');

  if (loanChart) {
    loanChart.destroy();
  }

  loanChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Remaining Balance',
          data: balanceData,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Cumulative Principal Paid',
          data: cumulativePrincipalData,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Cumulative Interest Paid',
          data: cumulativeInterestData,
          borderColor: '#ea580c',
          backgroundColor: 'rgba(234, 88, 12, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
            }
          }
        },
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 16
          }
        }
      },
      scales: {
        x: {
          display: true,
          ticks: {
            maxTicksLimit: 8,
            maxRotation: 45
          },
          grid: {
            display: false
          }
        },
        y: {
          display: true,
          ticks: {
            callback: function(value) {
              if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'k';
              return '$' + value;
            }
          },
          grid: {
            color: 'rgba(0,0,0,0.06)'
          }
        }
      }
    }
  });
}

function renderSummary(summary, baselineSummary) {
  var html = '<div class="summary-grid">';
  html += summaryItem('Payment', formatCurrency(summary.regularPayment) + '/' + freqLabel());
  html += summaryItem('Total Interest', formatCurrency(summary.totalInterest));
  html += summaryItem('Total Paid', formatCurrency(summary.totalPaid));
  html += summaryItem('# Payments', summary.totalPayments);
  html += summaryItem('Payoff Date', summary.payoffDate);
  if (summary.loanType === 'io') {
    html += summaryItem('Type', 'Interest Only');
  }
  html += '</div>';

  if (baselineSummary && (baselineSummary.totalInterest - summary.totalInterest) > 0.01) {
    var savedInterest = baselineSummary.totalInterest - summary.totalInterest;
    var savedPayments = baselineSummary.totalPayments - summary.totalPayments;
    html += '<div class="savings-banner">';
    html += '<div class="label">With Extra Payments You Save</div>';
    html += '<div class="value">' + formatCurrency(savedInterest) + ' interest';
    if (savedPayments > 0) {
      html += ' &bull; ' + savedPayments + ' fewer payments';
    }
    html += '</div></div>';
  }

  document.getElementById('results-summary').innerHTML = html;
}

function summaryItem(label, value) {
  return '<div class="summary-item"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
}

function freqLabel() {
  var f = document.getElementById('payment-frequency').value;
  if (f === 'biweekly') return 'bi-wk';
  if (f === 'weekly') return 'wk';
  return 'mo';
}

function renderBarChart(summary, baselineSummary) {
  var container = document.getElementById('bar-chart');
  if (!summary) { container.innerHTML = ''; return; }

  var principalAmt = summary.totalPaid - summary.totalInterest - (summary.totalExtraPaid || 0);
  var total = summary.totalPaid;
  var pPct = (principalAmt / total * 100).toFixed(1);
  var iPct = (summary.totalInterest / total * 100).toFixed(1);
  var ePct = ((summary.totalExtraPaid || 0) / total * 100).toFixed(1);

  var html = '<div class="bar-row"><div class="bar-label">Payment Breakdown</div><div class="bar-track">';
  html += '<div class="bar-segment principal" style="width:' + pPct + '%">' + (pPct > 8 ? formatCurrency(principalAmt) : '') + '</div>';
  html += '<div class="bar-segment interest" style="width:' + iPct + '%">' + (iPct > 8 ? formatCurrency(summary.totalInterest) : '') + '</div>';
  if (ePct > 0) {
    html += '<div class="bar-segment extra" style="width:' + ePct + '%">' + (ePct > 8 ? formatCurrency(summary.totalExtraPaid) : '') + '</div>';
  }
  html += '</div></div>';

  html += '<div class="bar-legend"><span class="leg-principal">Principal</span><span class="leg-interest">Interest</span>';
  if (ePct > 0) html += '<span class="leg-extra">Extra</span>';
  html += '</div>';

  if (baselineSummary) {
    var bTotal = baselineSummary.totalPaid;
    var bPrincipal = bTotal - baselineSummary.totalInterest;
    var bpPct = (bPrincipal / bTotal * 100).toFixed(1);
    var biPct = (baselineSummary.totalInterest / bTotal * 100).toFixed(1);
    html += '<div class="bar-row" style="margin-top:0.75rem"><div class="bar-label">Without Extra Payments</div><div class="bar-track">';
    html += '<div class="bar-segment principal" style="width:' + bpPct + '%"></div>';
    html += '<div class="bar-segment interest" style="width:' + biPct + '%"></div>';
    html += '</div></div>';
  }

  container.innerHTML = html;
}

function renderAmortTable(rows, limit) {
  var tbody = document.getElementById('amort-body');
  tbody.innerHTML = '';
  var count = limit || rows.length;
  for (var i = 0; i < count && i < rows.length; i++) {
    var r = rows[i];
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + r.paymentNumber + '</td><td>' + r.date + '</td><td>' +
      formatCurrency(r.paymentAmount) + '</td><td>' + formatCurrency(r.principal) + '</td><td>' +
      formatCurrency(r.interest) + '</td><td>' + formatCurrency(r.extra) + '</td><td>' +
      formatCurrency(r.balance) + '</td>';
    tbody.appendChild(tr);
  }

  var btn = document.getElementById('show-all-rows');
  if (rows.length > count) {
    btn.classList.remove('hidden');
    btn.textContent = 'Show All ' + rows.length + ' Rows';
  } else {
    btn.classList.add('hidden');
  }

  document.getElementById('amortization-section').classList.remove('hidden');
}

// ── Comparison Rendering ─────────────────────────────────────

function renderComparison(summaries) {
  var tbody = document.getElementById('compare-body');
  tbody.innerHTML = '';
  var metrics = [
    { label: 'Payment', key: 'regularPayment', fmt: formatCurrency },
    { label: 'Total Interest', key: 'totalInterest', fmt: formatCurrency },
    { label: 'Total Paid', key: 'totalPaid', fmt: formatCurrency },
    { label: '# Payments', key: 'totalPayments', fmt: String },
    { label: 'Payoff Date', key: 'payoffDate', fmt: String },
    { label: 'Loan Type', key: 'loanType', fmt: function(v) { return v === 'io' ? 'Interest Only' : 'P&I'; } }
  ];

  metrics.forEach(function(m) {
    var tr = document.createElement('tr');
    var html = '<td>' + m.label + '</td>';
    summaries.forEach(function(s) {
      html += '<td>' + (s ? m.fmt(s[m.key]) : '—') + '</td>';
    });
    tr.innerHTML = html;
    tbody.appendChild(tr);
  });

  // Chart
  var chartContainer = document.getElementById('compare-chart');
  var chartHtml = '';
  var chartMetrics = [
    { label: 'Total Interest', key: 'totalInterest' },
    { label: 'Total Paid', key: 'totalPaid' }
  ];

  chartMetrics.forEach(function(cm) {
    var vals = summaries.map(function(s) { return s ? s[cm.key] : 0; });
    var maxVal = Math.max.apply(null, vals.filter(function(v) { return v > 0; })) || 1;
    chartHtml += '<div class="chart-group"><div class="chart-group-label">' + cm.label + '</div>';
    summaries.forEach(function(s, idx) {
      if (!s) return;
      var pct = (s[cm.key] / maxVal * 100).toFixed(1);
      chartHtml += '<div class="chart-bar-row"><div class="chart-bar-name">Loan ' + (idx + 1) +
        '</div><div class="chart-bar-track"><div class="chart-bar-fill loan-' + (idx + 1) +
        '" style="width:' + pct + '%">' + formatCurrency(s[cm.key]) + '</div></div></div>';
    });
    chartHtml += '</div>';
  });

  chartContainer.innerHTML = chartHtml;
  document.getElementById('compare-results').classList.remove('hidden');
}

// ── Input Validation ─────────────────────────────────────────

function validateField(input, min, max) {
  var val = parseFloat(input.value);
  var err = input.parentElement.querySelector('.error-msg');
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

  var amount = validateField(document.getElementById('loan-amount'), 1);
  var rate = validateField(document.getElementById('interest-rate'), 0, 100);
  var term = validateField(document.getElementById('loan-term'), 1, 50);

  if (isNaN(amount) || isNaN(rate) || isNaN(term)) return;

  var frequency = document.getElementById('payment-frequency').value;
  var loanType = document.getElementById('loan-type').value;
  var extraPerPeriod = parseFloat(document.getElementById('extra-per-period').value) || 0;

  var hasExtras = extraPerPeriod > 0 || oneTimeExtras.length > 0;

  var schedule = generateAmortizationSchedule(amount, rate, term, frequency, loanType, extraPerPeriod, oneTimeExtras);
  fullSchedule = schedule;

  var baseline = null;
  if (hasExtras) {
    baseline = generateAmortizationSchedule(amount, rate, term, frequency, loanType, 0, []);
  }

  renderSummary(schedule.summary, baseline ? baseline.summary : null);
  renderBarChart(schedule.summary, baseline ? baseline.summary : null);
  renderLoanGraph(schedule.rows);
  renderAmortTable(schedule.rows, 60);
}

function handleCompare() {
  var cards = document.querySelectorAll('.compare-card');
  var summaries = [];
  var valid = false;

  cards.forEach(function(card) {
    var amt = parseFloat(card.querySelector('.cmp-amount').value);
    var rate = parseFloat(card.querySelector('.cmp-rate').value);
    var term = parseFloat(card.querySelector('.cmp-term').value);
    var freq = card.querySelector('.cmp-freq').value;
    var type = card.querySelector('.cmp-type').value;

    if (isNaN(amt) || isNaN(rate) || isNaN(term) || amt <= 0 || rate < 0 || term <= 0) {
      summaries.push(null);
      return;
    }
    valid = true;
    var result = generateAmortizationSchedule(amt, rate, term, freq, type, 0, []);
    summaries.push(result.summary);
  });

  if (!valid) return;
  renderComparison(summaries);
}

function handleToggleExtras() {
  var panel = document.getElementById('extras-panel');
  var btn = document.getElementById('toggle-extras');
  panel.classList.toggle('hidden');
  btn.classList.toggle('expanded');
  btn.textContent = panel.classList.contains('hidden') ? '+ Extra Payments' : '− Extra Payments';
}

function handleAddOneTime() {
  var numInput = document.getElementById('one-time-payment-num');
  var amtInput = document.getElementById('one-time-amount');
  var num = parseInt(numInput.value);
  var amt = parseFloat(amtInput.value);
  if (isNaN(num) || num < 1 || isNaN(amt) || amt <= 0) return;

  oneTimeExtras.push({ paymentNumber: num, amount: amt });
  numInput.value = '';
  amtInput.value = '';
  renderChips();
}

function renderChips() {
  var container = document.getElementById('one-time-chips');
  container.innerHTML = '';
  oneTimeExtras.forEach(function(e, idx) {
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = '#' + e.paymentNumber + ': ' + formatCurrency(e.amount) +
      ' <button data-idx="' + idx + '">&times;</button>';
    container.appendChild(chip);
  });
}

function handleRemoveChip(e) {
  if (e.target.tagName === 'BUTTON' && e.target.dataset.idx !== undefined) {
    oneTimeExtras.splice(parseInt(e.target.dataset.idx), 1);
    renderChips();
  }
}

function handleShowAllRows() {
  if (fullSchedule) {
    renderAmortTable(fullSchedule.rows, fullSchedule.rows.length);
  }
}

function handleDownloadCSV() {
  if (!fullSchedule) return;
  var csv = scheduleToCSV(fullSchedule);
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'amortization_schedule.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleTabSwitch(e) {
  var tabName = e.target.dataset.tab;
  if (!tabName) return;

  document.querySelectorAll('.tab').forEach(function(t) {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  e.target.classList.add('active');
  e.target.setAttribute('aria-selected', 'true');

  document.querySelectorAll('.tab-content').forEach(function(c) {
    c.classList.remove('active');
  });
  document.getElementById('tab-' + tabName).classList.add('active');
}

// ── Initialization ───────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('loan-form').addEventListener('submit', handleCalculate);
  document.getElementById('toggle-extras').addEventListener('click', handleToggleExtras);
  document.getElementById('add-one-time').addEventListener('click', handleAddOneTime);
  document.getElementById('one-time-chips').addEventListener('click', handleRemoveChip);
  document.getElementById('show-all-rows').addEventListener('click', handleShowAllRows);
  document.getElementById('download-csv').addEventListener('click', handleDownloadCSV);
  document.getElementById('compare-btn').addEventListener('click', handleCompare);

  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', handleTabSwitch);
  });

  // Allow Enter key in compare card inputs to trigger compare
  document.querySelectorAll('.compare-card input').forEach(function(input) {
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleCompare();
    });
  });
});
