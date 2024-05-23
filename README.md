# Kizuna Core Contracts

## Uniswap V2

[![Actions Status](https://github.com/Uniswap/uniswap-v2-core/workflows/CI/badge.svg)](https://github.com/Uniswap/uniswap-v2-core/actions)
[![Version](https://img.shields.io/npm/v/@uniswap/v2-core)](https://www.npmjs.com/package/@uniswap/v2-core)

In-depth documentation on Uniswap V2 is available at [uniswap.org](https://uniswap.org/docs).

The built contract artifacts can be browsed via [unpkg.com](https://unpkg.com/browse/@uniswap/v2-core@latest/).

# Local Development

The following assumes the use of `node@>=10`.

## Install Dependencies

`yarn`

## Build Contracts

`npx thirdweb build --all`

## Deploy Contract

Link to [Thirdweb Deploy Docs](https://portal.thirdweb.com/deploy) for reference.

`npx thirdweb deploy`

Select the contract you want to deploy:

```
? Choose which contract(s) to deploy …  Use <space> to select, <return> to submit
⬡ KizunaFactory
⬡ KizunaPair
⬡ Migrations
⬡ UniswapV2ERC20
⬡ ERC20
```

Open the provided link in the browser to continue deployment:

```
✔ Choose which contract(s) to deploy · UniswapV2ERC20
✔ Upload successful
✔ Open this link to deploy your contracts: https://thirdweb.com/contracts/deploy/<token>
```

Continue following the deployment steps in the browser
