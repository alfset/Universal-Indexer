
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
