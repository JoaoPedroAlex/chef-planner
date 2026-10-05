const menuForm = document.getElementById('menuForm');
const menuList = document.getElementById('menuList');
const submitButton = document.getElementById('saveMenuButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const timeline = document.getElementById('timeline');
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthTitle = document.querySelector('.month-title');
const addRequestButtons = document.querySelectorAll('#addRequestButton, [data-add-request-button]');
const resetRequestsButton = document.getElementById('resetRequestsButton');
const addToGoogleCalendarInput = document.getElementById('addToGoogleCalendarInput');
const menuDocumentInput = document.getElementById('menuDocumentInput');
const menuDocumentStatus = document.getElementById('menuDocumentStatus');
const removeMenuDocumentButton = document.getElementById('removeMenuDocumentButton');
const storageKey = 'chefops.planner.requests';
const attachmentDatabaseName = 'chefops.planner.attachments';
const attachmentStoreName = 'requestAttachments';
const maxAttachmentSize = 20 * 1024 * 1024;

function generateRequestId() {
  return 'request-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

async function loadRequests() {
  const savedRequests = localStorage.getItem(storageKey);

  if (!savedRequests) {
    localStorage.setItem(storageKey, '[]');
    return [];
  }

  try {
    const parsed = JSON.parse(savedRequests);
    if (!Array.isArray(parsed)) {
      throw new Error('Saved requests are not an array.');
    }

    return parsed.map((item) => ({
      ...item,
      id: item.id || generateRequestId(),
      guests: Number(item.guests || 0),
      price: Number(item.price || 0),
      grocery: Number(item.grocery || 0),
      date: item.date || new Date().toISOString().slice(0, 10),
      allergies: item.allergies || '',
      address: item.address || '',
      eventTime: item.eventTime || '',
    }));
  } catch (error) {
    console.warn('Unable to read requests from localStorage. Starting with an empty planner.', error);
    localStorage.setItem(storageKey, '[]');
    return [];
  }
}

async function saveRequests(items) {
  const normalized = Array.isArray(items) ? items : [];
  localStorage.setItem(storageKey, JSON.stringify(normalized));
  return normalized;
}

function openAttachmentDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('File storage is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(attachmentDatabaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(attachmentStoreName)) {
        database.createObjectStore(attachmentStoreName, { keyPath: 'requestId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open file storage.'));
  });
}

async function saveRequestAttachment(requestId, file) {
  const database = await openAttachmentDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(attachmentStoreName, 'readwrite');
    transaction.objectStore(attachmentStoreName).put({
      requestId,
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      updatedAt: new Date().toISOString(),
    });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Unable to save the menu document.'));
    };
  });
}

async function getRequestAttachment(requestId) {
  const database = await openAttachmentDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(attachmentStoreName, 'readonly');
    const request = transaction.objectStore(attachmentStoreName).get(requestId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Unable to read the menu document.'));
    transaction.oncomplete = () => database.close();
  });
}

async function deleteRequestAttachment(requestId) {
  const database = await openAttachmentDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(attachmentStoreName, 'readwrite');
    transaction.objectStore(attachmentStoreName).delete(requestId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Unable to delete the menu document.'));
    };
  });
}

async function clearRequestAttachments() {
  const database = await openAttachmentDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(attachmentStoreName, 'readwrite');
    transaction.objectStore(attachmentStoreName).clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Unable to clear menu documents.'));
    };
  });
}

function isSupportedMenuDocument(file) {
  const supportedDocumentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  return file.type.startsWith('image/')
    || supportedDocumentTypes.includes(file.type)
    || /\.(pdf|doc|docx)$/i.test(file.name);
}

function formatFileSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function resetMenuDocumentUi() {
  if (menuDocumentInput) {
    menuDocumentInput.value = '';
    delete menuDocumentInput.dataset.removeExistingAttachment;
  }
  if (menuDocumentStatus) menuDocumentStatus.textContent = 'No menu document attached';
  if (removeMenuDocumentButton) removeMenuDocumentButton.classList.add('hidden');
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

function formatLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]);
}

