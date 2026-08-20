export function MarketingFooter() {
  return (
    <footer className="border-t border-mkt-border bg-mkt-bg px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <span className="text-sm font-semibold tracking-[0.2em] text-mkt-ink">EQUITYLENS</span>
          <span className="text-xs text-mkt-ink-subtle">Financial data via SEC EDGAR · Explanations via Claude</span>
        </div>
        <div className="flex flex-col gap-2 border-t border-mkt-border pt-6 text-xs leading-relaxed text-mkt-ink-subtle">
          <p>
            The Investment Score is a fundamental-analysis framework, not a prediction of future stock returns, and
            is not a recommendation to buy or sell.
          </p>
          <p>AI-assisted analysis is for research and educational purposes only and is not financial advice.</p>
        </div>
      </div>
    </footer>
  );
}
