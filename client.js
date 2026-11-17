/**
 * Browser half of dsh-account-balance-pill.
 *
 * Registers a one-line balance row in `sidebar.footer.action`, directly above
 * the sidebar account entry: top-up balance, bonus balance and a refresh
 * button. It reads the signed-in account through the existing account Remote,
 * so no credential ever reaches the browser.
 */
window.__ModuleLoader__.load({
  id: 'dsh-account-balance-pill',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'account.balance'
    const AUTO_REFRESH_MS = 60 * 1000
    const MAX_BACKOFF_MS = 5 * 60 * 1000

    const en = {
      topUp: 'Top-up',
      bonus: 'Bonus',
      refresh: 'Refresh balance',
      refreshing: 'Refreshing…',
      failed: 'Balance refresh failed',
      unavailable: 'Balance unavailable',
    }
    const zh = {
      topUp: '充值',
      bonus: '赠金',
      refresh: '刷新余额',
      refreshing: '正在刷新…',
      failed: '余额刷新失败',
      unavailable: '余额不可用',
    }

    const STYLE = [
      '.dsh-abp-root{display:flex;align-items:center;justify-content:flex-start;gap:6px;flex:1 1 auto;min-width:0;height:28px;padding:0 2px 0 8px;box-sizing:border-box;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dsh-abp-item{display:inline-flex;align-items:baseline;gap:4px;min-width:0}',
      '.dsh-abp-label{flex:none;color:var(--dsw-alias-label-tertiary)}',
      '.dsh-abp-amount{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.dsh-abp-sep{flex:none;color:var(--dsw-alias-label-tertiary)}',
      '.dsh-abp-muted{color:var(--dsw-alias-label-tertiary)}',
      '.dsh-abp-button{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsh-abp-button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsh-abp-button:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}',
      ".dsh-abp-button[aria-disabled='true']{cursor:default;opacity:.65}",
      ".dsh-abp-button[data-stale='true']{color:var(--dsw-alias-state-warn-primary)}",
      '.dsh-abp-warn{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-state-warn-primary)}',
      '.dsh-abp-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
      '@keyframes dsh-abp-spin{to{transform:rotate(360deg)}}',
      '.dsh-abp-spin{animation:dsh-abp-spin .9s linear infinite}',
      '@media (prefers-reduced-motion: reduce){.dsh-abp-spin{animation:none}}',
    ].join('')

    /** @param {string} text @returns {{sign: number, int: string, frac: string} | null} */
    function parseDecimal(text) {
      const value = String(text == null ? '' : text).trim()
      if (/[eE]/.test(value)) {
        const numeric = Number(value)
        if (!Number.isFinite(numeric)) return null
        return parseDecimal(numeric.toFixed(10))
      }
      const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(value)
      if (match === null) return null
      return {
        sign: match[1] === '-' ? -1 : 1,
        int: match[2] === '' ? '0' : match[2],
        frac: match[3] || '',
      }
    }

    /** @param {string} integer @returns {string} */
    function trimLeadingZeros(integer) {
      const trimmed = integer.replace(/^0+(?=\d)/, '')
      return trimmed === '' ? '0' : trimmed
    }

    /** @param {string} integer @returns {string} */
    function groupDigits(integer) {
      return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

    /** @param {string} currency @returns {string} */
    function symbolOf(currency) {
      if (currency === 'CNY') return '¥'
      if (currency === 'USD') return '$'
      return typeof currency === 'string' && currency !== '' ? currency + ' ' : ''
    }

    /**
     * Format a Platform decimal balance: two decimals with digit grouping,
     * positive amounts truncated to cents, positive sub-cent amounts shown as
     * `<$0.01`, negative amounts rounded with a minimum of one cent.
     * @param {string} raw @param {string} currency @returns {string}
     */
    function formatMoney(raw, currency) {
      const symbol = symbolOf(currency)
      const parsed = parseDecimal(raw)
      if (parsed === null) return symbol + String(raw == null ? '' : raw)
      const isZero = /^0*$/.test(parsed.int) && /^0*$/.test(parsed.frac)
      if (isZero) return symbol + '0.00'
      if (parsed.sign < 0) {
        const absolute = Number(parsed.int + '.' + (parsed.frac || '0'))
        const rounded = Math.max(0.01, Math.round(absolute * 100) / 100)
        const parts = rounded.toFixed(2).split('.')
        return '-' + symbol + groupDigits(trimLeadingZeros(parts[0])) + '.' + parts[1]
      }
      const integer = trimLeadingZeros(parsed.int)
      const fraction = (parsed.frac + '00').slice(0, 2)
      if (integer === '0' && fraction === '00') return '<' + symbol + '0.01'
      return symbol + groupDigits(integer) + '.' + fraction
    }

    /** @param {unknown} wallets @returns {string} */
    function formatWallets(wallets) {
      if (!Array.isArray(wallets) || wallets.length === 0) return '—'
      const parts = []
      for (const wallet of wallets) {
        if (wallet === null || typeof wallet !== 'object') continue
        if (typeof wallet.balance !== 'string') continue
        parts.push(formatMoney(wallet.balance, wallet.currency))
      }
      return parts.length === 0 ? '—' : parts.join(' / ')
    }

    /** @param {{ spinning?: boolean }} props */
    function RefreshIcon(props) {
      return h('svg', {
        className: props.spinning ? 'dsh-abp-spin' : undefined,
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': true,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
        h('path', { key: 'arc', d: 'M13.2 8a5.2 5.2 0 1 1-1.6-3.8' }),
        h('path', { key: 'head', d: 'M13.4 2.6v3.2h-3.2' }),
      )
    }

    /** Visible stale marker; the surrounding span carries the localized label. */
    function WarnIcon() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 12,
        height: 12,
        'aria-hidden': true,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
        h('path', { key: 'shape', d: 'M8 2.4 14.1 13.2H1.9L8 2.4Z' }),
        h('path', { key: 'stem', d: 'M8 6.2v3.1' }),
        h('circle', { key: 'dot', cx: 8, cy: 11.2, r: 0.8, fill: 'currentColor', stroke: 'none' }),
      )
    }

    /**
     * Sidebar-footer balance row.
     * @param {{
     *   wide: boolean,
     *   t?: (key: string) => string,
     *   readBalance: () => Promise<unknown>,
     *   subscribe?: (listener: () => void) => () => void,
     * }} props
     */
    function BalanceRow(props) {
      const tr = typeof props.t === 'function' ? props.t : (key) => key
      const [view, setView] = React.useState({ phase: 'loading' })
      const [busy, setBusy] = React.useState(false)
      const refreshRef = React.useRef(null)
      const lastGoodRef = React.useRef(null)

      React.useEffect(() => {
        if (typeof props.subscribe !== 'function') return undefined
        return props.subscribe(() => {
          const refresh = refreshRef.current
          if (typeof refresh === 'function') refresh()
        })
      }, [props.subscribe])

      React.useEffect(() => {
        if (props.wide === false) return undefined
        let disposed = false
        let timer = null
        let running = false
        let failures = 0
        let lastAttempt = 0

        const clearTimer = () => {
          if (timer !== null) {
            clearTimeout(timer)
            timer = null
          }
        }
        const schedule = (delay) => {
          clearTimer()
          if (!disposed) timer = setTimeout(() => { void tick(false) }, delay)
        }
        const nextDelay = () => failures === 0
          ? AUTO_REFRESH_MS
          : Math.min(MAX_BACKOFF_MS, AUTO_REFRESH_MS * Math.pow(2, Math.min(failures, 3)))

        /** @param {boolean} manual */
        const tick = async (manual) => {
          if (disposed || running) return
          if (!manual && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            schedule(AUTO_REFRESH_MS)
            return
          }
          running = true
          lastAttempt = Date.now()
          setBusy(true)
          try {
            const value = await props.readBalance()
            if (disposed) return
            if (value === null || value === undefined) {
              failures = 0
              lastGoodRef.current = null
              setView({ phase: 'signed-out' })
            } else if (typeof value === 'object' && value.status === 'ready') {
              failures = 0
              lastGoodRef.current = {
                wallets: value.value,
                bonusWallets: value.bonusWallets,
                updatedAt: Date.now(),
              }
              setView({ phase: 'ready', ...lastGoodRef.current })
            } else {
              failures += 1
              const lastGood = lastGoodRef.current
              setView(lastGood === null
                ? { phase: 'error' }
                : { phase: 'ready', ...lastGood, stale: true })
            }
          } catch (_error) {
            if (disposed) return
            failures += 1
            const lastGood = lastGoodRef.current
            setView(lastGood === null
              ? { phase: 'error' }
              : { phase: 'ready', ...lastGood, stale: true })
          } finally {
            running = false
            if (!disposed) {
              setBusy(false)
              schedule(nextDelay())
            }
          }
        }

        const onVisibility = () => {
          if (typeof document !== 'undefined' && document.visibilityState === 'visible'
            && Date.now() - lastAttempt > 10000) {
            clearTimer()
            void tick(false)
          }
        }
        const onFocus = () => {
          if (Date.now() - lastAttempt > 10000) {
            clearTimer()
            void tick(false)
          }
        }

        refreshRef.current = () => {
          failures = 0
          clearTimer()
          void tick(true)
        }
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
        if (typeof window !== 'undefined') window.addEventListener('focus', onFocus)
        void tick(true)

        return () => {
          disposed = true
          clearTimer()
          refreshRef.current = null
          if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
          if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus)
        }
      }, [props.wide, props.readBalance])

      if (props.wide === false || view.phase === 'signed-out') return null

      const stale = view.phase === 'error' || view.stale === true
      const ready = view.phase === 'ready'
      const topUp = ready ? formatWallets(view.wallets) : '—'
      const bonus = ready
        ? (Array.isArray(view.bonusWallets) && view.bonusWallets.length > 0
          ? formatWallets(view.bonusWallets)
          : (Array.isArray(view.wallets) && view.wallets[0] !== null && typeof view.wallets[0] === 'object'
            ? formatMoney('0', view.wallets[0].currency)
            : '—'))
        : '—'

      const titleParts = []
      if (view.phase === 'error') {
        titleParts.push(tr('unavailable'))
      } else {
        titleParts.push(tr('topUp') + ' ' + topUp)
        titleParts.push(tr('bonus') + ' ' + bonus)
      }
      if (ready && typeof view.updatedAt === 'number') {
        titleParts.push(new Date(view.updatedAt).toLocaleTimeString())
      }
      if (stale) titleParts.push(tr('failed'))
      const title = titleParts.join(' · ')
      const buttonLabel = busy ? tr('refreshing') : tr('refresh')

      const body = view.phase === 'error'
        ? h('span', { className: 'dsh-abp-muted' }, tr('unavailable'))
        : h(React.Fragment, null,
          h('span', { className: 'dsh-abp-item' },
            h('span', { className: 'dsh-abp-label' }, tr('topUp')),
            h('span', { className: 'dsh-abp-amount', title: topUp }, topUp),
          ),
          h('span', { className: 'dsh-abp-sep', 'aria-hidden': true }, '·'),
          h('span', { className: 'dsh-abp-item' },
            h('span', { className: 'dsh-abp-label' }, tr('bonus')),
            h('span', { className: 'dsh-abp-amount', title: bonus }, bonus),
          ),
        )

      return h(React.Fragment, null,
        h('style', { key: 'style' }, STYLE),
        h('div', {
          key: 'row',
          className: 'dsh-abp-root',
          title,
          'data-stale': stale ? 'true' : undefined,
          'aria-busy': busy ? 'true' : undefined,
        },
          body,
          stale ? h('span', {
            key: 'warn',
            className: 'dsh-abp-warn',
            role: 'img',
            title: tr('failed'),
            'aria-label': tr('failed'),
          }, h(WarnIcon)) : null,
          h('span', {
            key: 'live',
            className: 'dsh-abp-sr',
            'aria-live': 'polite',
          }, stale ? tr('failed') : ''),
          h('button', {
            type: 'button',
            className: 'dsh-abp-button',
            'data-stale': stale ? 'true' : undefined,
            title: buttonLabel,
            'aria-label': buttonLabel,
            'aria-disabled': busy ? 'true' : undefined,
            'aria-busy': busy ? 'true' : undefined,
            onClick: () => {
              if (busy) return
              const refresh = refreshRef.current
              if (typeof refresh === 'function') refresh()
            },
          }, h(RefreshIcon, { spinning: busy })),
        ),
      )
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.account'],
      /**
       * @param {import('@deepseek-ai/cordis').Context} ctx
       */
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'account-balance: dictionaries')

        const read = async () => {
          const boot = globalThis.__DSH_BOOT__
          const release = boot && typeof boot === 'object' ? boot.release : undefined
          const version = release && typeof release.version === 'string' && release.version !== ''
            ? release.version
            : '0.0.0'
          const client = {
            version,
            locale: ctx.locale.getSnapshot().active,
            timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
          }
          const result = await ctx.remote.account.getBalance(client)
          if (!result.ok) throw result.error === undefined ? new Error('account balance read failed') : result.error
          return result.value
        }

        const refreshers = new Set()
        const subscribe = (listener) => {
          refreshers.add(listener)
          return () => { refreshers.delete(listener) }
        }
        // The account UI publishes sign-in, sign-out and credential changes.
        ctx.on('account-ui/change', () => {
          for (const refresher of [...refreshers]) refresher()
        })

        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'account-balance',
          order: 100,
          locale: NS,
          inject: () => ({ readBalance: read, subscribe }),
        }, BalanceRow))
      },
    }
  },
})