function buildGoogleCalendarUrl(request) {
  const startDate = request.date || new Date().toISOString().slice(0, 10);
  const startTime = request.eventTime || '19:00';
  const [hour, minute] = startTime.split(':').map(Number);
  const start = new Date(`${startDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const eventName = `${request.client || 'Client'} · ${request.style || 'Client Request'}`;
  const eventDescription = [
    'ChefOps Planner request',
    `Client: ${request.client || 'Unknown client'}`,
    `Request: ${request.style || 'Private event'}`,
    `Guests: ${request.guests || 0}`,
    request.attachment?.name ? `Menu document in ChefOps: ${request.attachment.name}` : '',
    `Price: €${request.price || 0}`,
    `Grocery: €${request.grocery || 0}`,
    request.allergies ? `Allergies: ${request.allergies}` : '',
  ].filter(Boolean).join('\n');

  const googleUrl = new URL('https://calendar.google.com/calendar/render');
  googleUrl.searchParams.set('action', 'TEMPLATE');
  googleUrl.searchParams.set('text', eventName);
  googleUrl.searchParams.set('details', eventDescription);
  googleUrl.searchParams.set('location', request.address || 'ChefOps event');
  googleUrl.searchParams.set('dates', `${formatGoogleDate(start)}/${formatGoogleDate(end)}`);

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
          <span class="menu-price">€${item.price}</span>
          <span class="menu-cost">Cost €${item.grocery}</span>
          <span class="menu-profit">Profit €${profit}</span>
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
        <span class="timeline-title">${item.client || 'Client'}</span>
        <span class="timeline-detail">${item.style || 'Private event'} · ${item.guests} guests</span>
      </div>
    </div>`;
  }).join('');
}

function renderCalendar(items) {
  if (!calendarGrid) {
    return;
  }

  const baseDate = items[0]?.date || formatLocalDateKey(new Date());
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
      return `<button type="button" class="event-chip ${palette}" data-calendar-request-id="${escapeHtml(event.id)}" aria-label="View request details for ${escapeHtml(event.client || 'client')}">${escapeHtml(event.client || 'Client')}</button>`;
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

function updateSummary(items) {
  const totalRevenue = items.reduce((sum, item) => sum + Number(item.price), 0);
  const totalCost = items.reduce((sum, item) => sum + Number(item.grocery), 0);
  const totalProfit = totalRevenue - totalCost;

  const requestCount = document.getElementById('requestCount');
  const eventsCount = document.getElementById('eventsCount');
  const groceryCost = document.getElementById('groceryCost');
  const profitTotal = document.getElementById('profitTotal');
  const profitBig = document.getElementById('profitBig');
  const todayDate = document.getElementById('todayDate');
  const todayEventsText = document.getElementById('todayEventsText');
  const weeklyEventsText = document.getElementById('weeklyEventsText');
  const requestSummaryText = document.getElementById('requestSummaryText');
  const profitSummaryText = document.getElementById('profitSummaryText');

  const now = new Date();
  const todayKey = formatLocalDateKey(now);
  const todayEventCount = items.filter((item) => item.date === todayKey).length;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const weekStartKey = formatLocalDateKey(weekStart);
  const nextWeekStartKey = formatLocalDateKey(nextWeekStart);
  const weeklyEventCount = items.filter((item) => (
    item.date >= weekStartKey && item.date < nextWeekStartKey
  )).length;

  if (requestCount) requestCount.textContent = String(items.length);
  if (eventsCount) eventsCount.textContent = String(items.length).padStart(2, '0');
  if (groceryCost) groceryCost.textContent = '€' + totalCost.toFixed(2);
  if (profitTotal) profitTotal.textContent = '€' + totalProfit.toLocaleString();
  if (profitBig) profitBig.textContent = '€' + totalProfit.toLocaleString();
  if (todayDate) {
    todayDate.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }
  if (todayEventsText) {
    const eventLabel = todayEventCount === 1 ? 'event' : 'events';
    todayEventsText.textContent = `${todayEventCount} ${eventLabel} scheduled`;
  }
  if (weeklyEventsText) {
    weeklyEventsText.textContent = `${weeklyEventCount} this week`;
    weeklyEventsText.classList.toggle('positive', weeklyEventCount > 0);
  }
  if (requestSummaryText) {
    requestSummaryText.textContent = items.length === 0
      ? 'No requests'
      : `${items.length} saved ${items.length === 1 ? 'request' : 'requests'}`;
    requestSummaryText.classList.toggle('positive', items.length > 0);
  }
  if (profitSummaryText) {
    profitSummaryText.classList.remove('positive', 'warning');

    if (totalRevenue === 0) {
      profitSummaryText.textContent = 'No profit recorded';
    } else {
      const margin = totalProfit / totalRevenue;
      const formattedMargin = new Intl.NumberFormat(undefined, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(margin);
      profitSummaryText.textContent = `${formattedMargin} margin`;
      profitSummaryText.classList.add(totalProfit >= 0 ? 'positive' : 'warning');
    }
  }
}

function fillFormForEdit(requestId) {
  const request = requests.find((item) => item.id === requestId);
  if (!request || !menuForm) {
    return;
  }

  document.getElementById('clientName').value = request.client;
  document.getElementById('requestTitle').value = request.style || '';
  document.getElementById('guestCount').value = request.guests;
  document.getElementById('eventDate').value = request.date;
  document.getElementById('menuPrice').value = request.price;
  document.getElementById('groceryCostInput').value = request.grocery;
  document.getElementById('allergiesInput').value = request.allergies || '';
  document.getElementById('clientAddressInput').value = request.address || '';
  document.getElementById('eventTimeInput').value = request.eventTime || '19:00';
  if (menuDocumentInput) {
    menuDocumentInput.value = '';
    delete menuDocumentInput.dataset.removeExistingAttachment;
  }
  if (request.attachment && menuDocumentStatus) {
    menuDocumentStatus.textContent = `Attached: ${request.attachment.name} (${formatFileSize(request.attachment.size || 0)})`;
  } else if (menuDocumentStatus) {
    menuDocumentStatus.textContent = 'No menu document attached';
  }
  if (removeMenuDocumentButton) {
    removeMenuDocumentButton.classList.toggle('hidden', !request.attachment);
  }

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
  resetMenuDocumentUi();
}

const backupDateStorageKey = 'chefops.lastBackupDate';

function renderBackupBanner() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard) {
    return;
  }

  document.getElementById('backupReminderBanner')?.remove();

  const banner = document.createElement('div');
  banner.id = 'backupReminderBanner';
  banner.setAttribute('role', 'status');
  banner.style.cssText = [
    'grid-column: 1 / -1',
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'gap: 16px',
    'padding: 14px 16px',
    'border-radius: 14px',
    'font-weight: 600',
    'box-sizing: border-box'
  ].join(';');

  const lastBackupValue = localStorage.getItem(backupDateStorageKey);
  const lastBackupDate = lastBackupValue ? new Date(lastBackupValue) : null;
  const validLastBackup = lastBackupDate && !Number.isNaN(lastBackupDate.getTime());
  const daysSinceBackup = validLastBackup
    ? Math.max(0, Math.floor((Date.now() - lastBackupDate.getTime()) / 86400000))
    : null;

  const message = document.createElement('span');
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'primary-button small-button';
  exportButton.textContent = 'Export Backup';
  exportButton.addEventListener('click', exportBackup);

  if (!validLastBackup) {
    banner.style.background = '#fff4d6';
    banner.style.color = '#6f5200';
    banner.style.border = '1px solid #f0d98c';
    message.textContent = 'No backup has been created yet. Protect the client requests by exporting a backup.';
    banner.append(message, exportButton);
  } else if (daysSinceBackup >= 14) {
    banner.style.background = '#fff4d6';
    banner.style.color = '#6f5200';
    banner.style.border = '1px solid #f0d98c';
    message.textContent = `Last backup was ${daysSinceBackup} days ago (${lastBackupDate.toLocaleString()}).`;
    banner.append(message, exportButton);
  } else {
    banner.style.background = '#e9f8ef';
    banner.style.color = '#256c3d';
    banner.style.border = '1px solid #a7dfb6';
    message.textContent = `Backup is current. Last export: ${lastBackupDate.toLocaleString()}.`;
    banner.append(message);
  }

  dashboard.prepend(banner);
}

