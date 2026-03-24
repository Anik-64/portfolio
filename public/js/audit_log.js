document.addEventListener('DOMContentLoaded', function() {
    const dataTable = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
    const oldDataModal = document.getElementById('oldDataModal');
    const newDataModal = document.getElementById('newDataModal');
    const closeOldDataModal = document.getElementById('closeOldDataModal');
    const closeNewDataModal = document.getElementById('closeNewDataModal');
    const oldDataContent = document.getElementById('oldDataContent');
    const newDataContent = document.getElementById('newDataContent');
    const floatingMessage = document.getElementById('floatingMessage');
    const searchInput = document.getElementById('searchInput');

    let originalData = [];

    if (!localStorage.getItem('accessToken')) {
        window.location.href = '/login';
    }

    loadData();

    closeOldDataModal.addEventListener('click', () => oldDataModal.classList.add('hidden'));
    closeNewDataModal.addEventListener('click', () => newDataModal.classList.add('hidden'));

    searchInput.addEventListener('input', debounce(() => {
        const query = searchInput.value.trim().toLowerCase();
        if (query) {
            const filtered = originalData.filter(item => 
                (item.action || '').toLowerCase().includes(query) || 
                (item.table_name || '').toLowerCase().includes(query) ||
                (item.user_id && item.user_id.toString().includes(query))
            );
            renderData(filtered);
        } else {
            renderData(originalData);
        }
    }, 500));

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
        if (!refreshToken) return false;

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

    async function loadData() {
        // We'll limit to a recent number to not overload the frontend, backend can implement pagination later if needed.
        const response = await fetchWithToken('/api/v1/settings/audit-log');
        if (!response) return;

        if(response.status === 404) {
             renderData([]);
             return;
        }

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            renderData([]);
            return;
        }
        originalData = data.data;
        renderData(data.data);
    }

    function renderData(items) {
        dataTable.innerHTML = '';
        if (!items || items.length === 0) {
            const row = dataTable.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 8;
            cell.textContent = 'No audit logs found';
            cell.className = 'text-center py-4 text-black';
            return;
        }

        items.forEach((item, index) => {
            const row = dataTable.insertRow();

            const idCell = row.insertCell(0);
            idCell.textContent = item.id;
            idCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-500';
            
            const userCell = row.insertCell(1);
            userCell.textContent = item.user_id || 'System';
            userCell.className = 'px-4 py-2 whitespace-nowrap text-sm font-medium text-black';
            
            const actionCell = row.insertCell(2);
            let actionColor = 'text-gray-600';
            if(item.action === 'INSERT') actionColor = 'text-green-600 font-bold';
            if(item.action === 'UPDATE') actionColor = 'text-yellow-600 font-bold';
            if(item.action === 'DELETE') actionColor = 'text-red-600 font-bold';
            
            actionCell.innerHTML = `<span class="${actionColor}">${item.action}</span>`;
            actionCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';

            const tableCell = row.insertCell(3);
            tableCell.textContent = item.table_name;
            tableCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600 font-mono';

            const recCell = row.insertCell(4);
            recCell.textContent = item.record_id || '-';
            recCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';

            const tsCell = row.insertCell(5);
            tsCell.textContent = new Date(item.created_at).toLocaleString();
            tsCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';

            const oldCell = row.insertCell(6);
            oldCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-right';
            if (item.old_data && Object.keys(item.old_data).length > 0) {
                const btn = document.createElement('button');
                btn.className = 'bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded text-xs';
                btn.textContent = 'View Old';
                btn.onclick = () => showOldData(item.old_data);
                oldCell.appendChild(btn);
            } else {
                oldCell.textContent = '-';
            }

            const newCell = row.insertCell(7);
            newCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-right';
            if (item.new_data && Object.keys(item.new_data).length > 0) {
                const btn = document.createElement('button');
                btn.className = 'bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs';
                btn.textContent = 'View New';
                btn.onclick = () => showNewData(item.new_data);
                newCell.appendChild(btn);
            } else {
                newCell.textContent = '-';
            }
        });
    }

    function showOldData(data) {
        oldDataContent.textContent = JSON.stringify(data, null, 2);
        oldDataModal.classList.remove('hidden');
    }

    function showNewData(data) {
        newDataContent.textContent = JSON.stringify(data, null, 2);
        newDataModal.classList.remove('hidden');
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
