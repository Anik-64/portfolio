document.addEventListener('DOMContentLoaded', function() {
    const currencyTable = document.getElementById('currencyTable').getElementsByTagName('tbody')[0];
    const addCurrencyBtn = document.getElementById('addCurrencyBtn');
    const currencyModal = document.getElementById('currencyModal');
    const deleteModal = document.getElementById('deleteModal');
    const closeModal = document.getElementById('closeModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    const currencyForm = document.getElementById('currencyForm');
    const modalTitle = document.getElementById('modalTitle');
    const cidInput = document.getElementById('cid');
    const floatingMessage = document.getElementById('floatingMessage');
    const searchInput = document.getElementById('searchInput');
    let originalCurrencies = [];
    let currentCid = null;

    // Check if user is authenticated
    if (!localStorage.getItem('accessToken')) {
        window.location.href = '/login';
    }

    loadCurrencies();

    addCurrencyBtn.addEventListener('click', () => {
        currentCid = null;
        modalTitle.textContent = 'Add Currency';
        currencyForm.reset();
        cidInput.removeAttribute('readonly');
        currencyModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        currencyModal.classList.add('hidden');
    });

    closeDeleteModal.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
    });

    cancelDelete.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
    });

    searchInput.addEventListener('input', debounce(() => {
        const query = searchInput.value.trim().toLowerCase();
        if (query) {
            const filteredCurrencies = originalCurrencies.filter(currency => 
                currency.cid.toLowerCase().includes(query) || 
                currency.ctext.toLowerCase().includes(query)
            );
            renderCurrencies(filteredCurrencies);
        } else {
            renderCurrencies(originalCurrencies);
        }
    }, 500));

    currencyForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = {
            cid: cidInput.value.trim(),
            ctext: document.getElementById('ctext').value.trim()
        };

        if (!formData.cid || !formData.ctext) {
            showMessage('Currency ID and text are required', 'error');
            return;
        }

        if (currentCid) {
            updateCurrency(currentCid, { ctext: formData.ctext });
        } else {
            createCurrency(formData);
        }
    });

    confirmDelete.addEventListener('click', function() {
        if (currentCid) {
            deleteCurrency(currentCid);
        }
    });

    async function fetchWithToken(url, options = {}) {
        const accessToken = localStorage.getItem('accessToken');
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        };

        try {
            const response = await fetch(url, options);
            if (response.status === 401) {
                // Try to refresh token
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    options.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
                    return await fetch(url, options);
                } else {
                    window.location.href = '/login';
                    return null;
                }
            }
            return response;
        } catch (err) {
            console.error('Fetch error:', err);
            showMessage('An error occurred. Please try again.', 'error');
            return null;
        }
    }

    async function refreshAccessToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            return false;
        }

        try {
            const response = await fetch('/api/v1/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            const data = await response.json();
            if (data.error) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                return false;
            }
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            return true;
        } catch (err) {
            console.error('Refresh token error:', err);
            return false;
        }
    }

    async function loadCurrencies() {
        const response = await fetchWithToken('/api/v1/currency');
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            renderCurrencies([]);
            return;
        }
        originalCurrencies = data.data;
        renderCurrencies(data.data);
    }

    function renderCurrencies(currencies) {
        currencyTable.innerHTML = '';
        if (currencies.length === 0) {
            const row = currencyTable.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 3;
            cell.textContent = 'No currency data found';
            cell.className = 'text-center py-4 text-black';
            return;
        }

        currencies.forEach((currency, index) => {
            const row = currencyTable.insertRow();

            const idCell = row.insertCell(0);
            idCell.textContent = index + 1;
            idCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black id-column';
            idCell.setAttribute('data-label', 'ID');

            const cidCell = row.insertCell(1);
            cidCell.textContent = currency.cid;
            cidCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black cid-column';
            cidCell.setAttribute('data-label', 'Currency ID');

            const ctextCell = row.insertCell(2);
            ctextCell.textContent = currency.ctext;
            ctextCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black ctext-column';
            ctextCell.setAttribute('data-label', 'Currency Text');

            const actionsCell = row.insertCell(3);
            actionsCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black';
            actionsCell.setAttribute('data-label', 'Actions');

            const actionButtons = document.createElement('div');
            actionButtons.className = 'action-buttons';
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.className = 'action-btn bg-yellow-500 hover:bg-yellow-600 text-white rounded';
            editBtn.addEventListener('click', () => editCurrency(currency.cid));

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';


            deleteBtn.className = 'action-btn bg-red-500 hover:bg-red-600 text-white rounded';
            deleteBtn.addEventListener('click', () => confirmDeleteCurrency(currency.cid));

            actionButtons.appendChild(editBtn);
            actionButtons.appendChild(deleteBtn);
            actionsCell.appendChild(actionButtons);
        });
    }

    async function createCurrency(currencyData) {
        const response = await fetchWithToken('/api/v1/currency', {
            method: 'POST',
            body: JSON.stringify(currencyData)
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        showMessage('Currency created successfully', 'success');
        currencyModal.classList.add('hidden');
        loadCurrencies();
    }

    async function editCurrency(cid) {
        const response = await fetchWithToken(`/api/v1/currency/${cid}`);
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        const currencyData = data.data;
        currentCid = cid;
        modalTitle.textContent = 'Edit Currency';
        cidInput.value = currencyData.cid || '';
        cidInput.setAttribute('readonly', 'true');
        document.getElementById('ctext').value = currencyData.ctext || '';
        currencyModal.classList.remove('hidden');
    }

    async function updateCurrency(cid, currencyData) {
        const response = await fetchWithToken(`/api/v1/currency/${cid}`, {
            method: 'PUT',
            body: JSON.stringify(currencyData)
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        showMessage('Currency updated successfully', 'success');
        currencyModal.classList.add('hidden');
        loadCurrencies();
    }

    function confirmDeleteCurrency(cid) {
        currentCid = cid;
        deleteModal.classList.remove('hidden');
    }

    async function deleteCurrency(cid) {
        const response = await fetchWithToken(`/api/v1/currency/${cid}`, {
            method: 'DELETE'
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        showMessage('Currency deleted successfully', 'success');
        deleteModal.classList.add('hidden');
        loadCurrencies();
    }

    function showMessage(message, type) {
        floatingMessage.textContent = message;
        floatingMessage.className = `floating-message ${type} show`;
        setTimeout(() => {
            floatingMessage.classList.remove('show');
            setTimeout(() => {
                floatingMessage.textContent = '';
                floatingMessage.className = 'floating-message';
            }, 300);
        }, 3000);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});