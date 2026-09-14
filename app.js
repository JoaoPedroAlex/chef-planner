const menuForm = document.getElementById('menuForm');
const menuList = document.getElementById('menuList');
const submitButton = document.getElementById('saveMenuButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const timeline = document.getElementById('timeline');
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthTitle = document.querySelector('.month-title');
const menuStyle = document.getElementById('menuStyle');
const requestPlatesInput = document.getElementById('requestPlatesInput');
const addMenuButton = document.getElementById('addMenuButton');
const addMenuLibraryButton = document.getElementById('addMenuLibraryButton');
const menuLibrary = document.getElementById('menuLibrary');
const menuLibraryEditor = document.getElementById('menuLibraryEditor');
const menuNameInput = document.getElementById('menuNameInput');
const menuDescriptionInput = document.getElementById('menuDescriptionInput');
const menuPlateNameInput = document.getElementById('menuPlateNameInput');
const menuPlateDescriptionInput = document.getElementById('menuPlateDescriptionInput');
const menuPlateCountInput = document.getElementById('menuPlateCountInput');
const menuPlatePreview = document.getElementById('menuPlatePreview');
const saveMenuLibraryButton = document.getElementById('saveMenuLibraryButton');
const cancelMenuEditButton = document.getElementById('cancelMenuEditButton');
const API_BASE = 'http://127.0.0.1:3000';
const storageKey = 'chefops.planner.requests';

let menus = [];

const samples = [
  {
    id: 'sample-1',
    client: 'Savory Table',
    style: 'French Market',
    guests: 8,
    price: 420,
    grocery: 180,
    date: '2026-09-14',
    plates: ['Market starter', 'Bistro fish', 'Pear tart'],
  },
  {
    id: 'sample-2',
    client: 'The Green Room',
    style: 'Vegetarian Menu',
    guests: 12,
    price: 560,
    grocery: 260,
    date: '2026-09-16',
    plates: ['Root garden soup', 'Saffron squash', 'Herb tart'],
  },
  {
    id: 'sample-3',
    client: 'Luna Catering',
    style: 'Seasonal Tasting',
    guests: 20,
    price: 980,
    grocery: 490,
    date: '2026-09-18',
    plates: ['Garden salad', 'Seasonal main', 'Cedar pear'],
  }
];

const defaultMenus = [
  {
    id: 'menu-1',
    name: 'French Market',
    plates: ['Market starter', 'Bistro fish', 'Pear tart'],
  },
  {
    id: 'menu-2',
    name: 'Vegetarian Menu',
    plates: ['Root garden soup', 'Saffron squash', 'Herb tart'],
  },
  {
    id: 'menu-3',
    name: 'Seasonal Tasting',
    plates: ['Garden salad', 'Seasonal main', 'Cedar pear'],
  },
];

function generateRequestId() {
  return 'request-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

async function loadRequests() {
  try {
    const response = await fetch(`${API_BASE}/api/requests`);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const parsed = await response.json();
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...samples];
    }

    return parsed.map((item) => ({
      ...item,
      id: item.id || generateRequestId(),
      guests: Number(item.guests),
      price: Number(item.price),
      grocery: Number(item.grocery),
      date: item.date || new Date().toISOString().slice(0, 10),
      allergies: item.allergies || '',
      address: item.address || '',
      eventTime: item.eventTime || '',
    }));
  } catch (error) {
    const savedRequests = localStorage.getItem(storageKey);

    if (!savedRequests) {
      localStorage.setItem(storageKey, JSON.stringify(samples));
      return [...samples];
    }

    try {
      const parsed = JSON.parse(savedRequests);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [...samples];
      }

      return parsed.map((item) => ({
        ...item,
        id: item.id || generateRequestId(),
        guests: Number(item.guests),
        price: Number(item.price),
        grocery: Number(item.grocery),
        date: item.date || new Date().toISOString().slice(0, 10),
        allergies: item.allergies || '',
        address: item.address || '',
        eventTime: item.eventTime || '',
      }));
    } catch (fallbackError) {
      return [...samples];
    }
  }
}

