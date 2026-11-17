# Publishing

This bundle is ready to publish as a public GitHub repository and an npm package, then list in the community plugin catalog.

## 1. Create the GitHub repository

The repository name used by this package is `dsh-account-balance-pill` under `cheny5100`.

Create an empty public repository at <https://github.com/new> (no README, no `.gitignore`), then from this directory:

```sh
git remote add origin https://github.com/cheny5100/dsh-account-balance-pill.git
git push -u origin main
```

Add the `dsh-plugin` topic so the repository is discoverable:

- Repository page → **About** (gear) → **Topics** → add `dsh-plugin` → **Save changes**.

### Optional: GitHub CLI

`gh` is GitHub's official command-line client. It can create the repository, push, add the topic and open the catalog PR without using the website.

Install on Windows (no winget or Chocolatey on this machine):

1. Download the Windows MSI from <https://cli.github.com/> and run it.
2. Open a new terminal and check `gh --version`.
3. `gh auth login` → GitHub.com → HTTPS → authenticate with the browser.
4. `gh auth status`.

Then:

```sh
gh repo create cheny5100/dsh-account-balance-pill --public --source . --remote origin --push
gh repo edit cheny5100/dsh-account-balance-pill --add-topic dsh-plugin
```

`gh` is optional here: Git Credential Manager (`manager-core`) is already configured, so `git push` prompts for a browser sign-in on first use.

## 2. Publish to npm

Use Node 24, which is already installed through nvm; the npm on the default PATH is an old 6.x and should not be used.

```sh
nvm use 24.18.0
node -v        # v24.18.0
npm -v         # 11.x
npm login      # registry https://registry.npmjs.org/
npm publish
```

Run these from this directory. If the account has two-factor authentication, enter the one-time code when asked.

Verify:

```sh
npm view dsh-account-balance-pill version
npm view dsh-account-balance-pill dist.tarball
```

The package has no dependencies and no build step, so `npm publish` uploads the files listed in `package.json`'s `files` array.

## 3. List in the community catalog

The DSH **Plugins → Discover** tab is driven by plugin indexes. The community index is generated from <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>; one YAML file lists one plugin.

1. Fork <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>.
2. Copy [`market/community-entry.yml`](market/community-entry.yml) to `data/plugins/cheny5100__dsh-account-balance-pill.yml` in the fork.
3. Optional local check: `npm ci && node scripts/generate-readme.mjs`.
4. Commit, push to the fork and open a pull request.

The catalog's CI checks that the repository exists, is public and carries the `dsh-plugin` topic. The catalog resolves the npm version from the package name, so publish to npm first.

## 4. Optional: self-hosted index

`market/index.json` is a `format: 1` index with this plugin. Serve `market/` from any static host (GitHub Pages, jsDelivr, an object store) and add the index URL under **Plugins → Discover → Index sources**.

When releasing a new version, update both `package.json` and the `version` / `publishTimestamp` fields in `market/index.json`.

## 5. Release checklist

- [ ] `package.json` version matches the tag (for example `v0.1.0`).
- [ ] `npm pack --dry-run` lists only `index.js`, `client.js`, `cordis.patch.yml`, `locale/`, `docs/`, `icon.svg`, README files and `LICENSE`.
- [ ] The repository is public and has the `dsh-plugin` topic.
- [ ] `npm view dsh-account-balance-pill version` returns the published version.
- [ ] The catalog PR is merged and the entry appears in **Discover**.
