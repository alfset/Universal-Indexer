
# Physica Finance – Indexing API

Welcome to the open-source **Indexing API** for Physica Finance, a robust backend solution designed to fetch, analyze, and serve decentralized swap data across multiple EVM-compatible blockchains. This API is built with Express.js and Supabase and supports real-time data queries for analytics, token volumes, user activity, and more.

---

## 📌 Features

- 🔗 Multi-chain support (chains defined in `/config/chain`)
- 📊 Top tokens by volume (daily, weekly, monthly)
- 👥 Top users by swap volume
- 🔄 Latest swap activity
- 🔍 Query swaps by chain
- 💎 Token-specific user volume insights

---

## 📡 API Endpoints

### `GET /chains`
Returns the list of supported chains.
```json
[
  { "chainId": 1, "name": "Ethereum" },
  { "chainId": 137, "name": "Polygon" }
]
````

---

### `GET /:chainId/swaps?limit=100&offset=0`

Returns recent swaps for a specific chain ID.

---

### `GET /top-tokens-all-chains`

Returns the top 5 tokens by volume across all chains for `daily`, `weekly`, and `monthly` periods.

---

### `GET /latest-swaps?limit=10`

Returns the latest global swap activity across all chains.

---

### `GET /:chainId/top-tokens`

Returns top 3 tokens by volume for the selected chain in the last `day`, `week`, and `month`.

---

### `GET /:chainId/top-users`

Returns top 10 users by swap volume on a given chain.

---

### `GET /:chainId/top-users-by-token/:tokenAddress`

Returns top 10 users who interacted with a specific token on a given chain.

---


## 🔓 License

This project is open-sourced under the [MIT License](#license). Contributions, forks, and pull requests are welcome.

---

## 🤝 Contributing

1. Fork this repo
2. Clone your fork
3. Create a feature branch (`git checkout -b feature-name`)
4. Make your changes
5. Submit a PR
---

## 🛠 Adding Tokens for Indexing

To include a new token in the indexing process, you need to register it under the appropriate chain configuration file located in:

```

/config/tokens/<chain>.js

````

### 🔧 Steps to Add a Token

1. **Open the appropriate chain file**, e.g., `config/tokens/planq.json` or `config/tokens/planq.json`.

2. **Add the token object** with the required information:
### add tokens on chains
```js
{
  ....
  "tokens": [
    {
      "address": "0x5EBCdf1De1781e8B5D41c016B0574aD53E2F6E1A",
      "symbol": "WPLANQ",
      "decimals": 18
    },
  ]
}
````

### 📘 adding Chains


```js
planq: {
    chainId: 7070,
    name: 'Planq',
    rpcUrl: process.env.PLANQ_RPC_URL,
    factoryAddress: process.env.PLANQ_FACTORY_ADDRESS || '',
    tokenListPath: path.join(__dirname, 'tokens/planq.json'),
    knownRouters: [
      '0xasdsad', // Universal Router address
    ],
    fromBlock: 14859328,
  },
```

> ✅ `fromBlock` defines from which block the indexer begins fetching swap data for that token, ensuring faster and efficient syncing.
> ✅ `knownRouters` Known router defines for set known Universal Address if you have more Universal Router just add as Array.
> ✅ `factoryAddress` Defines as Fatory Contract v3 work both for uniswap and physcia Finance



## 📃 License

### MIT License

```
MIT License

Copyright (c) 2025 Comunity Node

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

---

## ❤️ Built with love by Comunity Node
