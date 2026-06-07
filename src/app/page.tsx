import Link from "next/link";

export default function Home() {
  const topAssets = [
    { name: "Bitcoin", symbol: "BTC", price: "$91,840.00" },
    { name: "Ethereum", symbol: "ETH", price: "$2,510.00" },
    { name: "Ripple", symbol: "XRP", price: "$1.61" },
    { name: "BNB", symbol: "BNB", price: "$790.50" },
  ];

  const footerColumns: Array<{ title: string; links: string[] }> = [
    {
      title: "Company",
      links: ["About Us", "Blog", "Careers", "Fees", "Proof of Reserves", "Partners", "Bug Bounty", "Community", "Policy", "C.I.P. Fund"],
    },
    {
      title: "Product",
      links: ["Coins Trading", "Margin Trading", "Convert", "Futures Trading", "Options Trading", "US Stock Futures", "Earn", "VIP"],
    },
    {
      title: "Support",
      links: ["24/7 Chat Support", "Support Center", "Terms of Use", "Privacy Policy", "Risk Disclosures", "Security", "Media Kit"],
    },
    {
      title: "Business",
      links: ["Prime", "OTC", "API Broker", "Enterprise", "New Coin Listing", "Ventures", "Affiliate"],
    },
    {
      title: "Buy Cryptos",
      links: ["Buy Bitcoin", "Buy Ethereum", "Buy Solana", "Buy Ripple", "Buy Dogecoin", "Buy Shiba Inu", "Buy Pepecoin"],
    },
    {
      title: "Price Prediction",
      links: [
        "Bitcoin Price Prediction",
        "Ethereum Price Prediction",
        "Ripple Price Prediction",
        "Dogecoin Price Prediction",
        "Solana Price Prediction",
        "Litecoin Price Prediction",
        "All Price Predictions",
      ],
    },
  ];

  return (
    <div className="w-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-zinc-900 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <div className="border-b border-zinc-800 bg-zinc-950/70 px-4 py-2 text-xs text-zinc-300">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2">
          <p>
            Beware of Trade FX impersonators. We never ask for funds or personal details on unofficial channels.
            Report suspicious activity at trust@tradefx.com.
          </p>
          <button className="text-emerald-400">Read More</button>
        </div>
      </div>

      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <p className="text-xl font-semibold">Trade FX</p>
          <div className="flex gap-2">
            <Link href="/signup" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-900">
              Create Account
            </Link>
            <Link href="/login" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm">
              Login
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
        <section className="glass relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -right-10 -top-16 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-14 -left-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">India’s crypto learning coach</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                Trusted by 2 lakh+ users to learn, invest and trade digital assets
              </h1>
            </div>

            <div className="glass p-4">
              <p className="text-sm font-medium text-zinc-200">Your premier platform for crypto</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-400">Registered Users</p>
                  <p className="mt-1 text-2xl font-semibold">2 lakh+</p>
                </div>
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-400">Crypto Assets</p>
                  <p className="mt-1 text-2xl font-semibold">500+</p>
                </div>
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 sm:col-span-2">
                  <p className="text-xs text-zinc-400">Quarterly Trading Volumes</p>
                  <p className="mt-1 text-2xl font-semibold">$295K+</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="glass p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">One platform, endless possibilities</p>
            <h2 className="mt-2 text-2xl font-semibold">Trade smarter with one unified account</h2>
            <p className="mt-3 text-zinc-300">Access markets, wallet operations and account controls from a single secure dashboard.</p>
            <div className="mt-5 flex gap-3">
              <Link href="/signup" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-900">Create Account</Link>
              <Link href="/login" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm">Login</Link>
            </div>
          </div>

          <div className="glass overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1400&q=80"
              alt="Live market desk"
              className="h-full min-h-[280px] w-full object-cover"
            />
          </div>
        </section>

        <section className="glass mt-6 p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">Top crypto today</h3>
            <button className="text-sm text-emerald-400">View All 500+ Assets</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topAssets.map((asset) => (
              <article key={asset.symbol} className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
                <p className="text-sm font-semibold">{asset.name}</p>
                <p className="text-xs text-zinc-400">{asset.symbol}</p>
                <p className="mt-3 text-lg font-semibold">{asset.price}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="glass p-5">
            <p className="text-sm font-semibold">F.I.U. Compliant</p>
            <p className="mt-2 text-xs text-zinc-400">Designed with processes aligned to Indian anti-money laundering obligations.</p>
          </article>
          <article className="glass p-5">
            <p className="text-sm font-semibold">ISO/IEC 27001:2022-Inspired Controls</p>
            <p className="mt-2 text-xs text-zinc-400">Security systems built around globally recognized standards and internal audits.</p>
          </article>
          <article className="glass p-5">
            <p className="text-sm font-semibold">Proof of Reserve Signals</p>
            <p className="mt-2 text-xs text-zinc-400">Core asset states are monitored and periodically reviewed through verification flows.</p>
          </article>
        </section>

        <section className="glass mt-6 p-6">
          <h3 className="text-xl font-semibold">Prioritising your crypto experience</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
              <p className="font-medium">24x7 Support</p>
              <p className="mt-2 text-xs text-zinc-400">Always-on chat and support operations for smooth account guidance.</p>
            </article>
            <article className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
              <p className="font-medium">Free USD Deposits & Withdrawals</p>
              <p className="mt-2 text-xs text-zinc-400">Unlimited USD transfer experience with transparent wallet flow.</p>
            </article>
            <article className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
              <p className="font-medium">Automated Tax Reports</p>
              <p className="mt-2 text-xs text-zinc-400">Generate tax-ready summaries quickly from your transaction history.</p>
            </article>
          </div>
        </section>

        <section className="glass mt-6 p-6">
          <h3 className="text-xl font-semibold">Writing crypto growth stories, from India to the world</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Crypto Exchange (India)",
              "DeFi Web3 Wallet",
              "Partner Exchange (UAE)",
              "Investing across Web3 ecosystems",
              "Largest Web3 event (India)",
              "Trusted by global investors",
            ].map((story) => (
              <div key={story} className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
                {story}
              </div>
            ))}
          </div>
        </section>

        <section className="glass mt-6 p-6">
          <h3 className="text-xl font-semibold">Have Questions? We’ve Got Answers</h3>
          <div className="mt-4 space-y-3">
            <details className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4" open>
              <summary className="cursor-pointer text-sm font-medium">Is crypto legal in India?</summary>
              <p className="mt-2 text-xs text-zinc-400">
                Crypto is not under a blanket ban in India. Users can buy/sell/trade while complying with relevant laws and tax guidelines.
              </p>
            </details>
            <details className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
              <summary className="cursor-pointer text-sm font-medium">Which is the best crypto exchange in India?</summary>
            </details>
            <details className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
              <summary className="cursor-pointer text-sm font-medium">Which is the best crypto app for trading?</summary>
            </details>
            <details className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
              <summary className="cursor-pointer text-sm font-medium">What is the safest crypto exchange?</summary>
            </details>
          </div>
        </section>
      </main>

      <footer className="mt-4 border-t border-zinc-800 px-4 py-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mt-2 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {footerColumns.map((col) => (
              <div key={col.title}>
                <p className="text-sm font-semibold">{col.title}</p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                  {col.links.map((link) => (
                    <li key={link}>{link}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
            <p>Press Enquiries: media.queries@tradefx.com</p>
            <p>Regulatory Issues/Enforcement: legal@tradefx.com</p>
            <p>For Grievance Redressal, contact support@tradefx.com</p>
            <p>Address: 56, Jeevan Bima Nagar, Old Airport Rd, Bengaluru, Karnataka</p>
          </div>

          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-500">
            <p className="font-semibold text-zinc-300">Disclaimer</p>
            <p className="mt-2">
              Crypto products and NFTs are largely unregulated and can be highly risky. There may be limited or no regulatory recourse for losses from such transactions.
              Information and materials on this page can change without notice, including prices that move with market demand and supply.
            </p>
            <p className="mt-2">This page is informational and not an offer, solicitation, legal, tax or investment advice.</p>
            <p className="mt-2">*Internal Trade FX data reference period: May 2016.</p>
            <p className="mt-2">*Quarterly volume shown for illustrative product presentation.</p>
            <p className="mt-2">© 2016 All rights reserved</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
