// vishal
const STOCKS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "PYPL",
  "TSLA",
  "JPM",
  "NVDA",
  "NFLX",
  "DIS",
];

const API = {
  chart: "https://stock-market-api-k9vl.onrender.com/api/stocksdata",
  stats: "https://stock-market-api-k9vl.onrender.com/api/stocksstatsdata",
  profile: "https://stock-market-api-k9vl.onrender.com/api/profiledata",
};

let selectedStock = "AAPL";
let selectedRange = "1mo";
let chartInstance = null;

let chartDataStore = {};
let statsDataStore = {};
let profileDataStore = {};

const loading = document.getElementById("loading");
const errorBox = document.getElementById("errorBox");
const mainContent = document.getElementById("mainContent");
const stockList = document.getElementById("stockList");

const companyTitle = document.getElementById("companyTitle");
const companySubTitle = document.getElementById("companySubTitle");
const peakValue = document.getElementById("peakValue");
const lowValue = document.getElementById("lowValue");

const detailName = document.getElementById("detailName");
const detailBookValue = document.getElementById("detailBookValue");
const detailProfit = document.getElementById("detailProfit");
const detailSymbol = document.getElementById("detailSymbol");
const detailSummary = document.getElementById("detailSummary");

function formatCurrency(value) {
  const number = Number(value);
  if (isNaN(number)) return "N/A";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatProfit(value) {
  const number = Number(value);
  if (isNaN(number)) return "N/A";
  return number.toFixed(2) + "%";
}

function getProfitClass(value) {
  return Number(value) > 0 ? "profit-positive" : "profit-negative";
}

function formatDate(timestamp) {
  return new Date(Number(timestamp) * 1000).toLocaleDateString();
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch " + url);
  }
  return response.json();
}

/* Defensive normalizers because API shapes can vary slightly */
function normalizeStats(raw) {
  const result = {};
  const source = raw.stocksStatsData || raw.data || raw;

  STOCKS.forEach((symbol) => {
    let item = null;

    if (Array.isArray(source)) {
      for (let i = 0; i < source.length; i++) {
        if (source[i] && source[i][symbol]) {
          item = source[i][symbol];
          break;
        }
      }
    } else if (source && source[symbol]) {
      item = source[symbol];
    }

    result[symbol] = {
      bookValue: Number(item?.bookValue ?? item?.bookvalue ?? 0),
      profit: Number(item?.profit ?? 0),
    };
  });

  return result;
}

function normalizeProfile(raw) {
  const result = {};
  const source = raw.stocksProfileData || raw.data || raw;

  STOCKS.forEach((symbol) => {
    let item = null;

    if (Array.isArray(source)) {
      for (let i = 0; i < source.length; i++) {
        if (source[i] && source[i][symbol]) {
          item = source[i][symbol];
          break;
        }
      }
    } else if (source && source[symbol]) {
      item = source[symbol];
    }

    result[symbol] = {
      name: item?.companyName || item?.name || symbol,
      summary: item?.summary || item?.description || "No summary available.",
    };
  });

  return result;
}

function getRangeBlock(block) {
  return {
    "1mo": block?.["1mo"] || block?.["1month"] || { value: [], timeStamp: [] },
    "3mo": block?.["3mo"] || block?.["3month"] || { value: [], timeStamp: [] },
    "1y": block?.["1y"] || block?.["1year"] || { value: [], timeStamp: [] },
    "5y": block?.["5y"] || block?.["5year"] || { value: [], timeStamp: [] },
  };
}

function normalizeChart(raw) {
  const result = {};
  const source = raw.stocksData || raw.data || raw;

  STOCKS.forEach((symbol) => {
    const block = source?.[symbol] || raw?.[symbol] || null;
    result[symbol] = getRangeBlock(block);
  });

  return result;
}