async function saveRequests(items) {
  try {
    const response = await fetch(`${API_BASE}/api/requests`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(items),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const saved = await response.json();
    localStorage.setItem(storageKey, JSON.stringify(saved));
    return saved;
  } catch (error) {
    localStorage.setItem(storageKey, JSON.stringify(items));
    return items;
  }
}

function calculateProfit(price, grocery) {
  return Math.round(price - grocery);
}

function formatMenuDate(dateValue) {
  if (!dateValue) {
    return '';
  }

  const date = new Date(dateValue + 'T00:00:00');
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

async function loadMenus() {
  try {
    const response = await fetch(`${API_BASE}/api/menus`);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const parsed = await response.json();
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...defaultMenus];
    }

    return parsed.map((item) => {
      const plates = Array.isArray(item.plates)
        ? item.plates.map((plate) => normalizePlateObject(plate)).filter((plate) => plate.plateName)
        : typeof item.plates === 'string'
          ? platesToArray(item.plates).map((plateName) => ({ plateName, plateDescription: '' }))
          : [];

      return {
        ...item,
        id: item.id || `menu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        name: String(item.name || '').trim(),
        description: String(item.description || '').trim(),
        plates,
        plateCount: Number(item.plateCount || plates.length || 0),
      };
    });
  } catch (error) {
    return [...defaultMenus];
  }
}

async function saveMenus(items) {
  try {
    const normalizedForServer = items.map((item) => ({
      ...item,
      plates: Array.isArray(item.plates)
        ? item.plates.map((plate) => normalizePlateObject(plate))
        : typeof item.plates === 'string'
          ? platesToArray(item.plates)
          : [],
    }));

    const response = await fetch(`${API_BASE}/api/menus`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(normalizedForServer),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const saved = await response.json();
    menus = Array.isArray(saved) ? saved : normalizedForServer;
    return menus;
  } catch (error) {
    menus = Array.isArray(items) ? items : [...defaultMenus];
    return menus;
  }
}

function getStoredMenus() {
  return Array.isArray(menus) && menus.length ? [...menus] : [...defaultMenus];
}

function normalizePlateLabel(plate) {
  if (typeof plate === 'string') {
    return plate.trim();
  }

  if (plate && typeof plate === 'object') {
    return String(plate.plateName || plate.name || plate.title || '').trim();
  }

  return '';
}

function normalizePlateObject(plate) {
  if (typeof plate === 'string') {
    return { plateName: plate.trim(), plateDescription: '' };
  }

  if (plate && typeof plate === 'object') {
    return {
      plateName: String(plate.plateName || plate.name || plate.title || '').trim(),
      plateDescription: String(plate.plateDescription || plate.description || '').trim(),
    };
  }

  return { plateName: '', plateDescription: '' };
}

function platesToArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizePlateLabel(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    const rawText = String(value)
      .replace(/\r/g, '\n')
      .replace(/[•·]/g, '\n')
      .replace(/[—–]/g, ' ');

    const rawLines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!rawLines.length) {
      return [];
    }

    const candidateLines = rawLines.length > 1
      ? rawLines
      : rawText
        .split(/(?<=[.!?])\s+|\s*[,;|]\s*/)
        .map((line) => line.trim())
        .filter(Boolean);

    const parsed = [];
    const ignoredLinePatterns = [
      /^four shores?\.?\s+one table\.?$/i,
      /^mezza$/i,
      /^at the heart of the table$/i,
      /^the menu$/i,
      /^menu$/i,
      /^plates$/i,
      /^course[s]?$/i,
      /^course\s+menu$/i,
      /^this menu is not only about flavours\.?(?:\s+it is a story of culture)?$/i,
      /^it is a story of culture$/i,
    ];

    candidateLines.forEach((line) => {
      const sentenceFragments = String(line)
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

      sentenceFragments.forEach((sentence) => {
        const cleanLine = String(sentence)
          .replace(/^\s*[-•*]\s*/g, '')
          .replace(/^[\-\*\d\.\)]\s*/g, '')
          .replace(/\|[^|]+\|/g, '|')
          .replace(/\s+/g, ' ')
          .trim();

        if (!cleanLine || ignoredLinePatterns.some((pattern) => pattern.test(cleanLine))) {
          return;
        }

        let plate = cleanLine;
        if (plate.includes('|')) {
          const parts = plate.split('|').map((part) => part.trim()).filter(Boolean);
          plate = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        }

        plate = plate
          .replace(/[.!?;:]+$/g, '')
          .replace(/^[\-\*\d\.\)]\s*/g, '')
          .replace(/^\s*[-•*]\s*/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!plate || plate.length < 2 || !/[a-z]/i.test(plate)) {
          return;
        }

        const normalized = plate.replace(/\s+/g, ' ');
        if (!parsed.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
          parsed.push(normalized);
        }
      });
    });

    return parsed;
  }

  return [];
}

function getDefaultPlatesForStyle(style) {
  const menu = getStoredMenus().find((item) => item.name === style);
  if (!menu || !Array.isArray(menu.plates)) {
    return [];
  }

  return menu.plates
    .map((plate) => normalizePlateLabel(plate))
    .filter(Boolean);
}

function buildGoogleCalendarUrl(request) {
  const startDate = request.date || new Date().toISOString().slice(0, 10);
  const startTime = request.eventTime || '19:00';
  const [hour, minute] = startTime.split(':').map(Number);
  const start = new Date(`${startDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const eventName = `${request.client || 'Client'} · ${request.style || 'Menu Request'}`;
  const eventDescription = [
    'ChefOps Planner request',
    `Client: ${request.client || 'Unknown client'}`,
    `Menu: ${request.style || 'Custom menu'}`,
    `Guests: ${request.guests || 0}`,
    `Price: $${request.price || 0}`,
    `Grocery: $${request.grocery || 0}`,
    request.allergies ? `Allergies: ${request.allergies}` : '',
  ].filter(Boolean).join('\n');

  const googleUrl = new URL('https://calendar.google.com/calendar/render');
  googleUrl.searchParams.set('action', 'TEMPLATE');
  googleUrl.searchParams.set('text', eventName);
  googleUrl.searchParams.set('details', eventDescription);
  googleUrl.searchParams.set('location', request.address || 'ChefOps event');
  googleUrl.searchParams.set('dates', `${formatGoogleDate(start)} / ${formatGoogleDate(end)}`);

  return googleUrl.toString();
}

function formatGoogleDate(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function renderMenus(items) {
  if (!menuList) {
    return;
  }

  if (!items.length) {
    menuList.innerHTML = `<div class="empty-list">No requests yet</div>`;
    return;
  }

  menuList.innerHTML = items.map((item) => {
    const profit = calculateProfit(item.price, item.grocery);
    return `<div class="menu-row-wrapper" data-request-row="${item.id}">
      <div class="menu-row" data-request-id="${item.id}">
        <div class="menu-row-main">
          <span class="menu-client">${item.client}</span>
          <span class="menu-detail">${item.style} · ${item.guests} guests · ${formatMenuDate(item.date)}</span>
        </div>
        <div class="menu-row-meta">
          <span class="menu-price">$${item.price}</span>
          <span class="menu-cost">Cost $${item.grocery}</span>
          <span class="menu-profit">Profit $${profit}</span>
        </div>
        <div class="menu-row-actions">
          <button class="row-action-button row-details-button" data-action="details" data-request-id="${item.id}">Details</button>
          <button class="row-action-button row-edit-button" data-action="edit" data-request-id="${item.id}">Edit</button>
          <button class="row-action-button row-delete-button" data-action="delete" data-request-id="${item.id}">Delete</button>
        </div>
      </div>
      <div class="request-details-card hidden" data-request-details-card="${item.id}">
        <div class="request-details-head">
          <span class="panel-kicker">Request Details</span>
          <button class="ghost-button small-button" data-close-details-button>Close</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderMenuPlatePreview(value) {
  if (!menuPlatePreview) {
    return;
  }

  const previewText = normalizePlateLabel(value || '');
  if (!previewText) {
    menuPlatePreview.innerHTML = `<span class="preview-empty">No plate yet</span>`;
    return;
  }

  menuPlatePreview.innerHTML = `<span class="menu-plate-chip">${previewText}</span>`;
}

function renderMenuLibrary() {
  if (!menuLibrary) {
    return;
  }

  const menus = getStoredMenus();
  if (!menus.length) {
    menuLibrary.innerHTML = `<div class="empty-list">No menus yet</div>`;
    return;
  }

  menuLibrary.innerHTML = menus.map((menu) => {
    const plateNames = Array.isArray(menu.plates)
      ? menu.plates.map((plate) => normalizePlateLabel(plate))
      : [];
    const plateCount = Number(menu.plateCount || plateNames.length || 0);
    return `<article class="menu-library-item" data-menu-id="${menu.id}">
      <div class="menu-library-top">
        <span class="menu-library-name">${menu.name}</span>
        <span class="menu-library-actions">
          <button class="row-action-button row-edit-button" data-menu-action="edit" data-menu-id="${menu.id}">Edit</button>
          <button class="row-action-button row-delete-button" data-menu-action="delete" data-menu-id="${menu.id}">Delete</button>
        </span>
      </div>
      <div class="menu-library-meta">
        <span class="menu-library-count">${plateCount} plates</span>
      </div>
      <div class="menu-library-plates">
        ${plateNames.map((plate) => `<span class="menu-plate-chip">${plate}</span>`).join('')}
      </div>
    </article>`;
  }).join('');
}

function syncMenuStyleOptions() {
  if (!menuStyle) {
    return;
  }

  const baseStyles = ['Seasonal Tasting', 'Vegetarian Menu', 'French Market', 'Private Dining'];
  const menus = getStoredMenus();
  const styles = Array.from(new Set([
    ...baseStyles,
    ...menus.map((menu) => menu.name)
  ]));

  const selected = menuStyle.value || baseStyles[0];
  menuStyle.innerHTML = '';

  styles.forEach((style) => {
    const option = new Option(style, style);
    menuStyle.add(option);
  });

  if (styles.includes(selected)) {
    menuStyle.value = selected;
  } else {
    menuStyle.value = styles[0];
  }
}

function renderTimeline(items) {
  if (!timeline) {
    return;
  }

  const sorted = [...items]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  if (!sorted.length) {
    timeline.innerHTML = `<div class="timeline-item empty-timeline"><span class="timeline-title">No events scheduled</span></div>`;
    return;
  }

  timeline.innerHTML = sorted.map((item) => {
    return `<div class="timeline-item">
      <span class="time">${formatMenuDate(item.date)}</span>
      <span class="timeline-line"></span>
      <div class="timeline-content">
        <span class="timeline-title">${item.style}</span>
        <span class="timeline-detail">${item.client} · ${item.guests} guests</span>
      </div>
    </div>`;
  }).join('');
}

function renderCalendar(items) {
  if (!calendarGrid) {
    return;
  }

  const source = items.length ? items : samples;
  const baseDate = source[0]?.date || '2026-09-01';
  const firstSelectedDate = new Date(baseDate + 'T00:00:00');
  const year = firstSelectedDate.getFullYear();
  const month = firstSelectedDate.getMonth();
  const monthName = firstSelectedDate.toLocaleString(undefined, { month: 'long' });

  if (calendarMonthTitle) {
    calendarMonthTitle.textContent = `${monthName} ${year}`;
  }

  const header = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cells = header.map((label) => `<div class="cal-head">${label}</div>`);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const previousMonth = new Date(year, month, 0);
  const daysInPreviousMonth = previousMonth.getDate();

  for (let i = 0; i < startOffset; i += 1) {
    const dayNumber = daysInPreviousMonth - startOffset + i + 1;
    cells.push(`<div class="cal-day muted-day"><span class="day-number">${dayNumber}</span></div>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = items.filter((item) => item.date === date);
    const dayChips = events.map((event, index) => {
      const palette = ['event-green', 'event-orange', 'event-blue', 'event-red'][index % 4];
      return `<span class="event-chip ${palette}">${event.style}</span>`;
    }).join('');

    cells.push(`<div class="cal-day"><span class="day-number">${day}</span>${dayChips}</div>`);
  }

  const totalCells = cells.length;
  const remainder = (7 - (totalCells % 7)) % 7;
  for (let day = 1; day <= remainder; day += 1) {
    cells.push(`<div class="cal-day muted-day"><span class="day-number">${day}</span></div>`);
  }

  calendarGrid.innerHTML = cells.join('');
}

function listGroceriesForStyle(style) {
  const groceries = {
    'French Market': ['Market produce', 'Dairy', 'Bistro sauce'],
    'Vegetarian Menu': ['Herbs', 'Root vegetables', 'Pulses'],
    'Seasonal Tasting': ['Seasonal greens', 'Chef sauces', 'Market herbs'],
    'Private Dining': ['Chef stocks', 'Fresh herbs', 'Service garnishes'],
  };

  return groceries[style] || ['Market produce', 'Kitchen herbs', 'Fresh sauces'];
}

function listChecklistForStyle(style) {
  const checklists = {
    'French Market': ['Market produce review', 'Sauce station', 'Plate finish'],
    'Vegetarian Menu': ['Vegetable prep', 'Herb sauce check', 'Vegetarian garnish'],
    'Seasonal Tasting': ['Produce check', 'Seasonal sauce', 'Final tasting'],
    'Private Dining': ['Station layout', 'Service timing', 'Guest setup'],
  };

  return checklists[style] || ['Ingredient check', 'Station setup', 'Service call'];
}

function updateChefWorkflow(items) {
  const focus = items.length ? items[0] : samples[0];
  const prepOrder = document.getElementById('prepOrder');
  const prepDetail = document.getElementById('prepDetail');
  const groceryList = document.getElementById('groceryList');
  const groceryDetail = document.getElementById('groceryDetail');
  const serviceMenu = document.getElementById('serviceMenu');
  const serviceDetail = document.getElementById('serviceDetail');
  const prepChecklist = document.getElementById('prepChecklist');
  const shoppingList = document.getElementById('shoppingList');

  const groceries = listGroceriesForStyle(focus.style);
  const checklist = listChecklistForStyle(focus.style);

  if (prepOrder) prepOrder.textContent = `01 · ${focus.style}`;
  if (prepDetail) prepDetail.textContent = `${focus.client} · ${focus.guests} guests`;
  if (groceryList) groceryList.textContent = groceries.join(' · ');
  if (groceryDetail) groceryDetail.textContent = `Budget $${focus.grocery || 0}`;
  if (serviceMenu) serviceMenu.textContent = focus.style;
  if (serviceDetail) serviceDetail.textContent = `${focus.guests} guests · ${formatMenuDate(focus.date)}`;
  if (prepChecklist) {
    prepChecklist.innerHTML = checklist
      .map((step) => `<li>${step}</li>`)
      .join('');
  }
  if (shoppingList) {
    shoppingList.innerHTML = groceries
      .map((item) => `<span class="shopping-item">${item}</span>`)
      .join('');
  }
}

function updateSummary(items) {
  const totalRevenue = items.reduce((sum, item) => sum + Number(item.price), 0);
  const totalCost = items.reduce((sum, item) => sum + Number(item.grocery), 0);
  const totalProfit = totalRevenue - totalCost;

  const requestCount = document.getElementById('requestCount');
  const eventsCount = document.getElementById('eventsCount');
  const groceryCost = document.getElementById('groceryCost');
  const profitTotal = document.getElementById('profitTotal');
  const profitBig = document.getElementById('profitBig');

  if (requestCount) requestCount.textContent = String(items.length);
  if (eventsCount) eventsCount.textContent = String(items.length).padStart(2, '0');
  if (groceryCost) groceryCost.textContent = '$' + totalCost.toFixed(2);
  if (profitTotal) profitTotal.textContent = '$' + totalProfit.toLocaleString();
  if (profitBig) profitBig.textContent = '$' + totalProfit.toLocaleString();
}

function fillFormForEdit(requestId) {
  const request = requests.find((item) => item.id === requestId);
  if (!request || !menuForm) {
    return;
  }

  document.getElementById('clientName').value = request.client;
  document.getElementById('menuStyle').value = request.style;
  document.getElementById('guestCount').value = request.guests;
  document.getElementById('eventDate').value = request.date;
  document.getElementById('menuPrice').value = request.price;
  document.getElementById('groceryCostInput').value = request.grocery;
  document.getElementById('allergiesInput').value = request.allergies || '';
  document.getElementById('clientAddressInput').value = request.address || '';
  document.getElementById('eventTimeInput').value = request.eventTime || '19:00';
  document.getElementById('requestPlatesInput').value = platesToArray(request.plates || getDefaultPlatesForStyle(request.style)).join(', ');

  menuForm.dataset.editingRequestId = request.id;
  if (submitButton) submitButton.textContent = 'Update Request';
  if (cancelEditButton) cancelEditButton.classList.remove('hidden');
}

function clearEditMode() {
  if (!menuForm) {
    return;
  }

  delete menuForm.dataset.editingRequestId;
  if (submitButton) submitButton.textContent = 'Save Request';
  if (cancelEditButton) cancelEditButton.classList.add('hidden');
}

let requests = [];

async function boot() {
  requests = await loadRequests();
  menus = await loadMenus();

  renderMenus(requests);
  renderTimeline(requests);
  renderCalendar(requests);
  updateSummary(requests);
  updateChefWorkflow(requests);
  renderMenuLibrary();
  syncMenuStyleOptions();
}

boot();

if (menuStyle && requestPlatesInput) {
  menuStyle.addEventListener('change', () => {
    const style = menuStyle.value;
    const defaultPlates = getDefaultPlatesForStyle(style);
    const requestBeingEdited = menuForm?.dataset?.editingRequestId;

    if (!requestBeingEdited) {
      requestPlatesInput.value = defaultPlates.join(', ');
    }
  });
}

if (addMenuButton) {
  addMenuButton.addEventListener('click', () => {
    if (menuForm) {
      menuForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    document.getElementById('clientName')?.focus();
  });
}

if (addMenuLibraryButton) {
  addMenuLibraryButton.addEventListener('click', () => {
    if (menuLibraryEditor) {
      menuLibraryEditor.classList.remove('hidden');
    }
    if (menuNameInput) {
      menuNameInput.value = '';
      menuNameInput.focus();
    }
    if (menuDescriptionInput) {
      menuDescriptionInput.value = '';
    }
    if (menuPlateNameInput) {
      menuPlateNameInput.value = '';
    }
    if (menuPlateDescriptionInput) {
      menuPlateDescriptionInput.value = '';
    }
    if (menuPlateCountInput) {
      menuPlateCountInput.value = '';
    }
    if (menuPlatePreview) {
      renderMenuPlatePreview('');
    }
    delete menuLibraryEditor.dataset.editingMenuId;
    if (saveMenuLibraryButton) {
      saveMenuLibraryButton.textContent = 'Save Menu';
    }
  });
}

function showRequestDetails(requestId) {
  const request = requests.find((item) => item.id === requestId);
  if (!request || !menuList) {
    return;
  }

  const wrapper = menuList.querySelector(`[data-request-row="${requestId}"]`);
  const detailsCard = wrapper?.querySelector(`[data-request-details-card="${requestId}"]`);
  if (!detailsCard) {
    return;
  }

  const plates = Array.isArray(request.plates) && request.plates.length
    ? request.plates
    : getDefaultPlatesForStyle(request.style);

  const googleCalendarUrl = buildGoogleCalendarUrl(request);

  menuList.querySelectorAll('[data-request-details-card]').forEach((card) => {
    card.classList.add('hidden');
  });

  detailsCard.innerHTML = `
    <div class="request-details-head">
      <span class="panel-kicker">Request Details</span>
      <button class="ghost-button small-button" data-close-details-button>Close</button>
    </div>
    <div class="request-details-grid">
      <div><span class="request-detail-label">Client</span><span class="request-detail-value">${request.client}</span></div>
      <div><span class="request-detail-label">Menu</span><span class="request-detail-value">${request.style}</span></div>
      <div><span class="request-detail-label">Guests</span><span class="request-detail-value">${request.guests}</span></div>
      <div><span class="request-detail-label">Event Date</span><span class="request-detail-value">${formatMenuDate(request.date)}</span></div>
      <div><span class="request-detail-label">Event Time</span><span class="request-detail-value">${request.eventTime || 'Not set'}</span></div>
      <div><span class="request-detail-label">Address</span><span class="request-detail-value">${request.address || 'Not set'}</span></div>
      <div><span class="request-detail-label">Allergies</span><span class="request-detail-value">${request.allergies || 'None'}</span></div>
      <div><span class="request-detail-label">Price</span><span class="request-detail-value">$${request.price}</span></div>
      <div><span class="request-detail-label">Grocery Cost</span><span class="request-detail-value">$${request.grocery}</span></div>
      <div class="request-detail-wide">
        <span class="request-detail-label">Plates</span>
        <span class="request-detail-value plates-detail">${plates.map((plate) => `<span class="menu-plate-chip">${plate}</span>`).join('')}</span>
      </div>
      <div class="request-detail-wide">
        <a class="google-calendar-link" href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer">
          <span class="calendar-link-icon">+ Google Calendar</span>
          <span>Book in Google Calendar</span>
        </a>
      </div>
    </div>
  `;

  const closeButton = detailsCard.querySelector('[data-close-details-button]');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      detailsCard.classList.add('hidden');
    });
  }

  detailsCard.classList.remove('hidden');
}

const navLinks = Array.from(document.querySelectorAll('.nav-link'));

navLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();

    const targetSelector = link.getAttribute('href');
    const target = targetSelector ? document.querySelector(targetSelector) : null;
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    navLinks.forEach((item) => item.classList.toggle('active', item === link));
  });
});

if (menuList) {
  menuList.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) {
      return;
    }

    const requestId = actionButton.dataset.requestId;
    const action = actionButton.dataset.action;

    if (action === 'details') {
      showRequestDetails(requestId);
      return;
    }

    if (action === 'delete') {
      requests = requests.filter((item) => item.id !== requestId);
      await saveRequests(requests);
      renderMenus(requests);
      renderTimeline(requests);
      renderCalendar(requests);
      updateSummary(requests);
      updateChefWorkflow(requests);
      if (menuForm?.dataset?.editingRequestId === requestId) {
        clearEditMode();
        menuForm.reset();
      }
      return;
    }

    if (action === 'edit') {
      fillFormForEdit(requestId);
    }
  });
}

