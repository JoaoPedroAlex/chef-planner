const menuForm = document.getElementById('menuForm');
const menuList = document.getElementById('menuList');

const samples = [
  {
    client: 'Savory Table',
    style: 'French Market',
    guests: 8,
    price: 420,
    grocery: 180,
  },
  {
    client: 'The Green Room',
    style: 'Vegetarian Menu',
    guests: 12,
    price: 560,
    grocery: 260,
  },
  {
    client: 'Luna Catering',
    style: 'Seasonal Tasting',
    guests: 20,
    price: 980,
    grocery: 490,
  }
];

function drawMenu(rows) {
  const profit = Math.round(price - grocery);
}

function calculateProfit(price, grocery) {
  return Math.round(price - grocery);
}

function renderMenus(items) {
  if (!menuList) {
    return;
  }

  menuList.innerHTML = items.map((item) => {
    const profit = calculateProfit(item.price, item.grocery);
    return `<div class="menu-row">
      <div class="menu-row-main">
        <span class="menu-client">${item.client}</span>
        <span class="menu-detail">${item.style} · ${item.guests} guests</span>
      </div>
      <div class="menu-row-meta">
        <span class="menu-price">$${item.price}</span>
        <span class="menu-cost">Cost $${item.grocery}</span>
        <span class="menu-profit">Profit $${profit}</span>
      </div>
    </div>`;
  }).join('');
}

function updateSummary(items) {
  const totalRevenue = items.reduce((sum, item) => sum + Number(item.price), 0);
  const totalCost = items.reduce((sum, item) => sum + Number(item.grocery), 0);
  const totalProfit = totalRevenue - totalCost;

  const requestCount = document.getElementById('requestCount');
  const groceryCost = document.getElementById('groceryCost');
  const profitTotal = document.getElementById('profitTotal');
  const profitBig = document.getElementById('profitBig');

  if (requestCount) requestCount.textContent = String(items.length + 9);
  if (groceryCost) groceryCost.textContent = '$' + totalCost.toFixed(2);
  if (profitTotal) profitTotal.textContent = '$' + totalProfit.toLocaleString();
  if (profitBig) profitBig.textContent = '$' + totalProfit.toLocaleString();
}

renderMenus(samples);
updateSummary(samples);

menuForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const client = document.getElementById('clientName').value.trim();
  const style = document.getElementById('menuStyle').value;
  const guests = Number(document.getElementById('guestCount').value);
  const price = Number(document.getElementById('menuPrice').value);
  const grocery = Number(document.getElementById('groceryCostInput').value);

  if (!client || !style || guests < 1 || price < 1 || grocery < 0) {
    return;
  }

  const nextItem = { client, style, guests, price, grocery };
  const all = [...samples, nextItem];
  renderMenus(all);
  updateSummary(all);
  menuForm.reset();
});