async function loadAllData() {
  try {
    loading.classList.remove("hidden");
    errorBox.classList.add("hidden");
    mainContent.classList.add("hidden");

    const [chartRaw, statsRaw, profileRaw] = await Promise.all([
      fetchJSON(API.chart),
      fetchJSON(API.stats),
      fetchJSON(API.profile),
    ]);

    chartDataStore = normalizeChart(chartRaw);
    statsDataStore = normalizeStats(statsRaw);
    profileDataStore = normalizeProfile(profileRaw);

    renderStockList();
    renderDetails();
    renderChart();
    setupRangeButtons();

    loading.classList.add("hidden");
    mainContent.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    loading.classList.add("hidden");
    errorBox.classList.remove("hidden");
    errorBox.textContent =
      "Unable to load data right now. The API may still be waking up. Please wait 20-30 seconds and refresh the page.";
  }
}

function renderStockList() {
  stockList.innerHTML = "";

  STOCKS.forEach((symbol) => {
    const stats = statsDataStore[symbol] || {};
    const profile = profileDataStore[symbol] || {};

    const item = document.createElement("div");
    item.className = "stock-item" + (selectedStock === symbol ? " active" : "");

    item.innerHTML = `
      <div class="stock-left">
        <h3>${symbol}</h3>
        <p>${profile.name || symbol}</p>
      </div>
      <div class="stock-right">
        <span>BV: ${formatCurrency(stats.bookValue)}</span>
        <span class="${getProfitClass(stats.profit)}">${formatProfit(stats.profit)}</span>
      </div>
    `;

    item.addEventListener("click", function () {
      selectedStock = symbol;
      renderStockList();
      renderDetails();
      renderChart();
    });

    stockList.appendChild(item);
  });
}

function renderDetails() {
  const profile = profileDataStore[selectedStock] || {};
  const stats = statsDataStore[selectedStock] || {};

  detailName.textContent = profile.name || selectedStock;
  detailBookValue.textContent = formatCurrency(stats.bookValue);
  detailProfit.textContent = formatProfit(stats.profit);
  detailProfit.className = getProfitClass(stats.profit);
  detailSymbol.textContent = selectedStock;
  detailSummary.textContent = profile.summary || "No summary available.";

  companyTitle.textContent = profile.name || selectedStock;
  companySubTitle.textContent = `${selectedStock} stock performance`;
}

function renderChart() {
  const rangeData = chartDataStore?.[selectedStock]?.[selectedRange] || {
    value: [],
    timeStamp: [],
  };
  const values = Array.isArray(rangeData.value) ? rangeData.value : [];
  const timeStamps = Array.isArray(rangeData.timeStamp)
    ? rangeData.timeStamp
    : [];

  const labels = timeStamps.map((ts) => formatDate(ts));

  const peak = values.length ? Math.max(...values) : 0;
  const low = values.length ? Math.min(...values) : 0;

  peakValue.textContent = formatCurrency(peak);
  lowValue.textContent = formatCurrency(low);

  const ctx = document.getElementById("stockChart").getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: selectedStock,
          data: values,
          borderColor: "#2cff66",
          backgroundColor: "rgba(44, 255, 102, 0.12)",
          borderWidth: 2,
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: "#2cff66",
          pointBorderColor: "#2cff66",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#ffffff",
          bodyColor: "#ffffff",
          displayColors: false,
          callbacks: {
            title: function (tooltipItems) {
              const index = tooltipItems[0].dataIndex;
              return labels[index] || "";
            },
            label: function (context) {
              return `${selectedStock}: ${formatCurrency(context.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#b8c6db",
            maxTicksLimit: 6,
          },
          grid: {
            color: "rgba(255,255,255,0.07)",
          },
        },
        y: {
          ticks: {
            color: "#b8c6db",
            callback: function (value) {
              return "$" + value;
            },
          },
          grid: {
            color: "rgba(255,255,255,0.07)",
          },
        },
      },
    },
  });
}

function setupRangeButtons() {
  const buttons = document.querySelectorAll(".range-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", function () {
      buttons.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");

      selectedRange = this.dataset.range;
      renderChart();
    });
  });
}

loadAllData();
