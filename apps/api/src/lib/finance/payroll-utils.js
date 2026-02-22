function toSafeMinor(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(Math.round(number), 0);
}

function computePayrollAmounts({
  baseSalaryMinor,
  allowancesMinor,
  nonLoanDeductionsMinor,
  plannedLoanDeductionMinor,
}) {
  const base = toSafeMinor(baseSalaryMinor);
  const allowances = toSafeMinor(allowancesMinor);
  const nonLoanDeductions = toSafeMinor(nonLoanDeductionsMinor);
  const plannedLoanDeduction = toSafeMinor(plannedLoanDeductionMinor);

  const grossMinor = base + allowances;
  const expenseBaseMinor = Math.max(grossMinor - nonLoanDeductions, 0);
  const actualLoanDeductionMinor = Math.min(plannedLoanDeduction, expenseBaseMinor);
  const netPaidMinor = Math.max(expenseBaseMinor - actualLoanDeductionMinor, 0);

  return {
    gross_minor: grossMinor,
    expense_base_minor: expenseBaseMinor,
    actual_loan_deduction_minor: actualLoanDeductionMinor,
    net_paid_minor: netPaidMinor,
  };
}

function calculateMonthlyInterestMinor(outstandingPrincipalMinor, annualInterestBps) {
  const principal = toSafeMinor(outstandingPrincipalMinor);
  const bps = Math.max(Number(annualInterestBps || 0), 0);
  if (principal <= 0 || bps <= 0) {
    return 0;
  }

  return Math.round((principal * bps) / 10000 / 12);
}

function remainingDueMinor(row) {
  const principalDue = toSafeMinor(row.principal_due_minor);
  const interestDue = toSafeMinor(row.interest_due_minor);
  const principalPaid = toSafeMinor(row.principal_paid_minor);
  const interestPaid = toSafeMinor(row.interest_paid_minor);

  return {
    principal_remaining_minor: Math.max(principalDue - principalPaid, 0),
    interest_remaining_minor: Math.max(interestDue - interestPaid, 0),
  };
}

function allocateLoanPayment(scheduleRows, paymentMinor) {
  let remaining = toSafeMinor(paymentMinor);

  const sorted = [...(scheduleRows || [])].sort((a, b) => {
    if (a.due_date === b.due_date) {
      return Number(a.id || 0) - Number(b.id || 0);
    }
    return String(a.due_date).localeCompare(String(b.due_date));
  });

  let principalPaidTotal = 0;
  let interestPaidTotal = 0;

  const updatedRows = sorted.map((row) => {
    const updated = {
      ...row,
      principal_paid_minor: toSafeMinor(row.principal_paid_minor),
      interest_paid_minor: toSafeMinor(row.interest_paid_minor),
    };

    if (remaining <= 0) {
      return updated;
    }

    const before = remainingDueMinor(updated);

    const interestPay = Math.min(remaining, before.interest_remaining_minor);
    if (interestPay > 0) {
      updated.interest_paid_minor += interestPay;
      remaining -= interestPay;
      interestPaidTotal += interestPay;
    }

    const afterInterest = remainingDueMinor(updated);
    const principalPay = Math.min(remaining, afterInterest.principal_remaining_minor);
    if (principalPay > 0) {
      updated.principal_paid_minor += principalPay;
      remaining -= principalPay;
      principalPaidTotal += principalPay;
    }

    const dueAfter = remainingDueMinor(updated);
    if (dueAfter.principal_remaining_minor === 0 && dueAfter.interest_remaining_minor === 0) {
      updated.status = 'PAID';
    } else if (updated.principal_paid_minor > 0 || updated.interest_paid_minor > 0) {
      updated.status = 'PARTIAL';
    } else {
      updated.status = 'DUE';
    }

    return updated;
  });

  return {
    updated_rows: updatedRows,
    principal_paid_minor: principalPaidTotal,
    interest_paid_minor: interestPaidTotal,
    unapplied_minor: remaining,
  };
}

module.exports = {
  toSafeMinor,
  computePayrollAmounts,
  calculateMonthlyInterestMinor,
  remainingDueMinor,
  allocateLoanPayment,
};
