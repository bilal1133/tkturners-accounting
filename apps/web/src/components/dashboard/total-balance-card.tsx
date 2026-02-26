'use client';

import { useEffect, useMemo, useState } from 'react';

import { fetchLatestFxRates } from '@/lib/fx';
import { formatMinor } from '@/lib/format';
import type { AccountBalanceSnapshot } from '@/lib/types';

import styles from './total-balance-card.module.css';

type Props = {
  balances: AccountBalanceSnapshot[];
  workspaceBaseCurrency: string;
};

type ConversionState = {
  totalMinor: number;
  convertedCount: number;
  unconvertedCount: number;
  rateDate: string | null;
  loading: boolean;
  error: string | null;
};

const PRIORITY_CURRENCIES = ['USD', 'EUR', 'PKR'];

function toCurrency(value: string) {
  return String(value || '').trim().toUpperCase();
}

function formatDateLabel(isoDate: string | null) {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

export function TotalBalanceCard({ balances, workspaceBaseCurrency }: Props) {
  const [displayCurrency, setDisplayCurrency] = useState(toCurrency(workspaceBaseCurrency) || 'USD');
  const [conversion, setConversion] = useState<ConversionState>({
    totalMinor: 0,
    convertedCount: 0,
    unconvertedCount: 0,
    rateDate: null,
    loading: false,
    error: null,
  });

  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const item of PRIORITY_CURRENCIES) set.add(item);
    for (const item of balances) set.add(toCurrency(item.currency));
    set.add(toCurrency(workspaceBaseCurrency));
    return Array.from(set).filter(Boolean);
  }, [balances, workspaceBaseCurrency]);

  useEffect(() => {
    if (!availableCurrencies.includes(displayCurrency)) {
      setDisplayCurrency(toCurrency(workspaceBaseCurrency) || availableCurrencies[0] || 'USD');
    }
  }, [availableCurrencies, displayCurrency, workspaceBaseCurrency]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const targetCurrency = toCurrency(displayCurrency);
      if (!targetCurrency) {
        return;
      }

      const sourceCurrencies = Array.from(
        new Set(
          balances
            .map((item) => toCurrency(item.currency))
            .filter((currency) => currency && currency !== targetCurrency)
        )
      );

      setConversion((previous) => ({
        ...previous,
        loading: sourceCurrencies.length > 0,
        error: null,
      }));

      try {
        const ratesPayload: { rates: Record<string, number>; date: string | null } =
          sourceCurrencies.length > 0
            ? await fetchLatestFxRates(targetCurrency, sourceCurrencies)
            : { rates: {}, date: null };

        if (!active) {
          return;
        }

        let totalMajor = 0;
        let convertedCount = 0;
        let unconvertedCount = 0;

        for (const item of balances) {
          const accountCurrency = toCurrency(item.currency);
          const amountMajor = Number(item.current_balance_minor || 0) / 100;

          if (accountCurrency === targetCurrency) {
            totalMajor += amountMajor;
            continue;
          }

          const sourcePerTarget = Number(ratesPayload.rates[accountCurrency]);
          if (!Number.isFinite(sourcePerTarget) || sourcePerTarget <= 0) {
            unconvertedCount += 1;
            continue;
          }

          totalMajor += amountMajor / sourcePerTarget;
          convertedCount += 1;
        }

        setConversion({
          totalMinor: Math.round(totalMajor * 100),
          convertedCount,
          unconvertedCount,
          rateDate: ratesPayload.date,
          loading: false,
          error:
            unconvertedCount > 0
              ? `${unconvertedCount} account balance(s) were not convertible to ${targetCurrency}.`
              : null,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        // Fallback: still show same-currency totals when live FX is unavailable.
        const totalMinor = balances
          .filter((item) => toCurrency(item.currency) === targetCurrency)
          .reduce((sum, item) => sum + Number(item.current_balance_minor || 0), 0);

        const unconvertedCount = balances.filter((item) => toCurrency(item.currency) !== targetCurrency).length;

        setConversion({
          totalMinor,
          convertedCount: 0,
          unconvertedCount,
          rateDate: null,
          loading: false,
          error:
            error instanceof Error
              ? `Live FX unavailable (${error.message}). Showing ${targetCurrency} accounts only.`
              : `Live FX unavailable. Showing ${targetCurrency} accounts only.`,
        });
      }
    };

    run().catch(() => {
      if (!active) return;
      setConversion((previous) => ({
        ...previous,
        loading: false,
        error: `Failed to calculate total balance in ${displayCurrency}.`,
      }));
    });

    return () => {
      active = false;
    };
  }, [balances, displayCurrency]);

  const dateLabel = formatDateLabel(conversion.rateDate);
  const currencyCount = new Set(balances.map((item) => toCurrency(item.currency))).size;

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div>
          <p className={styles.label}>Total Balance (All Accounts)</p>
          <h3 className={styles.value}>{formatMinor(conversion.totalMinor, displayCurrency)}</h3>
        </div>
        <label className={styles.currencyControl}>
          <span>Display Currency</span>
          <select value={displayCurrency} onChange={(event) => setDisplayCurrency(event.target.value)}>
            {availableCurrencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>

      <small className="muted-text">
        Includes {balances.length} account(s) across {currencyCount} currenc{currencyCount === 1 ? 'y' : 'ies'}.
      </small>
      {conversion.convertedCount > 0 ? (
        <small className="muted-text">
          Converted {conversion.convertedCount} account balance(s) with live FX rates.
        </small>
      ) : null}
      {conversion.loading ? <small className="muted-text">Refreshing FX rates...</small> : null}
      {dateLabel ? (
        <small className="muted-text">FX source: currency-api (open source), updated {dateLabel}.</small>
      ) : null}
      {conversion.error ? <small className="error-text">{conversion.error}</small> : null}
      {conversion.unconvertedCount > 0 && !conversion.error ? (
        <small className="muted-text">
          Unconverted accounts: {conversion.unconvertedCount}
        </small>
      ) : null}
    </article>
  );
}