function exportBackup() {
  const backup = {
    app: 'ChefOps Planner',
    version: 1,
    exportedAt: new Date().toISOString(),
    requests: JSON.parse(localStorage.getItem(storageKey) || '[]'),
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `chefops-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(url);

  localStorage.setItem(backupDateStorageKey, backup.exportedAt);
  renderBackupBanner();
}

async function importBackupFile(file) {
  const text = await file.text();
  const backup = JSON.parse(text);

  if (!backup || !Array.isArray(backup.requests)) {
    throw new Error('This is not a valid ChefOps backup file.');
  }

  localStorage.setItem(storageKey, JSON.stringify(backup.requests));

  const importedDate = backup.exportedAt && !Number.isNaN(new Date(backup.exportedAt).getTime())
    ? backup.exportedAt
    : new Date().toISOString();
  localStorage.setItem(backupDateStorageKey, importedDate);
  window.location.reload();
}

function initializeBackupControls() {
  if (document.getElementById('exportBackupButton')) {
    return;
  }

  const target = document.querySelector('.topbar-actions');
  if (!target) {
    renderBackupBanner();
    return;
  }

  const exportButton = document.createElement('button');
  exportButton.id = 'exportBackupButton';
  exportButton.type = 'button';
  exportButton.className = 'ghost-button';
  exportButton.textContent = 'Export Backup';
  exportButton.addEventListener('click', exportBackup);

  const importButton = document.createElement('button');
  importButton.id = 'importBackupButton';
  importButton.type = 'button';
  importButton.className = 'ghost-button';
  importButton.textContent = 'Import Backup';

  const fileInput = document.createElement('input');
  fileInput.id = 'importBackupInput';
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;

  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      await importBackupFile(file);
    } catch (error) {
      console.error('Unable to import ChefOps backup.', error);
      window.alert(error.message || 'Unable to import the selected backup file.');
      fileInput.value = '';
    }
  });

  target.prepend(importButton);
  target.prepend(exportButton);
  target.appendChild(fileInput);
  renderBackupBanner();
}

let requests = [];

async function boot() {
  requests = await loadRequests();

  renderMenus(requests);
  renderTimeline(requests);
  renderCalendar(requests);
  updateSummary(requests);
  initializeBackupControls();
}

boot();

addRequestButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (menuForm) {
      menuForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    document.getElementById('clientName')?.focus();
  });
});

async function openRequestAttachment(requestId) {
  try {
    const attachment = await getRequestAttachment(requestId);
    if (!attachment?.file) {
      window.alert('This menu document is not available on this device. Attach it again by editing the request.');
      return;
    }

    const fileUrl = URL.createObjectURL(attachment.file);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.rel = 'noopener noreferrer';
    const canPreview = attachment.type === 'application/pdf' || attachment.type?.startsWith('image/');
    if (canPreview) {
      link.target = '_blank';
    } else {
      link.download = attachment.name || 'menu-document';
    }
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
  } catch (error) {
    console.error('Unable to open menu document.', error);
    window.alert('Unable to open the attached menu document on this device.');
  }
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
      <div><span class="request-detail-label">Event / Request</span><span class="request-detail-value">${request.style || 'Not set'}</span></div>
      <div><span class="request-detail-label">Guests</span><span class="request-detail-value">${request.guests}</span></div>
      <div><span class="request-detail-label">Event Date</span><span class="request-detail-value">${formatMenuDate(request.date)}</span></div>
      <div><span class="request-detail-label">Event Time</span><span class="request-detail-value">${request.eventTime || 'Not set'}</span></div>
      <div><span class="request-detail-label">Address</span><span class="request-detail-value">${request.address || 'Not set'}</span></div>
      <div><span class="request-detail-label">Allergies</span><span class="request-detail-value">${request.allergies || 'None'}</span></div>
      <div><span class="request-detail-label">Price</span><span class="request-detail-value">€${request.price}</span></div>
      <div><span class="request-detail-label">Grocery Cost</span><span class="request-detail-value">€${request.grocery}</span></div>
      ${request.attachment ? `<div class="request-detail-wide">
        <span class="request-detail-label">Menu Document</span>
        <button type="button" class="attachment-open-button" data-open-request-attachment>
          ${escapeHtml(request.attachment.name)} · ${formatFileSize(request.attachment.size || 0)}
        </button>
      </div>` : ''}
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

  detailsCard.querySelector('[data-open-request-attachment]')?.addEventListener('click', () => {
    openRequestAttachment(requestId);
  });

  detailsCard.classList.remove('hidden');
}

if (calendarGrid) {
  calendarGrid.addEventListener('click', (event) => {
    const calendarEntry = event.target.closest('[data-calendar-request-id]');
    if (!calendarEntry) {
      return;
    }

    const requestId = calendarEntry.dataset.calendarRequestId;
    showRequestDetails(requestId);

    const requestRow = Array.from(menuList?.querySelectorAll('[data-request-row]') || [])
      .find((row) => row.dataset.requestRow === requestId);
    requestRow?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
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

if (resetRequestsButton) {
  resetRequestsButton.addEventListener('click', async () => {
    if (!requests.length) {
      window.alert('The planner is already empty.');
      return;
    }

    const confirmed = window.confirm(
      'Delete all scheduled requests and their attached menu documents from this device? This resets events, grocery costs, and profit to zero.'
    );
    if (!confirmed) {
      return;
    }

    requests = [];
    await saveRequests(requests);
    try {
      await clearRequestAttachments();
    } catch (error) {
      console.warn('Requests were reset, but attached files could not be cleared.', error);
    }
    renderMenus(requests);
    renderTimeline(requests);
    renderCalendar(requests);
    updateSummary(requests);
    clearEditMode();
    menuForm?.reset();
  });
}

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
      try {
        await deleteRequestAttachment(requestId);
      } catch (error) {
        console.warn('Request deleted, but its attached file could not be cleared.', error);
      }
      renderMenus(requests);
      renderTimeline(requests);
      renderCalendar(requests);
      updateSummary(requests);
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

if (menuDocumentInput) {
  menuDocumentInput.addEventListener('change', () => {
    const file = menuDocumentInput.files?.[0];
    if (!file) return;

    if (!isSupportedMenuDocument(file)) {
      window.alert('Choose a picture, PDF, DOC, or DOCX file.');
      menuDocumentInput.value = '';
      return;
    }
    if (file.size > maxAttachmentSize) {
      window.alert('The menu document must be 20 MB or smaller.');
      menuDocumentInput.value = '';
      return;
    }

    delete menuDocumentInput.dataset.removeExistingAttachment;
    if (menuDocumentStatus) {
      menuDocumentStatus.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
    }
    removeMenuDocumentButton?.classList.remove('hidden');
  });
}

if (removeMenuDocumentButton) {
  removeMenuDocumentButton.addEventListener('click', () => {
    const editingRequest = requests.find((item) => item.id === menuForm?.dataset?.editingRequestId);

    if (menuDocumentInput?.files?.length) {
      menuDocumentInput.value = '';
      if (editingRequest?.attachment) {
        if (menuDocumentStatus) {
          menuDocumentStatus.textContent = `Attached: ${editingRequest.attachment.name} (${formatFileSize(editingRequest.attachment.size || 0)})`;
        }
        return;
      }
    } else if (editingRequest?.attachment && menuDocumentInput) {
      menuDocumentInput.dataset.removeExistingAttachment = 'true';
      if (menuDocumentStatus) menuDocumentStatus.textContent = 'Menu document will be removed when the request is updated';
    } else if (menuDocumentStatus) {
      menuDocumentStatus.textContent = 'No menu document attached';
    }

    removeMenuDocumentButton.classList.add('hidden');
  });
}

if (menuForm) {
  menuForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const client = document.getElementById('clientName').value.trim();
    const style = document.getElementById('requestTitle').value.trim();
    const guests = Number(document.getElementById('guestCount').value);
    const date = document.getElementById('eventDate').value;
    const price = Number(document.getElementById('menuPrice').value);
    const grocery = Number(document.getElementById('groceryCostInput').value);
    const allergies = document.getElementById('allergiesInput').value.trim();
    const address = document.getElementById('clientAddressInput').value.trim();
    const eventTime = document.getElementById('eventTimeInput').value;
    if (!client || !style || !date || guests < 1 || price < 1 || grocery < 0) {
      return;
    }

    const existingRequestId = menuForm.dataset.editingRequestId;
    const existingRequest = requests.find((item) => item.id === existingRequestId);
    const selectedAttachment = menuDocumentInput?.files?.[0] || null;
    const removeExistingAttachment = menuDocumentInput?.dataset.removeExistingAttachment === 'true';
    const attachment = selectedAttachment
      ? { name: selectedAttachment.name, type: selectedAttachment.type, size: selectedAttachment.size }
      : removeExistingAttachment
        ? null
        : existingRequest?.attachment || null;
    let savedRequest;

    if (existingRequestId) {
      requests = requests.map((item) => item.id === existingRequestId
        ? { ...item, client, style, guests, date, price, grocery, allergies, address, eventTime, attachment }
        : item
      );
      savedRequest = requests.find((item) => item.id === existingRequestId);
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
        attachment,
      };

      requests = [...requests, nextItem];
      savedRequest = nextItem;
    }

    const saveOperation = saveRequests(requests);
    const shouldOpenGoogleCalendar = !existingRequestId && addToGoogleCalendarInput?.checked;
    if (shouldOpenGoogleCalendar && savedRequest) {
      const calendarWindow = window.open(
        buildGoogleCalendarUrl(savedRequest),
        '_blank'
      );
      if (calendarWindow) {
        calendarWindow.opener = null;
      } else {
        window.alert('The request was saved, but the Google Calendar window was blocked. Open the request Details and tap Book in Google Calendar.');
      }
    }

    await saveOperation;

    try {
      if (selectedAttachment && savedRequest) {
        await saveRequestAttachment(savedRequest.id, selectedAttachment);
      } else if (removeExistingAttachment && savedRequest) {
        await deleteRequestAttachment(savedRequest.id);
      }
    } catch (error) {
      console.error('Unable to save the menu document.', error);
      if (selectedAttachment && savedRequest) {
        requests = requests.map((item) => item.id === savedRequest.id ? { ...item, attachment: null } : item);
        await saveRequests(requests);
      }
      window.alert('The request was saved, but the menu document could not be stored on this device.');
    }

    renderMenus(requests);
    renderTimeline(requests);
    renderCalendar(requests);
    updateSummary(requests);
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