if (menuPlateNameInput && menuPlatePreview) {
  menuPlateNameInput.addEventListener('input', () => {
    renderMenuPlatePreview(menuPlateNameInput.value);
  });
}

if (menuLibrary) {
  menuLibrary.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-menu-action]');
    if (!actionButton) {
      return;
    }

    const menuId = actionButton.dataset.menuId;
    const action = actionButton.dataset.menuAction;
    const sourceMenus = getStoredMenus();

    if (action === 'delete') {
      const nextMenus = sourceMenus.filter((menu) => menu.id !== menuId);
      menus = await saveMenus(nextMenus);
      renderMenuLibrary();
      syncMenuStyleOptions();
      return;
    }

    if (action === 'edit') {
      const target = sourceMenus.find((menu) => menu.id === menuId);
      if (!target || !menuLibraryEditor || !menuNameInput || !menuPlateNameInput || !menuPlateDescriptionInput || !saveMenuLibraryButton) {
        return;
      }
      const plate = Array.isArray(target.plates) && target.plates.length
        ? normalizePlateObject(target.plates[0])
        : { plateName: '', plateDescription: '' };

      menuLibraryEditor.dataset.editingMenuId = target.id;
      menuNameInput.value = target.name;
      menuDescriptionInput.value = target.description || '';
      menuPlateNameInput.value = plate.plateName;
      menuPlateDescriptionInput.value = plate.plateDescription;
      menuPlateCountInput.value = Number(target.plateCount || target.plates.length || 0);
      renderMenuPlatePreview(menuPlateNameInput.value);
      menuLibraryEditor.classList.remove('hidden');
      saveMenuLibraryButton.textContent = 'Update Menu';
      menuNameInput.focus();
    }
  });
}

if (saveMenuLibraryButton) {
  saveMenuLibraryButton.addEventListener('click', async () => {
    const sourceMenus = getStoredMenus();
    const existingId = menuLibraryEditor?.dataset?.editingMenuId;
    const name = menuNameInput.value.trim();
    const description = menuDescriptionInput?.value.trim() || '';
    const plateNameInput = menuPlateNameInput?.value.trim() || '';
    const plateDescription = menuPlateDescriptionInput?.value.trim() || '';
    const plateCount = Number(menuPlateCountInput?.value || 0);

    if (!name || !plateNameInput || plateCount < 0) {
      return;
    }

    const parsedPlateNames = platesToArray(plateNameInput);
    const plates = parsedPlateNames.length
      ? parsedPlateNames.map((plate, idx) => ({
          plateName: String(plate || '').trim(),
          plateDescription: idx === 0 ? plateDescription : '',
        }))
      : [{ plateName: '', plateDescription: '' }];

    const cleanPlates = plates.filter((plate) => plate.plateName);
    if (!cleanPlates.length) {
      return;
    }

    const nextMenus = [...sourceMenus];
    if (existingId) {
      const idx = nextMenus.findIndex((menu) => menu.id === existingId);
      if (idx >= 0) {
        nextMenus[idx] = { ...nextMenus[idx], name, description, plates: cleanPlates, plateCount };
      }
    } else {
      nextMenus.push({ id: 'menu-' + Date.now().toString(36), name, description, plates: cleanPlates, plateCount });
    }

    menus = await saveMenus(nextMenus);
    renderMenuLibrary();
    syncMenuStyleOptions();

    if (menuLibraryEditor) {
      menuLibraryEditor.classList.add('hidden');
    }
    if (menuNameInput) {
      menuNameInput.value = '';
    }
    if (menuDescriptionInput) {
      menuDescriptionInput.value = '';
    }
    if (menuPlateNameInput) {
      menuPlateNameInput.value = '';
    }
    if (menuPlateDescriptionInput) {
      menuPlateDescriptionInput.value = '';
    }
    if (menuPlateCountInput) {
      menuPlateCountInput.value = '';
    }
    if (menuPlatePreview) {
      renderMenuPlatePreview('');
    }
    delete menuLibraryEditor?.dataset.editingMenuId;
    if (saveMenuLibraryButton) {
      saveMenuLibraryButton.textContent = 'Save Menu';
    }
  });
}

if (cancelMenuEditButton) {
  cancelMenuEditButton.addEventListener('click', () => {
    if (menuLibraryEditor) {
      menuLibraryEditor.classList.add('hidden');
    }
    if (menuNameInput) {
      menuNameInput.value = '';
    }
    if (menuDescriptionInput) {
      menuDescriptionInput.value = '';
    }
    if (menuPlateNameInput) {
      menuPlateNameInput.value = '';
    }
    if (menuPlateDescriptionInput) {
      menuPlateDescriptionInput.value = '';
    }
    if (menuPlateCountInput) {
      menuPlateCountInput.value = '';
    }
    if (menuPlatePreview) {
      renderMenuPlatePreview('');
    }
    delete menuLibraryEditor?.dataset.editingMenuId;
    if (saveMenuLibraryButton) {
      saveMenuLibraryButton.textContent = 'Save Menu';
    }
  });
}

if (menuForm) {
  menuForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const client = document.getElementById('clientName').value.trim();
    const style = document.getElementById('menuStyle').value;
    const guests = Number(document.getElementById('guestCount').value);
    const date = document.getElementById('eventDate').value;
    const price = Number(document.getElementById('menuPrice').value);
    const grocery = Number(document.getElementById('groceryCostInput').value);
    const allergies = document.getElementById('allergiesInput').value.trim();
    const address = document.getElementById('clientAddressInput').value.trim();
    const eventTime = document.getElementById('eventTimeInput').value;
    const plates = platesToArray(requestPlatesInput?.value || getDefaultPlatesForStyle(style));

    if (!client || !style || !date || guests < 1 || price < 1 || grocery < 0) {
      return;
    }

    const existingRequestId = menuForm.dataset.editingRequestId;

    if (existingRequestId) {
      requests = requests.map((item) => item.id === existingRequestId
        ? { ...item, client, style, guests, date, price, grocery, allergies, address, eventTime, plates }
        : item
      );
    } else {
      const nextItem = {
        id: generateRequestId(),
        client,
        style,
        guests,
        date,
        price,
        grocery,
        allergies,
        address,
        eventTime,
        plates,
      };

      requests = [...requests, nextItem];
    }

    await saveRequests(requests);

    renderMenus(requests);
    renderTimeline(requests);
    renderCalendar(requests);
    updateSummary(requests);
    updateChefWorkflow(requests);
    menuForm.reset();
    clearEditMode();
  });
}

if (cancelEditButton) {
  cancelEditButton.addEventListener('click', () => {
    menuForm.reset();
    clearEditMode();
  });
}
